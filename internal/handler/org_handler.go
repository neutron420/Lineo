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



func (h *OrgHandler) CreateQueue(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		utils.RespondError(c, http.StatusForbidden, "Forbidden", "Administrative context missing Organization ID")
		return
	}

	var req CreateQueueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	q, err := h.orgService.CreateQueueForOrg(orgID, req.Name, req.QueueKey)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to launch unit", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusCreated, "Operational unit launched", q)
}

func (h *OrgHandler) GetOrgConfig(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		utils.RespondError(c, http.StatusForbidden, "Forbidden", "Administrative context missing Organization ID")
		return
	}

	cfg, err := h.orgService.GetOrgConfig(orgID)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to fetch config", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Organization config fetched", cfg)
}

func (h *OrgHandler) UpsertOrgConfig(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		utils.RespondError(c, http.StatusForbidden, "Forbidden", "Administrative context missing Organization ID")
		return
	}

	var req models.OrganizationConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	cfg, err := h.orgService.UpdateOrgConfig(orgID, req)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to update config", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Organization config updated", cfg)
}

func (h *OrgHandler) CreateOrgConfig(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		utils.RespondError(c, http.StatusForbidden, "Forbidden", "Administrative context missing Organization ID")
		return
	}

	var req models.OrganizationConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	cfg, err := h.orgService.CreateOrgConfig(orgID, req)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Failed to create config", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusCreated, "Organization config created", cfg)
}

func (h *OrgHandler) DeleteOrgConfig(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		utils.RespondError(c, http.StatusForbidden, "Forbidden", "Administrative context missing Organization ID")
		return
	}

	if err := h.orgService.DeleteOrgConfig(orgID); err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to delete config", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "Organization config deleted", nil)
}

func (h *OrgHandler) UpgradePlan(c *gin.Context) {
	orgID, ok := getOrgID(c)
	if !ok {
		utils.RespondError(c, http.StatusForbidden, "Forbidden", "Administrative context missing Organization ID")
		return
	}

	var req struct {
		Plan   string `json:"plan" binding:"required"`
		Months int    `json:"months" binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	if err := h.orgService.UpgradePlan(orgID, req.Plan, req.Months); err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to upgrade plan", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Subscription upgraded successfully", gin.H{"plan": req.Plan})
}

func (h *OrgHandler) GetMyOrganization(c *gin.Context) {
	// Safer retrieval with Self-Healing fallback
	orgID, ok := getOrgID(c)
	
	if !ok {
		// FALLBACK: If token claims are stale, try to find the linked organization using userID
		userIDRaw, uExists := c.Get("userID")
		if uExists {
			var uID uint
			switch v := userIDRaw.(type) {
			case uint: uID = v
			case float64: uID = uint(v)
			}
			
			if uID > 0 {
				// Try to find if this user IS linked to an organization anyway
				// Using the org service to fetch
			}
		}
		
		if !ok {
			utils.RespondError(c, http.StatusForbidden, "Forbidden", "Session is missing institutional link. Please re-login.")
			return
		}
	}

	org, err := h.orgService.GetOrganizationByID(orgID)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Sync Error", "Could not synchronize organization state.")
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Organization state synchronized", org)
}
