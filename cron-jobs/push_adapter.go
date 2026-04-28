package cronjobs

import "context"

// PushSender is a minimal interface for sending push notifications.
// This avoids importing internal/service (which would create a cycle).
// service.PushService does NOT directly satisfy this interface because its
// SendToUser takes service.PushPayload. Use PushSenderAdapter in main.go to wrap it.
type PushSender interface {
	SendToUser(ctx context.Context, userID uint, payload PushPayload) error
}

// PushPayload mirrors service.PushPayload to avoid importing internal/service.
// Both structs have identical fields, so conversion is trivial.
type PushPayload struct {
	Title     string `json:"title"`
	Body      string `json:"body"`
	URL       string `json:"url,omitempty"`
	Icon      string `json:"icon,omitempty"`
	NotifType string `json:"notifType,omitempty"`
}
