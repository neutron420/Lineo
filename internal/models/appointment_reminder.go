package models

import (
	"time"
)

// AppointmentReminder tracks which notification stages have been sent for each appointment.
// The UNIQUE(appointment_id, stage) constraint ensures idempotent delivery.
type AppointmentReminder struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	AppointmentID uint      `gorm:"not null;uniqueIndex:idx_appt_stage" json:"appointment_id"`
	Stage         int       `gorm:"not null;uniqueIndex:idx_appt_stage;check:stage >= 1 AND stage <= 7" json:"stage"`
	SentAt        time.Time `gorm:"not null;default:now()" json:"sent_at"`
	Status        string    `gorm:"type:varchar(20);not null;default:'sent'" json:"status"` // sent, failed, skipped
	ErrorMessage  string    `json:"error_message,omitempty"`
}

func (AppointmentReminder) TableName() string {
	return "appointment_reminders"
}
