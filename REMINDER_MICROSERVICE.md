# 🔔 Notification Cron Microservice
### For QueueLess (Lineo) — Appointment + Live Queue Push Notifications in Go

---

## 📋 Overview

This document covers **two notification systems** in one microservice:
1. **Appointment Reminders** — 7 stages (days/hours before a booked appointment)
2. **Live Queue Reminders** — 5 stages (based on estimated wait time in a live queue)

Both use Firebase Cloud Messaging (FCM) and integrate with your PostgreSQL (Neon) + Redis stack.

---

## 🚶 Live Queue Notification System (5 Stages)

When a user joins the live queue, the system monitors their **estimated wait time (EWT)** via Redis and fires push notifications at these thresholds:

| Stage | EWT Threshold | Cron Frequency | Push Notification |
|-------|--------------|----------------|-------------------|
| **Q1** | ~2 hours remaining | Every 10 min | "🕐 You're in the queue at [Org]! Estimated wait: ~2 hours." |
| **Q2** | ~1 hour remaining | Every 10 min | "⏳ 1 hour left in your queue at [Org]. Stay close!" |
| **Q3** | ~30 minutes remaining | Every 5 min | "🔔 You're getting close! ~30 min wait at [Org]." |
| **Q4** | ~15 minutes remaining | Every 2 min | "⚠️ Only 15 minutes left! Head to [Org] now." |
| **Q5** | ~5 minutes remaining | Every 1 min | "🚨 You're almost up! Get to the counter NOW at [Org]!" |

### How the Queue EWT Works

Your existing system already has Redis ZSets for queue position. The queue reminder service:

1. **Every cron tick** — fetches all active queue tickets from Redis
2. **Calculates EWT** — `position × avg_service_time_per_person`
3. **Checks threshold** — if EWT falls into one of the 5 windows
4. **Checks Redis dedup key** — `queue_notif:{ticket_id}:stage:{Q}` (expires after 20 min)
5. **Fires FCM push** — only if not already sent for this stage

### Queue Reminder Code

#### `internal/queue_reminder/service.go`

