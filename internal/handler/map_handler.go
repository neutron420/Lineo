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

	lat, _ := strconv.ParseFloat(latStr, 64)
	lng, _ := strconv.ParseFloat(lngStr, 64)
	radius, _ := strconv.Atoi(radiusStr)

	if radius == 0 {
		radius = 5000 // default 5km
	}

	var results []utils.Place
	var err error

	if orgType == "bank" {
		results, err = h.mapService.SearchNearbyBanks(lat, lng, radius)
	} else {
		results, err = h.mapService.SearchNearbyClinics(lat, lng, radius)
	}

	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to fetch nearby results", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Nearby places found", results)
}

func (h *MapHandler) GetAddress(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")

	lat, _ := strconv.ParseFloat(latStr, 64)
	lng, _ := strconv.ParseFloat(lngStr, 64)

	address, err := h.mapService.GetAddress(lat, lng)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to reverse geocode", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Address fetched", map[string]string{"address": address})
}
