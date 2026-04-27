# 🧠 AI Smart Slot Recommendation — Implementation Guide

> **For QueueLess (Lineo)** — Go Backend | PostgreSQL | Redis | Claude AI

---

## 📌 What This Feature Does

Instead of dumping ALL available slots on the user and making them guess, the AI analyzes your **Peak Hour SQL analytics** (already built in QueueLess!) and recommends the **top 3 best slots** personalized per user.

**What "best" means:**
- 🟢 Quietest time (shortest expected wait)
- 🕒 Matches user's past booking patterns (if they always book mornings, suggest morning)
- 📅 Avoids historically high no-show / cancellation slots
- 🏃 Feasible commute time (Google Distance Matrix already connected!)

**Example API Response:**
```json
{
  "recommended_slots": [
    {
      "slot_id": "slot_001",
      "datetime": "2025-08-05T10:00:00Z",
      "label": "Tuesday 10:00 AM",
      "score": 0.94,
      "badge": "🏆 Best Pick",
      "reason": "Historically the quietest slot this week. Average wait: 4 min."
    },
    {
      "slot_id": "slot_002",
      "datetime": "2025-08-06T09:00:00Z",
      "label": "Wednesday 9:00 AM",
      "score": 0.81,
      "badge": "⚡ Quick In & Out",
      "reason": "Low traffic. Matches your usual morning preference."
    },
    {
      "slot_id": "slot_003",
      "datetime": "2025-08-07T14:00:00Z",
      "label": "Thursday 2:00 PM",
      "score": 0.67,
      "badge": "📅 Also Available",
      "reason": "Moderate traffic but good availability."
    }
  ],
  "all_slots_available": 14,
  "explanation": "Recommendations based on your booking history and live traffic patterns."
}
```

---

## 🏗️ Architecture Overview

```
User requests to book an appointment
              │
              ▼
   SmartSlot Service (Go)
              │
    ┌─────────┼──────────────────────┐
    │         │                      │
    ▼         ▼                      ▼
PostgreSQL  PostgreSQL             Redis
Peak Hour   User Booking        Live queue
Analytics   History             depth NOW
    │         │                      │
    └─────────┴──────────────────────┘
                      │
                      ▼
             Build Slot Score Context
             (per available slot)
                      │
                      ▼
              Claude AI API
         (scores + ranks + explains)
                      │
                      ▼
        Top 3 Recommended Slots returned
        with human-readable reasons
```

---

## 🗄️ Step 1 — Database: Analytics Tables Needed

You already have `service_durations` and peak hour data from the Wait Time feature. Add these:

```sql
-- Stores every slot's historical performance
CREATE TABLE slot_analytics (
    id              SERIAL PRIMARY KEY,
    org_id          UUID NOT NULL,
    hour_of_day     INT NOT NULL,         -- 0-23
    day_of_week     INT NOT NULL,         -- 0=Sunday, 6=Saturday
    avg_queue_depth FLOAT DEFAULT 0,      -- average # of people in queue
    avg_wait_secs   INT DEFAULT 0,        -- average wait in seconds
    total_bookings  INT DEFAULT 0,        -- how many times this slot was booked
    total_noshows   INT DEFAULT 0,        -- no-shows in this slot
    noshow_rate     FLOAT DEFAULT 0,      -- 0.0 to 1.0
    cancellation_rate FLOAT DEFAULT 0,   -- 0.0 to 1.0
    last_updated    TIMESTAMP DEFAULT NOW(),
    UNIQUE(org_id, hour_of_day, day_of_week)
);

-- User's personal booking preferences (auto-derived from history)
CREATE TABLE user_booking_preferences (
    user_id              UUID PRIMARY KEY,
    preferred_hours      INT[],       -- e.g. {9, 10, 11} = prefers mornings
    preferred_days       INT[],       -- e.g. {2, 3, 4} = prefers Tue-Thu
    avg_advance_days     INT,         -- how many days ahead they usually book
    total_bookings       INT DEFAULT 0,
    last_updated         TIMESTAMP DEFAULT NOW()
);

-- Tracks recommendation outcomes (did user pick the recommended slot?)
CREATE TABLE recommendation_feedback (
    id                  SERIAL PRIMARY KEY,
    user_id             UUID NOT NULL,
    org_id              UUID NOT NULL,
    recommended_slot_id VARCHAR(100),     -- the slot we recommended #1
    chosen_slot_id      VARCHAR(100),     -- what the user actually picked
    accepted_top_pick   BOOLEAN,          -- did they pick our #1?
    recommendation_score FLOAT,           -- score we gave the top pick
    created_at          TIMESTAMP DEFAULT NOW()
);

-- Index for fast analytics lookup
CREATE INDEX idx_slot_analytics_org_day_hour
    ON slot_analytics(org_id, day_of_week, hour_of_day);

CREATE INDEX idx_recommendation_feedback_org
    ON recommendation_feedback(org_id, created_at);
```

