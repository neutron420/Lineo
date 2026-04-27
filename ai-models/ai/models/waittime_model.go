package models

import (
	"time"

	"gorm.io/gorm"
)

// ServiceDuration tracks how long each service actually took (ground truth data)
// Uses GORM tags to map directly to Neon DB table schemas
type ServiceDuration struct {
	ID           uint      `gorm:"primaryKey"`
	OrgID        uint      `gorm:"not null;index:idx_service_durations_org_hour"`
	AgentID      uint      `gorm:"not null"`
	TicketID     string    `gorm:"not null"` // Using string since token_number is string
	CalledAt     time.Time `gorm:"not null"`
	CompletedAt  time.Time `gorm:"not null"`
	DurationSecs int       
	HourOfDay    int       `gorm:"index:idx_service_durations_org_hour"`
	DayOfWeek    int       `gorm:"index:idx_service_durations_org_hour"`
	CreatedAt    time.Time `gorm:"default:CURRENT_TIMESTAMP"`
}

// BeforeCreate is a GORM hook that calculates the duration, hour, and day automatically before saving
func (s *ServiceDuration) BeforeCreate(tx *gorm.DB) (err error) {
	if !s.CompletedAt.IsZero() && !s.CalledAt.IsZero() {
		s.DurationSecs = int(s.CompletedAt.Sub(s.CalledAt).Seconds())
	}
	s.HourOfDay = s.CalledAt.Hour()
	s.DayOfWeek = int(s.CalledAt.Weekday())
	return
}

// OrgWaitStat stores pre-aggregated stats per org
type OrgWaitStat struct {
	OrgID          uint      `gorm:"primaryKey"`
	AvgServiceSecs int
	P90ServiceSecs int
	TotalSamples   int
	LastUpdated    time.Time `gorm:"default:CURRENT_TIMESTAMP"`
}
