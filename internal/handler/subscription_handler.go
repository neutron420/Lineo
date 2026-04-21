package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"queueless/internal/models"
	"queueless/internal/service"
	"queueless/pkg/utils"
)

type SubscriptionHandler struct {
	subSvc service.UserSubscriptionService
}

func NewSubscriptionHandler(subSvc service.UserSubscriptionService) *SubscriptionHandler {
	return &SubscriptionHandler{subSvc: subSvc}
}

func (h *SubscriptionHandler) UpgradeTier(c *gin.Context) {
	var req struct {
		Tier models.SubscriptionTier `json:"tier" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	userID := c.MustGet("userID").(uint)
	if err := h.subSvc.UpgradeTier(userID, req.Tier); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Upgrade failed", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Subscription upgraded successfully", gin.H{"tier": req.Tier})
}

func (h *SubscriptionHandler) GetStatus(c *gin.Context) {
	// Re-uses existing user info but can be specific
	// For now, handled by login/profile
	utils.RespondSuccess(c, http.StatusOK, "Status fetched", nil)
}
