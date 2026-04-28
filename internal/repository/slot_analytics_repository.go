package repository

import (
	aimodels "queueless/ai-models/ai/models"

	"gorm.io/gorm"
)

type SlotAnalyticsRepository interface {
	GetSlotAnalytics(orgID uint, dayOfWeek int) ([]aimodels.SlotAnalytics, error)
	GetUserPreferences(userID uint) (*aimodels.UserBookingPreference, error)
	SaveFeedback(feedback *aimodels.RecommendationFeedback) error
	SaveRecommendation(userID, orgID uint, slotID string, score float64) error
	RecordUserChoice(userID, orgID uint, chosenSlotID string) error
	UpdateUserPreferences(userID uint, hour, dayOfWeek int) error
	UpdateAnalyticsFromHistory() error
}

type slotAnalyticsRepository struct {
	db *gorm.DB
}

func NewSlotAnalyticsRepository(db *gorm.DB) SlotAnalyticsRepository {
	return &slotAnalyticsRepository{db: db}
}

func (r *slotAnalyticsRepository) GetSlotAnalytics(orgID uint, dayOfWeek int) ([]aimodels.SlotAnalytics, error) {
	var analytics []aimodels.SlotAnalytics
	err := r.db.Where("organization_id = ? AND day_of_week = ?", orgID, dayOfWeek).Find(&analytics).Error
	return analytics, err
}

func (r *slotAnalyticsRepository) GetUserPreferences(userID uint) (*aimodels.UserBookingPreference, error) {
	var pref aimodels.UserBookingPreference
	err := r.db.Where("user_id = ?", userID).First(&pref).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &pref, nil
}

func (r *slotAnalyticsRepository) SaveFeedback(feedback *aimodels.RecommendationFeedback) error {
	return r.db.Create(feedback).Error
}

// SaveRecommendation stores what we recommended for feedback tracking
func (r *slotAnalyticsRepository) SaveRecommendation(userID, orgID uint, slotID string, score float64) error {
	feedback := aimodels.RecommendationFeedback{
		UserID:              userID,
		OrganizationID:      orgID,
		RecommendedSlotID:   slotID,
		RecommendationScore: score,
	}
	return r.db.Create(&feedback).Error
}

// RecordUserChoice closes the feedback loop when user picks a slot
func (r *slotAnalyticsRepository) RecordUserChoice(userID, orgID uint, chosenSlotID string) error {
	return r.db.Exec(`
		UPDATE recommendation_feedbacks
		SET chosen_slot_id = ?,
		    accepted_top_pick = (recommended_slot_id = ?)
		WHERE user_id = ?
		  AND organization_id = ?
		  AND chosen_slot_id = ''
		ORDER BY created_at DESC
		LIMIT 1
	`, chosenSlotID, chosenSlotID, userID, orgID).Error
}

// UpdateUserPreferences learns from each booking to improve future recommendations
func (r *slotAnalyticsRepository) UpdateUserPreferences(userID uint, hour, dayOfWeek int) error {
	var pref aimodels.UserBookingPreference
	err := r.db.Where("user_id = ?", userID).First(&pref).Error

	if err == gorm.ErrRecordNotFound {
		// New user: create fresh preferences
		pref = aimodels.UserBookingPreference{
			UserID:         userID,
			PreferredHours: []int64{int64(hour)},
			PreferredDays:  []int64{int64(dayOfWeek)},
			TotalBookings:  1,
		}
		return r.db.Create(&pref).Error
	}
	if err != nil {
		return err
	}

	// Existing user: append hour/day if not already present, increment bookings
	hourExists := false
	for _, h := range pref.PreferredHours {
		if int(h) == hour {
			hourExists = true
			break
		}
	}
	if !hourExists && len(pref.PreferredHours) < 5 {
		pref.PreferredHours = append(pref.PreferredHours, int64(hour))
	}

	dayExists := false
	for _, d := range pref.PreferredDays {
		if int(d) == dayOfWeek {
			dayExists = true
			break
		}
	}
	if !dayExists && len(pref.PreferredDays) < 5 {
		pref.PreferredDays = append(pref.PreferredDays, int64(dayOfWeek))
	}

	pref.TotalBookings++
	return r.db.Save(&pref).Error
}

func (r *slotAnalyticsRepository) UpdateAnalyticsFromHistory() error {
	query := `
		INSERT INTO slot_analytics (organization_id, day_of_week, hour_of_day, avg_queue_depth, avg_wait_secs, total_bookings, last_updated)
		SELECT 
			org_id, 
			day_of_week, 
			hour_of_day, 
			AVG(duration_secs/60.0),
			AVG(duration_secs), 
			COUNT(*), 
			NOW()
		FROM service_durations
		WHERE created_at > NOW() - INTERVAL '90 days'
		GROUP BY org_id, day_of_week, hour_of_day
		ON CONFLICT (organization_id, day_of_week, hour_of_day) DO UPDATE SET
			avg_queue_depth = EXCLUDED.avg_queue_depth,
			avg_wait_secs = EXCLUDED.avg_wait_secs,
			total_bookings = EXCLUDED.total_bookings,
			last_updated = NOW();
	`
	return r.db.Exec(query).Error
}
