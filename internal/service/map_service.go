package service

import (
	"queueless/pkg/utils"
)

type MapService interface {
	SearchNearbyClinics(lat, lng float64, radius int) ([]utils.Place, error)
	SearchNearbyBanks(lat, lng float64, radius int) ([]utils.Place, error)
	GetAddress(lat, lng float64) (string, error)
}

type mapService struct {
	googleMaps *utils.GoogleMapsClient
}

func NewMapService() MapService {
	return &mapService{
		googleMaps: utils.NewGoogleMapsClient(),
	}
}

func (s *mapService) SearchNearbyClinics(lat, lng float64, radius int) ([]utils.Place, error) {
	return s.googleMaps.SearchNearby(lat, lng, radius, "hospital")
}

func (s *mapService) SearchNearbyBanks(lat, lng float64, radius int) ([]utils.Place, error) {
	return s.googleMaps.SearchNearby(lat, lng, radius, "bank")
}

func (s *mapService) GetAddress(lat, lng float64) (string, error) {
	return s.googleMaps.GetAddressFromCoords(lat, lng)
}
