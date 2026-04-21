package tests

import (
	"context"
	"testing"
	"queueless/internal/events"
)

// MockBus is a useful mock for other packages to use in their tests
type MockBus struct {
	PublishQueueEventFunc     func(ctx context.Context, event events.QueueEvent) error
	PublishSMSNotificationFunc func(ctx context.Context, notification events.SMSNotification) error
	PublishCommuteTriggerFunc func(ctx context.Context, job events.CommuteTriggerJob) error
	PublishAuditEventFunc     func(ctx context.Context, event events.AuditEvent) error
}

func (m *MockBus) PublishQueueEvent(ctx context.Context, event events.QueueEvent) error {
	if m.PublishQueueEventFunc != nil {
		return m.PublishQueueEventFunc(ctx, event)
	}
	return nil
}
func (m *MockBus) PublishSMSNotification(ctx context.Context, notification events.SMSNotification) error {
	if m.PublishSMSNotificationFunc != nil {
		return m.PublishSMSNotificationFunc(ctx, notification)
	}
	return nil
}
func (m *MockBus) PublishCommuteTrigger(ctx context.Context, job events.CommuteTriggerJob) error {
	if m.PublishCommuteTriggerFunc != nil {
		return m.PublishCommuteTriggerFunc(ctx, job)
	}
	return nil
}
func (m *MockBus) PublishAuditEvent(ctx context.Context, event events.AuditEvent) error {
	if m.PublishAuditEventFunc != nil {
		return m.PublishAuditEventFunc(ctx, event)
	}
	return nil
}

func TestMockBus(t *testing.T) {
	var bus events.Bus = &MockBus{}
	ctx := context.Background()
	
	err := bus.PublishQueueEvent(ctx, events.QueueEvent{TokenNumber: "T1"})
	if err != nil {
		t.Errorf("Expected nil error, got %v", err)
	}
}
