package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"queueless/internal/models"
	"queueless/internal/service"
	"queueless/pkg/utils"
)

type FeedbackHandler struct {
	svc service.FeedbackService
}

func NewFeedbackHandler(svc service.FeedbackService) *FeedbackHandler {
	return &FeedbackHandler{svc: svc}
}

func (h *FeedbackHandler) Submit(c *gin.Context) {
	var req models.FeedbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	userID := c.MustGet("userID").(uint)
	if err := h.svc.SubmitFeedback(userID, req); err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to submit feedback", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Feedback submitted successfully", nil)
}

func (h *FeedbackHandler) GetByOrg(c *gin.Context) {
	orgIDStr := c.Query("org_id")
	orgID, err := strconv.ParseUint(orgIDStr, 10, 32)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid org_id", err.Error())
		return
	}

	feedbacks, err := h.svc.GetOrgFeedback(uint(orgID))
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to fetch feedback", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Feedback fetched successfully", feedbacks)
}
