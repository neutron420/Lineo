package cronjobs

import (
	"context"
	"log/slog"

	"github.com/robfig/cron/v3"

	"queueless/internal/repository"
)

// Scheduler registers and manages all notification cron jobs.
type Scheduler struct {
	cron     *cron.Cron
	apptSvc  *AppointmentReminderService
	queueSvc *QueueReminderService
	logger   *slog.Logger
}

// NewScheduler creates a fully wired scheduler with all dependencies from
// the existing Lineo service layer.
func NewScheduler(
	pushSvc PushSender,
	queueRepo repository.QueueRepository,
	orgRepo repository.OrganizationRepository,
) *Scheduler {
	return &Scheduler{
		cron:     cron.New(),
		apptSvc:  NewAppointmentReminderService(pushSvc),
		queueSvc: NewQueueReminderService(pushSvc, queueRepo, orgRepo),
		logger:   slog.Default(),
	}
}

// ApptService exposes the appointment reminder service so main.go / consumers
// can call OnBookingConfirmed / OnAppointmentCancelled hooks directly.
func (s *Scheduler) ApptService() *AppointmentReminderService {
	return s.apptSvc
}

// Register adds all cron jobs to the scheduler.
func (s *Scheduler) Register() {
	// ═══════════════════════════════════════════════════════════════════
	//  APPOINTMENT REMINDERS (7 stages)
	// ═══════════════════════════════════════════════════════════════════

	// Stage 1 — 7 days before — daily at 9:00 AM UTC
	s.cron.AddFunc("0 9 * * *", func() {
		s.logger.Info("🔔 Running Appointment Stage 1 (7-day reminder)...")
		s.apptSvc.RunStage(context.Background(), Stages[0])
	})

	// Stage 2 — 3 days before — daily at 9:00 AM UTC
	s.cron.AddFunc("0 9 * * *", func() {
		s.logger.Info("🔔 Running Appointment Stage 2 (3-day reminder)...")
		s.apptSvc.RunStage(context.Background(), Stages[1])
	})

	// Stage 3 — 24 hours before — daily at 8:00 AM UTC
	s.cron.AddFunc("0 8 * * *", func() {
		s.logger.Info("🔔 Running Appointment Stage 3 (24-hour reminder)...")
		s.apptSvc.RunStage(context.Background(), Stages[2])
	})

	// Stage 4 — 2 hours before — every hour on the hour
	s.cron.AddFunc("0 * * * *", func() {
		s.logger.Info("🔔 Running Appointment Stage 4 (2-hour reminder)...")
		s.apptSvc.RunStage(context.Background(), Stages[3])
	})

	// Stage 5 — 30 minutes before — every 5 minutes
	s.cron.AddFunc("*/5 * * * *", func() {
		s.logger.Info("🔔 Running Appointment Stage 5 (30-min reminder)...")
		s.apptSvc.RunStage(context.Background(), Stages[4])
	})

	// Stage 6 — 5 minutes before — every 1 minute
	s.cron.AddFunc("* * * * *", func() {
		s.apptSvc.RunStage(context.Background(), Stages[5])
	})

	// Stage 7 — Post-visit follow-up — every hour
	s.cron.AddFunc("0 * * * *", func() {
		s.logger.Info("🔔 Running Appointment Stage 7 (post-visit feedback)...")
		s.apptSvc.RunStage(context.Background(), Stages[6])
	})

	// ═══════════════════════════════════════════════════════════════════
	//  LIVE QUEUE REMINDERS (5 stages, single idempotent check)
	// ═══════════════════════════════════════════════════════════════════

	// Queue check runs every minute. The function itself is idempotent — Redis
	// dedup keys ensure each stage is only sent once per ticket. Running it
	// every minute means Q5 ("you're almost up!") fires with ≤1 min latency.
	s.cron.AddFunc("* * * * *", func() {
		s.queueSvc.RunQueueCheck(context.Background())
	})

	s.logger.Info("✅ Notification cron scheduler registered — 7 appointment stages + 5 queue stages")
}

// Start begins executing all registered cron jobs.
func (s *Scheduler) Start() {
	s.logger.Info("🚀 Notification cron scheduler started")
	s.cron.Start()
}

// Stop gracefully stops the cron scheduler and waits for running jobs.
func (s *Scheduler) Stop() context.Context {
	s.logger.Info("🛑 Stopping notification cron scheduler...")
	return s.cron.Stop()
}
