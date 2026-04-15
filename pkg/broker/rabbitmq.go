package broker

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"queueless/pkg/metrics"
)

const (
	ExchangeQueueEvents    = "queue.events"
	ExchangeNotifySMS      = "notify.sms"
	ExchangeCommuteTrigger = "commute.triggers"
	ExchangeAnalyticsIngest = "analytics.ingest"
	ExchangeDLX            = "dlx.failed"
)

const (
	QueueTicketCreated    = "queue.ticket.created"
	QueueTicketCalled     = "queue.ticket.called"
	QueueTicketCompleted  = "queue.ticket.completed"
	QueueTicketNoShow     = "queue.ticket.noshow"
	QueueTicketPending    = "queue.ticket.pending"
	QueueTicketWaiting    = "queue.ticket.waiting"
	QueueTicketServing    = "queue.ticket.serving"
	QueueSMSNotifications = "notify.sms"
	QueueCommuteTriggers  = "commute.triggers"
	QueueAnalyticsAudit   = "analytics.audit"
	QueueEventsWebsocket  = "queue.events.websocket"
	QueueDeadLetter       = "dlq.failed"
)

var queueArgs = amqp.Table{
	"x-dead-letter-exchange": ExchangeDLX,
}

type DeliveryHandler func(ctx context.Context, msg amqp.Delivery) error

type RabbitMQ struct {
	url       string
	logger    *slog.Logger
	mu        sync.RWMutex
	publishMu sync.Mutex
	conn      *amqp.Connection
	publishCh *amqp.Channel
	closed    chan struct{}
	closeOnce sync.Once
}

func NewRabbitMQ(url string, logger *slog.Logger) (*RabbitMQ, error) {
	if url == "" {
		return nil, errors.New("RABBITMQ_URL is required")
	}
	if logger == nil {
		logger = slog.Default()
	}

	r := &RabbitMQ{
		url:    url,
		logger: logger,
		closed: make(chan struct{}),
	}

	_ = r.connectAndDeclare() 
	go r.watchConnection()    
	return r, nil
}

func (r *RabbitMQ) connectAndDeclare() error {
	conn, err := amqp.Dial(r.url)
	if err != nil {
		return err
	}

	pubCh, err := conn.Channel()
	if err != nil {
		_ = conn.Close()
		return err
	}

	if err := declareTopology(pubCh); err != nil {
		_ = pubCh.Close()
		_ = conn.Close()
		return err
	}

	r.mu.Lock()
	oldConn := r.conn
	oldPubCh := r.publishCh
	r.conn = conn
	r.publishCh = pubCh
	r.mu.Unlock()

	if oldPubCh != nil {
		_ = oldPubCh.Close()
	}
	if oldConn != nil {
		_ = oldConn.Close()
	}

	r.logger.Info("rabbitmq connected and topology declared")
	return nil
}

