package models

import "time"

type OrganizationConfig struct {
	OrgID                uint      `gorm:"primaryKey;index" json:"org_id"`
	MaxQueueSize         int       `gorm:"default:200" json:"max_queue_size"`
	SlotDurationMinutes  int       `gorm:"default:15" json:"slot_duration_minutes"`
	GracePeriodMinutes   int       `gorm:"default:10" json:"grace_period_minutes"`
	OperatingHoursJSON   string    `gorm:"type:jsonb;default:'{}'" json:"operating_hours_json"`
	GeofenceRadiusMeters int       `gorm:"default:1000" json:"geofence_radius_meters"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
	DeletedAt            *time.Time `gorm:"index" json:"-"`
}

type OrganizationConfigRequest struct {
	MaxQueueSize         int    `json:"max_queue_size"`
	SlotDurationMinutes  int    `json:"slot_duration_minutes"`
	GracePeriodMinutes   int    `json:"grace_period_minutes"`
	OperatingHoursJSON   string `json:"operating_hours_json"`
	GeofenceRadiusMeters int    `json:"geofence_radius_meters"`
}
