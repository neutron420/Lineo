package utils

import (
	"math"
)

// CalculateDistance checks the Haversine distance between two sets of GPS coordinates
// Returns the distance in Kilometers
func CalculateDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371.0 // Radius of earth in km

	dLat := (lat2 - lat1) * (math.Pi / 180.0)
	dLon := (lon2 - lon1) * (math.Pi / 180.0)

	rLat1 := lat1 * (math.Pi / 180.0)
	rLat2 := lat2 * (math.Pi / 180.0)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Sin(dLon/2)*math.Sin(dLon/2)*math.Cos(rLat1)*math.Cos(rLat2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return R * c
}
