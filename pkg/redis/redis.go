package redis

import (
	"context"
	"log/slog"
	"os"

	redis "github.com/redis/go-redis/v9"
	"queueless/pkg/config"
)

var Client *redis.Client
var Ctx = context.Background()

func InitRedis() {
	redisHost := config.Secret("REDIS_HOST")
	redisPort := config.Secret("REDIS_PORT")
	redisPassword := config.Secret("REDIS_PASSWORD")

	Client = redis.NewClient(&redis.Options{
		Addr:     redisHost + ":" + redisPort,
		Password: redisPassword,
		DB:       0,
	})

	if err := Client.Ping(Ctx).Err(); err != nil {
		slog.Error("failed to connect to redis", "error", err)
		os.Exit(1)
	}

	slog.Info("redis connection established")
}

func CloseRedis() {
	slog.Info("closing redis connections")
	_ = Client.Close()
}

func FlushPipeline() {
	if Client == nil {
		return
	}
	pipe := Client.Pipeline()
	_, _ = pipe.Exec(Ctx)
}
