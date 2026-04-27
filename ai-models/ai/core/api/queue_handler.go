package api

import (
    "github.com/gin-gonic/gin"
    "queueless/ai-models/ai/core/waittime"
)

type QueueHandler struct {
    waitTimeService *waittime.WaitTimeService
}

func NewQueueHandler(service *waittime.WaitTimeService) *QueueHandler {
    return &QueueHandler{
        waitTimeService: service,
    }
}

// GET /api/v1/queue/:key/wait-time
func (h *QueueHandler) GetWaitTime(c *gin.Context) {
    orgID := c.GetString("org_id") // typically extracted from JWT middleware
    queueKey := c.Param("key")
    ticketID := c.Query("ticket_id")

    // Defaulting IsAppointment to false for this example; adapt as needed
    prediction, err := h.waitTimeService.GetPrediction(c.Request.Context(), waittime.WaitTimeRequest{
        OrgID:         orgID,
        QueueKey:      queueKey,
        UserTicketID:  ticketID,
        IsAppointment: false, 
    })

    if err != nil {
        c.JSON(500, gin.H{"error": "prediction failed", "details": err.Error()})
        return
    }

    c.JSON(200, prediction)
}

// NOTE: Remember to register this route in your router:
// api.GET("/queue/:key/wait-time", middleware.Auth(), queueHandler.GetWaitTime)
