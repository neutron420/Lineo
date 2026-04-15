package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"queueless/internal/models"
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

func (h *OrgHandler) GetOrgConfig(c *gin.Context) {
	orgID, exists := c.Get("organizationID")
	if !exists || orgID == nil {
		utils.RespondError(c, http.StatusForbidden, "Forbidden", "Admin is not tied to an organization")
		return
	}

	idPtr := orgID.(*uint)
	cfg, err := h.orgService.GetOrgConfig(*idPtr)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to fetch config", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Organization config fetched", cfg)
}

func (h *OrgHandler) UpsertOrgConfig(c *gin.Context) {
	orgID, exists := c.Get("organizationID")
	if !exists || orgID == nil {
		utils.RespondError(c, http.StatusForbidden, "Forbidden", "Admin is not tied to an organization")
		return
	}

	var req models.OrganizationConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	idPtr := orgID.(*uint)
	cfg, err := h.orgService.UpdateOrgConfig(*idPtr, req)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to update config", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Organization config updated", cfg)
}

func (h *OrgHandler) CreateOrgConfig(c *gin.Context) {
	orgID, exists := c.Get("organizationID")
	if !exists || orgID == nil {
		utils.RespondError(c, http.StatusForbidden, "Forbidden", "Admin is not tied to an organization")
		return
	}

	var req models.OrganizationConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	idPtr := orgID.(*uint)
	cfg, err := h.orgService.CreateOrgConfig(*idPtr, req)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Failed to create config", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusCreated, "Organization config created", cfg)
}

func (h *OrgHandler) DeleteOrgConfig(c *gin.Context) {
	orgID, exists := c.Get("organizationID")
	if !exists || orgID == nil {
		utils.RespondError(c, http.StatusForbidden, "Forbidden", "Admin is not tied to an organization")
		return
	}

	idPtr := orgID.(*uint)
	if err := h.orgService.DeleteOrgConfig(*idPtr); err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to delete config", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "Organization config deleted", nil)
}