```go
package queue_reminder

import (
    "context"
    "fmt"
    "log"
    "time"

    "github.com/redis/go-redis/v9"
    "your-module/internal/fcm"
)

// QueueStage defines a threshold window for queue notifications
type QueueStage struct {
    Stage       string        // "Q1" through "Q5"
    MinWait     time.Duration // Lower bound of EWT window
    MaxWait     time.Duration // Upper bound of EWT window
    Title       string
    BodyTemplate string
    DedupeExpiry time.Duration // How long to block re-sending this stage
}

var QueueStages = []QueueStage{
    {
        Stage:        "Q1",
        MinWait:      90 * time.Minute,
        MaxWait:      150 * time.Minute,
        Title:        "🕐 You're in the Queue!",
        BodyTemplate: "Estimated wait at %s is ~2 hours. We'll keep you updated!",
        DedupeExpiry: 30 * time.Minute,
    },
    {
        Stage:        "Q2",
        MinWait:      45 * time.Minute,
        MaxWait:      90 * time.Minute,
        Title:        "⏳ 1 Hour Left",
        BodyTemplate: "About 1 hour wait remaining at %s. Stay nearby!",
        DedupeExpiry: 20 * time.Minute,
    },
    {
        Stage:        "Q3",
        MinWait:      20 * time.Minute,
        MaxWait:      45 * time.Minute,
        Title:        "🔔 30 Minutes Left!",
        BodyTemplate: "You're getting close! ~30 min wait at %s.",
        DedupeExpiry: 10 * time.Minute,
    },
    {
        Stage:        "Q4",
        MinWait:      8 * time.Minute,
        MaxWait:      20 * time.Minute,
        Title:        "⚠️ 15 Minutes — Head Over Now!",
        BodyTemplate: "Only ~15 min left in the queue at %s. Make your way over!",
        DedupeExpiry: 5 * time.Minute,
    },
    {
        Stage:        "Q5",
        MinWait:      0,
        MaxWait:      8 * time.Minute,
        Title:        "🚨 YOU'RE ALMOST UP!",
        BodyTemplate: "GET TO THE COUNTER NOW at %s! You're next in line!",
        DedupeExpiry: 3 * time.Minute,
    },
}

type ActiveTicket struct {
    TicketID     string
    UserID       string
    OrgName      string
    Position     int
    FCMToken     string
    AvgServiceTime time.Duration // Per person, fetched from Redis analytics
}

type Service struct {
    redis     *redis.Client
    fcmClient *fcm.Client
}

func NewService(redisClient *redis.Client, fcmClient *fcm.Client) *Service {
    return &Service{redis: redisClient, fcmClient: fcmClient}
}

func (s *Service) RunQueueCheck(ctx context.Context) {
    // Fetch all active queue tickets from Redis
    // Your existing Redis ZSet key pattern: queue:{org_id}:tickets
    tickets, err := s.fetchActiveTickets(ctx)
    if err != nil {
        log.Printf("❌ Queue reminder: failed to fetch tickets: %v", err)
        return
    }

    for _, ticket := range tickets {
        ewt := time.Duration(ticket.Position) * ticket.AvgServiceTime

        for _, stage := range QueueStages {
            if ewt >= stage.MinWait && ewt < stage.MaxWait {
                s.maybeNotify(ctx, ticket, stage)
                break // Only fire one stage per check
            }
        }
    }
}

func (s *Service) maybeNotify(ctx context.Context, ticket ActiveTicket, stage QueueStage) {
    // Redis dedup key — prevents re-sending same stage notification
    dedupKey := fmt.Sprintf("queue_notif:%s:%s", ticket.TicketID, stage.Stage)

    // Check if already sent
    exists, err := s.redis.Exists(ctx, dedupKey).Result()
    if err != nil || exists > 0 {
        return // Already sent this stage for this ticket
    }

    body := fmt.Sprintf(stage.BodyTemplate, ticket.OrgName)

    pushErr := s.fcmClient.SendPush(ctx, fcm.PushPayload{
        FCMToken: ticket.FCMToken,
        Title:    stage.Title,
        Body:     body,
        Data: map[string]string{
            "ticket_id": ticket.TicketID,
            "stage":     stage.Stage,
            "screen":    "queue_status",
        },
    })

    if pushErr != nil {
        log.Printf("❌ Queue push failed [%s][%s]: %v", ticket.TicketID, stage.Stage, pushErr)
        return
    }

    // Set dedup key so this stage doesn't fire again
    s.redis.Set(ctx, dedupKey, "1", stage.DedupeExpiry)
    log.Printf("✅ Queue notif sent [%s][%s] EWT position %d", ticket.TicketID, stage.Stage, ticket.Position)
}

func (s *Service) fetchActiveTickets(ctx context.Context) ([]ActiveTicket, error) {
    // TODO: integrate with your existing Redis ZSet queue structure
    // Pattern: ZRANGE queue:{org_id} 0 -1 WITHSCORES
    // Then JOIN with Postgres for fcm_token + org_name
    // Return []ActiveTicket
    return nil, nil
}
```

#### Add Queue Crons to `internal/scheduler/scheduler.go`

```go
// Queue Stage Q1 + Q2 — every 10 minutes
s.cron.AddFunc("0 */10 * * * *", func() {
    s.queueService.RunQueueCheck(context.Background())
})

// Queue Stage Q3 — every 5 minutes
s.cron.AddFunc("0 */5 * * * *", func() {
    s.queueService.RunQueueCheck(context.Background())
})

// Queue Stage Q4 — every 2 minutes
s.cron.AddFunc("0 */2 * * * *", func() {
    s.queueService.RunQueueCheck(context.Background())
})

// Queue Stage Q5 — every 1 minute
s.cron.AddFunc("0 * * * * *", func() {
    s.queueService.RunQueueCheck(context.Background())
})
```

> **Note:** `RunQueueCheck` is idempotent — running it more frequently is fine because the Redis dedup key blocks duplicate sends. Q5 runs every minute but the user only gets ONE "you're almost up" push.

### Queue Dedup Flow (How Redis Prevents Spam)

```
User joins queue → position 45 (EWT ~2hrs)
  ↓
Cron fires → EWT = 2hr window → checks Redis key "queue_notif:TKT123:Q1"
  ↓ key doesn't exist
  → SEND PUSH ✅ → SET key with 30min TTL
  ↓
10 min later cron fires again → EWT still ~2hr
  ↓ key EXISTS (TTL still active)
  → SKIP ✅ (no duplicate)
  ↓
User moves up → EWT = 1hr window → checks "queue_notif:TKT123:Q2"
  ↓ key doesn't exist
  → SEND PUSH ✅ → SET key with 20min TTL
```

