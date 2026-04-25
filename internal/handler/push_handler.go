package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"queueless/internal/models"
	"queueless/internal/repository"
	"queueless/pkg/config"
	"queueless/pkg/utils"
)

type PushHandler struct {
	repo repository.PushSubscriptionRepository
}

func NewPushHandler(repo repository.PushSubscriptionRepository) *PushHandler {
	return &PushHandler{repo: repo}
}

// Subscribe handles POST /api/v1/push/subscribe.
// The user must be authenticated (JWT). The handler extracts userID from
// context, binds the PushSubscription JSON body, and upserts the record.
func (h *PushHandler) Subscribe(c *gin.Context) {
	userIDRaw, exists := c.Get("userID")
	if !exists {
		utils.RespondError(c, http.StatusUnauthorized, "Auth error", "user ID not found in token")
		return
	}
	userID, ok := userIDRaw.(uint)
	if !ok {
		utils.RespondError(c, http.StatusUnauthorized, "Auth error", "invalid user ID type")
		return
	}

	var req models.PushSubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid body", err.Error())
		return
	}

	sub := &models.PushSubscription{
		UserID:   userID,
		Endpoint: req.Endpoint,
		P256dh:   req.Keys.P256dh,
		Auth:     req.Keys.Auth,
	}

	if err := h.repo.Save(sub); err != nil {
		utils.RespondServerError(c, err)
		return
	}

	utils.RespondSuccess(c, http.StatusCreated, "Push subscription saved", nil)
}

// VAPIDKey handles GET /api/v1/push/vapid-key.
// Returns the public VAPID key so the frontend can call
// pushManager.subscribe() with the correct applicationServerKey.
func (h *PushHandler) VAPIDKey(c *gin.Context) {
	key := config.Secret("VAPID_PUBLIC_KEY")
	if key == "" {
		utils.RespondError(c, http.StatusServiceUnavailable, "Not configured", "VAPID key is not set on the server")
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "VAPID public key", map[string]string{
		"vapid_public_key": key,
	})
}
