package config

import (
	"os"
	"path/filepath"
	"strings"
)

func Secret(key string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}

	filePath := strings.TrimSpace(os.Getenv(key + "_FILE"))
	if filePath == "" {
		return ""
	}

	filePath = filepath.Clean(filePath)
	content, err := os.ReadFile(filePath)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(content))
}
