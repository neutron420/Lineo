package utils

import (
	"context"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"queueless/internal/models"
	"queueless/pkg/config"

	goredis "github.com/redis/go-redis/v9"
)

type GoogleMapsClient struct {
	APIKey     string
	httpClient *http.Client
	redis      *goredis.Client
}

func NewGoogleMapsClient() *GoogleMapsClient {
	return &GoogleMapsClient{
		APIKey: config.Secret("GOOGLE_API_KEY"),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// NewGoogleMapsClientWithRedis creates a client with Redis caching support.
func NewGoogleMapsClientWithRedis(redisClient *goredis.Client) *GoogleMapsClient {
	c := NewGoogleMapsClient()
	c.redis = redisClient
	return c
}

// ─── Place Type Resolution ──────────────────────────────────────────────────

// googlePlaceType maps user-friendly query strings to the exact Google Places
// API type enum values. Unrecognised queries are returned as-is so that Text
// Search can still match on the raw string.
func resolveGoogleType(query string) (placeType string, textQuery string) {
	q := strings.TrimSpace(strings.ToLower(query))

	typeMap := map[string]string{
		// Healthcare
		"hospital":      "hospital",
		"clinic":        "doctor",
		"doctor":        "doctor",
		"dentist":       "dentist",
		"pharmacy":      "pharmacy",
		"physiotherapy": "physiotherapist",
		"veterinary":    "veterinary_care",
		"vet":           "veterinary_care",

		// Finance
		"bank":           "bank",
		"atm":            "atm",
		"insurance":      "insurance_agency",
		"accounting":     "accounting",

		// Government
		"post office":    "post_office",
		"post_office":    "post_office",
		"police":         "police",
		"fire station":   "fire_station",
		"fire_station":   "fire_station",
		"courthouse":     "courthouse",
		"city hall":      "city_hall",
		"city_hall":      "city_hall",
		"embassy":        "embassy",
		"local_government_office": "local_government_office",

		// Education
		"school":     "school",
		"university": "university",
		"library":    "library",

		// Other common
		"gas station":    "gas_station",
		"gas_station":    "gas_station",
		"restaurant":     "restaurant",
		"cafe":           "cafe",
		"supermarket":    "supermarket",
		"grocery":        "supermarket",
		"gym":            "gym",
		"spa":            "spa",
		"salon":          "beauty_salon",
		"beauty_salon":   "beauty_salon",
		"hair_care":      "hair_care",
		"laundry":        "laundry",
		"car_repair":     "car_repair",
		"car repair":     "car_repair",
		"parking":        "parking",
		"train_station":  "train_station",
		"bus_station":    "bus_station",
	}

	if mapped, ok := typeMap[q]; ok {
		return mapped, ""
	}
	// If no direct match, return empty type so we fall back to Text Search only.
	return "", q
}

// ─── Cache Key Builder ──────────────────────────────────────────────────────

// buildCacheKey returns a deterministic Redis key from search parameters.
// Latitude and longitude are rounded to 3 decimal places (~111m precision)
// to coalesce nearby requests into the same cache bucket.
func buildCacheKey(query string, lat, lng float64, radius int) string {
	roundedLat := math.Round(lat*1000) / 1000
	roundedLng := math.Round(lng*1000) / 1000
	raw := fmt.Sprintf("search:%s:%.3f:%.3f:%d", strings.ToLower(query), roundedLat, roundedLng, radius)
	hash := md5.Sum([]byte(raw))
	return fmt.Sprintf("lineo:search:%x", hash)
}

const searchCacheTTL = 10 * time.Minute

// ─── Structs ────────────────────────────────────────────────────────────────

type QueueInfo struct {
	Name     string `json:"name"`
	Key      string `json:"key"`
	IsPaused bool   `json:"is_paused"`
}

type Place struct {
	PlaceID          string      `json:"place_id"`
	Name             string      `json:"name"`
	Address          string      `json:"address"`
	Vicinity         string      `json:"vicinity"`
	Lat              float64     `json:"lat"`
	Lng              float64     `json:"lng"`
	Rating           float32     `json:"rating"`
	UserRatingsTotal int         `json:"user_ratings_total"`
	DistanceKM       float64     `json:"distance_km"`
	IsOpen           *bool       `json:"is_open"`
	PhoneNumber      string      `json:"phone_number,omitempty"`
	Key              string      `json:"key,omitempty"`
	Type             string      `json:"type"`
	Partnered        bool        `json:"partnered"`
	Queues           []QueueInfo `json:"queues,omitempty"`
}

// ─── Nearby Search (legacy Google endpoint) ─────────────────────────────────

func (g *GoogleMapsClient) nearbySearch(ctx context.Context, lat, lng float64, radius int, placeType string) ([]Place, error) {
	apiURL := fmt.Sprintf(
		"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=%f,%f&radius=%d&type=%s&key=%s",
		lat, lng, radius, url.QueryEscape(placeType), g.APIKey,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("nearbySearch: build request: %w", err)
	}

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("nearbySearch: http call: %w", err)
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
			OpeningHours     *struct {
				OpenNow bool `json:"open_now"`
			} `json:"opening_hours"`
		} `json:"results"`
		Status string `json:"status"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("nearbySearch: decode: %w", err)
	}
	if result.Status != "OK" && result.Status != "ZERO_RESULTS" {
		return nil, fmt.Errorf("nearbySearch: google api status: %s", result.Status)
	}

	places := make([]Place, 0, len(result.Results))
	for _, r := range result.Results {
		dist := CalculateDistance(lat, lng, r.Geometry.Location.Lat, r.Geometry.Location.Lng)
		p := Place{
			PlaceID:          r.PlaceID,
			Name:             r.Name,
			Address:          r.Vicinity,
			Vicinity:         r.Vicinity,
			Lat:              r.Geometry.Location.Lat,
			Lng:              r.Geometry.Location.Lng,
			Rating:           r.Rating,
			UserRatingsTotal: r.UserRatingsTotal,
			DistanceKM:       math.Round(dist*100) / 100,
			Type:             placeType,
			Partnered:        false,
		}
		if r.OpeningHours != nil {
			open := r.OpeningHours.OpenNow
			p.IsOpen = &open
		}
		places = append(places, p)
	}
	return places, nil
}

// ─── Text Search (better relevance for ambiguous queries) ───────────────────

func (g *GoogleMapsClient) textSearch(ctx context.Context, lat, lng float64, radius int, textQuery, placeType string) ([]Place, error) {
	params := url.Values{}
	params.Set("query", textQuery)
	params.Set("location", fmt.Sprintf("%f,%f", lat, lng))
	params.Set("radius", fmt.Sprintf("%d", radius))
	params.Set("key", g.APIKey)
	if placeType != "" {
		params.Set("type", placeType)
	}

	apiURL := "https://maps.googleapis.com/maps/api/place/textsearch/json?" + params.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("textSearch: build request: %w", err)
	}

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("textSearch: http call: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Results []struct {
			Name             string `json:"name"`
			FormattedAddress string `json:"formatted_address"`
			PlaceID          string `json:"place_id"`
			Geometry         struct {
				Location struct {
					Lat float64 `json:"lat"`
					Lng float64 `json:"lng"`
				} `json:"location"`
			} `json:"geometry"`
			Rating           float32 `json:"rating"`
			UserRatingsTotal int     `json:"user_ratings_total"`
			OpeningHours     *struct {
				OpenNow bool `json:"open_now"`
			} `json:"opening_hours"`
		} `json:"results"`
		Status string `json:"status"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("textSearch: decode: %w", err)
	}
	if result.Status != "OK" && result.Status != "ZERO_RESULTS" {
		return nil, fmt.Errorf("textSearch: google api status: %s", result.Status)
	}

	places := make([]Place, 0, len(result.Results))
	for _, r := range result.Results {
		dist := CalculateDistance(lat, lng, r.Geometry.Location.Lat, r.Geometry.Location.Lng)
		p := Place{
			PlaceID:          r.PlaceID,
			Name:             r.Name,
			Address:          r.FormattedAddress,
			Vicinity:         r.FormattedAddress,
			Lat:              r.Geometry.Location.Lat,
			Lng:              r.Geometry.Location.Lng,
			Rating:           r.Rating,
			UserRatingsTotal: r.UserRatingsTotal,
			DistanceKM:       math.Round(dist*100) / 100,
			Type:             placeType,
			Partnered:        false,
		}
		if r.OpeningHours != nil {
			open := r.OpeningHours.OpenNow
			p.IsOpen = &open
		}
		places = append(places, p)
	}
	return places, nil
}

