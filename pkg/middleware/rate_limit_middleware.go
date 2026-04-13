package middleware

import (
	"context"
	"net/http"
	"time"
	"github.com/gin-gonic/gin"
	"queueless/pkg/redis"
	"queueless/pkg/utils"
)

func RateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := "rate_limit:" + c.ClientIP()
		
		// Use Redis INCR for rate limiting (Distributed)
		count, err := redis.Client.Incr(context.Background(), key).Result()
		if err != nil {
			c.Next() // Fallback to allow if Redis has issues
			return
		}

		if count == 1 {
			// First request, set expiration (10 requests per 10 seconds)
			redis.Client.Expire(context.Background(), key, 10*time.Second)
		}

		if count > 20 { // 2 emails per second limit (burst)
			utils.RespondError(c, http.StatusTooManyRequests, "Rate limit exceeded", "Too many requests from this IP")
			return
		}
		c.Next()
	}
}

