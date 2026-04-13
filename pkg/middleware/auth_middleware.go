package middleware

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"queueless/internal/models"
	"queueless/pkg/utils"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			utils.RespondError(c, http.StatusUnauthorized, "Auth error", "Authorization header is required")
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			utils.RespondError(c, http.StatusUnauthorized, "Auth error", "Authorization format must be Bearer {token}")
			return
		}

		claims, err := utils.ValidateToken(parts[1])
		if err != nil {
			utils.RespondError(c, http.StatusUnauthorized, "Auth error", err.Error())
			return
		}

		c.Set("userID", claims.UserID)
		c.Set("role", claims.Role)
		if claims.OrganizationID != nil {
			c.Set("organizationID", claims.OrganizationID)
		}
		c.Next()
	}
}

func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			utils.RespondError(c, http.StatusForbidden, "Forbidden", "Role not found")
			return
		}

		if role.(models.Role) != models.RoleAdmin {
			log.Println("Admin error: user role is", role)
			utils.RespondError(c, http.StatusForbidden, "Forbidden", "Requires admin privileges")
			return
		}

		c.Next()
	}
}