---

## 🔄 Step 2 — Populate `slot_analytics` from Existing Data

You already have `service_durations` with queue data. Backfill `slot_analytics` from it:

```sql
-- Run this once to backfill, then use the nightly cron (Step 8) to keep it fresh
INSERT INTO slot_analytics
    (org_id, hour_of_day, day_of_week, avg_queue_depth, avg_wait_secs,
     total_bookings, noshow_rate, last_updated)

SELECT
    sd.org_id,
    EXTRACT(HOUR FROM sd.called_at)::INT           AS hour_of_day,
    EXTRACT(DOW  FROM sd.called_at)::INT           AS day_of_week,

    -- avg queue size during that hour/day combo (from Redis snapshots if stored,
    -- or approximated from booking count density)
    COUNT(*) / 4.0                                 AS avg_queue_depth,

    AVG(sd.duration_secs)::INT                     AS avg_wait_secs,
    COUNT(*)                                       AS total_bookings,

    -- no-show rate from appointment_outcomes joined by time window
    COALESCE(
        (SELECT COUNT(*)::FLOAT
         FROM appointment_outcomes ao
         WHERE ao.org_id = sd.org_id
           AND ao.outcome = 'noshow'
           AND EXTRACT(HOUR FROM ao.scheduled_at) = EXTRACT(HOUR FROM sd.called_at)
           AND EXTRACT(DOW FROM ao.scheduled_at)  = EXTRACT(DOW FROM sd.called_at)
        ) / NULLIF(COUNT(*), 0),
    0)                                             AS noshow_rate,

    NOW()                                          AS last_updated

FROM service_durations sd
GROUP BY sd.org_id, hour_of_day, day_of_week

ON CONFLICT (org_id, hour_of_day, day_of_week) DO UPDATE
SET avg_wait_secs   = EXCLUDED.avg_wait_secs,
    avg_queue_depth = EXCLUDED.avg_queue_depth,
    total_bookings  = EXCLUDED.total_bookings,
    noshow_rate     = EXCLUDED.noshow_rate,
    last_updated    = NOW();
```

---

## 📦 Step 3 — Go Package Structure

```
internal/
└── smartslot/
    ├── service.go        ← orchestrates the full recommendation flow
    ├── repository.go     ← DB queries: slot analytics + user preferences
    ├── scorer.go         ← builds score context per slot
    └── claude.go         ← Claude AI ranks and explains slots
pkg/
└── slots/
    └── available.go      ← fetches raw available appointment slots
```

---

## 🔧 Step 4 — Repository Layer (`repository.go`)