// ─── Hybrid Search (public API) ─────────────────────────────────────────────

// SearchNearby performs a hybrid search combining Google Nearby Search and
// Text Search for maximum accuracy. Results are de-duplicated by place_id,
// sorted by the smart algorithm (rating within 1 km, distance beyond), and
// cached in Redis for 10 minutes.
func (g *GoogleMapsClient) SearchNearby(lat, lng float64, radius int, orgType string) ([]Place, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if g.APIKey == "" {
		return nil, fmt.Errorf("google api key is missing")
	}

	// ── Cache check ─────────────────────────────────────────────────────
	cacheKey := buildCacheKey(orgType, lat, lng, radius)
	if g.redis != nil {
		cached, err := g.redis.Get(ctx, cacheKey).Bytes()
		if err == nil && len(cached) > 0 {
			var places []Place
			if json.Unmarshal(cached, &places) == nil {
				return places, nil
			}
		}
	}

	// ── Resolve type ────────────────────────────────────────────────────
	googleType, textQuery := resolveGoogleType(orgType)

	// ── Parallel hybrid search ──────────────────────────────────────────
	type searchResult struct {
		places []Place
		err    error
	}

	nearbyC := make(chan searchResult, 1)
	textC := make(chan searchResult, 1)

	// 1) Nearby Search — only if we resolved a valid Google type
	go func() {
		if googleType != "" {
			p, err := g.nearbySearch(ctx, lat, lng, radius, googleType)
			nearbyC <- searchResult{p, err}
		} else {
			nearbyC <- searchResult{}
		}
	}()

	// 2) Text Search — use the original orgType as the text query
	go func() {
		q := textQuery
		if q == "" {
			q = orgType // e.g. "hospital" → text search for "hospital near me"
		}
		p, err := g.textSearch(ctx, lat, lng, radius, q, googleType)
		textC <- searchResult{p, err}
	}()

	nearbyRes := <-nearbyC
	textRes := <-textC

	// ── Merge & De-duplicate by place_id ────────────────────────────────
	seen := make(map[string]Place)

	// Nearby results first (tend to be more distance-accurate)
	if nearbyRes.err == nil {
		for _, p := range nearbyRes.places {
			if p.PlaceID != "" {
				seen[p.PlaceID] = p
			}
		}
	}
	// Text Search results fill gaps (tend to have better relevance)
	if textRes.err == nil {
		for _, p := range textRes.places {
			if p.PlaceID == "" {
				continue
			}
			if existing, ok := seen[p.PlaceID]; ok {
				// Prefer the richer address from Text Search
				if existing.Address == "" || (p.Address != "" && len(p.Address) > len(existing.Address)) {
					existing.Address = p.Address
					seen[p.PlaceID] = existing
				}
			} else {
				seen[p.PlaceID] = p
			}
		}
	}

	// Both searches failed — return the first error
	if nearbyRes.err != nil && textRes.err != nil {
		return nil, fmt.Errorf("hybrid search failed: nearby=%w, text=%v", nearbyRes.err, textRes.err)
	}

	merged := make([]Place, 0, len(seen))
	for _, p := range seen {
		merged = append(merged, p)
	}

	// ── Smart sort ──────────────────────────────────────────────────────
	smartSort(merged)

	// ── Cache result ────────────────────────────────────────────────────
	if g.redis != nil && len(merged) > 0 {
		if data, err := json.Marshal(merged); err == nil {
			_ = g.redis.Set(ctx, cacheKey, data, searchCacheTTL).Err()
		}
	}

	return merged, nil
}

