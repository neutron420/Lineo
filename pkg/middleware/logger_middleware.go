package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

func LoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime := time.Now()

		c.Next()

			endTime := time.Now()
			latency := endTime.Sub(startTime)

			slog.Info("http_request",
				"method", c.Request.Method,
				"path", c.Request.URL.Path,
				"status", c.Writer.Status(),
				"latency_ms", latency.Milliseconds(),
				"client_ip", c.ClientIP(),
			)
		}
	}