---

---

## ⏰ The 7 Reminder Stages

| Stage | Cron Schedule | Time Before Appointment | Notification Message |
|-------|--------------|--------------------------|----------------------|
| **1** | `0 9 * * *` (daily at 9AM) | **7 days before** | "📅 Reminder: You have an appointment in 7 days at [Org]" |
| **2** | `0 9 * * *` (daily at 9AM) | **3 days before** | "📅 Your appointment at [Org] is in 3 days. We'll see you soon!" |
| **3** | `0 8 * * *` (daily at 8AM) | **24 hours before** | "⏰ Tomorrow is your appointment at [Org] at [time]. Get ready!" |
| **4** | `0 * * * *` (every hour) | **2 hours before** | "🚗 Your appointment at [Org] starts in 2 hours. Time to prepare!" |
| **5** | `*/5 * * * *` (every 5 min) | **30 minutes before** | "🔴 LEAVE NOW — Your appointment at [Org] is in 30 minutes!" |
| **6** | `*/1 * * * *` (every min) | **5 minutes before** | "🚨 You're almost up! Appointment at [Org] starts in 5 minutes." |
| **7** | `0 * * * *` (every hour) | **+1 hour AFTER** | "✅ How was your visit? Rate your experience at [Org]!" |

### Why These Intervals?

- **Stages 1-3** run as daily batch jobs — they query the DB once per day for appointments matching that window. Very cheap on compute.
- **Stages 4-6** run more frequently but use **Redis caching** to avoid hammering Postgres. The reminder is only sent once per appointment per stage (idempotent via Redis keys).
- **Stage 7** is the post-visit follow-up for feedback/ratings, sent 1 hour after the scheduled appointment end time.

---

## 🏗️ Microservice Architecture

```
notification-service/
├── cmd/
│   └── main.go                  # Entry point, starts all cron jobs
├── internal/
│   ├── config/
│   │   └── config.go            # Env vars loader
│   ├── db/
│   │   └── postgres.go          # DB connection (reuse Lineo's Neon URL)
│   ├── cache/
│   │   └── redis.go             # Redis client (reuse Lineo's Redis)
│   ├── fcm/
│   │   └── client.go            # Firebase Cloud Messaging client
│   ├── scheduler/
│   │   └── scheduler.go         # All 7 cron job definitions
│   └── reminder/
│       ├── repository.go        # DB queries for upcoming appointments
│       └── service.go           # Business logic: fetch → check → push
├── Dockerfile
├── docker-compose.yml
├── example.env
└── go.mod
```

---

## 🔧 Step 1 — Prerequisites & Dependencies

### Add to your `go.mod`

```bash
go get github.com/robfig/cron/v3          # Cron scheduler
go get firebase.google.com/go/v4          # Firebase SDK
go get google.golang.org/api              # Google APIs (needed for FCM)
go get github.com/redis/go-redis/v9       # Redis client (already in Lineo)
go get github.com/lib/pq                  # Postgres driver (already in Lineo)
```

---

## 🔧 Step 2 — Environment Variables

Add these to your `.env` (extend `example.env`):

```env
# Existing from Lineo
DATABASE_URL=postgres://user:pass@neon-host/db
REDIS_URL=redis://localhost:6379

# New for this microservice
FIREBASE_CREDENTIALS_PATH=./firebase-service-account.json
FCM_SENDER_ID=your_fcm_sender_id

# Service config
NOTIFICATION_SERVICE_PORT=8081
```

> **Firebase Setup:** Go to Firebase Console → Project Settings → Service Accounts → Generate new private key → save as `firebase-service-account.json`

---

## 🔧 Step 3 — Database: FCM Token Storage

You need to store each user's device FCM token. Add this migration to your existing PostgreSQL schema:

```sql
-- Add FCM token to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token_updated_at TIMESTAMPTZ;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_fcm_token ON users(id) WHERE fcm_token IS NOT NULL;

-- Reminder tracking table (prevents duplicate notifications)
CREATE TABLE IF NOT EXISTS appointment_reminders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id  UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    stage           INT NOT NULL CHECK (stage BETWEEN 1 AND 7),
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status          VARCHAR(20) NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'skipped'
    error_message   TEXT,
    UNIQUE(appointment_id, stage) -- One reminder per stage per appointment
);

CREATE INDEX IF NOT EXISTS idx_reminders_appointment ON appointment_reminders(appointment_id);
```

