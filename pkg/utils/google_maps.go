package utils

import (
	"encoding/json"
	"fmt"
	"net/http"

	"queueless/internal/models"
	"queueless/pkg/config"
)

type GoogleMapsClient struct {
	APIKey string
}

func NewGoogleMapsClient() *GoogleMapsClient {
	return &GoogleMapsClient{
		APIKey: config.Secret("GOOGLE_API_KEY"),
	}
}

type Place struct {
	Name     string  `json:"name"`
	Address  string  `json:"vicinity"`
	PlaceID  string  `json:"place_id"`
	Lat      float64 `json:"lat"`
	Lng      float64 `json:"lng"`
	Rating   float32 `json:"rating"`
	UserRatingsTotal int `json:"user_ratings_total"`
	Key      string  `json:"key"`
}

// SearchNearby finds hospitals, clinics, or banks using Google Places API
func (g *GoogleMapsClient) SearchNearby(lat, lng float64, radius int, placeType string) ([]Place, error) {
	if g.APIKey == "" {
		return nil, fmt.Errorf("google api key is missing")
	}

	apiURL := fmt.Sprintf(
		"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=%f,%f&radius=%d&type=%s&key=%s",
		lat, lng, radius, placeType, g.APIKey,
	)

	resp, err := http.Get(apiURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Results []struct {
			Name     string `json:"name"`
			Vicinity string `json:"vicinity"`
			PlaceID  string `json:"place_id"`
			Geometry struct {
				Location struct {
					Lat float64 `json:"lat"`
					Lng float64 `json:"lng"`
				} `json:"location"`
			} `json:"geometry"`
			Rating           float32 `json:"rating"`
			UserRatingsTotal int     `json:"user_ratings_total"`
		} `json:"results"`
		Status string `json:"status"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if result.Status != "OK" && result.Status != "ZERO_RESULTS" {
		return nil, fmt.Errorf("google api error: %s", result.Status)
	}

	places := make([]Place, 0)
	for _, r := range result.Results {
		places = append(places, Place{
			Name:             r.Name,
			Address:          r.Vicinity,
			PlaceID:          r.PlaceID,
			Lat:              r.Geometry.Location.Lat,
			Lng:              r.Geometry.Location.Lng,
			Rating:           r.Rating,
			UserRatingsTotal: r.UserRatingsTotal,
		})
	}

	return places, nil
}

func (g *GoogleMapsClient) GetAddressFromCoords(lat, lng float64) (string, error) {
	if g.APIKey == "" {
		return "", fmt.Errorf("google api key is missing")
	}

	apiURL := fmt.Sprintf(
		"https://maps.googleapis.com/maps/api/geocode/json?latlng=%f,%f&key=%s",
		lat, lng, g.APIKey,
	)

	resp, err := http.Get(apiURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		Results []struct {
			FormattedAddress string `json:"formatted_address"`
		} `json:"results"`
		Status string `json:"status"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	if result.Status != "OK" {
		return "", fmt.Errorf("google api error: %s", result.Status)
	}

	if len(result.Results) > 0 {
		return result.Results[0].FormattedAddress, nil
	}

	return "Unknown Location", nil
}

func (g *GoogleMapsClient) GetDistanceMatrix(originLat, originLng, destLat, destLng float64) (*models.CommuteInfo, error) {
	if g.APIKey == "" {
		return nil, fmt.Errorf("google api key is missing")
	}

	apiURL := fmt.Sprintf(
		"https://maps.googleapis.com/maps/api/distancematrix/json?origins=%f,%f&destinations=%f,%f&departure_time=now&traffic_model=best_guess&key=%s",
		originLat, originLng, destLat, destLng, g.APIKey,
	)

	resp, err := http.Get(apiURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Rows []struct {
			Elements []struct {
				Distance struct { Text string `json:"text"`; Value int `json:"value"` } `json:"distance"`
				DurationInTraffic struct { Text string `json:"text"`; Value int `json:"value"` } `json:"duration_in_traffic"`
				Status   string `json:"status"`
			} `json:"elements"`
		} `json:"rows"`
		Status string `json:"status"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if result.Status != "OK" || len(result.Rows) == 0 || len(result.Rows[0].Elements) == 0 {
		return nil, fmt.Errorf("google distance error: %v", result.Status)
	}

	el := result.Rows[0].Elements[0]
	if el.Status != "OK" {
		return nil, fmt.Errorf("distance matrix element status: %s", el.Status)
	}

	return &models.CommuteInfo{
		DistanceText: el.Distance.Text,
		DurationText: el.DurationInTraffic.Text,
		DurationSec:  el.DurationInTraffic.Value,
	}, nil
}
