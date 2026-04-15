package worker

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"encoding/hex"
	"fmt"
	"log/slog"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/robfig/cron/v3"

	"queueless/internal/events"
	"queueless/internal/handler"
	"queueless/internal/models"
	"queueless/internal/repository"
	"queueless/internal/service"
	"queueless/pkg/broker"
	"queueless/pkg/db"
	"queueless/pkg/metrics"
	"queueless/pkg/redis"
	"queueless/pkg/utils"
)

type Consumers struct {
	Rabbit   *broker.RabbitMQ
	Bus      events.Bus
	QueueSvc service.QueueService
	ApptSvc  service.AppointmentService
	OrgRepo  repository.OrganizationRepository
	Logger   *slog.Logger
}

func (w *Consumers) Start(ctx context.Context, wg *sync.WaitGroup) *cron.Cron {
	wg.Add(4)
	go func() {
		defer wg.Done()
		w.startQueueEventConsumer(ctx)
	}()
	go func() {
		defer wg.Done()
		w.startSMSConsumer(ctx)
	}()
	go func() {
		defer wg.Done()
		w.startCommuteConsumer(ctx)
	}()
	go func() {
		defer wg.Done()
		w.startAuditConsumer(ctx)
	}()

	c := cron.New()
	_, _ = c.AddFunc("*/5 * * * *", func() {
		_ = w.ApptSvc.QueueCommuteChecks(ctx)
	})
	c.Start()
	return c
}

func (w *Consumers) startQueueEventConsumer(ctx context.Context) {
	w.Rabbit.Consume(ctx, broker.QueueEventsWebsocket, 20, func(ctx context.Context, msg amqp.Delivery) error {
		if !acquireMessageLock(ctx, "queue-events", msg) {
			return nil
		}

		var evt events.QueueEvent
		if err := json.Unmarshal(msg.Body, &evt); err != nil {
			return err
		}

		state, err := w.QueueSvc.GetQueueState(evt.QueueKey)
		if err != nil {
			return err
		}

		payload, err := json.Marshal(map[string]interface{}{
			"event": evt,
			"state": state,
		})
		if err != nil {
			return err
		}

		channel := handler.OrgQueueChannel(evt.OrgID)
		if err := redis.Client.Publish(ctx, channel, payload).Err(); err != nil {
			return err
		}

		// Alert the third waiting user once every 10 minutes.
		if len(state.WaitingList) >= 3 {
			target := state.WaitingList[2]
			if target.PhoneNumber != "" {
				key := fmt.Sprintf("sms:third:%s", target.TokenNumber)
				ok, _ := redis.Client.SetNX(ctx, key, "1", 10*time.Minute).Result()
				if ok {
					_ = w.Bus.PublishSMSNotification(ctx, events.SMSNotification{
						OrgID:       evt.OrgID,
						UserID:      target.UserID,
						PhoneNumber: target.PhoneNumber,
						Message:     "You are now third in line. Please get ready.",
						Type:        "third_in_line",
						TokenNumber: target.TokenNumber,
						CreatedAt:   time.Now().UTC(),
					})
				}
			}
		}

		return nil
	})
}

func (w *Consumers) startSMSConsumer(ctx context.Context) {
	w.Rabbit.Consume(ctx, broker.QueueSMSNotifications, 10, func(ctx context.Context, msg amqp.Delivery) error {
		if !acquireMessageLock(ctx, "notify-sms", msg) {
			return nil
		}

		var payload events.SMSNotification
		if err := json.Unmarshal(msg.Body, &payload); err != nil {
			return err
		}
		utils.SendSMS(payload.PhoneNumber, payload.Message)
		metrics.IncSMSSent(payload.Type)
		return nil
	})
}

func (w *Consumers) startCommuteConsumer(ctx context.Context) {
	googleClient := utils.NewGoogleMapsClient()
	w.Rabbit.Consume(ctx, broker.QueueCommuteTriggers, 5, func(ctx context.Context, msg amqp.Delivery) error {
		if !acquireMessageLock(ctx, "commute", msg) {
			return nil
		}

		var job events.CommuteTriggerJob
		if err := json.Unmarshal(msg.Body, &job); err != nil {
			return err
		}

		org, err := w.OrgRepo.GetOrganizationByID(job.OrgID)
		if err != nil {
			return err
		}
		if org.Latitude == 0 || org.Longitude == 0 || job.UserLat == 0 || job.UserLng == 0 {
			return nil
		}

		commute, err := googleClient.GetDistanceMatrix(job.UserLat, job.UserLng, org.Latitude, org.Longitude)
		if err != nil {
			return err
		}

		leaveInMinutes := int(time.Until(job.AppointmentTime).Minutes()) - (commute.DurationSec / 60)
		if leaveInMinutes > job.ThresholdMinutes {
			return nil
		}

		message := fmt.Sprintf("Traffic update for %s: travel time %s. Please leave now.", org.Name, commute.DurationText)
		if err := w.Bus.PublishSMSNotification(ctx, events.SMSNotification{
			OrgID:       job.OrgID,
			UserID:      job.UserID,
			PhoneNumber: job.PhoneNumber,
			Message:     message,
			Type:        "commute_leave_now",
			CreatedAt:   time.Now().UTC(),
		}); err != nil {
			return err
		}

		return db.DB.Model(&models.Appointment{}).
			Where("id = ?", job.AppointmentID).
			Update("commute_notified", true).Error
	})
}

func (w *Consumers) startAuditConsumer(ctx context.Context) {
	w.Rabbit.Consume(ctx, broker.QueueAnalyticsAudit, 20, func(ctx context.Context, msg amqp.Delivery) error {
		if !acquireMessageLock(ctx, "analytics-audit", msg) {
			return nil
		}

		var audit events.AuditEvent
		if err := json.Unmarshal(msg.Body, &audit); err != nil {
			return err
		}

		metadata, err := json.Marshal(audit.Metadata)
		if err != nil {
			return err
		}

		record := models.AuditLog{
			OrgID:      audit.OrgID,
			ActorID:    audit.ActorID,
			Action:     audit.Action,
			EntityType: audit.EntityType,
			EntityID:   audit.EntityID,
			Metadata:   metadata,
			CreatedAt:  audit.CreatedAt,
		}
		return db.DB.WithContext(ctx).Create(&record).Error
	})
}

func acquireMessageLock(ctx context.Context, scope string, msg amqp.Delivery) bool {
	base := msg.MessageId
	if base == "" {
		sum := sha256.Sum256(msg.Body)
		base = hex.EncodeToString(sum[:])
	}
	key := fmt.Sprintf("idempotency:%s:%s", scope, base)
	ok, err := redis.Client.SetNX(ctx, key, "1", 24*time.Hour).Result()
	if err != nil {
		return true // Fail open to avoid blocking critical consumers.
	}
	return ok
}