---

## 🔧 Step 4 — Core Code

### `internal/fcm/client.go`

```go
package fcm

import (
    "context"
    "log"

    firebase "firebase.google.com/go/v4"
    "firebase.google.com/go/v4/messaging"
    "google.golang.org/api/option"
)

type Client struct {
    messaging *messaging.Client
}

func NewClient(credentialsPath string) (*Client, error) {
    ctx := context.Background()
    opt := option.WithCredentialsFile(credentialsPath)
    app, err := firebase.NewApp(ctx, nil, opt)
    if err != nil {
        return nil, err
    }
    msgClient, err := app.Messaging(ctx)
    if err != nil {
        return nil, err
    }
    return &Client{messaging: msgClient}, nil
}

type PushPayload struct {
    FCMToken    string
    Title       string
    Body        string
    Data        map[string]string // Extra data for the app to handle
}

func (c *Client) SendPush(ctx context.Context, payload PushPayload) error {
    msg := &messaging.Message{
        Token: payload.FCMToken,
        Notification: &messaging.Notification{
            Title: payload.Title,
            Body:  payload.Body,
        },
        Data: payload.Data,
        Android: &messaging.AndroidConfig{
            Priority: "high",
            Notification: &messaging.AndroidNotification{
                Sound:       "default",
                ClickAction: "FLUTTER_NOTIFICATION_CLICK",
            },
        },
        APNS: &messaging.APNSConfig{
            Payload: &messaging.APNSPayload{
                Aps: &messaging.Aps{
                    Sound: "default",
                    Badge: messaging.BadgeCount(1),
                },
            },
        },
    }

    response, err := c.messaging.Send(ctx, msg)
    if err != nil {
        return err
    }
    log.Printf("✅ FCM sent: %s", response)
    return nil
}
```

---

### `internal/reminder/repository.go`

```go
package reminder

import (
    "context"
    "database/sql"
    "time"
)

type Appointment struct {
    ID           string
    UserID       string
    OrgName      string
    ScheduledAt  time.Time
    UserFCMToken string
    UserName     string
}

type Repository struct {
    db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
    return &Repository{db: db}
}

// FetchAppointmentsInWindow fetches confirmed appointments within a time window
// that haven't had the given reminder stage sent yet.
func (r *Repository) FetchAppointmentsInWindow(
    ctx context.Context,
    windowStart, windowEnd time.Time,
    stage int,
) ([]Appointment, error) {
    query := `
        SELECT 
            a.id,
            a.user_id,
            o.name AS org_name,
            a.scheduled_at,
            u.fcm_token,
            u.name AS user_name
        FROM appointments a
        JOIN users u ON u.id = a.user_id
        JOIN organizations o ON o.id = a.organization_id
        WHERE 
            a.status = 'confirmed'
            AND a.scheduled_at BETWEEN $1 AND $2
            AND u.fcm_token IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM appointment_reminders ar
                WHERE ar.appointment_id = a.id
                  AND ar.stage = $3
            )
    `
    rows, err := r.db.QueryContext(ctx, query, windowStart, windowEnd, stage)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var appointments []Appointment
    for rows.Next() {
        var a Appointment
        if err := rows.Scan(
            &a.ID, &a.UserID, &a.OrgName,
            &a.ScheduledAt, &a.UserFCMToken, &a.UserName,
        ); err != nil {
            continue
        }
        appointments = append(appointments, a)
    }
    return appointments, rows.Err()
}

// MarkReminderSent records that a stage reminder was sent for an appointment.
func (r *Repository) MarkReminderSent(ctx context.Context, appointmentID string, stage int, errMsg string) error {
    status := "sent"
    if errMsg != "" {
        status = "failed"
    }
    _, err := r.db.ExecContext(ctx, `
        INSERT INTO appointment_reminders (appointment_id, stage, status, error_message)
        VALUES ($1, $2, $3, NULLIF($4, ''))
        ON CONFLICT (appointment_id, stage) DO NOTHING
    `, appointmentID, stage, status, errMsg)
    return err
}
```

---

### `internal/reminder/service.go`

