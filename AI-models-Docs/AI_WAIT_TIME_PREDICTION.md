# 🕐 AI Wait Time Prediction — Implementation Guide

> **For QueueLess (Lineo)** — Go Backend | PostgreSQL | Redis | Claude AI

---

## 📌 What This Feature Does

Instead of showing users a raw queue position like `"You are #7 in line"`, this AI layer predicts the **exact wait time in minutes** based on:

- Current queue depth (from Redis)
- Historical average service time per organization
- Time of day & day of week (peak hours)
- Current agent count online
- Recent service velocity (how fast agents are calling "next" today)

**Example Output:**
```json
{
  "queue_position": 7,
  "estimated_wait_minutes": 23,
  "confidence": "high",
  "message": "Based on current traffic, you'll be served around 3:42 PM"
}
```

---

## 🏗️ Architecture Overview

```
User joins Queue
      │
      ▼
Redis ZSet (real-time queue)
      │
      ▼
WaitTime Service (Go)
      │
      ├──► Pull historical avg from PostgreSQL
      ├──► Pull current queue depth from Redis
      ├──► Pull active agents count from DB
      └──► Send context to Claude AI API
                │
                ▼
         Claude AI Response
         (predicted wait in minutes)
                │
                ▼
      Return to user via WebSocket / REST
```

---

## 🗄️ Step 1 — Database: Add Analytics Tables

Add these tables to your PostgreSQL schema:

```sql
-- Tracks how long each service actually took (ground truth data)
CREATE TABLE service_durations (
    id            SERIAL PRIMARY KEY,
    org_id        UUID NOT NULL,
    agent_id      UUID NOT NULL,
    ticket_id     UUID NOT NULL,
    called_at     TIMESTAMP NOT NULL,       -- when agent called "next"
    completed_at  TIMESTAMP NOT NULL,       -- when agent marked "done"
    duration_secs INT GENERATED ALWAYS AS  -- auto-calculated
                  (EXTRACT(EPOCH FROM (completed_at - called_at))::INT) STORED,
    hour_of_day   INT GENERATED ALWAYS AS
                  (EXTRACT(HOUR FROM called_at)::INT) STORED,
    day_of_week   INT GENERATED ALWAYS AS
                  (EXTRACT(DOW FROM called_at)::INT) STORED,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- Pre-aggregated stats per org (refresh every 15 mins via cron)
CREATE TABLE org_wait_stats (
    org_id            UUID PRIMARY KEY,
    avg_service_secs  INT,     -- average seconds per customer
    p90_service_secs  INT,     -- 90th percentile (for busy days)
    total_samples     INT,     -- how many data points
    last_updated      TIMESTAMP DEFAULT NOW()
);

-- Index for fast analytics queries
CREATE INDEX idx_service_durations_org_hour
    ON service_durations(org_id, hour_of_day, day_of_week);
```

---

## 📦 Step 2 — Go Package Structure

Create this inside your existing clean architecture:

```
internal/
└── waittime/
    ├── service.go        ← main prediction logic
    ├── repository.go     ← DB queries for historical data
    └── claude.go         ← Claude AI API call
pkg/
└── aipredictor/
    └── prompt.go         ← builds the AI prompt
```

---

## 🔧 Step 3 — Repository Layer (`repository.go`)

```go
package waittime

import (
    "context"
    "database/sql"
    "time"
)

type WaitTimeRepo struct {
    db *sql.DB
}

type OrgStats struct {
    AvgServiceSecs int
    P90ServiceSecs int
    TotalSamples   int
}

type CurrentConditions struct {
    QueueDepth      int
    ActiveAgents    int
    RecentAvgSecs   int // last 30 mins average
}

// GetOrgHistoricalStats pulls pre-aggregated stats for an org
func (r *WaitTimeRepo) GetOrgHistoricalStats(ctx context.Context, orgID string) (OrgStats, error) {
    var stats OrgStats
    query := `
        SELECT avg_service_secs, p90_service_secs, total_samples
        FROM org_wait_stats
        WHERE org_id = $1
    `
    err := r.db.QueryRowContext(ctx, query, orgID).Scan(
        &stats.AvgServiceSecs,
        &stats.P90ServiceSecs,
        &stats.TotalSamples,
    )
    return stats, err
}

// GetRecentVelocity — how fast is the queue moving RIGHT NOW (last 30 mins)
func (r *WaitTimeRepo) GetRecentVelocity(ctx context.Context, orgID string) (int, error) {
    var avgSecs int
    query := `
        SELECT COALESCE(AVG(duration_secs)::INT, 0)
        FROM service_durations
        WHERE org_id = $1
          AND called_at > NOW() - INTERVAL '30 minutes'
    `
    err := r.db.QueryRowContext(ctx, query, orgID).Scan(&avgSecs)
    return avgSecs, err
}

// GetActiveAgentCount — how many agents are currently logged in / active
func (r *WaitTimeRepo) GetActiveAgentCount(ctx context.Context, orgID string) (int, error) {
    var count int
    query := `
        SELECT COUNT(*)
        FROM users
        WHERE org_id = $1
          AND role = 'agent'
          AND last_active > NOW() - INTERVAL '10 minutes'
    `
    err := r.db.QueryRowContext(ctx, query, orgID).Scan(&count)
    return count, err
}
```

