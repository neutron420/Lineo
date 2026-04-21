package tests

import (
	"math"
	"testing"
	"queueless/pkg/utils"
)

func TestCalculateDistance(t *testing.T) {
	tests := []struct {
		name     string
		lat1     float64
		lon1     float64
		lat2     float64
		lon2     float64
		expected float64
	}{
		{
			name:     "Same point",
			lat1:     0,
			lon1:     0,
			lat2:     0,
			lon2:     0,
			expected: 0,
		},
		{
			name:     "New York to London",
			lat1:     40.7128,
			lon1:     -74.0060,
			lat2:     51.5074,
			lon2:     -0.1278,
			expected: 5570.0,
		},
		{
			name:     "London to Paris",
			lat1:     51.5074,
			lon1:     -0.1278,
			lat2:     48.8566,
			lon2:     2.3522,
			expected: 344.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := utils.CalculateDistance(tt.lat1, tt.lon1, tt.lat2, tt.lon2)
			if tt.name == "Same point" {
				if got != tt.expected {
					t.Errorf("CalculateDistance() = %v, want %v", got, tt.expected)
				}
			} else {
				diff := math.Abs(got - tt.expected)
				if diff > (tt.expected * 0.01) {
					t.Errorf("CalculateDistance() = %v, want approx %v (diff %v)", got, tt.expected, diff)
				}
			}
		})
	}
}
