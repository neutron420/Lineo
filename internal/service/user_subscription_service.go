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
	IncrementAppts(userID uint) error
	UpgradeTier(userID uint, tier models.SubscriptionTier) error
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

func (s *userSubscriptionService) syncCounters(user *models.User) error {
	now := time.Now().Truncate(24 * time.Hour)
	if user.LastActionDate == nil || user.LastActionDate.Before(now) {
		user.DailyJoins = 0
		user.DailyAppts = 0
		user.LastActionDate = &now
		return db.DB.Model(user).Updates(map[string]interface{}{
			"daily_joins":      0,
			"daily_appts":      0,
			"last_action_date": &now,
		}).Error
	}
	return nil
}

func (s *userSubscriptionService) CheckJoinLimit(userID uint) error {
	var user models.User
	if err := db.DB.First(&user, userID).Error; err != nil {
		return err
	}

	if err := s.syncCounters(&user); err != nil {
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

	if err := s.syncCounters(&user); err != nil {
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

func (s *userSubscriptionService) IncrementAppts(userID uint) error {
	return db.DB.Model(&models.User{}).Where("id = ?", userID).UpdateColumn("daily_appts", db.DB.Raw("daily_appts + 1")).Error
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
