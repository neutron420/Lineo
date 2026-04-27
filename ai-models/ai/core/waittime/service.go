package waittime

import (
    "context"
    "fmt"
    "time"

    "github.com/redis/go-redis/v9"
)

type WaitTimeService struct {
    repo      *WaitTimeRepo
    predictor *OpenAIPredictor
    redis     *redis.Client
}

func NewWaitTimeService(repo *WaitTimeRepo, redis *redis.Client) *WaitTimeService {
    return &WaitTimeService{
        repo:      repo,
        predictor: NewOpenAIPredictor(),
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
    var queuePosition int
    pos, err := s.redis.ZRank(ctx, req.QueueKey, req.UserTicketID).Result()
    if err != nil {
        // Fallback for testing: if ticket isn't in Redis, just pretend they are 5th in line
        fmt.Println("Warning: Ticket not in Redis, defaulting to position 5 for testing AI")
        queuePosition = 5 
    } else {
        queuePosition = int(pos) + 1 // ZRank is 0-indexed
    }

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