```go
package reminder

import (
    "context"
    "fmt"
    "log"
    "time"

    "your-module/internal/fcm"
)

type Service struct {
    repo      *Repository
    fcmClient *fcm.Client
}

func NewService(repo *Repository, fcmClient *fcm.Client) *Service {
    return &Service{repo: repo, fcmClient: fcmClient}
}

type StageConfig struct {
    Stage        int
    WindowBefore time.Duration  // How far before appointment to send
    WindowSlack  time.Duration  // Tolerance window (e.g., ±5 min)
    Title        string
    BodyTemplate string         // Use %s for org name
}

// All 7 stages defined here
var Stages = []StageConfig{
    {
        Stage:        1,
        WindowBefore: 7 * 24 * time.Hour,
        WindowSlack:  12 * time.Hour,
        Title:        "📅 Appointment in 7 Days",
        BodyTemplate: "Reminder: You have an appointment at %s in 7 days. Mark your calendar!",
    },
    {
        Stage:        2,
        WindowBefore: 3 * 24 * time.Hour,
        WindowSlack:  12 * time.Hour,
        Title:        "📅 Appointment in 3 Days",
        BodyTemplate: "Your appointment at %s is coming up in 3 days. We'll see you soon!",
    },
    {
        Stage:        3,
        WindowBefore: 24 * time.Hour,
        WindowSlack:  1 * time.Hour,
        Title:        "⏰ Appointment Tomorrow",
        BodyTemplate: "Don't forget — your appointment at %s is tomorrow. Get ready!",
    },
    {
        Stage:        4,
        WindowBefore: 2 * time.Hour,
        WindowSlack:  10 * time.Minute,
        Title:        "🚗 2 Hours Until Your Appointment",
        BodyTemplate: "Your appointment at %s starts in 2 hours. Time to prepare!",
    },
    {
        Stage:        5,
        WindowBefore: 30 * time.Minute,
        WindowSlack:  5 * time.Minute,
        Title:        "🔴 Leave Now!",
        BodyTemplate: "Your appointment at %s is in 30 minutes. Leave now to arrive on time!",
    },
    {
        Stage:        6,
        WindowBefore: 5 * time.Minute,
        WindowSlack:  2 * time.Minute,
        Title:        "🚨 Starting in 5 Minutes!",
        BodyTemplate: "You're almost up! Your appointment at %s starts in 5 minutes.",
    },
    {
        Stage:        7,
        WindowBefore: -1 * time.Hour, // NEGATIVE = 1 hour AFTER appointment
        WindowSlack:  30 * time.Minute,
        Title:        "✅ How Was Your Visit?",
        BodyTemplate: "Thanks for visiting %s! Tap to rate your experience.",
    },
}

// RunStage executes a single reminder stage
func (s *Service) RunStage(ctx context.Context, stage StageConfig) {
    now := time.Now().UTC()

    var windowStart, windowEnd time.Time

    if stage.Stage == 7 {
        // Post-appointment: appointment was 1 hour ago (±slack)
        targetTime := now.Add(stage.WindowBefore) // WindowBefore is negative here
        windowStart = targetTime.Add(-stage.WindowSlack)
        windowEnd = targetTime.Add(stage.WindowSlack)
    } else {
        // Pre-appointment: appointment is X hours from now (±slack)
        targetTime := now.Add(stage.WindowBefore)
        windowStart = targetTime.Add(-stage.WindowSlack)
        windowEnd = targetTime.Add(stage.WindowSlack)
    }

    appointments, err := s.repo.FetchAppointmentsInWindow(ctx, windowStart, windowEnd, stage.Stage)
    if err != nil {
        log.Printf("❌ Stage %d: DB error: %v", stage.Stage, err)
        return
    }

    log.Printf("📬 Stage %d: Found %d appointments to notify", stage.Stage, len(appointments))

    for _, appt := range appointments {
        body := fmt.Sprintf(stage.BodyTemplate, appt.OrgName)

        pushErr := s.fcmClient.SendPush(ctx, fcm.PushPayload{
            FCMToken: appt.UserFCMToken,
            Title:    stage.Title,
            Body:     body,
            Data: map[string]string{
                "appointment_id": appt.ID,
                "stage":          fmt.Sprintf("%d", stage.Stage),
                "screen":         "appointment_detail",
            },
        })

        errMsg := ""
        if pushErr != nil {
            errMsg = pushErr.Error()
            log.Printf("❌ Stage %d: Push failed for appt %s: %v", stage.Stage, appt.ID, pushErr)
        }

        // Always mark as attempted (success or fail) to avoid retrying
        if markErr := s.repo.MarkReminderSent(ctx, appt.ID, stage.Stage, errMsg); markErr != nil {
            log.Printf("⚠️ Stage %d: Failed to mark reminder for appt %s: %v", stage.Stage, appt.ID, markErr)
        }
    }
}
```

