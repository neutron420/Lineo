package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"queueless/internal/models"
	"queueless/internal/service"
	"queueless/pkg/utils"
)

type QueueHandler struct {
	queueService service.QueueService
}

func NewQueueHandler(s service.QueueService) *QueueHandler {
	return &QueueHandler{queueService: s}
}

func (h *QueueHandler) Enqueue(c *gin.Context) {
	var req models.EnqueueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	userID := c.MustGet("userID").(uint)
	role := c.MustGet("role").(models.Role)
	username := "user"
	if role != models.RoleAdmin {
		req.Priority = false
	}

	resp, err := h.queueService.Enqueue(userID, username, req)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Enqueue failed", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "Joined queue", resp)
}

func (h *QueueHandler) EnqueueKiosk(c *gin.Context) {
	var req models.EnqueueKioskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	resp, err := h.queueService.EnqueueKiosk(req)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Kiosk enqueue failed", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "Kiosk joined queue successfully", resp)
}

func (h *QueueHandler) GetState(c *gin.Context) {
	queueKey := c.Param("key")
	if queueKey == "" {
		utils.RespondError(c, http.StatusBadRequest, "Invalid queue key", "")
		return
	}

	state, err := h.queueService.GetQueueState(queueKey)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to get state", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "Queue state", state)
}

func (h *QueueHandler) GetPosition(c *gin.Context) {
	queueKey := c.Param("key")
	tokenNumber := c.Param("token")

	resp, err := h.queueService.GetUserPosition(queueKey, tokenNumber)
	if err != nil {
		utils.RespondError(c, http.StatusNotFound, "Token not found", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "User position", resp)
}

func (h *QueueHandler) GetActiveTicket(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	resp, err := h.queueService.GetActiveTicket(userID)
	if err != nil {
		utils.RespondSuccess(c, http.StatusOK, "No active ticket found", nil)
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "Active ticket fetched", resp)
}

func (h *QueueHandler) GetUserHistory(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	history, err := h.queueService.GetUserHistory(userID)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to fetch history", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "User history fetched", history)
}

func (h *QueueHandler) CancelTicket(c *gin.Context) {
	queueKey := c.Param("key")
	tokenNumber := c.Param("token")
	userID := c.MustGet("userID").(uint)

	err := h.queueService.CancelTicket(queueKey, tokenNumber, userID)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to cancel", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "Ticket cancelled", nil)
}

func getOrgID(c *gin.Context) (uint, bool) {
	orgIDRaw, exists := c.Get("organizationID")
	if !exists || orgIDRaw == nil {
		utils.RespondError(c, http.StatusForbidden, "Forbidden", "Admin is not tied to an organization")
		return 0, false
	}
	idPtr := orgIDRaw.(*uint)
	if idPtr == nil {
		utils.RespondError(c, http.StatusForbidden, "Forbidden", "Admin is not tied to an organization")
		return 0, false
	}
	return *idPtr, true
}

func (h *QueueHandler) CallNext(c *gin.Context) {
	queueKey := c.Param("key")
	orgID, ok := getOrgID(c)
	if !ok {
		return
	}

	agentID := c.MustGet("userID").(uint)
	entry, err := h.queueService.CallNext(queueKey, orgID, agentID)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to call next", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "Called next user", entry)
}

func (h *QueueHandler) MarkHolding(c *gin.Context) {
	queueKey := c.Param("key")
	orgID, ok := getOrgID(c)
	if !ok {
		return
	}

	err := h.queueService.MarkHolding(queueKey, orgID)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to mark holding", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "User moved to hold status", nil)
}

func (h *QueueHandler) PauseQueue(c *gin.Context) {
	queueKey := c.Param("key")
	orgID, ok := getOrgID(c)
	if !ok {
		return
	}

	var req struct {
		IsPaused bool `json:"is_paused"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	err := h.queueService.PauseQueue(queueKey, req.IsPaused, orgID)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to update pause status", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "Queue pause status updated", req.IsPaused)
}

func (h *QueueHandler) GetAnalytics(c *gin.Context) {
	queueKey := c.Param("key")
	orgID, ok := getOrgID(c)
	if !ok {
		return
	}

	data, err := h.queueService.GetAnalytics(queueKey, orgID)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to get analytics", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "Analytics metrics fetched", data)
}

func (h *QueueHandler) MarkNoShow(c *gin.Context) {
	queueKey := c.Param("key")
	tokenNumber := c.Param("token")
	actorID := c.MustGet("userID").(uint)
	orgID, ok := getOrgID(c)
	if !ok {
		return
	}

	if err := h.queueService.MarkNoShow(queueKey, tokenNumber, orgID, actorID); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Failed to mark no-show", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "Ticket marked as no-show", map[string]string{
		"queue_key":    queueKey,
		"token_number": tokenNumber,
	})
}

func (h *QueueHandler) ReorderQueue(c *gin.Context) {
	queueKey := c.Param("key")
	orgID, ok := getOrgID(c)
	if !ok {
		return
	}
	actorID := c.MustGet("userID").(uint)

	var req struct {
		TokenNumber string `json:"token_number" binding:"required"`
		Position    int    `json:"position" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	if err := h.queueService.ReorderPriority(queueKey, req.TokenNumber, req.Position, orgID, actorID); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Failed to reorder queue", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "Queue priority reordered", req)
}

func (h *QueueHandler) PeakHours(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		return
	}

	orgIDRaw := c.Query("org_id")
	if orgIDRaw == "" {
		utils.RespondError(c, http.StatusBadRequest, "Invalid org_id", "org_id query is required")
		return
	}
	parsed, err := strconv.ParseUint(orgIDRaw, 10, 64)
	if err != nil || uint(parsed) != orgID {
		utils.RespondError(c, http.StatusForbidden, "Forbidden", "org_id mismatch")
		return
	}

	rangeExpr := c.DefaultQuery("range", "7d")
	data, err := h.queueService.GetPeakHoursByOrg(orgID, rangeExpr)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Failed to fetch peak hours", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "Peak hours", data)
}

func (h *QueueHandler) StreamTicketStatus(c *gin.Context) {
	tokenNumber := c.Param("id")

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		utils.RespondError(c, http.StatusInternalServerError, "Streaming unsupported", "flusher not available")
		return
	}

	send := func() error {
		status, err := h.queueService.GetTicketStatus(tokenNumber)
		if err != nil {
			return err
		}
		body, err := json.Marshal(status)
		if err != nil {
			return err
		}
		_, _ = fmt.Fprintf(c.Writer, "event: status\\ndata: %s\\n\\n", body)
		flusher.Flush()
		return nil
	}

	_ = send()

	for {
		select {
		case <-c.Request.Context().Done():
			return
		case <-ticker.C:
			if err := send(); err != nil {
				_, _ = fmt.Fprintf(c.Writer, "event: error\\ndata: {\"message\":\"%s\"}\\n\\n", err.Error())
				flusher.Flush()
				return
			}
		}
	}
}
