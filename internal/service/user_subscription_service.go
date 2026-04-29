package service

import (
	"errors"
	"fmt"
	"time"

	"queueless/internal/models"
	"queueless/pkg/db"
)

type UserSubscriptionService interface {
	CheckJoinLimit(userID uint) error
	CheckApptLimit(userID uint) error
	IncrementJoins(userID uint) error
	DecrementJoins(userID uint) error
	IncrementAppts(userID uint) error
	DecrementAppts(userID uint) error
	UpgradeTier(userID uint, tier models.SubscriptionTier) error
	SyncCounters(user *models.User) error
}

type userSubscriptionService struct{}

func NewUserSubscriptionService() UserSubscriptionService {
	return &userSubscriptionService{}
}

func (s *userSubscriptionService) getLimits(tier models.SubscriptionTier) (int, int) {
	switch tier {
	case models.TierPlus:
		return 15, 10
	case models.TierUnlimited:
		return 999999, 999999 // Effectively unlimited
	default: // Basic
		return 3, 2
	}
}

func (s *userSubscriptionService) SyncCounters(user *models.User) error {
	loc, _ := time.LoadLocation("Asia/Kolkata")
	now := time.Now().In(loc)
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)

	if user.LastActionDate == nil || user.LastActionDate.Before(startOfDay) {
		user.DailyJoins = 0
		user.DailyAppts = 0
		user.LastActionDate = &startOfDay
		return db.DB.Model(user).Updates(map[string]interface{}{
			"daily_joins":      0,
			"daily_appts":      0,
			"last_action_date": &startOfDay,
		}).Error
	}
	return nil
}

func (s *userSubscriptionService) CheckJoinLimit(userID uint) error {
	var user models.User
	if err := db.DB.First(&user, userID).Error; err != nil {
		return err
	}

	if err := s.SyncCounters(&user); err != nil {
		return err
	}

	maxJoins, _ := s.getLimits(user.SubscriptionTier)
	if user.DailyJoins >= maxJoins {
		return fmt.Errorf("daily queue limit reached for %s tier (%d). upgrade to Plus or Unlimited for more", user.SubscriptionTier, maxJoins)
	}

	return nil
}

func (s *userSubscriptionService) CheckApptLimit(userID uint) error {
	var user models.User
	if err := db.DB.First(&user, userID).Error; err != nil {
		return err
	}

	if err := s.SyncCounters(&user); err != nil {
		return err
	}

	_, maxAppts := s.getLimits(user.SubscriptionTier)
	if user.DailyAppts >= maxAppts {
		return fmt.Errorf("daily appointment limit reached for %s tier (%d). upgrade to Plus or Unlimited for more", user.SubscriptionTier, maxAppts)
	}

	return nil
}

func (s *userSubscriptionService) IncrementJoins(userID uint) error {
	return db.DB.Model(&models.User{}).Where("id = ?", userID).UpdateColumn("daily_joins", db.DB.Raw("daily_joins + 1")).Error
}

func (s *userSubscriptionService) DecrementJoins(userID uint) error {
	// Prevents negative limits by ensuring max(daily_joins - 1, 0)
	return db.DB.Model(&models.User{}).Where("id = ? AND daily_joins > 0", userID).UpdateColumn("daily_joins", db.DB.Raw("daily_joins - 1")).Error
}

func (s *userSubscriptionService) IncrementAppts(userID uint) error {
	return db.DB.Model(&models.User{}).Where("id = ?", userID).UpdateColumn("daily_appts", db.DB.Raw("daily_appts + 1")).Error
}

func (s *userSubscriptionService) DecrementAppts(userID uint) error {
	// Prevents negative limits
	return db.DB.Model(&models.User{}).Where("id = ? AND daily_appts > 0", userID).UpdateColumn("daily_appts", db.DB.Raw("daily_appts - 1")).Error
}

func (s *userSubscriptionService) UpgradeTier(userID uint, tier models.SubscriptionTier) error {
	validTiers := map[models.SubscriptionTier]bool{
		models.TierBasic:     true,
		models.TierPlus:      true,
		models.TierUnlimited: true,
	}
	if !validTiers[tier] {
		return errors.New("invalid subscription tier")
	}

	return db.DB.Model(&models.User{}).Where("id = ?", userID).Update("subscription_tier", tier).Error
}
