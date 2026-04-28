package slots

import (
	"fmt"
	"time"

	aimodels "queueless/ai-models/ai/models"
)

// ScoredSlot is a slot enriched with analytics signals, ready for the AI ranker
type ScoredSlot struct {
	SlotID        string
	StartsAt      time.Time
	Label         string  // "Tuesday 10:00 AM"
	DayOfWeek     string
	HourOfDay     int

	// Analytics signals (0.0 to 1.0 where higher = better for user)
	WaitTimeScore   float64 // low wait = high score
	BusynessScore   float64 // low queue = high score
	NoShowRiskScore float64 // low noshow rate = high score
	UserMatchScore  float64 // matches user's historic preference
	DataConfidence  string  // "high", "medium", "low"

	// Raw values for AI context
	AvgWaitMins   float64
	AvgQueueDepth float64
	TotalSamples  int
}

var dayNames = []string{"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"}

// ScoreSlots enriches each available slot with analytics signals
func ScoreSlots(
	baseSlots []string,
	date time.Time,
	analytics []aimodels.SlotAnalytics,
	prefs *aimodels.UserBookingPreference,
) []ScoredSlot {

	// Build a lookup map: (hour, day) -> SlotStats
	statsMap := make(map[string]aimodels.SlotAnalytics)
	var maxWait, maxDepth float64
	for _, s := range analytics {
		key := fmt.Sprintf("%d_%d", s.HourOfDay, s.DayOfWeek)
		statsMap[key] = s
		if float64(s.AvgWaitSecs) > maxWait {
			maxWait = float64(s.AvgWaitSecs)
		}
		if s.AvgQueueDepth > maxDepth {
			maxDepth = s.AvgQueueDepth
		}
	}

	// Build preference lookup sets
	prefHours := make(map[int]bool)
	prefDays := make(map[int]bool)
	if prefs != nil {
		for _, h := range prefs.PreferredHours {
			prefHours[int(h)] = true
		}
		for _, d := range prefs.PreferredDays {
			prefDays[int(d)] = true
		}
	}

	dow := int(date.Weekday())

	var scored []ScoredSlot
	for i, slotTime := range baseSlots {
		// Parse hour from "09:00" format
		var hour, minute int
		fmt.Sscanf(slotTime, "%d:%d", &hour, &minute)

		slotStart := time.Date(date.Year(), date.Month(), date.Day(), hour, minute, 0, 0, date.Location())
		key := fmt.Sprintf("%d_%d", hour, dow)

		stat, hasStat := statsMap[key]

		ss := ScoredSlot{
			SlotID:    fmt.Sprintf("slot_%03d", i+1),
			StartsAt:  slotStart,
			Label:     fmt.Sprintf("%s %d:%02d %s", dayNames[dow], normalizeHour(hour), minute, amPm(hour)),
			DayOfWeek: dayNames[dow],
			HourOfDay: hour,
		}

		if hasStat && stat.TotalBookings > 0 {
			// Wait time score: invert (low wait = high score)
			if maxWait > 0 {
				ss.WaitTimeScore = 1.0 - (float64(stat.AvgWaitSecs) / maxWait)
			} else {
				ss.WaitTimeScore = 1.0
			}

			// Busyness score: invert queue depth
			if maxDepth > 0 {
				ss.BusynessScore = 1.0 - (stat.AvgQueueDepth / maxDepth)
			} else {
				ss.BusynessScore = 1.0
			}

			// No-show risk as proxy for reliability
			ss.NoShowRiskScore = 1.0 - stat.NoShowRate

			ss.AvgWaitMins = float64(stat.AvgWaitSecs) / 60.0
			ss.AvgQueueDepth = stat.AvgQueueDepth
			ss.TotalSamples = stat.TotalBookings

			switch {
			case stat.TotalBookings >= 500:
				ss.DataConfidence = "high"
			case stat.TotalBookings >= 50:
				ss.DataConfidence = "medium"
			default:
				ss.DataConfidence = "low"
			}
		} else {
			// No historical data: neutral scores
			ss.WaitTimeScore = 0.5
			ss.BusynessScore = 0.5
			ss.NoShowRiskScore = 0.5
			ss.DataConfidence = "low"
		}

		// User preference match
		matchScore := 0.0
		if prefHours[hour] {
			matchScore += 0.5
		}
		if prefDays[dow] {
			matchScore += 0.5
		}
		ss.UserMatchScore = matchScore

		scored = append(scored, ss)
	}

	return scored
}

func normalizeHour(h int) int {
	if h > 12 {
		return h - 12
	}
	if h == 0 {
		return 12
	}
	return h
}

func amPm(h int) string {
	if h >= 12 {
		return "PM"
	}
	return "AM"
}
