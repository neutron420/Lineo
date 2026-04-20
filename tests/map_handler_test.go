package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"queueless/internal/handler"
	"queueless/pkg/utils"
)

// MockMapService implements service.MapService for testing
type MockMapService struct {
	SearchNearbyFunc    func(lat, lng float64, radius int, orgType string) ([]utils.Place, error)
	GetAddressFunc      func(lat, lng float64) (string, error)
	SearchPartneredFunc func(lat, lng float64, radius int, orgType string) ([]utils.Place, error)
}

func (m *MockMapService) SearchNearby(lat, lng float64, radius int, orgType string) ([]utils.Place, error) {
	if m.SearchNearbyFunc != nil {
		return m.SearchNearbyFunc(lat, lng, radius, orgType)
	}
	return nil, nil
}

func (m *MockMapService) GetAddress(lat, lng float64) (string, error) {
	if m.GetAddressFunc != nil {
		return m.GetAddressFunc(lat, lng)
	}
	return "", nil
}

func (m *MockMapService) SearchPartnered(lat, lng float64, radius int, orgType string) ([]utils.Place, error) {
	if m.SearchPartneredFunc != nil {
		return m.SearchPartneredFunc(lat, lng, radius, orgType)
	}
	return nil, nil
}

func TestMapHandler_GetAddress(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockSvc := &MockMapService{
		GetAddressFunc: func(lat, lng float64) (string, error) {
			if lat == 28.6139 && lng == 77.2090 {
				return "New Delhi, India", nil
			}
			return "Unknown Location", nil
		},
	}

	handlerInstance := handler.NewMapHandler(mockSvc)

	t.Run("Valid coordinates", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request, _ = http.NewRequest("GET", "/api/v1/search/address?lat=28.6139&lng=77.2090", nil)

		// Gin does not automatically parse URL queries when building contexts this simply,
		// so we need to set the URL or use a router
		router := gin.New()
		router.GET("/api/v1/search/address", handlerInstance.GetAddress)
		router.ServeHTTP(w, c.Request)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
		}

		var resp utils.SuccessResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		if err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		data := resp.Data.(map[string]interface{})
		if data["address"] != "New Delhi, India" {
			t.Errorf("Expected address 'New Delhi, India', got '%s'", data["address"])
		}
	})

	t.Run("Missing lat/lng", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/address", nil)

		router := gin.New()
		router.GET("/address", handlerInstance.GetAddress)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
		}
	})
}

func TestMapHandler_SearchNearby(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockSvc := &MockMapService{
		SearchPartneredFunc: func(lat, lng float64, radius int, orgType string) ([]utils.Place, error) {
			return []utils.Place{
				{Name: "Partnered Hospital", Lat: 28.6, Lng: 77.2, Key: "hosp123"},
			}, nil
		},
		SearchNearbyFunc: func(lat, lng float64, radius int, orgType string) ([]utils.Place, error) {
			return []utils.Place{
				{Name: "Google Maps Hospital", Lat: 28.61, Lng: 77.21, Address: "Delhi"},
			}, nil
		},
	}

	handlerInstance := handler.NewMapHandler(mockSvc)

	t.Run("Valid search", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/search?lat=28.6139&lng=77.2090", nil)

		router := gin.New()
		router.GET("/search", handlerInstance.SearchNearby)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
		}

		var resp utils.SuccessResponse
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		if err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		places := resp.Data.([]interface{})
		if len(places) != 2 {
			t.Errorf("Expected 2 places (1 partnered, 1 gmaps), got %d", len(places))
		}
	})
}
