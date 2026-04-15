package events

import (
	"context"
	"fmt"
	"time"

	"queueless/internal/ticket"
	"queueless/pkg/broker"
)

type Bus interface {
	PublishQueueEvent(ctx context.Context, event QueueEvent) error
	PublishSMSNotification(ctx context.Context, notification SMSNotification) error
	PublishCommuteTrigger(ctx context.Context, job CommuteTriggerJob) error
	PublishAuditEvent(ctx context.Context, event AuditEvent) error
}

type RabbitBus struct {
	rabbit *broker.RabbitMQ
}

func NewRabbitBus(rabbit *broker.RabbitMQ) *RabbitBus {
	return &RabbitBus{rabbit: rabbit}
}

func (b *RabbitBus) PublishQueueEvent(ctx context.Context, event QueueEvent) error {
	if event.OccurredAt.IsZero() {
		event.OccurredAt = time.Now().UTC()
	}

	newState := ticket.State(event.NewState)
	routingKey := ticket.RoutingKeyForState(newState)
	if err := b.rabbit.PublishJSON(ctx, broker.ExchangeQueueEvents, routingKey, event); err != nil {
		return err
	}

	audit := AuditEvent{
		OrgID:      event.OrgID,
		ActorID:    event.ActorID,
		Action:     fmt.Sprintf("ticket.%s", event.NewState),
		EntityType: "ticket",
		EntityID:   event.TokenNumber,
		Metadata: map[string]interface{}{
			"queue_key":  event.QueueKey,
			"from_state": event.FromState,
			"new_state":  event.NewState,
		},
		CreatedAt: event.OccurredAt,
	}
	return b.PublishAuditEvent(ctx, audit)
}

func (b *RabbitBus) PublishSMSNotification(ctx context.Context, notification SMSNotification) error {
	if notification.CreatedAt.IsZero() {
		notification.CreatedAt = time.Now().UTC()
	}
	if err := b.rabbit.PublishJSON(ctx, broker.ExchangeNotifySMS, broker.QueueSMSNotifications, notification); err != nil {
		return err
	}

	return b.PublishAuditEvent(ctx, AuditEvent{
		OrgID:      notification.OrgID,
		ActorID:    notification.UserID,
		Action:     "sms.queued",
		EntityType: "notification",
		EntityID:   notification.TokenNumber,
		Metadata: map[string]interface{}{
			"type":         notification.Type,
			"phone_number": notification.PhoneNumber,
		},
		CreatedAt: notification.CreatedAt,
	})
}

func (b *RabbitBus) PublishCommuteTrigger(ctx context.Context, job CommuteTriggerJob) error {
	if job.RequestedAt.IsZero() {
		job.RequestedAt = time.Now().UTC()
	}
	if err := b.rabbit.PublishJSON(ctx, broker.ExchangeCommuteTrigger, broker.QueueCommuteTriggers, job); err != nil {
		return err
	}

	return b.PublishAuditEvent(ctx, AuditEvent{
		OrgID:      job.OrgID,
		ActorID:    job.UserID,
		Action:     "commute.trigger.queued",
		EntityType: "appointment",
		EntityID:   fmt.Sprintf("%d", job.AppointmentID),
		Metadata: map[string]interface{}{
			"queue_key":          job.QueueKey,
			"appointment_time":   job.AppointmentTime,
			"threshold_minutes":  job.ThresholdMinutes,
		},
		CreatedAt: job.RequestedAt,
	})
}

func (b *RabbitBus) PublishAuditEvent(ctx context.Context, event AuditEvent) error {
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now().UTC()
	}
	return b.rabbit.PublishJSON(ctx, broker.ExchangeAnalyticsIngest, "", event)
}
