package broker

import (
	"context"
	"log/slog"
	"os"
	"testing"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

func TestRabbitMQPublishConsumeIntegration(t *testing.T) {
	url := os.Getenv("RABBITMQ_URL")
	if url == "" {
		t.Skip("RABBITMQ_URL not set; skipping RabbitMQ integration test")
	}

	r, err := NewRabbitMQ(url, slog.Default())
	if err != nil {
		t.Skipf("unable to connect rabbitmq: %v", err)
	}
	defer r.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	received := make(chan []byte, 1)
	payload := []byte(`{"integration":"ok"}`)
	go r.Consume(ctx, QueueSMSNotifications, 1, func(ctx context.Context, msg amqp.Delivery) error {
		if string(msg.Body) != string(payload) {
			return nil
		}
		select {
		case received <- msg.Body:
		default:
		}
		return nil
	})

	if err := r.PublishWithRetry(ctx, ExchangeNotifySMS, QueueSMSNotifications, "application/json", payload); err != nil {
		t.Fatalf("publish failed: %v", err)
	}

	select {
	case body := <-received:
		if string(body) != string(payload) {
			t.Fatalf("unexpected message body: %s", string(body))
		}
	case <-ctx.Done():
		t.Fatal("timed out waiting for consumed message")
	}
}
