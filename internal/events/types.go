package events

import "time"

type QueueEvent struct {
	EventID     string                 `json:"event_id"`
	OrgID       uint                   `json:"org_id"`
	QueueKey    string                 `json:"queue_key"`
	TokenNumber string                 `json:"token_number"`
	UserID      uint                   `json:"user_id,omitempty"`
	ActorID     uint                   `json:"actor_id,omitempty"`
	FromState   string                 `json:"from_state"`
	NewState    string                 `json:"new_state"`
	OccurredAt  time.Time              `json:"occurred_at"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

type SMSNotification struct {
	OrgID       uint      `json:"org_id"`
	UserID      uint      `json:"user_id,omitempty"`
	PhoneNumber string    `json:"phone_number"`
	Message     string    `json:"message"`
	Type        string    `json:"type"`
	TokenNumber string    `json:"token_number,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type CommuteTriggerJob struct {
	AppointmentID    uint      `json:"appointment_id"`
	UserID           uint      `json:"user_id"`
	OrgID            uint      `json:"org_id"`
	QueueKey         string    `json:"queue_key"`
	AppointmentTime  time.Time `json:"appointment_time"`
	UserLat          float64   `json:"user_lat"`
	UserLng          float64   `json:"user_lng"`
	PhoneNumber      string    `json:"phone_number"`
	ThresholdMinutes int       `json:"threshold_minutes"`
	RequestedAt      time.Time `json:"requested_at"`
}

type AuditEvent struct {
	OrgID      uint                   `json:"org_id"`
	ActorID    uint                   `json:"actor_id,omitempty"`
	Action     string                 `json:"action"`
	EntityType string                 `json:"entity_type"`
	EntityID   string                 `json:"entity_id"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt  time.Time              `json:"created_at"`
}
