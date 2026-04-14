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
	GetNearbyOrgs(lat, lng float64, radius float64) ([]models.Organization, error)
}

func (r *organizationRepository) GetNearbyOrgs(lat, lng float64, radius float64) ([]models.Organization, error) {
	var orgs []models.Organization
	// Approximate 1km = 0.01 degrees for bounding box
	deg := (radius / 1000.0) * 0.01
	
	err := r.db.Preload("Queues").
		Where("latitude BETWEEN ? AND ?", lat-deg, lat+deg).
		Where("longitude BETWEEN ? AND ?", lng-deg, lng+deg).
		Find(&orgs).Error
		
	return orgs, err
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