// smartSort sorts places by rating when within 1 km, by distance when farther.
// This gives the best UX: within walking distance you care about quality, at
// greater distances you care about proximity.
func smartSort(places []Place) {
	sort.SliceStable(places, func(i, j int) bool {
		iNear := places[i].DistanceKM <= 1.0
		jNear := places[j].DistanceKM <= 1.0

		switch {
		case iNear && jNear:
			// Both within 1 km → higher rating first
			if places[i].Rating != places[j].Rating {
				return places[i].Rating > places[j].Rating
			}
			return places[i].DistanceKM < places[j].DistanceKM

		case iNear && !jNear:
			return true // Near always beats far

		case !iNear && jNear:
			return false

		default:
			// Both far → closer first
			if places[i].DistanceKM != places[j].DistanceKM {
				return places[i].DistanceKM < places[j].DistanceKM
			}
			return places[i].Rating > places[j].Rating
		}
	})
}

// ─── Reverse Geocoding ──────────────────────────────────────────────────────

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

// ─── Distance Matrix ────────────────────────────────────────────────────────

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
				Distance struct {
					Text  string `json:"text"`
					Value int    `json:"value"`
				} `json:"distance"`
				DurationInTraffic struct {
					Text  string `json:"text"`
					Value int    `json:"value"`
				} `json:"duration_in_traffic"`
				Status string `json:"status"`
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
