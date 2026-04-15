package handler

import (
	"net/http"
	"strconv"

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
	partnered, _ := h.mapService.SearchPartnered(lat, lng, radius)
	
	// 2. Fetch from Google Maps
	nearby, _ := h.mapService.SearchNearby(lat, lng, radius, orgType)
	
	// Merge and Prioritize
	allResults := append(partnered, nearby...)

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
