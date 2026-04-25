package service

import (
	"math"

	"queueless/internal/repository"
	"queueless/pkg/utils"

	goredis "github.com/redis/go-redis/v9"
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

// NewMapService creates the map service. If a non-nil Redis client is
// supplied, search results are cached automatically.
func NewMapService(orgRepo repository.OrganizationRepository, redisClient ...*goredis.Client) MapService {
	var gmaps *utils.GoogleMapsClient
	if len(redisClient) > 0 && redisClient[0] != nil {
		gmaps = utils.NewGoogleMapsClientWithRedis(redisClient[0])
	} else {
		gmaps = utils.NewGoogleMapsClient()
	}

	return &mapService{
		googleMaps: gmaps,
		orgRepo:    orgRepo,
	}
}

func (s *mapService) SearchPartnered(lat, lng float64, radius int, orgType string) ([]utils.Place, error) {
	orgs, err := s.orgRepo.GetNearbyOrgs(lat, lng, float64(radius), orgType)
	if err != nil {
		return nil, err
	}

	places := make([]utils.Place, 0, len(orgs))
	for _, o := range orgs {
		queues := make([]utils.QueueInfo, 0, len(o.Queues))
		key := ""
		for _, q := range o.Queues {
			queues = append(queues, utils.QueueInfo{
				Name:     q.Name,
				Key:      q.QueueKey,
				IsPaused: q.IsPaused,
			})
			if key == "" {
				key = q.QueueKey
			}
		}

		dist := utils.CalculateDistance(lat, lng, o.Latitude, o.Longitude)

		places = append(places, utils.Place{
			Name:       o.Name,
			Address:    o.Address,
			Vicinity:   o.Address,
			Lat:        o.Latitude,
			Lng:        o.Longitude,
			Key:        key,
			Type:       o.Type,
			DistanceKM: math.Round(dist*100) / 100,
			Partnered:  true,
			Queues:     queues,
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