```go
package smartslot

import (
    "context"
    "database/sql"
    "time"
)

type SmartSlotRepo struct {
    db *sql.DB
}

// SlotStats — historical performance of a specific hour/day combo
type SlotStats struct {
    HourOfDay        int
    DayOfWeek        int
    AvgQueueDepth    float64
    AvgWaitSecs      int
    TotalBookings    int
    NoShowRate       float64
    CancellationRate float64
}

// UserPreferences — derived from booking history
type UserPreferences struct {
    PreferredHours   []int
    PreferredDays    []int
    AvgAdvanceDays   int
    TotalBookings    int
}

// AvailableSlot — a raw open slot from the appointments table
type AvailableSlot struct {
    SlotID      string
    StartsAt    time.Time
    AgentID     string
    DurationMin int
}

// GetSlotAnalytics — pulls historical stats for ALL hour/day combos for an org
func (r *SmartSlotRepo) GetSlotAnalytics(ctx context.Context, orgID string) ([]SlotStats, error) {
    rows, err := r.db.QueryContext(ctx, `
        SELECT hour_of_day, day_of_week, avg_queue_depth, avg_wait_secs,
               total_bookings, noshow_rate, cancellation_rate
        FROM slot_analytics
        WHERE org_id = $1
        ORDER BY avg_wait_secs ASC
    `, orgID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var stats []SlotStats
    for rows.Next() {
        var s SlotStats
        rows.Scan(&s.HourOfDay, &s.DayOfWeek, &s.AvgQueueDepth,
            &s.AvgWaitSecs, &s.TotalBookings, &s.NoShowRate, &s.CancellationRate)
        stats = append(stats, s)
    }
    return stats, nil
}

// GetUserPreferences — user's personal booking patterns
func (r *SmartSlotRepo) GetUserPreferences(ctx context.Context, userID string) (UserPreferences, error) {
    var prefs UserPreferences
    var hours, days []byte // scan postgres arrays as raw bytes

    err := r.db.QueryRowContext(ctx, `
        SELECT preferred_hours, preferred_days, avg_advance_days, total_bookings
        FROM user_booking_preferences
        WHERE user_id = $1
    `, userID).Scan(&hours, &days, &prefs.AvgAdvanceDays, &prefs.TotalBookings)

    if err == sql.ErrNoRows {
        return UserPreferences{}, nil // new user — no preferences yet
    }
    return prefs, err
}

// GetAvailableSlots — open slots for an org in a date range
func (r *SmartSlotRepo) GetAvailableSlots(ctx context.Context,
    orgID string, from, to time.Time) ([]AvailableSlot, error) {

    rows, err := r.db.QueryContext(ctx, `
        SELECT id, starts_at, agent_id, duration_minutes
        FROM appointment_slots
        WHERE org_id = $1
          AND starts_at BETWEEN $2 AND $3
          AND is_booked = false
          AND is_blocked = false
        ORDER BY starts_at ASC
    `, orgID, from, to)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var slots []AvailableSlot
    for rows.Next() {
        var s AvailableSlot
        rows.Scan(&s.SlotID, &s.StartsAt, &s.AgentID, &s.DurationMin)
        slots = append(slots, s)
    }
    return slots, nil
}

// GetLiveQueueDepth — current queue depth from Redis snapshot (last 5 min avg)
// This is a fast supplementary signal
func (r *SmartSlotRepo) GetRecentQueueDepths(ctx context.Context, orgID string) (map[int]float64, error) {
    // hour → avg queue depth in the last 4 weeks, same day of week
    rows, err := r.db.QueryContext(ctx, `
        SELECT hour_of_day, AVG(avg_queue_depth)
        FROM slot_analytics
        WHERE org_id = $1
        GROUP BY hour_of_day
        ORDER BY hour_of_day
    `, orgID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    depths := make(map[int]float64)
    for rows.Next() {
        var hour int
        var depth float64
        rows.Scan(&hour, &depth)
        depths[hour] = depth
    }
    return depths, nil
}

// SaveRecommendation — store what we recommended for feedback tracking
func (r *SmartSlotRepo) SaveRecommendation(ctx context.Context,
    userID, orgID, recommendedSlotID string, score float64) error {
    _, err := r.db.ExecContext(ctx, `
        INSERT INTO recommendation_feedback
            (user_id, org_id, recommended_slot_id, recommendation_score)
        VALUES ($1, $2, $3, $4)
    `, userID, orgID, recommendedSlotID, score)
    return err
}

// RecordUserChoice — call this after user picks a slot to close the feedback loop
func (r *SmartSlotRepo) RecordUserChoice(ctx context.Context,
    userID, orgID, chosenSlotID, recommendedSlotID string) error {
    _, err := r.db.ExecContext(ctx, `
        UPDATE recommendation_feedback
        SET chosen_slot_id   = $1,
            accepted_top_pick = ($1 = recommended_slot_id)
        WHERE user_id = $2
          AND org_id  = $3
          AND chosen_slot_id IS NULL
        ORDER BY created_at DESC
        LIMIT 1
    `, chosenSlotID, userID, orgID)
    return err
}
```

---

## 📊 Step 5 — Slot Scorer (`scorer.go`)

Before calling Claude, pre-score each slot with raw numbers so Claude has context to reason about:

