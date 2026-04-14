package handler

import (
	"net/http"

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
	username := "user" // Dynamic in a real app
	
	// Ensure that ONLY admins can set Priority flags
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
		// Instead of 404, we return null to keep the frontend clean
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


// User Actions
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

// Below are Admin specific logic handling
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
	if !ok { return }

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
	if !ok { return }

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
	if !ok { return }

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
	if !ok { return }

	data, err := h.queueService.GetAnalytics(queueKey, orgID)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to get analytics", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "Analytics metrics fetched", data)
}
