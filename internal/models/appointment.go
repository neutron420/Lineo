package models

import (
	"time"
	"gorm.io/gorm"
)

type AppointmentStatus string

const (
	ApptScheduled AppointmentStatus = "scheduled"
	ApptCheckedIn AppointmentStatus = "checked_in"
	ApptCompleted AppointmentStatus = "completed"
	ApptNoShow    AppointmentStatus = "no_show"
	ApptCancelled AppointmentStatus = "cancelled"
)

type Appointment struct {
	ID             uint              `gorm:"primaryKey" json:"id"`
	OrganizationID uint              `gorm:"not null;index" json:"organization_id"`
	QueueKey       string            `gorm:"index" json:"queue_key"` // Optional now
	UserID         uint              `json:"user_id"`
	PhoneNumber    string            `json:"phone_number"`
	TokenNumber    string            `json:"token_number"` 
	StartTime      time.Time         `gorm:"not null" json:"start_time"`
	Status         AppointmentStatus `gorm:"type:varchar(20);default:'scheduled'" json:"status"`
	CommuteNotified bool             `gorm:"default:false" json:"commute_notified"` 
	UserLat        float64           `json:"user_lat"`
	UserLon        float64           `json:"user_lon"`
	User           User              `gorm:"foreignKey:UserID" json:"user,omitempty"`
	CreatedAt      time.Time         `json:"created_at"`
	UpdatedAt      time.Time         `json:"updated_at"`
	DeletedAt      gorm.DeletedAt    `gorm:"index" json:"-"`
}

type BookAppointmentRequest struct {
	OrganizationID uint    `json:"organization_id" binding:"required"`
	QueueKey       string  `json:"queue_key"` // Optional
	StartTime      string  `json:"start_time" binding:"required"` // Format: YYYY-MM-DD HH:MM
	UserLat        float64 `json:"user_lat"`
	UserLon        float64 `json:"user_lon"`
}

type CommuteInfo struct {
	DistanceText string `json:"distance"`
	DurationText string `json:"duration"`
	DurationSec  int    `json:"duration_seconds"`
	TrafficLevel string `json:"traffic_level"` // optimistic, pessimistic, or normal
}
