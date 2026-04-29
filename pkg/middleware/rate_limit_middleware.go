package middleware

import (
	"context"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"queueless/pkg/redis"
	"queueless/pkg/utils"
)

func RateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		// Permissive rate limit for development
		limit := 1000 
		if os.Getenv("ENV") == "production" {
			limit = 60 // 60 requests per window (1 min) in production
		}

		key := "rate_limit_v4:" + c.ClientIP()

		// Atomic increment with Redis
		count, err := redis.Client.Incr(context.Background(), key).Result()
		if err != nil {
			c.Next()
			return
		}

		if count == 1 {
			redis.Client.Expire(context.Background(), key, 60*time.Second)
		} else {
			// Periodic TTL check to recover from orphan keys without full pipeline on every request
			if count % 10 == 0 {
				ttl, _ := redis.Client.TTL(context.Background(), key).Result()
				if ttl == -1 {
					redis.Client.Expire(context.Background(), key, 60*time.Second)
				}
			}
		}

		if count > int64(limit) {
			utils.RespondError(c, http.StatusTooManyRequests, "Protocol Congestion", "Too many requests from this IP. Please wait a moment.")
			return
		}
		c.Next()
	}
}
