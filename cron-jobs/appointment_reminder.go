package cronjobs

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"queueless/internal/models"
	"queueless/pkg/db"
)

// StageConfig defines a single appointment reminder stage.
type StageConfig struct {
	Stage        int
	WindowBefore time.Duration // How far before the appointment this stage fires
	WindowSlack  time.Duration // ± tolerance window so the cron doesn't have to hit the exact second
	Title        string
	BodyTemplate string // %s → org name
}

// Stages are the 7 appointment reminder stages.
// Stage 7 has a NEGATIVE WindowBefore meaning it fires AFTER the appointment.
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
		WindowBefore: -1 * time.Hour, // NEGATIVE → 1 hour AFTER appointment
		WindowSlack:  30 * time.Minute,
		Title:        "✅ How Was Your Visit?",
		BodyTemplate: "Thanks for visiting %s! Tap to rate your experience.",
	},
}

// AppointmentReminderService runs cron-driven appointment reminders.
type AppointmentReminderService struct {
	pushSvc PushSender
}

// NewAppointmentReminderService creates a new appointment reminder service
// using the existing Lineo push infrastructure.
func NewAppointmentReminderService(pushSvc PushSender) *AppointmentReminderService {
	return &AppointmentReminderService{pushSvc: pushSvc}
}

// RunStage executes a single reminder stage.
// It queries all confirmed appointments whose scheduled time falls within the
// stage's window, checks that the reminder hasn't been sent already (dedup via
// appointment_reminders table), sends the push, and marks it as sent.
func (s *AppointmentReminderService) RunStage(ctx context.Context, stage StageConfig) {
	now := time.Now().UTC()

	// Calculate the time window in which the appointment's start_time must fall.
	// For pre-appointment stages: appointment is X hours from now ± slack.
	// For post-appointment (stage 7): appointment was 1 hour ago ± slack.
	targetTime := now.Add(stage.WindowBefore)
	windowStart := targetTime.Add(-stage.WindowSlack)
	windowEnd := targetTime.Add(stage.WindowSlack)

	// Query appointments in window that haven't had this stage sent yet.
	type appointmentRow struct {
		ID        uint
		UserID    uint
		OrgName   string
		StartTime time.Time
	}

	var rows []appointmentRow
	err := db.DB.WithContext(ctx).
		Table("appointments a").
		Select("a.id, a.user_id, o.name AS org_name, a.start_time").
		Joins("JOIN organizations o ON o.id = a.organization_id").
		Where("a.status IN ?", []models.AppointmentStatus{models.ApptScheduled, models.ApptCheckedIn}).
		Where("a.start_time BETWEEN ? AND ?", windowStart, windowEnd).
		Where("a.user_id > 0"). // Only registered users (not kiosk)
		Where("NOT EXISTS (SELECT 1 FROM appointment_reminders ar WHERE ar.appointment_id = a.id AND ar.stage = ?)", stage.Stage).
		Where("a.deleted_at IS NULL").
		Scan(&rows).Error

	if err != nil {
		slog.Error("cron: appointment reminder DB error", "stage", stage.Stage, "error", err)
		return
	}

	slog.Info("cron: appointment reminder stage", "stage", stage.Stage, "found", len(rows))

	for _, row := range rows {
		body := fmt.Sprintf(stage.BodyTemplate, row.OrgName)
		url := "/dashboard/appointments"
		if stage.Stage == 7 {
			url = "/dashboard" // Redirect to feedback on post-visit
		}

		pushErr := s.pushSvc.SendToUser(ctx, row.UserID, PushPayload{
			Title:     stage.Title,
			Body:      body,
			URL:       url,
			NotifType: "appointment",
		})

		errMsg := ""
		if pushErr != nil {
			errMsg = pushErr.Error()
			slog.Warn("cron: appointment push failed",
				"stage", stage.Stage,
				"appointment_id", row.ID,
				"user_id", row.UserID,
				"error", pushErr,
			)
		}

		// Mark as sent (or failed) — ON CONFLICT DO NOTHING ensures idempotency.
		markReminder(ctx, row.ID, stage.Stage, errMsg)
	}
}

// OnBookingConfirmed should be called immediately after an appointment is created.
// It pre-marks all already-past stages as "skipped" so the cron never fires them
// (handles late bookings gracefully).
func (s *AppointmentReminderService) OnBookingConfirmed(ctx context.Context, appointmentID uint, userID uint, orgName string, scheduledAt time.Time) {
	// Pre-mark all already-past stages as skipped
	now := time.Now().UTC()
	timeUntilAppt := scheduledAt.Sub(now)

	for _, stage := range Stages {
		if stage.Stage == 7 {
			continue // Post-visit is always in the future
		}
		if timeUntilAppt < stage.WindowBefore {
			markReminderSkipped(ctx, appointmentID, stage.Stage)
			slog.Info("cron: pre-skipped past stage",
				"appointment_id", appointmentID,
				"stage", stage.Stage,
			)
		}
	}
}

// OnAppointmentCancelled blocks all future notifications for a cancelled appointment.
func (s *AppointmentReminderService) OnAppointmentCancelled(ctx context.Context, appointmentID uint, userID uint, orgName string) {
	// Mark all 7 stages as skipped
	for stage := 1; stage <= 7; stage++ {
		markReminderSkipped(ctx, appointmentID, stage)
	}

	// Send cancellation push
	_ = s.pushSvc.SendToUser(ctx, userID, PushPayload{
		Title:     "❌ Appointment Cancelled",
		Body:      fmt.Sprintf("Your appointment at %s has been cancelled.", orgName),
		URL:       "/dashboard",
		NotifType: "appointment",
	})
}

// OnAppointmentRescheduled clears old reminders and re-evaluates which stages to skip.
func (s *AppointmentReminderService) OnAppointmentRescheduled(ctx context.Context, appointmentID uint, userID uint, orgName string, newTime time.Time) {
	// Clear all existing reminders for this appointment
	db.DB.WithContext(ctx).
		Where("appointment_id = ?", appointmentID).
		Delete(&models.AppointmentReminder{})

	// Re-run the booking confirmed logic with the new time
	s.OnBookingConfirmed(ctx, appointmentID, userID, orgName, newTime)
}

// --- DB helpers ---

func markReminder(ctx context.Context, appointmentID uint, stage int, errMsg string) {
	status := "sent"
	if errMsg != "" {
		status = "failed"
	}
	// ON CONFLICT DO NOTHING — safe for duplicate calls
	db.DB.WithContext(ctx).Exec(
		`INSERT INTO appointment_reminders (appointment_id, stage, sent_at, status, error_message)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT (appointment_id, stage) DO NOTHING`,
		appointmentID, stage, time.Now().UTC(), status, errMsg,
	)
}

func markReminderSkipped(ctx context.Context, appointmentID uint, stage int) {
	db.DB.WithContext(ctx).Exec(
		`INSERT INTO appointment_reminders (appointment_id, stage, sent_at, status)
		 VALUES (?, ?, ?, 'skipped')
		 ON CONFLICT (appointment_id, stage) DO NOTHING`,
		appointmentID, stage, time.Now().UTC(),
	)
}