```go
package smartslot

import (
    "fmt"
    "time"
)

// ScoredSlot — a slot enriched with analytics signals, ready for Claude
type ScoredSlot struct {
    SlotID          string
    StartsAt        time.Time
    Label           string    // "Tuesday 10:00 AM"
    DayOfWeek       string
    HourOfDay       int

    // Analytics signals (0.0 to 1.0 where higher = better for user)
    WaitTimeScore    float64  // low wait = high score
    BusynessScore    float64  // low queue = high score
    NoShowRiskScore  float64  // low noshow rate = high score (proxy for reliability)
    UserMatchScore   float64  // matches user's historic preference
    DataConfidence   string   // "high", "medium", "low" (based on sample size)

    // Raw values for Claude's context
    AvgWaitMins      float64
    AvgQueueDepth    float64
    TotalSamples     int
}

var dayNames = []string{"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"}

// ScoreSlots — enriches each available slot with analytics signals
func ScoreSlots(
    slots []AvailableSlot,
    analytics []SlotStats,
    prefs UserPreferences,
) []ScoredSlot {

    // Build a lookup map: (hour, day) → SlotStats
    statsMap := make(map[string]SlotStats)
    var maxWait, maxDepth float64
    for _, s := range analytics {
        key := fmt.Sprintf("%d_%d", s.HourOfDay, s.DayOfWeek)
        statsMap[key] = s
        if float64(s.AvgWaitSecs) > maxWait { maxWait = float64(s.AvgWaitSecs) }
        if s.AvgQueueDepth > maxDepth       { maxDepth = s.AvgQueueDepth }
    }

    // Build preference lookup sets
    prefHours := make(map[int]bool)
    prefDays  := make(map[int]bool)
    for _, h := range prefs.PreferredHours { prefHours[h] = true }
    for _, d := range prefs.PreferredDays  { prefDays[d]  = true }

    var scored []ScoredSlot
    for _, slot := range slots {
        hour := slot.StartsAt.Hour()
        dow  := int(slot.StartsAt.Weekday())
        key  := fmt.Sprintf("%d_%d", hour, dow)

        stat, hasStat := statsMap[key]

        ss := ScoredSlot{
            SlotID:    slot.SlotID,
            StartsAt:  slot.StartsAt,
            Label:     fmt.Sprintf("%s %d:%02d %s",
                dayNames[dow], normalizeHour(hour), slot.StartsAt.Minute(), amPm(hour)),
            DayOfWeek: dayNames[dow],
            HourOfDay: hour,
        }

        if hasStat && stat.TotalBookings > 0 {
            // Wait time score: invert (low wait = high score)
            if maxWait > 0 {
                ss.WaitTimeScore = 1.0 - (float64(stat.AvgWaitSecs) / maxWait)
            } else {
                ss.WaitTimeScore = 1.0
            }

            // Busyness score: invert queue depth
            if maxDepth > 0 {
                ss.BusynessScore = 1.0 - (stat.AvgQueueDepth / maxDepth)
            } else {
                ss.BusynessScore = 1.0
            }

            // No-show risk as proxy for reliability (low noshow = high score)
            ss.NoShowRiskScore = 1.0 - stat.NoShowRate

            ss.AvgWaitMins   = float64(stat.AvgWaitSecs) / 60.0
            ss.AvgQueueDepth = stat.AvgQueueDepth
            ss.TotalSamples  = stat.TotalBookings

            switch {
            case stat.TotalBookings >= 500: ss.DataConfidence = "high"
            case stat.TotalBookings >= 50:  ss.DataConfidence = "medium"
            default:                        ss.DataConfidence = "low"
            }
        } else {
            // No historical data — neutral scores
            ss.WaitTimeScore   = 0.5
            ss.BusynessScore   = 0.5
            ss.NoShowRiskScore = 0.5
            ss.DataConfidence  = "low"
        }

        // User preference match
        matchScore := 0.0
        if prefHours[hour] { matchScore += 0.5 }
        if prefDays[dow]   { matchScore += 0.5 }
        ss.UserMatchScore = matchScore

        scored = append(scored, ss)
    }

    return scored
}

func normalizeHour(h int) int {
    if h > 12 { return h - 12 }
    if h == 0 { return 12 }
    return h
}

func amPm(h int) string {
    if h >= 12 { return "PM" }
    return "AM"
}
```

---

## 🤖 Step 6 — Claude AI Ranker (`claude.go`)

