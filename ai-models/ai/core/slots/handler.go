package slots

import (
	"net/http"
	"strconv"
	"time"

	"queueless/internal/repository"
	"queueless/pkg/utils"

	"github.com/gin-gonic/gin"
)

const (
	recommendedSlotsMsg = "Recommended slots"
)

type AISlotHandler struct {
	aiSlotService AISlotService
	orgRepo       repository.OrganizationRepository
}

func NewAISlotHandler(s AISlotService, orgRepo repository.OrganizationRepository) *AISlotHandler {
	return &AISlotHandler{aiSlotService: s, orgRepo: orgRepo}
}

func (h *AISlotHandler) GetRecommendations(c *gin.Context) {
	// Support both org_id (numeric) and queue_key (string)
	var orgID uint64

	if raw := c.Query("org_id"); raw != "" {
		parsed, err := strconv.ParseUint(raw, 10, 64)
		if err != nil || parsed == 0 {
			// Treat it as a queue_key string — resolve to org ID
			queueDef, err := h.orgRepo.GetQueueDefByKey(raw)
			if err != nil || queueDef == nil {
				// Graceful fallback: no crash, just return empty recommendations
				utils.RespondSuccess(c, http.StatusOK, recommendedSlotsMsg, map[string]interface{}{
					"recommended_slots":  []interface{}{},
					"all_slots_available": 0,
					"explanation":        "Could not resolve organization. Please try again.",
				})
				return
			}
			orgID = uint64(queueDef.OrganizationID)
		} else {
			orgID = parsed
		}
	} else {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", "org_id is required")
		return
	}

	if orgID == 0 {
		utils.RespondSuccess(c, http.StatusOK, recommendedSlotsMsg, map[string]interface{}{
			"recommended_slots":  []interface{}{},
			"all_slots_available": 0,
			"explanation":        "Organization not found.",
		})
		return
	}

	date := c.Query("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	userID := c.MustGet("userID").(uint)

	resp, err := h.aiSlotService.GetRecommendedSlots(c.Request.Context(), userID, uint(orgID), date)
	if err != nil {
		// Graceful fallback instead of 500
		utils.RespondSuccess(c, http.StatusOK, recommendedSlotsMsg, map[string]interface{}{
			"recommended_slots":  []interface{}{},
			"all_slots_available": 0,
			"explanation":        "AI recommendation temporarily unavailable.",
		})
		return
	}

	utils.RespondSuccess(c, http.StatusOK, recommendedSlotsMsg, resp)
}