---

### `internal/scheduler/scheduler.go`

```go
package scheduler

import (
    "context"
    "log"

    "github.com/robfig/cron/v3"
    "your-module/internal/reminder"
)

type Scheduler struct {
    cron    *cron.Cron
    service *reminder.Service
}

func New(service *reminder.Service) *Scheduler {
    c := cron.New(cron.WithSeconds()) // Enable seconds for precision
    return &Scheduler{cron: c, service: service}
}

func (s *Scheduler) Register() {
    // Stage 1 — 7 days before — daily at 9:00 AM UTC
    s.cron.AddFunc("0 0 9 * * *", func() {
        log.Println("🔔 Running Stage 1 (7-day reminder)...")
        s.service.RunStage(context.Background(), reminder.Stages[0])
    })

    // Stage 2 — 3 days before — daily at 9:00 AM UTC
    s.cron.AddFunc("0 0 9 * * *", func() {
        log.Println("🔔 Running Stage 2 (3-day reminder)...")
        s.service.RunStage(context.Background(), reminder.Stages[1])
    })

    // Stage 3 — 24 hours before — daily at 8:00 AM UTC
    s.cron.AddFunc("0 0 8 * * *", func() {
        log.Println("🔔 Running Stage 3 (24-hour reminder)...")
        s.service.RunStage(context.Background(), reminder.Stages[2])
    })

    // Stage 4 — 2 hours before — every hour on the hour
    s.cron.AddFunc("0 0 * * * *", func() {
        log.Println("🔔 Running Stage 4 (2-hour reminder)...")
        s.service.RunStage(context.Background(), reminder.Stages[3])
    })

    // Stage 5 — 30 minutes before — every 5 minutes
    s.cron.AddFunc("0 */5 * * * *", func() {
        log.Println("🔔 Running Stage 5 (30-min reminder)...")
        s.service.RunStage(context.Background(), reminder.Stages[4])
    })

    // Stage 6 — 5 minutes before — every 1 minute
    s.cron.AddFunc("0 * * * * *", func() {
        log.Println("🔔 Running Stage 6 (5-min reminder)...")
        s.service.RunStage(context.Background(), reminder.Stages[5])
    })

    // Stage 7 — Post-visit follow-up — every hour
    s.cron.AddFunc("0 0 * * * *", func() {
        log.Println("🔔 Running Stage 7 (post-visit feedback)...")
        s.service.RunStage(context.Background(), reminder.Stages[6])
    })
}

func (s *Scheduler) Start() {
    log.Println("✅ Notification cron scheduler started — all 7 stages active")
    s.cron.Start()
}

func (s *Scheduler) Stop() {
    log.Println("🛑 Stopping scheduler...")
    s.cron.Stop()
}
```

---

### `cmd/main.go`

```go
package main

import (
    "database/sql"
    "log"
    "os"
    "os/signal"
    "syscall"

    _ "github.com/lib/pq"
    "your-module/internal/cache"
    "your-module/internal/fcm"
    "your-module/internal/reminder"
    "your-module/internal/scheduler"
)

func main() {
    // Database
    db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
    if err != nil {
        log.Fatalf("DB connection failed: %v", err)
    }
    defer db.Close()

    // Redis (optional: for extra dedup layer)
    _ = cache.NewRedisClient(os.Getenv("REDIS_URL"))

    // Firebase FCM
    fcmClient, err := fcm.NewClient(os.Getenv("FIREBASE_CREDENTIALS_PATH"))
    if err != nil {
        log.Fatalf("FCM init failed: %v", err)
    }

    // Wire up service
    repo := reminder.NewRepository(db)
    svc := reminder.NewService(repo, fcmClient)

    // Start scheduler
    sch := scheduler.New(svc)
    sch.Register()
    sch.Start()

    // Graceful shutdown
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit
    sch.Stop()
    log.Println("Notification service shut down cleanly.")
}
```

---

## 🔧 Step 5 — Mobile: Saving FCM Tokens

Your existing Go API needs one endpoint so the mobile app can register/update the user's FCM token after login:

