package tests

import (
	"testing"
	"queueless/pkg/redis"
)

func TestRedisContext(t *testing.T) {
	if redis.Ctx == nil {
		t.Error("Global Redis context should not be nil")
	}
}

func TestFlushPipelineHandlesNilClient(t *testing.T) {
	redis.Client = nil
	redis.FlushPipeline() // Should not panic
}
