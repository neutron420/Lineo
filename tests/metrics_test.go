package tests

import (
	"testing"
	"queueless/pkg/metrics"
)

func TestMetrics(t *testing.T) {
	t.Run("Increment Functions", func(t *testing.T) {
		metrics.IncQueueJoin(1)
		metrics.IncSMSSent("test")
		metrics.IncRabbitPublishErrors()
		metrics.IncWSConnections()
		metrics.DecWSConnections()
		metrics.ObserveQueueWaitDuration(1.5)
	})

	t.Run("Handler", func(t *testing.T) {
		h := metrics.Handler()
		if h == nil {
			t.Error("Handler() returned nil")
		}
	})
}
