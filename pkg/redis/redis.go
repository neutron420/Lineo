package redis

import (
	"context"
	"log"
	"os"

	redis "github.com/redis/go-redis/v9"
)

var Client *redis.Client
var Ctx = context.Background()

func InitRedis() {
	redisHost := os.Getenv("REDIS_HOST")
	redisPort := os.Getenv("REDIS_PORT")
	redisPassword := os.Getenv("REDIS_PASSWORD")

	Client = redis.NewClient(&redis.Options{
		Addr:     redisHost + ":" + redisPort,
		Password: redisPassword,
		DB:       0,
	})

	if err := Client.Ping(Ctx).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	log.Println("Redis connection established")
}

func CloseRedis() {
	log.Println("Closing Redis connections...")
	Client.Close()
}