func declareTopology(ch *amqp.Channel) error {
	exchanges := []struct {
		name string
		kind string
	}{
		{name: ExchangeQueueEvents, kind: "topic"},
		{name: ExchangeNotifySMS, kind: "direct"},
		{name: ExchangeCommuteTrigger, kind: "direct"},
		{name: ExchangeAnalyticsIngest, kind: "fanout"},
		{name: ExchangeDLX, kind: "fanout"},
	}

	for _, ex := range exchanges {
		if err := ch.ExchangeDeclare(ex.name, ex.kind, true, false, false, false, nil); err != nil {
			return fmt.Errorf("declare exchange %s: %w", ex.name, err)
		}
	}

	queues := []string{
		QueueTicketCreated,
		QueueTicketCalled,
		QueueTicketCompleted,
		QueueTicketNoShow,
		QueueTicketPending,
		QueueTicketWaiting,
		QueueTicketServing,
		QueueSMSNotifications,
		QueueCommuteTriggers,
		QueueAnalyticsAudit,
		QueueEventsWebsocket,
		QueueDeadLetter,
	}

	for _, q := range queues {
		args := queueArgs
		if q == QueueDeadLetter {
			args = nil
		}

		if _, err := ch.QueueDeclare(q, true, false, false, false, args); err != nil {
			return fmt.Errorf("declare queue %s: %w", q, err)
		}
	}

	if err := ch.QueueBind(QueueTicketPending, QueueTicketPending, ExchangeQueueEvents, false, nil); err != nil {
		return err
	}
	if err := ch.QueueBind(QueueTicketWaiting, QueueTicketWaiting, ExchangeQueueEvents, false, nil); err != nil {
		return err
	}
	if err := ch.QueueBind(QueueTicketServing, QueueTicketServing, ExchangeQueueEvents, false, nil); err != nil {
		return err
	}
	if err := ch.QueueBind(QueueTicketCreated, QueueTicketWaiting, ExchangeQueueEvents, false, nil); err != nil {
		return err
	}
	if err := ch.QueueBind(QueueTicketCalled, QueueTicketCalled, ExchangeQueueEvents, false, nil); err != nil {
		return err
	}
	if err := ch.QueueBind(QueueTicketCompleted, QueueTicketCompleted, ExchangeQueueEvents, false, nil); err != nil {
		return err
	}
	if err := ch.QueueBind(QueueTicketNoShow, QueueTicketNoShow, ExchangeQueueEvents, false, nil); err != nil {
		return err
	}
	if err := ch.QueueBind(QueueSMSNotifications, QueueSMSNotifications, ExchangeNotifySMS, false, nil); err != nil {
		return err
	}
	if err := ch.QueueBind(QueueCommuteTriggers, QueueCommuteTriggers, ExchangeCommuteTrigger, false, nil); err != nil {
		return err
	}
	if err := ch.QueueBind(QueueAnalyticsAudit, "", ExchangeAnalyticsIngest, false, nil); err != nil {
		return err
	}
	if err := ch.QueueBind(QueueEventsWebsocket, "queue.ticket.*", ExchangeQueueEvents, false, nil); err != nil {
		return err
	}
	if err := ch.QueueBind(QueueDeadLetter, "", ExchangeDLX, false, nil); err != nil {
		return err
	}

	return nil
}

func (r *RabbitMQ) watchConnection() {
	for {
		select {
		case <-r.closed:
			return
		default:
		}

		r.mu.RLock()
		conn := r.conn
		r.mu.RUnlock()

		if conn == nil {
			if err := r.reconnectLoop(); err != nil {
				r.logger.Error("rabbitmq reconnect failed", "error", err)
			}
			time.Sleep(1 * time.Second)
			continue
		}

		notifyClose := make(chan *amqp.Error, 1)
		conn.NotifyClose(notifyClose)

		select {
		case <-r.closed:
			return
		case err := <-notifyClose:
			if err != nil {
				r.logger.Warn("rabbitmq connection closed; reconnecting", "error", err)
				if reconnectErr := r.reconnectLoop(); reconnectErr != nil {
					r.logger.Error("rabbitmq reconnect loop exited", "error", reconnectErr)
				}
			}
		}
	}
}

func (r *RabbitMQ) reconnectLoop() error {
	backoff := 1 * time.Second
	for {
		select {
		case <-r.closed:
			return nil
		default:
		}

		if err := r.connectAndDeclare(); err == nil {
			return nil
		}

		r.logger.Warn("rabbitmq reconnect attempt failed", "wait", backoff.String())
		time.Sleep(backoff)
		if backoff < 30*time.Second {
			backoff *= 2
		}
	}
}

func (r *RabbitMQ) getPublishChannel() (*amqp.Channel, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.publishCh == nil {
		return nil, errors.New("rabbitmq publish channel unavailable")
	}
	return r.publishCh, nil
}

func (r *RabbitMQ) getConnection() (*amqp.Connection, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.conn == nil {
		return nil, errors.New("rabbitmq connection unavailable")
	}
	return r.conn, nil
}