```go
// POST /api/v1/user/fcm-token
// Body: { "fcm_token": "dQw4w9WgXcQ..." }
func (h *UserHandler) UpdateFCMToken(w http.ResponseWriter, r *http.Request) {
    userID := r.Context().Value("user_id").(string)
    var body struct {
        FCMToken string `json:"fcm_token"`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
        http.Error(w, "invalid body", 400)
        return
    }
    _, err := h.db.ExecContext(r.Context(), `
        UPDATE users SET fcm_token = $1, fcm_token_updated_at = NOW()
        WHERE id = $2
    `, body.FCMToken, userID)
    if err != nil {
        http.Error(w, "db error", 500)
        return
    }
    w.WriteHeader(http.StatusOK)
}
```

Call this from your mobile app on:
- User login
- App foreground (token refresh)
- Firebase's `onTokenRefresh` callback

---

## 🐳 Step 6 — Docker Integration

### `Dockerfile` for the notification service

```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o notification-service ./cmd/

FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /root/
COPY --from=builder /app/notification-service .
COPY --from=builder /app/firebase-service-account.json .
CMD ["./notification-service"]
```

### Add to your existing `docker-compose.yml`

```yaml
  notification-service:
    build:
      context: ./notification-service
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: redis://redis:6379
      FIREBASE_CREDENTIALS_PATH: /app/firebase-service-account.json
    depends_on:
      - postgres
      - redis
    networks:
      - app-network
```

---

## 🛡️ Idempotency (No Duplicate Notifications)

The `appointment_reminders` table with a `UNIQUE(appointment_id, stage)` constraint ensures:

1. Even if a cron job runs twice (crash + restart), the notification is only sent **once** per stage per appointment.
2. The `ON CONFLICT DO NOTHING` in `MarkReminderSent` makes it safe.
3. For the fast-running Stage 5 and Stage 6 crons, the DB constraint is the final guard.

---

## 📊 Monitoring & Observability

Add these log patterns to your monitoring dashboard (Datadog, Grafana, etc.):

```
✅ FCM sent       → Successful push
📬 Stage X: Found → How many appointments per run
❌ Stage X: Push failed → FCM delivery failures (check token validity)
❌ Stage X: DB error    → Database issues
```

**Recommended additions:**
- Expose `/health` and `/metrics` (Prometheus) endpoints on port 8081
- Alert if any stage has 0 appointments processed for 24 hours (cron might be down)
- Set up Firebase Analytics to track notification open rates per stage

---

## 🚀 Deployment Checklist

- [ ] Firebase project created, service account JSON downloaded
- [ ] `fcm_token` column added to `users` table
- [ ] `appointment_reminders` table created (migration run)
- [ ] `POST /api/v1/user/fcm-token` endpoint added to main API
- [ ] Mobile app calls FCM token registration on login + `onTokenRefresh`
- [ ] `.env` updated with `FIREBASE_CREDENTIALS_PATH`
- [ ] Notification service added to `docker-compose.yml`
- [ ] Tested each stage manually by seeding appointments at the right times
- [ ] Deployed and confirmed Stage
---

## ⚠️ Edge Cases — Late Bookings

This is critical. A user won't always book 7 days in advance — they might book 2 days, 1 day, or even 30 minutes before. The system must handle all of these gracefully.

### The Full Edge Case Matrix

| Booked When | Stages Already Missed | Stages Still Fired |
|-------------|----------------------|--------------------|
| 7+ days before | None | All 7 ✅ |
| 2–7 days before | Stage 1 (7-day) | Stages 2–7 |
| 1–2 days before | Stages 1, 2 | Stages 3–7 |
| 2–24 hrs before | Stages 1, 2, 3 | Stages 4–7 |
| 30 min–2 hrs before | Stages 1, 2, 3, 4 | Stages 5–7 |
| 5–30 min before | Stages 1–5 | Stages 6–7 |
| < 5 min before | Stages 1–6 | Stage 7 only (feedback) |

### The Fix — `OnBookingConfirmed()` Hook

Call this **immediately** when a booking is created. It does two things:
1. Sends an instant **booking confirmation push**
2. **Pre-marks all already-passed stages** as `skipped` in the DB so the cron never fires them

