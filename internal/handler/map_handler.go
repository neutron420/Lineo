package handler

import (
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

func (h *MapHandler) SearchNearby(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")
	radiusStr := c.Query("radius")
	orgType := c.Query("type") // hospital, bank etc.

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
	radius, _ := strconv.Atoi(radiusStr)

	if radius == 0 {
		radius = 50000 // BookMyShow style 50km range
	}

	// 1. Fetch Partnered Institutions from our DB
	partnered, _ := h.mapService.SearchPartnered(lat, lng, radius, orgType)
	
	// 2. Fetch from Google Maps
	nearby, _ := h.mapService.SearchNearby(lat, lng, radius, orgType)
	
	// Merge and De-duplicate (Prioritize Partnered Orgs)
	finalMap := make(map[string]utils.Place)
	for _, p := range partnered {
		finalMap[strings.ToLower(p.Name)] = p
	}
	for _, n := range nearby {
		lowerName := strings.ToLower(n.Name)
		if _, exists := finalMap[lowerName]; !exists {
			finalMap[lowerName] = n
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
