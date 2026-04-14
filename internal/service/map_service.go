package service

import (
	"queueless/internal/repository"
	"queueless/pkg/utils"
)

type MapService interface {
	SearchNearby(lat, lng float64, radius int, orgType string) ([]utils.Place, error)
	GetAddress(lat, lng float64) (string, error)
	SearchPartnered(lat, lng float64, radius int) ([]utils.Place, error)
}

type mapService struct {
	googleMaps *utils.GoogleMapsClient
	orgRepo    repository.OrganizationRepository
}

func NewMapService(orgRepo repository.OrganizationRepository) MapService {
	return &mapService{
		googleMaps: utils.NewGoogleMapsClient(),
		orgRepo:    orgRepo,
	}
}

func (s *mapService) SearchPartnered(lat, lng float64, radius int) ([]utils.Place, error) {
	orgs, err := s.orgRepo.GetNearbyOrgs(lat, lng, float64(radius))
	if err != nil { return nil, err }

	places := make([]utils.Place, 0)
	for _, o := range orgs {
		key := ""
		if len(o.Queues) > 0 { key = o.Queues[0].QueueKey }
		places = append(places, utils.Place{
			Name:    o.Name,
			Address: o.Address,
			Lat:     o.Latitude,
			Lng:     o.Longitude,
			Key:     key,
		})
	}
	return places, nil
}

func (s *mapService) SearchNearby(lat, lng float64, radius int, orgType string) ([]utils.Place, error) {
	if orgType == "" {
		orgType = "hospital" // default
	}
	return s.googleMaps.SearchNearby(lat, lng, radius, orgType)
}

func (s *mapService) GetAddress(lat, lng float64) (string, error) {
	return s.googleMaps.GetAddressFromCoords(lat, lng)
}
