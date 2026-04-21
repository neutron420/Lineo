package tests

import (
	"testing"
	"queueless/pkg/db"
)

func TestDBPlaceholder(t *testing.T) {
	if db.DB != nil {
		t.Log("Database instance is initialized")
	}
}
