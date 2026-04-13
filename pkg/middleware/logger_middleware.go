package middleware

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

func LoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime := time.Now()

		c.Next()

		endTime := time.Now()
		latency := endTime.Sub(startTime)

		log.Printf("[%s] %s %d %s", c.Request.Method, c.Request.URL.Path, c.Writer.Status(), latency)
	}
}
