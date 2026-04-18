package tests

import (
	"testing"
	"time"

	"queueless/internal/models"
	"queueless/pkg/utils"
)

func TestGenerateAndValidateToken(t *testing.T) {
	orgID := uint(42)
	user := &models.User{
		ID:             100,
		Role:           models.RoleAdmin,
		OrganizationID: &orgID,
	}

	tokenStr, err := utils.GenerateToken(user)
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	if tokenStr == "" {
		t.Fatal("Expected token string, got empty string")
	}

	claims, err := utils.ValidateToken(tokenStr)
	if err != nil {
		t.Fatalf("Failed to validate token: %v", err)
	}

	if claims.UserID != user.ID {
		t.Errorf("Expected user ID %d, got %d", user.ID, claims.UserID)
	}
	if claims.Role != user.Role {
		t.Errorf("Expected role %s, got %s", user.Role, claims.Role)
	}
	if claims.OrganizationID == nil || *claims.OrganizationID != *user.OrganizationID {
		t.Errorf("Expected organization ID %d, got %v", *user.OrganizationID, claims.OrganizationID)
	}

	// Validate expiration time is roughly 24 hours from now
	expectedExp := time.Now().Add(24 * time.Hour).Unix()
	if claims.ExpiresAt.Unix() < expectedExp-10 || claims.ExpiresAt.Unix() > expectedExp+10 {
		t.Errorf("Expected expiration time around %d, got %d", expectedExp, claims.ExpiresAt.Unix())
	}
}

func TestValidateToken_Invalid(t *testing.T) {
	_, err := utils.ValidateToken("invalid.token.string")
	if err == nil {
		t.Error("Expected error validating invalid token string, got nil")
	}
}
