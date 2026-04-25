package handler

import (
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"queueless/internal/service"
	"queueless/pkg/utils"
)

type MapHandler struct {
	mapService service.MapService
}

func NewMapHandler(s service.MapService) *MapHandler {
	return &MapHandler{mapService: s}
}

// SearchNearby handles GET /api/v1/search/nearby
//
// Query params:
//   - lat    (required) – latitude  (-90 to 90)
//   - lng    (required) – longitude (-180 to 180)
//   - radius (optional) – metres, default 5000, max 50000
//   - type   (optional) – e.g. hospital, bank, clinic, atm, pharmacy …
func (h *MapHandler) SearchNearby(c *gin.Context) {
	// ── Validate lat ────────────────────────────────────────────────────
	latStr := strings.TrimSpace(c.Query("lat"))
	if latStr == "" {
		utils.RespondError(c, http.StatusBadRequest, "Missing parameter", "lat query parameter is required")
		return
	}
	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil || math.IsNaN(lat) || math.IsInf(lat, 0) {
		utils.RespondError(c, http.StatusBadRequest, "Invalid lat", "lat must be a valid number")
		return
	}
	if lat < -90 || lat > 90 {
		utils.RespondError(c, http.StatusBadRequest, "Invalid lat", "lat must be between -90 and 90")
		return
	}

	// ── Validate lng ────────────────────────────────────────────────────
	lngStr := strings.TrimSpace(c.Query("lng"))
	if lngStr == "" {
		utils.RespondError(c, http.StatusBadRequest, "Missing parameter", "lng query parameter is required")
		return
	}
	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil || math.IsNaN(lng) || math.IsInf(lng, 0) {
		utils.RespondError(c, http.StatusBadRequest, "Invalid lng", "lng must be a valid number")
		return
	}
	if lng < -180 || lng > 180 {
		utils.RespondError(c, http.StatusBadRequest, "Invalid lng", "lng must be between -180 and 180")
		return
	}

	// ── Validate radius ─────────────────────────────────────────────────
	radius := 5000 // default 5 km
	if rStr := strings.TrimSpace(c.Query("radius")); rStr != "" {
		r, err := strconv.Atoi(rStr)
		if err != nil || r <= 0 {
			utils.RespondError(c, http.StatusBadRequest, "Invalid radius", "radius must be a positive integer (metres)")
			return
		}
		if r > 50000 {
			r = 50000 // cap at 50 km
		}
		radius = r
	}

	orgType := strings.TrimSpace(c.Query("type"))

	// ── 1. Fetch Partnered Institutions from our DB ─────────────────────
	partnered, _ := h.mapService.SearchPartnered(lat, lng, radius, orgType)

	// ── 2. Fetch from Google Maps (hybrid search) ───────────────────────
	nearby, _ := h.mapService.SearchNearby(lat, lng, radius, orgType)

	// ── 3. Merge & De-duplicate (Partnered orgs take priority) ──────────
	finalMap := make(map[string]utils.Place, len(partnered)+len(nearby))

	// Partnered first — keyed by lowercase name for DB entries (no place_id)
	for _, p := range partnered {
		key := strings.ToLower(p.Name)
		finalMap[key] = p
	}

	// Google results — keyed by place_id when available
	for _, n := range nearby {
		// Skip if a partnered org already covers this name
		if _, exists := finalMap[strings.ToLower(n.Name)]; exists {
			continue
		}
		// Use place_id as key for Google results
		key := n.PlaceID
		if key == "" {
			key = strings.ToLower(n.Name)
		}
		if _, exists := finalMap[key]; !exists {
			finalMap[key] = n
		}
	}

	allResults := make([]utils.Place, 0, len(finalMap))
	for _, v := range finalMap {
		allResults = append(allResults, v)
	}

	utils.RespondSuccess(c, http.StatusOK, "Nearby places found", allResults)
}

func (h *MapHandler) GetAddress(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid lat", "lat query is required")
		return
	}
	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid lng", "lng query is required")
		return
	}

	address, err := h.mapService.GetAddress(lat, lng)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to reverse geocode", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Address fetched", map[string]string{"address": address})
}