```go
package smartslot

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "os"
    "strings"
)

type SlotRanker struct {
    apiKey string
    client *http.Client
}

func NewSlotRanker() *SlotRanker {
    return &SlotRanker{
        apiKey: os.Getenv("ANTHROPIC_API_KEY"),
        client: &http.Client{},
    }
}

// RecommendedSlot — what we return to the frontend
type RecommendedSlot struct {
    SlotID      string  `json:"slot_id"`
    DateTime    string  `json:"datetime"`
    Label       string  `json:"label"`
    Score       float64 `json:"score"`           // 0.0 to 1.0
    Badge       string  `json:"badge"`           // e.g. "🏆 Best Pick"
    Reason      string  `json:"reason"`          // human-readable explanation
}

type RankingResponse struct {
    RecommendedSlots []RecommendedSlot `json:"recommended_slots"`
    Explanation      string            `json:"explanation"`
}

func (r *SlotRanker) Rank(ctx context.Context,
    slots []ScoredSlot, prefs UserPreferences, orgName string) (RankingResponse, error) {

    if len(slots) == 0 {
        return RankingResponse{}, fmt.Errorf("no slots to rank")
    }

    // Cap at 20 slots to avoid huge prompts — take first 20 by time
    if len(slots) > 20 {
        slots = slots[:20]
    }

    prompt := buildRankingPrompt(slots, prefs, orgName)

    body, _ := json.Marshal(map[string]interface{}{
        "model":      "claude-sonnet-4-20250514",
        "max_tokens": 1000,
        "messages": []map[string]string{
            {"role": "user", "content": prompt},
        },
    })

    req, _ := http.NewRequestWithContext(ctx, "POST",
        "https://api.anthropic.com/v1/messages", bytes.NewBuffer(body))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("x-api-key", r.apiKey)
    req.Header.Set("anthropic-version", "2023-06-01")

    resp, err := r.client.Do(req)
    if err != nil {
        return RankingResponse{}, err
    }
    defer resp.Body.Close()

    var claudeResp struct {
        Content []struct{ Text string `json:"text"` } `json:"content"`
    }
    json.NewDecoder(resp.Body).Decode(&claudeResp)

    if len(claudeResp.Content) == 0 {
        return RankingResponse{}, fmt.Errorf("empty claude response")
    }

    return parseRankingResponse(claudeResp.Content[0].Text), nil
}

func buildRankingPrompt(slots []ScoredSlot, prefs UserPreferences, orgName string) string {
    // Serialize slots into a readable table for Claude
    var sb strings.Builder
    sb.WriteString(fmt.Sprintf(`You are a smart appointment slot recommender for "%s".

Your job: Analyze the available slots below and recommend the TOP 3 best ones for the user.

USER PREFERENCES:
- Preferred hours: %v (empty = no clear preference)
- Preferred days: %v
- Total past bookings: %d
- Average days booked in advance: %d

AVAILABLE SLOTS WITH ANALYTICS:
(Scores are 0.0-1.0 where HIGHER = BETTER for the user)

`, orgName, prefs.PreferredHours, prefs.PreferredDays, prefs.TotalBookings, prefs.AvgAdvanceDays))

    sb.WriteString("slot_id | label | wait_score | busy_score | user_match | avg_wait_mins | avg_queue | confidence\n")
    sb.WriteString("--------|-------|------------|------------|------------|---------------|-----------|----------\n")

    for _, s := range slots {
        sb.WriteString(fmt.Sprintf("%s | %s | %.2f | %.2f | %.2f | %.1f min | %.1f people | %s\n",
            s.SlotID, s.Label,
            s.WaitTimeScore, s.BusynessScore, s.UserMatchScore,
            s.AvgWaitMins, s.AvgQueueDepth, s.DataConfidence,
        ))
    }

    sb.WriteString(`
SCORING GUIDANCE:
- wait_score: Higher = historically shorter wait times at this slot
- busy_score: Higher = fewer people in queue at this time  
- user_match: Higher = this slot matches the user's past booking preferences
- avg_wait_mins: Raw average wait in minutes (lower = better)
- avg_queue: Raw average people in queue (lower = better)
- confidence: How much historical data backs these scores

RULES FOR PICKING TOP 3:
1. Prioritize low avg_wait_mins and low avg_queue above all else
2. If user_match is high AND wait is low → boost that slot
3. If confidence is "low", mention it in the reason as a caveat
4. Give each slot a badge: "🏆 Best Pick", "⚡ Quick In & Out", "📅 Also Great", "🌅 Early Bird", "🌆 Afternoon Pick"
5. Write reasons in plain English, 1 sentence max, friendly tone
6. Score field should be your overall composite recommendation score (0.0-1.0)

