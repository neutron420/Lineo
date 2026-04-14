package models

import (
	"time"
	"gorm.io/gorm"
)

type AppointmentStatus string

const (
	ApptScheduled AppointmentStatus = "scheduled"
	ApptCheckedIn AppointmentStatus = "checked_in"
	ApptNoShow    AppointmentStatus = "no_show"
	ApptCancelled AppointmentStatus = "cancelled"
)

type Appointment struct {
	ID             uint              `gorm:"primaryKey" json:"id"`
	OrganizationID uint              `gorm:"not null;index" json:"organization_id"`
	QueueKey       string            `gorm:"not null;index" json:"queue_key"`
	UserID         uint              `json:"user_id"`
	PhoneNumber    string            `json:"phone_number"`
	TokenNumber    string            `json:"token_number"` 
	StartTime      time.Time         `gorm:"not null" json:"start_time"`
	Status         AppointmentStatus `gorm:"type:varchar(20);default:'scheduled'" json:"status"`
	CommuteNotified bool             `gorm:"default:false" json:"commute_notified"` 
	UserLat        float64           `json:"user_lat"`
	UserLon        float64           `json:"user_lon"`
	CreatedAt      time.Time         `json:"created_at"`
	UpdatedAt      time.Time         `json:"updated_at"`
	DeletedAt      gorm.DeletedAt    `gorm:"index" json:"-"`
}

type BookAppointmentRequest struct {
	QueueKey  string  `json:"queue_key" binding:"required"`
	StartTime string  `json:"start_time" binding:"required"` // Format: YYYY-MM-DD HH:MM
	UserLat   float64 `json:"user_lat"`
	UserLon   float64 `json:"user_lon"`
}

type CommuteInfo struct {
	DistanceText string `json:"distance"`
	DurationText string `json:"duration"`
	DurationSec  int    `json:"duration_seconds"`
	TrafficLevel string `json:"traffic_level"` // optimistic, pessimistic, or normal
}
