package middleware

import (
	"log/slog"
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
	return RequireRoles(models.RoleAdmin)
}

func AgentMiddleware() gin.HandlerFunc {
	return RequireRoles(models.RoleStaff)
}

func StaffMiddleware() gin.HandlerFunc {
	return RequireRoles(models.RoleAdmin, models.RoleStaff)
}

func RequireRoles(allowed ...models.Role) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleRaw, exists := c.Get("role")
		if !exists {
			utils.RespondError(c, http.StatusForbidden, "Forbidden", "Role not found")
			return
		}

		role, ok := roleRaw.(models.Role)
		if !ok {
			utils.RespondError(c, http.StatusForbidden, "Forbidden", "Invalid role in token")
			return
		}

		allowedSet := make(map[models.Role]struct{}, len(allowed))
		for _, r := range allowed {
			allowedSet[r] = struct{}{}
		}
		if _, ok := allowedSet[role]; !ok {
			slog.Warn("role middleware denied user", "role", role, "allowed_roles", allowed)
			utils.RespondError(c, http.StatusForbidden, "Forbidden", "Insufficient role permissions")
			return
		}

		c.Next()
	}
}