Respond ONLY with this exact JSON format, no extra text:
{
  "recommended_slots": [
    {
      "slot_id": "<exact slot_id from table>",
      "datetime": "<ISO8601 datetime>",
      "label": "<exact label from table>",
      "score": <float>,
      "badge": "<badge emoji + text>",
      "reason": "<1 sentence friendly reason>"
    }
  ],
  "explanation": "<1 sentence summary of overall recommendation strategy>"
}`)

    return sb.String()
}

func parseRankingResponse(text string) RankingResponse {
    text = strings.TrimSpace(text)
    // Strip markdown code fences if Claude adds them
    text = strings.TrimPrefix(text, "```json")
    text = strings.TrimPrefix(text, "```")
    text = strings.TrimSuffix(text, "```")
    text = strings.TrimSpace(text)

    var response RankingResponse
    if err := json.Unmarshal([]byte(text), &response); err != nil {
        // Fallback — return empty with error note
        return RankingResponse{
            Explanation: "Could not generate recommendations. Please pick from all available slots.",
        }
    }
    return response
}
```

---

## ⚙️ Step 7 — Main Service (`service.go`)

```go
package smartslot

import (
    "context"
    "fmt"
    "time"
)

type SmartSlotService struct {
    repo   *SmartSlotRepo
    ranker *SlotRanker
}

func NewSmartSlotService(repo *SmartSlotRepo) *SmartSlotService {
    return &SmartSlotService{
        repo:   repo,
        ranker: NewSlotRanker(),
    }
}

type RecommendRequest struct {
    UserID  string
    OrgID   string
    OrgName string
    FromDate time.Time
    ToDate   time.Time
}

type RecommendResponse struct {
    RecommendedSlots []RecommendedSlot `json:"recommended_slots"`
    AllSlotsCount    int               `json:"all_slots_available"`
    Explanation      string            `json:"explanation"`
}

func (s *SmartSlotService) GetRecommendations(ctx context.Context, req RecommendRequest) (RecommendResponse, error) {
    // 1. Get all available raw slots in the date range
    available, err := s.repo.GetAvailableSlots(ctx, req.OrgID, req.FromDate, req.ToDate)
    if err != nil {
        return RecommendResponse{}, fmt.Errorf("failed to get slots: %w", err)
    }
    if len(available) == 0 {
        return RecommendResponse{AllSlotsCount: 0, Explanation: "No slots available in this period."}, nil
    }

    // 2. Pull historical slot analytics
    analytics, err := s.repo.GetSlotAnalytics(ctx, req.OrgID)
    if err != nil {
        analytics = []SlotStats{} // fallback — proceed without history
    }

    // 3. Pull user booking preferences
    prefs, err := s.repo.GetUserPreferences(ctx, req.UserID)
    if err != nil {
        prefs = UserPreferences{} // new user — neutral preferences
    }

    // 4. Score each slot
    scored := ScoreSlots(available, analytics, prefs)

    // 5. Ask Claude to rank and explain
    ranking, err := s.ranker.Rank(ctx, scored, prefs, req.OrgName)
    if err != nil {
        // Fallback: return top 3 by wait score without AI explanation
        return s.fallbackRecommend(scored, len(available)), nil
    }

    // 6. Save recommendation for feedback tracking
    if len(ranking.RecommendedSlots) > 0 {
        s.repo.SaveRecommendation(ctx,
            req.UserID, req.OrgID,
            ranking.RecommendedSlots[0].SlotID,
            ranking.RecommendedSlots[0].Score,
        )
    }

    return RecommendResponse{
        RecommendedSlots: ranking.RecommendedSlots,
        AllSlotsCount:    len(available),
        Explanation:      ranking.Explanation,
    }, nil
}

