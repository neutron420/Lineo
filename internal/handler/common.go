package handler

import (
	"github.com/gin-gonic/gin"
)

func getOrgID(c *gin.Context) (uint, bool) {
	val, exists := c.Get("organizationID")
	if !exists || val == nil {
		return 0, false
	}
	switch v := val.(type) {
	case uint:
		return v, true
	case *uint:
		if v == nil {
			return 0, false
		}
		return *v, true
	default:
		return 0, false
	}
}

type CreateQueueRequest struct {
	Name     string `json:"name" binding:"required"`
	QueueKey string `json:"queue_key" binding:"required"`
}
