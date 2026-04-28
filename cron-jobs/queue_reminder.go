package cronjobs

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"queueless/internal/models"
	"queueless/internal/repository"
	"queueless/pkg/redis"
)

// QueueStage defines a threshold window for live queue notifications.
type QueueStage struct {
	Stage        string        // "Q1" through "Q5"
	MinWait      time.Duration // Lower bound of EWT window
	MaxWait      time.Duration // Upper bound of EWT window
	Title        string
	BodyTemplate string        // %s → org name
	DedupeExpiry time.Duration // How long to block re-sending this stage
}

// QueueStages are the 5 live queue reminder stages based on Estimated Wait Time (EWT).
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

// QueueReminderService monitors live queue EWT and sends push notifications
// at progressive thresholds.
type QueueReminderService struct {
	pushSvc   PushSender
	queueRepo repository.QueueRepository
	orgRepo   repository.OrganizationRepository
}

// NewQueueReminderService creates a new queue reminder service wired into
// existing Lineo repositories and push infrastructure.
func NewQueueReminderService(
	pushSvc PushSender,
	queueRepo repository.QueueRepository,
	orgRepo repository.OrganizationRepository,
) *QueueReminderService {
	return &QueueReminderService{
		pushSvc:   pushSvc,
		queueRepo: queueRepo,
		orgRepo:   orgRepo,
	}
}

// RunQueueCheck is the main cron entry point. It iterates all active queues,
// calculates each waiting user's EWT, and fires the appropriate stage push.
// This function is idempotent — Redis dedup keys prevent duplicate sends.
func (s *QueueReminderService) RunQueueCheck(ctx context.Context) {
	// Get all queue definitions to iterate over all active queues.
	var queueDefs []models.QueueDef
	if err := fetchAllQueueDefs(&queueDefs); err != nil {
		slog.Error("cron: queue reminder — failed to fetch queue defs", "error", err)
		return
	}

	for _, qd := range queueDefs {
		s.processQueue(ctx, qd)
	}
}

func (s *QueueReminderService) processQueue(ctx context.Context, qd models.QueueDef) {
	// Get waiting list from Redis
	waiting, err := s.queueRepo.GetQueueList(qd.QueueKey)
	if err != nil || len(waiting) == 0 {
		return
	}

	// Get average service time (minutes) for EWT calculation
	_, avgServiceMins, _ := s.queueRepo.CalculateAverages(qd.QueueKey)
	if avgServiceMins <= 0 {
		avgServiceMins = 5 // Default fallback: 5 min per person
	}

	// Get org name for the push message
	org, err := s.orgRepo.GetOrganizationByID(qd.OrganizationID)
	if err != nil {
		return
	}

	for i, entry := range waiting {
		if entry.UserID == 0 {
			continue // Skip kiosk (anonymous) users — no push target
		}

		// Position is 1-indexed
		position := i + 1

		// EWT = position × avg_service_time_per_person
		ewt := time.Duration(position*avgServiceMins) * time.Minute

		// Find which stage this EWT falls into
		for _, stage := range QueueStages {
			if ewt >= stage.MinWait && ewt < stage.MaxWait {
				s.maybeNotifyQueue(ctx, entry, org.Name, stage)
				break // Only fire one stage per check per user
			}
		}
	}
}

// maybeNotifyQueue checks the Redis dedup key and sends the push if not already sent.
func (s *QueueReminderService) maybeNotifyQueue(ctx context.Context, entry models.QueueEntry, orgName string, stage QueueStage) {
	// Redis dedup key — prevents re-sending same stage for same ticket
	dedupKey := fmt.Sprintf("queue_notif:%s:%s", entry.TokenNumber, stage.Stage)

	// Check if already sent
	exists, err := redis.Client.Exists(ctx, dedupKey).Result()
	if err != nil || exists > 0 {
		return // Already sent this stage for this ticket
	}

	body := fmt.Sprintf(stage.BodyTemplate, orgName)

	pushErr := s.pushSvc.SendToUser(ctx, entry.UserID, PushPayload{
		Title:     stage.Title,
		Body:      body,
		URL:       "/dashboard",
		NotifType: "queue",
	})

	if pushErr != nil {
		slog.Warn("cron: queue push failed",
			"token", entry.TokenNumber,
			"stage", stage.Stage,
			"error", pushErr,
		)
		return
	}

	// Set dedup key with TTL so this stage doesn't fire again
	redis.Client.Set(ctx, dedupKey, "1", stage.DedupeExpiry)

	slog.Info("cron: queue notif sent",
		"token", entry.TokenNumber,
		"stage", stage.Stage,
		"org", orgName,
	)
}
