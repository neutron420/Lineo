package tests

import (
	"encoding/json"
	"testing"
	"queueless/internal/models"
)

func TestUserJSON(t *testing.T) {
	user := models.User{
		ID:       1,
		Username: "testuser",
		Email:    "test@example.com",
		Role:     models.RoleUser,
	}

	data, err := json.Marshal(user)
	if err != nil {
		t.Fatalf("Failed to marshal user: %v", err)
	}

	var unmarshaled models.User
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("Failed to unmarshal user: %v", err)
	}

	if unmarshaled.Username != user.Username {
		t.Errorf("Expected username %s, got %s", user.Username, unmarshaled.Username)
	}
}

func TestOrgJSON(t *testing.T) {
	org := models.Organization{
		Name: "Test Org",
		Type: "hospital",
	}

	data, err := json.Marshal(org)
	if err != nil {
		t.Fatalf("Failed to marshal org: %v", err)
	}

	var unmarshaled models.Organization
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("Failed to unmarshal org: %v", err)
	}

	if unmarshaled.Name != org.Name {
		t.Errorf("Expected Name %s, got %s", org.Name, unmarshaled.Name)
	}
}
