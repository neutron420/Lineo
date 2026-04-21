package tests

import (
	"log/slog"
	"testing"
	"queueless/pkg/logger"
)

func TestInit(t *testing.T) {
	log := logger.Init()
	if log == nil {
		t.Fatal("Init() returned nil logger")
	}

	if slog.Default() != log {
		t.Error("Init() did not set the default logger")
	}
}
