package tests

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"queueless/internal/models"
	"queueless/pkg/middleware"
	"queueless/pkg/utils"
)

func TestAuthMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Valid token for test
	orgID := uint(1)
	user := &models.User{
		ID:             1,
		Role:           models.RoleAdmin,
		OrganizationID: &orgID,
	}
	token, _ := utils.GenerateToken(user)

	t.Run("Valid Token", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)

		r.Use(middleware.AuthMiddleware())
		r.GET("/test", func(c *gin.Context) {
			userID, _ := c.Get("userID")
			if userID != user.ID {
				t.Errorf("Expected userID %v, got %v", user.ID, userID)
			}
			c.Status(http.StatusOK)
		})

		c.Request = httptest.NewRequest("GET", "/test", nil)
		c.Request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		r.ServeHTTP(w, c.Request)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status OK, got %v", w.Code)
		}
	})

	t.Run("Missing Header", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)

		r.Use(middleware.AuthMiddleware())
		r.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

		c.Request = httptest.NewRequest("GET", "/test", nil)
		r.ServeHTTP(w, c.Request)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected status Unauthorized, got %v", w.Code)
		}
	})

	t.Run("RequireRoles Admin Success", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)

		r.Use(func(c *gin.Context) {
			c.Set("role", models.RoleAdmin)
			c.Next()
		})
		r.Use(middleware.AdminMiddleware())
		r.GET("/admin", func(c *gin.Context) { c.Status(http.StatusOK) })

		c.Request = httptest.NewRequest("GET", "/admin", nil)
		r.ServeHTTP(w, c.Request)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status OK for admin role, got %v", w.Code)
		}
	})

	t.Run("RequireRoles Denied", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)

		r.Use(func(c *gin.Context) {
			c.Set("role", models.RoleUser)
			c.Next()
		})
		r.Use(middleware.AdminMiddleware())
		r.GET("/admin", func(c *gin.Context) { c.Status(http.StatusOK) })

		c.Request = httptest.NewRequest("GET", "/admin", nil)
		r.ServeHTTP(w, c.Request)

		if w.Code != http.StatusForbidden {
			t.Errorf("Expected status Forbidden for user role on admin route, got %v", w.Code)
		}
	})
}