func (r *RabbitMQ) PublishJSON(ctx context.Context, exchange, routingKey string, payload any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return r.PublishWithRetry(ctx, exchange, routingKey, "application/json", body)
}

func (r *RabbitMQ) PublishWithRetry(ctx context.Context, exchange, routingKey, contentType string, body []byte) error {
	const maxAttempts = 3
	backoff := 250 * time.Millisecond
	var lastErr error

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		lastErr = r.publish(ctx, exchange, routingKey, contentType, body)
		if lastErr == nil {
			return nil
		}

		r.logger.Warn("rabbitmq publish failed",
			"exchange", exchange,
			"routing_key", routingKey,
			"attempt", attempt,
			"error", lastErr)
		metrics.IncRabbitPublishErrors()

		_ = r.connectAndDeclare()
		if attempt == maxAttempts {
			break
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(backoff):
			backoff *= 2
		}
	}

	return fmt.Errorf("rabbitmq publish failed after retries: %w", lastErr)
}

func (r *RabbitMQ) publish(ctx context.Context, exchange, routingKey, contentType string, body []byte) error {
	r.publishMu.Lock()
	defer r.publishMu.Unlock()

	ch, err := r.getPublishChannel()
	if err != nil {
		return err
	}

	return ch.PublishWithContext(ctx, exchange, routingKey, false, false, amqp.Publishing{
		DeliveryMode: amqp.Persistent,
		ContentType:  contentType,
		Timestamp:    time.Now().UTC(),
		Body:         body,
	})
}

func (r *RabbitMQ) Consume(ctx context.Context, queue string, prefetch int, handler DeliveryHandler) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-r.closed:
			return
		default:
		}

		conn, err := r.getConnection()
		if err != nil {
			time.Sleep(500 * time.Millisecond)
			continue
		}

		ch, err := conn.Channel()
		if err != nil {
			r.logger.Warn("rabbitmq open consume channel failed", "queue", queue, "error", err)
			time.Sleep(500 * time.Millisecond)
			continue
		}

		if prefetch > 0 {
			if err := ch.Qos(prefetch, 0, false); err != nil {
				r.logger.Warn("rabbitmq qos failed", "queue", queue, "error", err)
				_ = ch.Close()
				time.Sleep(500 * time.Millisecond)
				continue
			}
		}

		deliveries, err := ch.Consume(queue, "", false, false, false, false, nil)
		if err != nil {
			r.logger.Warn("rabbitmq consume start failed", "queue", queue, "error", err)
			_ = ch.Close()
			time.Sleep(500 * time.Millisecond)
			continue
		}

		r.logger.Info("rabbitmq consumer started", "queue", queue)

	consumeLoop:
		for {
			select {
			case <-ctx.Done():
				_ = ch.Close()
				return
			case <-r.closed:
				_ = ch.Close()
				return
			case msg, ok := <-deliveries:
				if !ok {
					break consumeLoop
				}

				if err := handler(ctx, msg); err != nil {
					r.logger.Error("rabbitmq consumer handler failed", "queue", queue, "error", err)
					if nackErr := msg.Nack(false, false); nackErr != nil {
						r.logger.Error("rabbitmq nack failed", "queue", queue, "error", nackErr)
					}
					continue
				}

				if err := msg.Ack(false); err != nil {
					r.logger.Error("rabbitmq ack failed", "queue", queue, "error", err)
				}
			}
		}

		_ = ch.Close()
		time.Sleep(500 * time.Millisecond)
	}
}

func (r *RabbitMQ) Close() {
	r.closeOnce.Do(func() {
		close(r.closed)

		r.mu.Lock()
		defer r.mu.Unlock()
		if r.publishCh != nil {
			_ = r.publishCh.Close()
		}
		if r.conn != nil {
			_ = r.conn.Close()
		}
	})
}
