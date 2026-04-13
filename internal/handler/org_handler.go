package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"queueless/internal/service"
	"queueless/pkg/utils"
)

type OrgHandler struct {
	orgService service.OrganizationService
}

func NewOrgHandler(s service.OrganizationService) *OrgHandler {
	return &OrgHandler{orgService: s}
}

type CreateOrgRequest struct {
	Name    string `json:"name" binding:"required"`
	Type    string `json:"type" binding:"required"`
	Address string `json:"address"`
}

func (h *OrgHandler) CreateOrganization(c *gin.Context) {
	var req CreateOrgRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	org, err := h.orgService.CreateOrganization(req.Name, req.Type, req.Address)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to create organization", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusCreated, "Organization created", org)
}

type CreateQueueRequest struct {
	Name     string `json:"name" binding:"required"`
	QueueKey string `json:"queue_key" binding:"required"`
}

func (h *OrgHandler) CreateQueue(c *gin.Context) {
	orgID, exists := c.Get("organizationID") // Should be set by admin middleware
	if !exists || orgID == nil {
		utils.RespondError(c, http.StatusForbidden, "Forbidden", "Admin is not tied to an organization")
		return
	}

	var req CreateQueueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	idPtr := orgID.(*uint)

	q, err := h.orgService.CreateQueueForOrg(*idPtr, req.Name, req.QueueKey)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to create queue", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusCreated, "Queue created for organization", q)
}
