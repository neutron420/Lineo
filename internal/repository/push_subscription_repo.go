package repository

import (
	"fmt"

	"queueless/internal/models"
	database "queueless/pkg/db"

	"gorm.io/gorm"
)

// PushSubscriptionRepository manages browser push subscription persistence.
type PushSubscriptionRepository interface {
	Save(sub *models.PushSubscription) error
	GetByUserID(userID uint) ([]models.PushSubscription, error)
	DeleteByEndpoint(endpoint string) error
	DeleteByID(id uint) error
}

type pushSubscriptionRepository struct {
	db *gorm.DB
}

func NewPushSubscriptionRepository() PushSubscriptionRepository {
	return &pushSubscriptionRepository{db: database.DB}
}

// Save upserts a push subscription. If the endpoint already exists, the keys
// and user association are updated so that a reinstalled service-worker
// re-registers seamlessly.
func (r *pushSubscriptionRepository) Save(sub *models.PushSubscription) error {
	var existing models.PushSubscription
	err := r.db.Where("endpoint = ?", sub.Endpoint).First(&existing).Error
	if err == nil {
		// Endpoint already registered — update in place.
		return r.db.Model(&existing).Updates(map[string]interface{}{
			"user_id": sub.UserID,
			"p256dh":  sub.P256dh,
			"auth":    sub.Auth,
		}).Error
	}
	if err != gorm.ErrRecordNotFound {
		return fmt.Errorf("push repo save: lookup: %w", err)
	}
	return r.db.Create(sub).Error
}

func (r *pushSubscriptionRepository) GetByUserID(userID uint) ([]models.PushSubscription, error) {
	var subs []models.PushSubscription
	err := r.db.Where("user_id = ?", userID).Find(&subs).Error
	return subs, err
}

func (r *pushSubscriptionRepository) DeleteByEndpoint(endpoint string) error {
	return r.db.Where("endpoint = ?", endpoint).Delete(&models.PushSubscription{}).Error
}

func (r *pushSubscriptionRepository) DeleteByID(id uint) error {
	return r.db.Delete(&models.PushSubscription{}, id).Error
}
