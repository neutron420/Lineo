package models

import (
	"time"

	"github.com/lib/pq"
)

// SlotAnalytics stores historical performance for every hour/day combination
type SlotAnalytics struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	OrganizationID   uint      `gorm:"not null;uniqueIndex:idx_org_day_hour" json:"organization_id"`
	DayOfWeek        int       `gorm:"not null;uniqueIndex:idx_org_day_hour" json:"day_of_week"` // 0=Sunday
	HourOfDay        int       `gorm:"not null;uniqueIndex:idx_org_day_hour" json:"hour_of_day"` // 0-23
	AvgQueueDepth    float64   `gorm:"default:0" json:"avg_queue_depth"`
	AvgWaitSecs      int       `gorm:"default:0" json:"avg_wait_secs"`
	TotalBookings    int       `gorm:"default:0" json:"total_bookings"`
	TotalNoShows     int       `gorm:"default:0" json:"total_noshows"`
	NoShowRate       float64   `gorm:"default:0" json:"noshow_rate"`
	CancellationRate float64   `gorm:"default:0" json:"cancellation_rate"`
	LastUpdated      time.Time `gorm:"autoUpdateTime" json:"last_updated"`
}

// UserBookingPreference tracks personalized patterns per user
type UserBookingPreference struct {
	UserID         uint          `gorm:"primaryKey" json:"user_id"`
	PreferredHours pq.Int64Array `gorm:"type:integer[]" json:"preferred_hours"`
	PreferredDays  pq.Int64Array `gorm:"type:integer[]" json:"preferred_days"`
	AvgAdvanceDays int           `json:"avg_advance_days"`
	TotalBookings  int           `gorm:"default:0" json:"total_bookings"`
	LastUpdated    time.Time     `gorm:"autoUpdateTime" json:"last_updated"`
}

// RecommendationFeedback tracks if users actually pick our AI top picks
type RecommendationFeedback struct {
	ID                  uint      `gorm:"primaryKey" json:"id"`
	UserID              uint      `gorm:"index" json:"user_id"`
	OrganizationID      uint      `gorm:"index" json:"organization_id"`
	RecommendedSlotID   string    `json:"recommended_slot_id"`
	ChosenSlotID        string    `json:"chosen_slot_id"`
	AcceptedTopPick     bool      `json:"accepted_top_pick"`
	RecommendationScore float64   `json:"recommendation_score"`
	CreatedAt           time.Time `gorm:"autoCreateTime" json:"created_at"`
}

// RecommendedSlot is the API response type for a single AI-ranked slot
type RecommendedSlot struct {
	SlotID   string  `json:"slot_id"`
	DateTime string  `json:"datetime"`
	Label    string  `json:"label"`
	Score    float64 `json:"score"`
	Badge    string  `json:"badge"`
	Reason   string  `json:"reason"`
}

// RecommendationResponse is the full API response from the AI slot recommender
type RecommendationResponse struct {
	RecommendedSlots  []RecommendedSlot `json:"recommended_slots"`
	AllSlotsAvailable int               `json:"all_slots_available"`
	Explanation       string            `json:"explanation"`
}
