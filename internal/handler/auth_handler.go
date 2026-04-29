package handler

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"queueless/internal/models"
	"queueless/internal/service"
	"queueless/pkg/db"
	"queueless/pkg/utils"
)

type AuthHandler struct {
	authService service.AuthService
	subSvc      service.UserSubscriptionService
}

func NewAuthHandler(s service.AuthService, subSvc service.UserSubscriptionService) *AuthHandler {
	return &AuthHandler{
		authService: s,
		subSvc:      subSvc,
	}
}

func (h *AuthHandler) GetMe(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	
	var user models.User
	if err := db.DB.First(&user, userID).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", err.Error())
		return
	}

	// Important: Sync counters when fetching profile to ensure daily limits refresh on dashboard load
	if err := h.subSvc.SyncCounters(&user); err != nil {
		slog.Error("Failed to sync counters for user", "userID", userID, "error", err)
	}

	utils.RespondSuccess(c, http.StatusOK, "User profile fetched", user)
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	user, err := h.authService.RegisterUser(req)
	if err != nil {
		utils.RespondError(c, http.StatusConflict, "Registration failed", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusCreated, "User registered successfully", user)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	token, user, err := h.authService.LoginUser(req)
	if err != nil {
		utils.RespondError(c, http.StatusUnauthorized, "Login failed", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Login successful", models.TokenResponse{
		Token: token,
		User:  *user,
	})
}

func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req models.ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	err := h.authService.ForgotPassword(req.Email, req.Method)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Reset failed", err.Error())
		return
	}

	msg := "Reset email sent successfully"
	if req.Method == "sms" {
		msg = "Reset OTP sent via SMS successfully"
	}
	utils.RespondSuccess(c, http.StatusOK, msg, nil)
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req models.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	err := h.authService.ResetPassword(req.Email, req.OTP, req.NewPassword)
	if err != nil {
		utils.RespondError(c, http.StatusUnauthorized, "Password reset failed", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Password reset successfully. You can now login.", nil)
}

func (h *AuthHandler) AddStaff(c *gin.Context) {
	orgID, exists := c.Get("organizationID")
	if !exists || orgID == nil {
		utils.RespondError(c, http.StatusForbidden, "Forbidden", "Admin is not tied to an organization")
		return
	}

	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	idPtr := orgID.(*uint)
	user, err := h.authService.AddStaff(*idPtr, req)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to add staff", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusCreated, "Staff member added successfully", user)
}

func (h *AuthHandler) RegisterOrganization(c *gin.Context) {
	var req models.OrgRegistrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	user, err := h.authService.RegisterOrganization(req)
	if err != nil {
		utils.RespondError(c, http.StatusConflict, "Organization registration failed", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusCreated, "Organization registered and pending verification", user)
}