---

## 🤖 Step 4 — Claude AI Integration (`claude.go`)

```go
package waittime

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "os"
    "strconv"
    "strings"
)

type ClaudePredictor struct {
    apiKey string
    client *http.Client
}

func NewClaudePredictor() *ClaudePredictor {
    return &ClaudePredictor{
        apiKey: os.Getenv("ANTHROPIC_API_KEY"),
        client: &http.Client{},
    }
}

type PredictionInput struct {
    QueuePosition    int
    ActiveAgents     int
    AvgServiceSecs   int
    P90ServiceSecs   int
    RecentAvgSecs    int  // last 30 min velocity
    TotalSamples     int
    HourOfDay        int
    DayOfWeek        string
    IsAppointment    bool
}

type WaitPrediction struct {
    EstimatedMinutes int    `json:"estimated_wait_minutes"`
    Confidence       string `json:"confidence"`  // "high", "medium", "low"
    Message          string `json:"message"`
}

func (c *ClaudePredictor) Predict(ctx context.Context, input PredictionInput) (WaitPrediction, error) {
    prompt := buildPrompt(input)

    requestBody, _ := json.Marshal(map[string]interface{}{
        "model":      "claude-sonnet-4-20250514",
        "max_tokens": 300,
        "messages": []map[string]string{
            {"role": "user", "content": prompt},
        },
    })

    req, err := http.NewRequestWithContext(ctx, "POST",
        "https://api.anthropic.com/v1/messages",
        bytes.NewBuffer(requestBody))
    if err != nil {
        return WaitPrediction{}, err
    }

    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("x-api-key", c.apiKey)
    req.Header.Set("anthropic-version", "2023-06-01")

    resp, err := c.client.Do(req)
    if err != nil {
        return WaitPrediction{}, err
    }
    defer resp.Body.Close()

    var claudeResp struct {
        Content []struct {
            Text string `json:"text"`
        } `json:"content"`
    }
    json.NewDecoder(resp.Body).Decode(&claudeResp)

    if len(claudeResp.Content) == 0 {
        return WaitPrediction{}, fmt.Errorf("empty claude response")
    }

    return parseClaudeResponse(claudeResp.Content[0].Text), nil
}

func buildPrompt(input PredictionInput) string {
    return fmt.Sprintf(`You are a queue wait time predictor for a hospital/clinic/bank management system.

Given the following real-time data, predict the wait time for the customer.

CURRENT CONDITIONS:
- Queue position: %d (they are this many people ahead of them)
- Active agents/counters serving right now: %d
- Historical average service time: %d seconds per customer
- Historical 90th percentile service time: %d seconds (for busy periods)
- Recent service time (last 30 min): %d seconds (current velocity)
- Historical data samples: %d total records
- Current hour of day: %d (0-23)
- Day of week: %s
- Is this an appointment (vs walk-in): %v

INSTRUCTIONS:
1. Calculate estimated wait time in minutes (be realistic, not optimistic)
2. If recent velocity is much higher than historical avg, it is a busy period — use p90
3. Account for multiple agents (divide by agent count)
4. Set confidence: "high" if >500 samples, "medium" if 50-500, "low" if <50
5. Respond ONLY in this exact JSON format, nothing else:

{"estimated_wait_minutes": <number>, "confidence": "<high|medium|low>", "message": "<friendly 1-sentence message>"}`,
        input.QueuePosition,
        input.ActiveAgents,
        input.AvgServiceSecs,
        input.P90ServiceSecs,
        input.RecentAvgSecs,
        input.TotalSamples,
        input.HourOfDay,
        input.DayOfWeek,
        input.IsAppointment,
    )
}

func parseClaudeResponse(text string) WaitPrediction {
    // Claude returns clean JSON, just parse it
    text = strings.TrimSpace(text)
    var prediction WaitPrediction
    if err := json.Unmarshal([]byte(text), &prediction); err != nil {
        // Fallback if parsing fails
        return WaitPrediction{
            EstimatedMinutes: 15,
            Confidence:       "low",
            Message:          "Estimated wait time is approximately 15 minutes.",
        }
    }
    return prediction
}
```

---

## ⚙️ Step 5 — Main Service (`service.go`)

