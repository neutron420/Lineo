package chatbot

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type WebChatHandler struct {
	service *ChatbotService
}

func NewWebChatHandler(svc *ChatbotService) *WebChatHandler {
	return &WebChatHandler{service: svc}
}

type ChatRequest struct {
	Message   string `json:"message" binding:"required"`
	SessionID string `json:"session_id"` // Frontend can send this to maintain session
	OrgID     string `json:"org_id"`
}

func (h *WebChatHandler) HandleWebChat(c *gin.Context) {
	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Try to get the user_id from the context (set by AuthMiddleware)
	userIDInt, exists := c.Get("userID")
	userID := "anon"
	if exists {
		userID = fmt.Sprintf("%v", userIDInt)
	}

	orgID := req.OrgID
	if orgID == "" {
		if orgIDVal, exists := c.Get("organizationID"); exists {
			orgID = fmt.Sprintf("%v", orgIDVal)
		} else {
			orgID = "1" // Default fallback
		}
	}

	sessionID := req.SessionID
	if sessionID == "" {
		// Create a new session ID if they didn't provide one
		sessionID = "web:" + userID + ":" + time.Now().Format("2006-01-02-15-04-05")
	}

	userPhone := ""
	if exists {
		userPhone = h.service.GetUserPhone(userIDInt)
	}

	user := UserContext{
		ID:    userID,
		Name:  "User",
		OrgID: orgID,
		Phone: userPhone,
	}

	response, err := h.service.ProcessMessage(c.Request.Context(), sessionID, req.Message, user, "web")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process message"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"response":   response,
		"session_id": sessionID,
	})
}

func (h *WebChatHandler) HandleGetHistory(c *gin.Context) {
	sessionID := c.Query("session_id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
		return
	}

	history, err := h.service.GetHistory(c.Request.Context(), sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"history": history})
}

