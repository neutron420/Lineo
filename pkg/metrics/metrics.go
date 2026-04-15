package metrics

import (
	"net/http"
	"strconv"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	queueJoinTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "queue_join_total",
			Help: "Total queue joins by organization",
		},
		[]string{"org_id"},
	)
	queueWaitDurationSeconds = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "queue_wait_duration_seconds",
			Help:    "Queue wait duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
	)
	smsSentTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "sms_sent_total",
			Help: "Total SMS sent by type",
		},
		[]string{"type"},
	)
	rabbitPublishErrorsTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "rabbitmq_publish_errors_total",
			Help: "Total RabbitMQ publish failures",
		},
	)
	websocketConnectionsActive = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "websocket_connections_active",
			Help: "Current active websocket connections",
		},
	)
)

func Register() {
	prometheus.MustRegister(
		queueJoinTotal,
		queueWaitDurationSeconds,
		smsSentTotal,
		rabbitPublishErrorsTotal,
		websocketConnectionsActive,
	)
}

func Handler() http.Handler {
	return promhttp.Handler()
}

func IncQueueJoin(orgID uint) {
	queueJoinTotal.WithLabelValues(strconv.FormatUint(uint64(orgID), 10)).Inc()
}

func ObserveQueueWaitDuration(seconds float64) {
	queueWaitDurationSeconds.Observe(seconds)
}

func IncSMSSent(kind string) {
	smsSentTotal.WithLabelValues(kind).Inc()
}

func IncRabbitPublishErrors() {
	rabbitPublishErrorsTotal.Inc()
}

func IncWSConnections() {
	websocketConnectionsActive.Inc()
}

func DecWSConnections() {
	websocketConnectionsActive.Dec()
}
