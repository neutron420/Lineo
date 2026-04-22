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

// MockAuthService implements service.AuthService
type MockAuthService struct {
	RegisterUserFunc         func(req models.RegisterRequest) (*models.User, error)
	LoginUserFunc            func(req models.LoginRequest) (string, *models.User, error)
	ForgotPasswordFunc       func(email string, method string) error
	ResetPasswordFunc        func(email, otp, newPass string) error
	VerifyTurnstileFunc      func(token string) bool
	AddStaffFunc             func(adminOrgID uint, req models.RegisterRequest) (*models.User, error)
	RegisterOrganizationFunc func(req models.OrgRegistrationRequest) (*models.User, error)
}

func (m *MockAuthService) RegisterUser(req models.RegisterRequest) (*models.User, error) {
	return m.RegisterUserFunc(req)
}
func (m *MockAuthService) LoginUser(req models.LoginRequest) (string, *models.User, error) {
	return m.LoginUserFunc(req)
}
func (m *MockAuthService) ForgotPassword(email string, method string) error {
	return m.ForgotPasswordFunc(email, method)
}
func (m *MockAuthService) ResetPassword(email, otp, newPass string) error {
	return m.ResetPasswordFunc(email, otp, newPass)
}
func (m *MockAuthService) VerifyTurnstile(token string) bool {
	return m.VerifyTurnstileFunc(token)
}
func (m *MockAuthService) AddStaff(adminOrgID uint, req models.RegisterRequest) (*models.User, error) {
	return m.AddStaffFunc(adminOrgID, req)
}
func (m *MockAuthService) RegisterOrganization(req models.OrgRegistrationRequest) (*models.User, error) {
	return m.RegisterOrganizationFunc(req)
}

func TestAuthHandler_Login(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("Successful Login", func(t *testing.T) {
		mockSvc := &MockAuthService{
			LoginUserFunc: func(req models.LoginRequest) (string, *models.User, error) {
				return "fake-jwt-token", &models.User{ID: 1, Email: req.Email}, nil
			},
		}
		h := handler.NewAuthHandler(mockSvc)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)

		body, _ := json.Marshal(models.LoginRequest{
			Email:    "test@example.com",
			Password: "password123",
		})
		c.Request = httptest.NewRequest("POST", "/login", bytes.NewBuffer(body))

		h.Login(c)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status OK, got %v", w.Code)
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp["data"].(map[string]interface{})
		if data["token"] != "fake-jwt-token" {
			t.Errorf("Expected token fake-jwt-token, got %v", data["token"])
		}
	})

	t.Run("Failed Login", func(t *testing.T) {
		mockSvc := &MockAuthService{
			LoginUserFunc: func(req models.LoginRequest) (string, *models.User, error) {
				return "", nil, errors.New("invalid credentials")
			},
		}
		h := handler.NewAuthHandler(mockSvc)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)

		body, _ := json.Marshal(models.LoginRequest{
			Email:    "wrong@example.com",
			Password: "wrong",
		})
		c.Request = httptest.NewRequest("POST", "/login", bytes.NewBuffer(body))

		h.Login(c)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status Unauthorized, got %v", w.Code)
		}
	})
}
