package cronjobs

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"queueless/internal/models"
	"queueless/pkg/db"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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
	loc, _ := time.LoadLocation("Asia/Kolkata")
	now := time.Now().In(loc)

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

	// Atomic transaction with SKIP LOCKED for distributed safety
	err := db.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		err := tx.Table("appointments a").
			Clauses(clause.Locking{Strength: "UPDATE", Table: clause.Table{Name: "a"}, Options: "SKIP LOCKED"}).
			Select("a.id, a.user_id, o.name AS org_name, a.start_time").
			Joins("JOIN organizations o ON o.id = a.organization_id").
			Where("a.status IN ?", []models.AppointmentStatus{models.ApptScheduled, models.ApptCheckedIn}).
			Where("a.start_time BETWEEN ? AND ?", windowStart, windowEnd).
			Where("a.user_id > 0"). // Only registered users (not kiosk)
			Where("NOT EXISTS (SELECT 1 FROM appointment_reminders ar WHERE ar.appointment_id = a.id AND ar.stage = ?)", stage.Stage).
			Where("a.deleted_at IS NULL").
			Scan(&rows).Error

		if err != nil {
			return err
		}

		for _, row := range rows {
			// Mark as sent immediately within the transaction to prevent other instances from processing
			loc, _ := time.LoadLocation("Asia/Kolkata")
			err := tx.Table("appointment_reminders").Create(map[string]interface{}{
				"appointment_id": row.ID,
				"stage":          stage.Stage,
				"sent_at":        time.Now().In(loc),
				"status":         "sent",
			}).Error
			if err != nil {
				return err
			}

			// Actual sending happens inside the loop but outside the DB write lock wait if we were using it, 
			// though here we are already safe because of the Create insert.
			body := fmt.Sprintf(stage.BodyTemplate, row.OrgName)
			url := "/dashboard/appointments"
			if stage.Stage == 7 {
				url = "/dashboard" 
			}

			go s.pushSvc.SendToUser(ctx, row.UserID, PushPayload{
				Title:     stage.Title,
				Body:      body,
				URL:       url,
				Icon:      "/icon-512.png",
				NotifType: "appointment",
			})
			slog.Info("cron: sent appointment reminder", "appointment_id", row.ID, "user_id", row.UserID, "stage", stage.Stage)
		}
		return nil
	})

	if err != nil {
		slog.Error("cron: appointment reminder DB error", "stage", stage.Stage, "error", err)
		return
	}

	if len(rows) > 0 {
		slog.Info("cron: appointment reminder stage", "stage", stage.Stage, "sent", len(rows))
	}
}

// OnBookingConfirmed should be called immediately after an appointment is created.
// It pre-marks all already-past stages as "skipped" so the cron never fires them
// (handles late bookings gracefully).
func (s *AppointmentReminderService) OnBookingConfirmed(ctx context.Context, appointmentID uint, userID uint, orgName string, scheduledAt time.Time) {
	// Pre-mark all already-past stages as skipped
	loc, _ := time.LoadLocation("Asia/Kolkata")
	now := time.Now().In(loc)
	timeUntilAppt := scheduledAt.Sub(now)

	for _, stage := range Stages {
		if stage.Stage == 7 {
			continue // Post-visit is always in the future
		}
		// Only skip if we are definitively past the entire trigger window (including slack)
		if timeUntilAppt < (stage.WindowBefore - stage.WindowSlack) {
			markReminderSkipped(ctx, appointmentID, stage.Stage)
			slog.Info("cron: pre-skipped past stage",
				"appointment_id", appointmentID,
				"stage", stage.Stage,
				"time_until", timeUntilAppt.String(),
				"window_before", stage.WindowBefore.String(),
			)
		}
	}
}

// OnAppointmentCancelled blocks all future notifications for a cancelled appointment.
func (s *AppointmentReminderService) OnAppointmentCancelled(ctx context.Context, appointmentID uint, userID uint, orgName string, apptTime time.Time) {
	// Mark all 7 stages as skipped
	for stage := 1; stage <= 7; stage++ {
		markReminderSkipped(ctx, appointmentID, stage)
	}

	timeStr := apptTime.Format("Mon, 02 Jan at 03:04 PM")

	// Send cancellation push
	_ = s.pushSvc.SendToUser(ctx, userID, PushPayload{
		Title:     "❌ Appointment Cancelled",
		Body:      fmt.Sprintf("Your appointment at %s for %s has been cancelled.", orgName, timeStr),
		URL:       "/dashboard",
		Icon:      "/icon-512.png",
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
	loc, _ := time.LoadLocation("Asia/Kolkata")
	// ON CONFLICT DO NOTHING — safe for duplicate calls
	db.DB.WithContext(ctx).Exec(
		`INSERT INTO appointment_reminders (appointment_id, stage, sent_at, status, error_message)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT (appointment_id, stage) DO NOTHING`,
		appointmentID, stage, time.Now().In(loc), status, errMsg,
	)
}

func markReminderSkipped(ctx context.Context, appointmentID uint, stage int) {
	loc, _ := time.LoadLocation("Asia/Kolkata")
	db.DB.WithContext(ctx).Exec(
		`INSERT INTO appointment_reminders (appointment_id, stage, sent_at, status)
		 VALUES (?, ?, ?, 'skipped')
		 ON CONFLICT (appointment_id, stage) DO NOTHING`,
		appointmentID, stage, time.Now().In(loc),
	)
}