```go
package waittime

import (
    "context"
    "fmt"
    "time"

    "github.com/redis/go-redis/v9"
)

type WaitTimeService struct {
    repo      *WaitTimeRepo
    predictor *ClaudePredictor
    redis     *redis.Client
}

func NewWaitTimeService(repo *WaitTimeRepo, redis *redis.Client) *WaitTimeService {
    return &WaitTimeService{
        repo:      repo,
        predictor: NewClaudePredictor(),
        redis:     redis,
    }
}

type WaitTimeRequest struct {
    OrgID         string
    QueueKey      string // Redis ZSet key for this org's queue
    UserTicketID  string
    IsAppointment bool
}

func (s *WaitTimeService) GetPrediction(ctx context.Context, req WaitTimeRequest) (WaitPrediction, error) {
    // 1. Get queue position from Redis ZSet
    pos, err := s.redis.ZRank(ctx, req.QueueKey, req.UserTicketID).Result()
    if err != nil {
        return WaitPrediction{}, fmt.Errorf("ticket not in queue: %w", err)
    }
    queuePosition := int(pos) + 1 // ZRank is 0-indexed

    // 2. Pull historical stats from PostgreSQL
    stats, err := s.repo.GetOrgHistoricalStats(ctx, req.OrgID)
    if err != nil {
        // Use defaults if no history yet
        stats = OrgStats{AvgServiceSecs: 300, P90ServiceSecs: 480, TotalSamples: 0}
    }

    // 3. Get real-time service velocity (last 30 mins)
    recentAvg, err := s.repo.GetRecentVelocity(ctx, req.OrgID)
    if err != nil || recentAvg == 0 {
        recentAvg = stats.AvgServiceSecs
    }

    // 4. Get active agent count
    agentCount, err := s.repo.GetActiveAgentCount(ctx, req.OrgID)
    if err != nil || agentCount == 0 {
        agentCount = 1 // assume at least 1 agent
    }

    now := time.Now()

    // 5. Ask Claude AI to predict
    prediction, err := s.predictor.Predict(ctx, PredictionInput{
        QueuePosition:  queuePosition,
        ActiveAgents:   agentCount,
        AvgServiceSecs: stats.AvgServiceSecs,
        P90ServiceSecs: stats.P90ServiceSecs,
        RecentAvgSecs:  recentAvg,
        TotalSamples:   stats.TotalSamples,
        HourOfDay:      now.Hour(),
        DayOfWeek:      now.Weekday().String(),
        IsAppointment:  req.IsAppointment,
    })

    return prediction, err
}
```

---

## 🌐 Step 6 — HTTP Handler

Add to your existing handler layer:

```go
// GET /api/v1/queue/:key/wait-time
func (h *QueueHandler) GetWaitTime(c *gin.Context) {
    orgID   := c.GetString("org_id") // from JWT middleware
    queueKey := c.Param("key")
    ticketID := c.Query("ticket_id")

    prediction, err := h.waitTimeService.GetPrediction(c.Request.Context(), waittime.WaitTimeRequest{
        OrgID:        orgID,
        QueueKey:     queueKey,
        UserTicketID: ticketID,
    })
    if err != nil {
        c.JSON(500, gin.H{"error": "prediction failed"})
        return
    }

    c.JSON(200, prediction)
}
```

**Register the route:**
```go
api.GET("/queue/:key/wait-time", middleware.Auth(), queueHandler.GetWaitTime)
```

---

## 🔄 Step 7 — Auto-Update Stats (Cron Job)

Add a background job that refreshes `org_wait_stats` every 15 minutes:

```go
// cmd/api/main.go — add this goroutine
go func() {
    ticker := time.NewTicker(15 * time.Minute)
    for range ticker.C {
        db.Exec(`
            INSERT INTO org_wait_stats (org_id, avg_service_secs, p90_service_secs, total_samples, last_updated)
            SELECT
                org_id,
                AVG(duration_secs)::INT,
                PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY duration_secs)::INT,
                COUNT(*),
                NOW()
            FROM service_durations
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY org_id
            ON CONFLICT (org_id) DO UPDATE
            SET avg_service_secs = EXCLUDED.avg_service_secs,
                p90_service_secs  = EXCLUDED.p90_service_secs,
                total_samples     = EXCLUDED.total_samples,
                last_updated      = NOW()
        `)
    }
}()
```

---

## 🌍 Environment Variables Needed

Add to your `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
```

---

## ✅ Final API Response Example

```json
GET /api/v1/queue/clinic_abc/wait-time?ticket_id=ticket_789

{
  "estimated_wait_minutes": 18,
  "confidence": "high",
  "message": "Based on current traffic, you'll likely be served around 3:47 PM."
}
```

---

## 📈 How It Gets Smarter Over Time

| Data Points | Accuracy |
|---|---|
| 0–50 records | Low — uses defaults |
| 50–500 records | Medium — pattern emerging |
| 500+ records | High — very accurate predictions |

The more your org uses QueueLess, the smarter and more accurate the predictions become automatically. No retraining needed — Claude adapts its reasoning to the data you provide each time.

---

> **Next:** See `AI_NOSHOW_PREDICTION.md` for the No-Show feature.
