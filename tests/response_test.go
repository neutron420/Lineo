package tests

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"queueless/pkg/utils"

	"github.com/gin-gonic/gin"
)

func TestRespondError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	utils.RespondError(c, http.StatusBadRequest, "Invalid Request", "Bad input provided")

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}

	var response utils.ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Error != "Invalid Request" {
		t.Errorf("Expected error 'Invalid Request', got '%s'", response.Error)
	}
	if response.Message != "Bad input provided" {
		t.Errorf("Expected message 'Bad input provided', got '%s'", response.Message)
	}
}

func TestRespondServerError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	dummyErr := errors.New("database connection failed")
	utils.RespondServerError(c, dummyErr)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status %d, got %d", http.StatusInternalServerError, w.Code)
	}

	var response utils.ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Error != "Internal Server Error" {
		t.Errorf("Expected error 'Internal Server Error', got '%s'", response.Error)
	}
}

func TestRespondSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	data := map[string]string{"user": "alpha"}
	utils.RespondSuccess(c, http.StatusOK, "Success", data)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response utils.SuccessResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Message != "Success" {
		t.Errorf("Expected message 'Success', got '%s'", response.Message)
	}

	respData := response.Data.(map[string]interface{})
	if respData["user"] != "alpha" {
		t.Errorf("Expected data object with user='alpha', got %v", respData)
	}
}
