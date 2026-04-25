package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	webpush "github.com/SherClockHolmes/webpush-go"

	"queueless/internal/repository"
	"queueless/pkg/config"
)

// PushPayload is the JSON envelope sent inside the push message.
// The service-worker will parse these fields.
type PushPayload struct {
	Title     string `json:"title"`
	Body      string `json:"body"`
	URL       string `json:"url,omitempty"`
	Icon      string `json:"icon,omitempty"`
	NotifType string `json:"notifType,omitempty"` // "queue", "appointment", "commute", "info"
}

// PushService sends web-push notifications to user devices.
type PushService interface {
	SendToUser(ctx context.Context, userID uint, payload PushPayload) error
}

type pushService struct {
	repo           repository.PushSubscriptionRepository
	vapidPublicKey string
	vapidPrivateKey string
	vapidContact   string
}

func NewPushService(repo repository.PushSubscriptionRepository) PushService {
	return &pushService{
		repo:            repo,
		vapidPublicKey:  config.Secret("VAPID_PUBLIC_KEY"),
		vapidPrivateKey: config.Secret("VAPID_PRIVATE_KEY"),
		vapidContact:    config.Secret("VAPID_CONTACT"), // e.g. "mailto:hello@lineo.ai"
	}
}

// SendToUser pushes a notification to every device the user has subscribed.
// Subscriptions that return 404/410 (expired/unsubscribed) are auto-deleted.
func (s *pushService) SendToUser(ctx context.Context, userID uint, payload PushPayload) error {
	if s.vapidPublicKey == "" || s.vapidPrivateKey == "" {
		slog.Warn("push: VAPID keys not configured, skipping push", "user_id", userID)
		return nil
	}

	subs, err := s.repo.GetByUserID(userID)
	if err != nil {
		return fmt.Errorf("push: fetch subs for user %d: %w", userID, err)
	}
	if len(subs) == 0 {
		return nil // user has no push subscriptions — nothing to do
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("push: marshal payload: %w", err)
	}

	for _, sub := range subs {
		wpSub := &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys: webpush.Keys{
				P256dh: sub.P256dh,
				Auth:   sub.Auth,
			},
		}

		resp, err := webpush.SendNotification(body, wpSub, &webpush.Options{
			VAPIDPublicKey:  s.vapidPublicKey,
			VAPIDPrivateKey: s.vapidPrivateKey,
			Subscriber:      s.vapidContact,
			TTL:             60,
		})
		if err != nil {
			slog.Warn("push: send failed", "user_id", userID, "endpoint", sub.Endpoint, "error", err)
			// Network-level failure — subscription may still be valid.
			continue
		}
		_ = resp.Body.Close()

		// Google/Mozilla return 404 or 410 when the subscription is no longer valid.
		if resp.StatusCode == http.StatusGone || resp.StatusCode == http.StatusNotFound {
			slog.Info("push: removing expired subscription", "id", sub.ID, "endpoint", sub.Endpoint)
			_ = s.repo.DeleteByID(sub.ID)
			continue
		}

		if resp.StatusCode >= 400 {
			slog.Warn("push: upstream rejected", "status", resp.StatusCode, "endpoint", sub.Endpoint)
			// 429 (rate limit) or 413 (payload too large) — don't delete.
			continue
		}

		slog.Debug("push: sent", "user_id", userID, "status", resp.StatusCode)
	}

	return nil
}
