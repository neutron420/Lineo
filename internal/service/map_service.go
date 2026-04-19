package service

import (
	"queueless/internal/repository"
	"queueless/pkg/utils"
)

type MapService interface {
	SearchNearby(lat, lng float64, radius int, orgType string) ([]utils.Place, error)
	GetAddress(lat, lng float64) (string, error)
	SearchPartnered(lat, lng float64, radius int, orgType string) ([]utils.Place, error)
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

func (s *mapService) SearchPartnered(lat, lng float64, radius int, orgType string) ([]utils.Place, error) {
	orgs, err := s.orgRepo.GetNearbyOrgs(lat, lng, float64(radius), orgType)
	if err != nil { return nil, err }

	places := make([]utils.Place, 0)
	for _, o := range orgs {
		queues := make([]utils.QueueInfo, 0)
		key := ""
		for _, q := range o.Queues {
			queues = append(queues, utils.QueueInfo{
				Name:     q.Name,
				Key:      q.QueueKey,
				IsPaused: q.IsPaused,
			})
			if key == "" { key = q.QueueKey }
		}

		places = append(places, utils.Place{
			Name:      o.Name,
			Address:   o.Address,
			Vicinity:  o.Address,
			Lat:       o.Latitude,
			Lng:       o.Longitude,
			Key:       key,
			Type:      o.Type,
			Partnered: true,
			Queues:    queues,
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
