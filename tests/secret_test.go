package tests

import (
	"os"
	"testing"
	"queueless/pkg/config"
)

func TestSecret(t *testing.T) {
	// Test from Env
	os.Setenv("TEST_KEY", "test_value")
	defer os.Unsetenv("TEST_KEY")
	if config.Secret("TEST_KEY") != "test_value" {
		t.Error("Expected test_value from env")
	}

	// Test from File
	tmpFile, _ := os.CreateTemp("", "secret_test")
	defer os.Remove(tmpFile.Name())
	tmpFile.WriteString("file_secret")
	tmpFile.Close()

	os.Setenv("FILE_KEY_FILE", tmpFile.Name())
	defer os.Unsetenv("FILE_KEY_FILE")
	if config.Secret("FILE_KEY") != "file_secret" {
		t.Error("Expected file_secret from file")
	}

	// Test non-existent
	if config.Secret("NON_EXISTENT") != "" {
		t.Error("Expected empty string for non-existent key")
	}
}
