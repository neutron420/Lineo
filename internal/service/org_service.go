package service

import (
	"fmt"
	"queueless/internal/models"
	"queueless/internal/repository"
	"time"
)

type OrganizationService interface {
	CreateOrganization(name, orgType, address string) (*models.Organization, error)
	CreateQueueForOrg(orgID uint, name, queueKey string) (*models.QueueDef, error)
	GetOrgConfig(orgID uint) (*models.OrganizationConfig, error)
	CreateOrgConfig(orgID uint, req models.OrganizationConfigRequest) (*models.OrganizationConfig, error)
	UpdateOrgConfig(orgID uint, req models.OrganizationConfigRequest) (*models.OrganizationConfig, error)
	DeleteOrgConfig(orgID uint) error
	UpgradePlan(orgID uint, plan string, months int) error
	GetOrganizationByID(id uint) (*models.Organization, error)
}

type organizationService struct {
	orgRepo repository.OrganizationRepository
}

func NewOrganizationService(repo repository.OrganizationRepository) OrganizationService {
	return &organizationService{orgRepo: repo}
}

func (s *organizationService) CreateOrganization(name, orgType, address string) (*models.Organization, error) {
	org := &models.Organization{
		Name:    name,
		Type:    orgType,
		Address: address,
	}
	err := s.orgRepo.CreateOrganization(org)
	return org, err
}

func (s *organizationService) CreateQueueForOrg(orgID uint, name, queueKey string) (*models.QueueDef, error) {
	org, err := s.orgRepo.GetOrganizationByID(orgID)
	if err != nil {
		return nil, err
	}

	queueCount, err := s.orgRepo.GetQueueCountByOrg(orgID)
	if err == nil {
		limit := 3 // Generous default for free/testing
		switch org.SubscriptionStatus {
		case "pro":
			limit = 10
		case "enterprise":
			limit = 100
		}

		if queueCount >= limit {
			return nil, fmt.Errorf("unit limit reached for %s plan (%d). please upgrade to launch more units", org.SubscriptionStatus, limit)
		}
	}

	def := &models.QueueDef{
		OrganizationID: orgID,
		Name:           name,
		QueueKey:       queueKey,
	}
	err = s.orgRepo.CreateQueueDef(def)
	return def, err
}

func (s *organizationService) GetOrgConfig(orgID uint) (*models.OrganizationConfig, error) {
	return s.orgRepo.GetOrCreateOrgConfig(orgID)
}

func (s *organizationService) CreateOrgConfig(orgID uint, req models.OrganizationConfigRequest) (*models.OrganizationConfig, error) {
	return s.orgRepo.CreateOrgConfig(orgID, req)
}

func (s *organizationService) UpdateOrgConfig(orgID uint, req models.OrganizationConfigRequest) (*models.OrganizationConfig, error) {
	return s.orgRepo.UpdateOrgConfig(orgID, req)
}

func (s *organizationService) DeleteOrgConfig(orgID uint) error {
	return s.orgRepo.DeleteOrgConfig(orgID)
}

func (s *organizationService) UpgradePlan(orgID uint, plan string, months int) error {
	expiry := time.Now().AddDate(0, months, 0)
	return s.orgRepo.UpdateSubscription(orgID, plan, &expiry)
}

func (s *organizationService) GetOrganizationByID(id uint) (*models.Organization, error) {
	return s.orgRepo.GetOrganizationByID(id)
}
