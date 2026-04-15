package worker

import (
	"context"
	"testing"

	miniredis "github.com/alicebob/miniredis/v2"
	amqp "github.com/rabbitmq/amqp091-go"
	redisClient "github.com/redis/go-redis/v9"

	"queueless/pkg/redis"
)

func TestAcquireMessageLock_DeduplicatesSameMessage(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer mr.Close()

	oldClient := redis.Client
	oldCtx := redis.Ctx
	defer func() {
		redis.Client = oldClient
		redis.Ctx = oldCtx
	}()

	redis.Ctx = context.Background()
	redis.Client = redisClient.NewClient(&redisClient.Options{Addr: mr.Addr()})
	defer redis.Client.Close()

	msg := amqp.Delivery{
		MessageId: "msg-123",
		Body:      []byte(`{"a":1}`),
	}

	if ok := acquireMessageLock(context.Background(), "scope", msg); !ok {
		t.Fatal("expected first lock acquisition to succeed")
	}
	if ok := acquireMessageLock(context.Background(), "scope", msg); ok {
		t.Fatal("expected duplicate message to be rejected")
	}
}
