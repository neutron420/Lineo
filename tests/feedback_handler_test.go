package tests

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"queueless/internal/handler"
	"queueless/internal/models"
)

type MockFeedbackService struct {
	SubmitFeedbackFunc func(userID uint, req models.FeedbackRequest) error
	GetOrgFeedbackFunc func(orgID uint) ([]models.Feedback, error)
}

func (m *MockFeedbackService) SubmitFeedback(userID uint, req models.FeedbackRequest) error {
	if m.SubmitFeedbackFunc != nil {
		return m.SubmitFeedbackFunc(userID, req)
	}
	return nil
}

func (m *MockFeedbackService) GetOrgFeedback(orgID uint) ([]models.Feedback, error) {
	if m.GetOrgFeedbackFunc != nil {
		return m.GetOrgFeedbackFunc(orgID)
	}
	return nil, nil
}

func TestFeedbackHandler_Submit(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockSvc := &MockFeedbackService{
		SubmitFeedbackFunc: func(userID uint, req models.FeedbackRequest) error {
			if req.Rating < 1 || req.Rating > 5 {
				return errors.New("invalid rating")
			}
			return nil
		},
	}

	h := handler.NewFeedbackHandler(mockSvc)

	t.Run("Valid feedback submission", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)

		// Mock authentication middleware by injecting userID directly
		c.Set("userID", uint(10))

		reqBody := models.FeedbackRequest{
			TokenNumber: "A-123",
			Rating:      5,
			Comment:     "Great service!",
		}
		bodyBytes, _ := json.Marshal(reqBody)
		c.Request, _ = http.NewRequest("POST", "/feedback", bytes.NewBuffer(bodyBytes))
		c.Request.Header.Set("Content-Type", "application/json")

		router := gin.New()
		
		// In tests, we often simulate middleswares manually or build one inline to pass the set value:
		router.POST("/feedback", func(ctx *gin.Context) {
			ctx.Set("userID", uint(10))
			h.Submit(ctx)
		})
		
		router.ServeHTTP(w, c.Request)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		var response struct {
			Message string `json:"message"`
		}
		json.Unmarshal(w.Body.Bytes(), &response)
		if response.Message != "Feedback submitted successfully" {
			t.Errorf("Expected success message, got %s", response.Message)
		}
	})

	t.Run("Invalid feedback payload", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)

		c.Request, _ = http.NewRequest("POST", "/feedback", bytes.NewBuffer([]byte(`{invalid_json}`)))
		c.Request.Header.Set("Content-Type", "application/json")

		router := gin.New()
		router.POST("/feedback", func(ctx *gin.Context) {
			ctx.Set("userID", uint(10))
			h.Submit(ctx)
		})
		router.ServeHTTP(w, c.Request)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status 400, got %d", w.Code)
		}
	})
}

func TestFeedbackHandler_GetByOrg(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockSvc := &MockFeedbackService{
		GetOrgFeedbackFunc: func(orgID uint) ([]models.Feedback, error) {
			if orgID == 1 {
				return []models.Feedback{
					{Rating: 4, Comment: "Good"},
					{Rating: 5, Comment: "Excellent"},
				}, nil
			}
			return nil, errors.New("organization not found")
		},
	}

	h := handler.NewFeedbackHandler(mockSvc)

	t.Run("Valid org ID", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/feedback?org_id=1", nil)

		router := gin.New()
		router.GET("/feedback", h.GetByOrg)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		var response struct {
			Data []models.Feedback `json:"data"`
		}
		json.Unmarshal(w.Body.Bytes(), &response)

		if len(response.Data) != 2 {
			t.Errorf("Expected 2 feedback items, got %d", len(response.Data))
		}
	})

	t.Run("Missing org ID", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/feedback", nil) // missing query

		router := gin.New()
		router.GET("/feedback", h.GetByOrg)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status 400 for missing org_id, got %d", w.Code)
		}
	})
}
