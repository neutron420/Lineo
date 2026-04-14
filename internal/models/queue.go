package models

import (
	"time"
	"gorm.io/gorm"
)

type QueueStatus string

const (
	StatusWaiting   QueueStatus = "waiting"
	StatusServing   QueueStatus = "serving"
	StatusCompleted QueueStatus = "completed"
	StatusSkipped   QueueStatus = "skipped"
	StatusHolding   QueueStatus = "holding"
	StatusCancelled QueueStatus = "cancelled"
)

// Postgres model
type QueueHistory struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	OrganizationID uint           `gorm:"index;not null" json:"organization_id"`
	QueueKey       string         `gorm:"index;not null" json:"queue_key"`
	TokenNumber    string         `gorm:"not null" json:"token_number"`
	UserID         uint           `json:"user_id"` // 0 if Kiosk Mode
	PhoneNumber    string         `json:"phone_number"` // Fallback for Twilio / SMS
	IsKiosk        bool           `gorm:"default:false" json:"is_kiosk"`
	Status         QueueStatus    `gorm:"type:varchar(20)" json:"status"`
	Priority       bool           `gorm:"default:false" json:"priority"`
	UserLat        float64        `json:"user_lat"`
	UserLon        float64        `json:"user_lon"`
	CounterNumber   int           `json:"counter_number"` 
	ServingDuration int           `json:"serving_duration"` 
	JoinedAt       time.Time      `json:"joined_at"`
	ServedAt       *time.Time     `json:"served_at"`
	CommuteNotified bool          `gorm:"default:false" json:"commute_notified"` 
	CompletedAt    *time.Time     `json:"completed_at"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

type EnqueueRequest struct {
	QueueKey string  `json:"queue_key" binding:"required"`
	Priority bool    `json:"priority"`
	UserLat  float64 `json:"user_lat"` // Geofencing payloads
	UserLon  float64 `json:"user_lon"` // Geofencing payloads
}

// For anonymous users via kiosk IPads
type EnqueueKioskRequest struct {
	QueueKey    string `json:"queue_key" binding:"required"`
	Name        string `json:"name" binding:"required"`
	PhoneNumber string `json:"phone_number"` // Optional for SMS updates
}


type QueueResponse struct {
	TokenNumber   string    `json:"token_number"`
	QueueKey      string    `json:"queue_key"`
	Position      int       `json:"position"`
	EstimatedWait int       `json:"estimated_wait_mins"`
	IsVIP         bool      `json:"is_vip"`
	JoinedAt      time.Time `json:"joined_at"`
	QRCodeURL     string    `json:"qr_code_url,omitempty"`
}

type QueueState struct {
	QueueKey         string          `json:"queue_key"`
	IsPaused         bool            `json:"is_paused"`
	EstServiceTime   int             `json:"avg_service_time_mins"`
	CurrentlyServing *QueueEntry     `json:"currently_serving"`
	HoldingList      []QueueEntry    `json:"holding_list"`
	WaitingList      []QueueEntry    `json:"waiting_list"`
}

// Redis tracking
type QueueEntry struct {
	TokenNumber string      `json:"token_number"`
	UserID      uint        `json:"user_id"`
	Username    string      `json:"username"`
	PhoneNumber string      `json:"phone_number"` // For pulling into SMS
	IsKiosk     bool        `json:"is_kiosk"`
	Priority    bool        `json:"priority"`
	Status      QueueStatus `json:"status"`
	Score       float64     `json:"score"`
	JoinedAt    time.Time   `json:"joined_at"`
}

type AnalyticsResponse struct {
	TotalServedToday   int64          `json:"total_served_today"`
	AvgWaitTimeMins    int            `json:"avg_wait_time_mins"`
	AvgServiceTimeMins int            `json:"avg_service_time_mins"`
	PeakHours          map[string]int `json:"peak_hours"`
	
	// Feature #3: Efficiency Analytics
	CounterAverages    map[int]int    `json:"counter_averages_mins"` // e.g. Counter 1: 4 mins
}