```go
// internal/reminder/service.go — add this method

func (s *Service) OnBookingConfirmed(ctx context.Context, appt Appointment) error {

    // 1. Instant booking confirmation push
    s.fcmClient.SendPush(ctx, fcm.PushPayload{
        FCMToken: appt.UserFCMToken,
        Title:    "✅ Appointment Confirmed!",
        Body:     fmt.Sprintf("Your appointment at %s on %s is booked. We'll remind you!", appt.OrgName, appt.ScheduledAt.Format("Jan 2 at 3:04 PM")),
        Data:     map[string]string{"appointment_id": appt.ID, "screen": "appointment_detail"},
    })

    // 2. Pre-mark all already-past stages as skipped
    now := time.Now().UTC()
    timeUntilAppt := appt.ScheduledAt.Sub(now)

    for _, stage := range Stages {
        if stage.Stage == 7 {
            continue // Post-visit is always future
        }
        if timeUntilAppt < stage.WindowBefore {
            s.repo.MarkReminderSkipped(ctx, appt.ID, stage.Stage)
            log.Printf("⏭️  Stage %d skipped for appt %s (booked too late)", stage.Stage, appt.ID)
        }
    }
    return nil
}
```

### Add `MarkReminderSkipped` to Repository

```go
// internal/reminder/repository.go

func (r *Repository) MarkReminderSkipped(ctx context.Context, appointmentID string, stage int) error {
    _, err := r.db.ExecContext(ctx, `
        INSERT INTO appointment_reminders (appointment_id, stage, status)
        VALUES ($1, $2, 'skipped')
        ON CONFLICT (appointment_id, stage) DO NOTHING
    `, appointmentID, stage)
    return err
}
```

### Wire into your Booking Handler (existing Lineo code)

```go
// In your existing booking service — after CreateAppointment succeeds

go func() {
    reminderAppt := reminder.Appointment{
        ID:           appt.ID,
        OrgName:      appt.OrgName,
        ScheduledAt:  appt.ScheduledAt,
        UserFCMToken: appt.UserFCMToken,
    }
    s.reminderService.OnBookingConfirmed(context.Background(), reminderAppt)
}()
```

### Real Example Walkthrough

**User books at 1:30 PM, appointment is at 3:00 PM (90 minutes away):**

```
OnBookingConfirmed fires immediately
  → "✅ Appointment Confirmed!" push sent

  timeUntilAppt = 90 minutes

  Stage 1 (7 days):   90min < 10080min → SKIPPED ⏭️
  Stage 2 (3 days):   90min < 4320min  → SKIPPED ⏭️
  Stage 3 (24 hours): 90min < 1440min  → SKIPPED ⏭️
  Stage 4 (2 hours):  90min < 120min   → SKIPPED ⏭️
  Stage 5 (30 min):   90min > 30min    → cron will fire ✅
  Stage 6 (5 min):    90min > 5min     → cron will fire ✅
  Stage 7 (feedback): always future    → cron will fire ✅

Timeline:
  1:30 PM → "✅ Appointment Confirmed!" (immediate)
  2:30 PM → "🔴 LEAVE NOW — 30 min!" (cron Stage 5)
  2:55 PM → "🚨 5 minutes left!" (cron Stage 6)
  4:00 PM → "✅ Rate your visit!" (cron Stage 7)
```

**Panic booking — 20 minutes before:**

```
  Stages 1–5 all SKIPPED (20min is less than all their windows)
  Only Stage 6 and Stage 7 remain

  T-20min → "✅ Confirmed! It's in 20 minutes, hurry!" (immediate)
  T-5min  → "🚨 You're almost up!" (cron)
  T+1hr   → "Rate your experience" (cron)
```

### Cancellation Edge Case

If an appointment is cancelled, block all future notifications immediately:

```go
func (s *Service) OnAppointmentCancelled(ctx context.Context, appointmentID string, fcmToken string, orgName string) error {
    // Mark all stages skipped
    for stage := 1; stage <= 7; stage++ {
        s.repo.MarkReminderSkipped(ctx, appointmentID, stage)
    }
    // Send cancellation push
    s.fcmClient.SendPush(ctx, fcm.PushPayload{
        FCMToken: fcmToken,
        Title:    "❌ Appointment Cancelled",
        Body:     fmt.Sprintf("Your appointment at %s has been cancelled.", orgName),
        Data:     map[string]string{"appointment_id": appointmentID, "screen": "home"},
    })
    return nil
}
```

Also update the cron DB query to exclude cancelled/completed appointments:
```sql
AND a.status NOT IN ('cancelled', 'completed')
```