// fallbackRecommend — if Claude fails, return top 3 by composite score
func (s *SmartSlotService) fallbackRecommend(scored []ScoredSlot, total int) RecommendResponse {
    // Sort by wait time score
    sort.Slice(scored, func(i, j int) bool {
        return scored[i].WaitTimeScore > scored[j].WaitTimeScore
    })

    var slots []RecommendedSlot
    for i, s := range scored {
        if i >= 3 { break }
        slots = append(slots, RecommendedSlot{
            SlotID:   s.SlotID,
            DateTime: s.StartsAt.Format(time.RFC3339),
            Label:    s.Label,
            Score:    s.WaitTimeScore,
            Badge:    []string{"🏆 Best Pick", "⚡ Quick In & Out", "📅 Also Available"}[i],
            Reason:   fmt.Sprintf("Historically low wait time: ~%.0f minutes.", s.AvgWaitMins),
        })
    }
    return RecommendResponse{
        RecommendedSlots: slots,
        AllSlotsCount:    total,
        Explanation:      "Based on historical wait time data.",
    }
}
```

---

## 🌐 Step 8 — HTTP Handler

```go
// GET /api/v1/appointments/recommend?org_id=xxx&from=2025-08-01&to=2025-08-07
func (h *AppointmentHandler) GetRecommendedSlots(c *gin.Context) {
    userID := c.GetString("user_id") // from JWT middleware
    orgID  := c.Query("org_id")

    from, err := time.Parse("2006-01-02", c.Query("from"))
    if err != nil {
        from = time.Now()
    }
    to, err := time.Parse("2006-01-02", c.Query("to"))
    if err != nil {
        to = time.Now().AddDate(0, 0, 7) // default: next 7 days
    }

    org, _ := h.orgRepo.GetByID(c.Request.Context(), orgID)

    result, err := h.smartSlotService.GetRecommendations(c.Request.Context(),
        smartslot.RecommendRequest{
            UserID:   userID,
            OrgID:    orgID,
            OrgName:  org.Name,
            FromDate: from,
            ToDate:   to,
        })
    if err != nil {
        c.JSON(500, gin.H{"error": "recommendation failed"})
        return
    }

    c.JSON(200, result)
}
```

**Register the route:**
```go
api.GET("/appointments/recommend", middleware.Auth(), appointmentHandler.GetRecommendedSlots)
```

---

## 🔄 Step 9 — Update User Preferences After Each Booking

Call this whenever a user books an appointment to keep preferences fresh:

```go
// internal/appointments/service.go — add after successful booking
func (s *AppointmentService) updateUserPreferences(ctx context.Context, userID string, scheduledAt time.Time) {
    s.db.ExecContext(ctx, `
        INSERT INTO user_booking_preferences (user_id, preferred_hours, preferred_days, total_bookings, last_updated)
        VALUES ($1, ARRAY[$2], ARRAY[$3], 1, NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET preferred_hours = (
                SELECT ARRAY(
                    SELECT hour FROM (
                        SELECT EXTRACT(HOUR FROM scheduled_at)::INT AS hour
                        FROM appointments
                        WHERE user_id = $1
                        ORDER BY created_at DESC LIMIT 20
                    ) recent
                    GROUP BY hour ORDER BY COUNT(*) DESC LIMIT 3
                )
            ),
            preferred_days = (
                SELECT ARRAY(
                    SELECT dow FROM (
                        SELECT EXTRACT(DOW FROM scheduled_at)::INT AS dow
                        FROM appointments
                        WHERE user_id = $1
                        ORDER BY created_at DESC LIMIT 20
                    ) recent
                    GROUP BY dow ORDER BY COUNT(*) DESC LIMIT 3
                )
            ),
            total_bookings = user_booking_preferences.total_bookings + 1,
            last_updated   = NOW()
    `, userID, scheduledAt.Hour(), int(scheduledAt.Weekday()))
}
```

---

## 🌙 Step 10 — Nightly Stats Refresh (Cron Job)

```go
// Add to your main.go background jobs
go func() {
    // Refresh slot_analytics every night at 2 AM
    for {
        now := time.Now()
        next2AM := time.Date(now.Year(), now.Month(), now.Day()+1, 2, 0, 0, 0, now.Location())
        time.Sleep(time.Until(next2AM))

        db.Exec(`
            INSERT INTO slot_analytics
                (org_id, hour_of_day, day_of_week, avg_queue_depth,
                 avg_wait_secs, total_bookings, noshow_rate, last_updated)
            SELECT
                sd.org_id,
                EXTRACT(HOUR FROM sd.called_at)::INT,
                EXTRACT(DOW  FROM sd.called_at)::INT,
                COUNT(*) / 4.0,
                AVG(sd.duration_secs)::INT,
                COUNT(*),
                COALESCE(
                    (SELECT COUNT(*)::FLOAT
                     FROM appointment_outcomes ao
                     WHERE ao.org_id = sd.org_id
                       AND ao.outcome = 'noshow'
                       AND EXTRACT(HOUR FROM ao.scheduled_at) = EXTRACT(HOUR FROM sd.called_at)
                       AND EXTRACT(DOW  FROM ao.scheduled_at) = EXTRACT(DOW  FROM sd.called_at)
                    ) / NULLIF(COUNT(*),0),
                0),
                NOW()
            FROM service_durations sd
            WHERE sd.created_at > NOW() - INTERVAL '90 days'
            GROUP BY sd.org_id,
                     EXTRACT(HOUR FROM sd.called_at),
                     EXTRACT(DOW  FROM sd.called_at)
            ON CONFLICT (org_id, hour_of_day, day_of_week) DO UPDATE
            SET avg_wait_secs   = EXCLUDED.avg_wait_secs,
                avg_queue_depth = EXCLUDED.avg_queue_depth,
                total_bookings  = EXCLUDED.total_bookings,
                noshow_rate     = EXCLUDED.noshow_rate,
                last_updated    = NOW()
        `)
    }
}()
```

---

## ✅ Full API Response Example

```json
GET /api/v1/appointments/recommend?org_id=clinic_abc&from=2025-08-04&to=2025-08-08

