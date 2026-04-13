package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"queueless/internal/models"
	"queueless/internal/service"
	"queueless/pkg/utils"
)

type AuthHandler struct {
	authService service.AuthService
}

func NewAuthHandler(s service.AuthService) *AuthHandler {
	return &AuthHandler{authService: s}
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

	err := h.authService.ForgotPassword(req.Email)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Reset failed", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Reset email sent successfully", nil)
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req models.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	err := h.authService.ResetPassword(req.Token, req.NewPassword)
	if err != nil {
		utils.RespondError(c, http.StatusUnauthorized, "Password reset failed", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Password reset successfully. You can now login.", nil)
}

