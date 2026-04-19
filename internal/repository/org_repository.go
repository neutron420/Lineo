package repository

import (
	"errors"
	"fmt"
	"queueless/internal/models"
	database "queueless/pkg/db"
	"time"

	"gorm.io/gorm"
)

type OrganizationRepository interface {
	CreateOrganization(org *models.Organization) error
	GetOrganizationByID(id uint) (*models.Organization, error)
	CreateQueueDef(def *models.QueueDef) error
	GetQueueDefByKey(key string) (*models.QueueDef, error)
	UpdateQueueDefPause(key string, isPaused bool) error
	GetNearbyOrgs(lat, lng float64, radius float64, orgType string) ([]models.Organization, error)
	GetOrCreateOrgConfig(orgID uint) (*models.OrganizationConfig, error)
	CreateOrgConfig(orgID uint, req models.OrganizationConfigRequest) (*models.OrganizationConfig, error)
	UpdateOrgConfig(orgID uint, req models.OrganizationConfigRequest) (*models.OrganizationConfig, error)
	DeleteOrgConfig(orgID uint) error
	GetQueueCountByOrg(orgID uint) (int, error)
	UpdateSubscription(orgID uint, plan string, expiry *time.Time) error
}

func (r *organizationRepository) GetQueueCountByOrg(orgID uint) (int, error) {
	var count int64
	err := r.db.Model(&models.QueueDef{}).Where("organization_id = ?", orgID).Count(&count).Error
	return int(count), err
}

func (r *organizationRepository) GetNearbyOrgs(lat, lng float64, radius float64, orgType string) ([]models.Organization, error) {
	var orgs []models.Organization
	deg := (radius / 1000.0) * 0.01

	query := r.db.Preload("Queues").
		Where("is_verified = ?", true).
		Where("latitude BETWEEN ? AND ?", lat-deg, lat+deg).
		Where("longitude BETWEEN ? AND ?", lng-deg, lng+deg)

	if orgType != "" && orgType != "all" {
		query = query.Where("type = ?", orgType)
	}

	err := query.Find(&orgs).Error
	if err == nil {
		fmt.Printf("[DEBUG] Search: %f, %f Radius: %f (deg: %f) Type: %s -> Found: %d\n", lat, lng, radius, deg, orgType, len(orgs))
		for _, o := range orgs {
			fmt.Printf("  - Found Org: %s (Verified: %v, Lat: %f, Lng: %f)\n", o.Name, o.IsVerified, o.Latitude, o.Longitude)
		}
	} else {
		fmt.Printf("[DEBUG] DB Error in search: %v\n", err)
	}

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

func (r *organizationRepository) GetOrCreateOrgConfig(orgID uint) (*models.OrganizationConfig, error) {
	var cfg models.OrganizationConfig
	err := r.db.Where("org_id = ?", orgID).First(&cfg).Error
	if err == nil {
		return &cfg, nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}

	cfg = models.OrganizationConfig{
		OrgID:                orgID,
		MaxQueueSize:         200,
		SlotDurationMinutes:  15,
		GracePeriodMinutes:   10,
		GeofenceRadiusMeters: 1000,
	}
	if err := r.db.Create(&cfg).Error; err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (r *organizationRepository) UpdateOrgConfig(orgID uint, req models.OrganizationConfigRequest) (*models.OrganizationConfig, error) {
	cfg, err := r.GetOrCreateOrgConfig(orgID)
	if err != nil {
		return nil, err
	}

	updates := map[string]interface{}{}
	if req.MaxQueueSize > 0 {
		updates["max_queue_size"] = req.MaxQueueSize
	}
	if req.SlotDurationMinutes > 0 {
		updates["slot_duration_minutes"] = req.SlotDurationMinutes
	}
	if req.GracePeriodMinutes > 0 {
		updates["grace_period_minutes"] = req.GracePeriodMinutes
	}
	if len(req.OperatingHoursJSON) > 0 {
		updates["operating_hours_json"] = req.OperatingHoursJSON
	}
	if req.GeofenceRadiusMeters > 0 {
		updates["geofence_radius_meters"] = req.GeofenceRadiusMeters
	}

	if len(updates) == 0 {
		return cfg, nil
	}

	if err := r.db.Model(cfg).Updates(updates).Error; err != nil {
		return nil, err
	}
	if err := r.db.Where("org_id = ?", orgID).First(cfg).Error; err != nil {
		return nil, err
	}
	return cfg, nil
}

func (r *organizationRepository) CreateOrgConfig(orgID uint, req models.OrganizationConfigRequest) (*models.OrganizationConfig, error) {
	var existing models.OrganizationConfig
	err := r.db.Where("org_id = ?", orgID).First(&existing).Error
	if err == nil {
		return nil, errors.New("organization config already exists")
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}

	cfg := models.OrganizationConfig{
		OrgID:                orgID,
		MaxQueueSize:         req.MaxQueueSize,
		SlotDurationMinutes:  req.SlotDurationMinutes,
		GracePeriodMinutes:   req.GracePeriodMinutes,
		OperatingHoursJSON:   req.OperatingHoursJSON,
		GeofenceRadiusMeters: req.GeofenceRadiusMeters,
	}
	if cfg.MaxQueueSize <= 0 {
		cfg.MaxQueueSize = 200
	}
	if cfg.SlotDurationMinutes <= 0 {
		cfg.SlotDurationMinutes = 15
	}
	if cfg.GracePeriodMinutes <= 0 {
		cfg.GracePeriodMinutes = 10
	}
	if cfg.GeofenceRadiusMeters <= 0 {
		cfg.GeofenceRadiusMeters = 1000
	}
	if cfg.OperatingHoursJSON == "" {
		cfg.OperatingHoursJSON = "{}"
	}

	if err := r.db.Create(&cfg).Error; err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (r *organizationRepository) DeleteOrgConfig(orgID uint) error {
	return r.db.Where("org_id = ?", orgID).Delete(&models.OrganizationConfig{}).Error
}

func (r *organizationRepository) UpdateSubscription(orgID uint, plan string, expiry *time.Time) error {
	return r.db.Model(&models.Organization{}).Where("id = ?", orgID).Updates(map[string]interface{}{
		"subscription_status": plan,
		"subscription_expiry": expiry,
		"is_verified":         plan != "free", // Auto-verify if they pay? Or just separate. Let's keep separate for now.
	}).Error
}