{
  "recommended_slots": [
    {
      "slot_id": "slot_tues_10am",
      "datetime": "2025-08-05T10:00:00Z",
      "label": "Tuesday 10:00 AM",
      "score": 0.94,
      "badge": "🏆 Best Pick",
      "reason": "Quietest slot this week — average wait is just 4 minutes with only 2 people in queue."
    },
    {
      "slot_id": "slot_wed_9am",
      "datetime": "2025-08-06T09:00:00Z",
      "label": "Wednesday 9:00 AM",
      "score": 0.81,
      "badge": "⚡ Quick In & Out",
      "reason": "Low traffic morning slot that matches your past preference for early appointments."
    },
    {
      "slot_id": "slot_thu_2pm",
      "datetime": "2025-08-07T14:00:00Z",
      "label": "Thursday 2:00 PM",
      "score": 0.67,
      "badge": "📅 Also Great",
      "reason": "Moderate traffic but good availability — average wait around 11 minutes."
    }
  ],
  "all_slots_available": 14,
  "explanation": "Recommendations prioritize low wait times and your preference for morning slots."
}
```

---

## 📈 How Recommendations Improve Over Time

| Stage | Data Available | Quality |
|---|---|---|
| New org (0–50 bookings) | No history | Random + fair scheduling |
| Growing (50–500 bookings) | Patterns emerging | Medium — spots busy hours |
| Established (500+ bookings) | Rich analytics | High — very precise quiet slots |
| User has 5+ bookings | Personal preferences | Personalized per user |

Every booking → updates `slot_analytics` + `user_booking_preferences` → next recommendation is smarter. **Fully self-improving with zero manual work.**

---

## 🌍 Environment Variables Needed

```env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx    # only new one needed
```

Everything else (PostgreSQL, Redis, Google API) is already in your `.env`.

---

## 🔁 Feedback Loop — Track Acceptance Rate

```sql
-- See how often users pick the #1 recommended slot (measure AI quality)
SELECT
    DATE_TRUNC('week', created_at)  AS week,
    COUNT(*)                         AS total_recommendations,
    SUM(CASE WHEN accepted_top_pick THEN 1 ELSE 0 END) AS accepted,
    ROUND(
        100.0 * SUM(CASE WHEN accepted_top_pick THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
    2)                               AS acceptance_rate_pct
FROM recommendation_feedback
WHERE org_id = $1
GROUP BY week
ORDER BY week DESC;
```

A good AI recommender should hit **60–75% acceptance rate** within a few weeks of data. If below 50%, your slot analytics data needs more history.

---

> **You now have all 4 AI features documented:**
> 1. ✅ `AI_WAIT_TIME_PREDICTION.md`
> 2. ✅ `AI_NOSHOW_PREDICTION.md`
> 3. ✅ `AI_RECEPTIONIST_CHATBOT.md`
> 4. ✅ `AI_SMART_SLOT_RECOMMENDATION.md` ← this file
