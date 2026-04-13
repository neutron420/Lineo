package repository

import (
	"gorm.io/gorm"
	"queueless/internal/models"
	database "queueless/pkg/db"
)

type OrganizationRepository interface {
	CreateOrganization(org *models.Organization) error
	GetOrganizationByID(id uint) (*models.Organization, error)
	CreateQueueDef(def *models.QueueDef) error
	GetQueueDefByKey(key string) (*models.QueueDef, error)
	UpdateQueueDefPause(key string, isPaused bool) error
}

type organizationRepository struct {
	db *gorm.DB
}

func NewOrganizationRepository() OrganizationRepository {
	return &organizationRepository{db: database.DB}
}

func (r *organizationRepository) CreateOrganization(org *models.Organization) error {
	return r.db.Create(org).Error
}

func (r *organizationRepository) GetOrganizationByID(id uint) (*models.Organization, error) {
	var org models.Organization
	if err := r.db.Preload("Queues").First(&org, id).Error; err != nil {
		return nil, err
	}
	return &org, nil
}

func (r *organizationRepository) CreateQueueDef(def *models.QueueDef) error {
	return r.db.Create(def).Error
}

func (r *organizationRepository) GetQueueDefByKey(key string) (*models.QueueDef, error) {
	var def models.QueueDef
	if err := r.db.Where("queue_key = ?", key).First(&def).Error; err != nil {
		return nil, err
	}
	return &def, nil
}

func (r *organizationRepository) UpdateQueueDefPause(key string, isPaused bool) error {
	return r.db.Model(&models.QueueDef{}).Where("queue_key = ?", key).Update("is_paused", isPaused).Error
}
