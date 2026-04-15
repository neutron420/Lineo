package service

import (
	"queueless/internal/models"
	"queueless/internal/repository"
)

type OrganizationService interface {
	CreateOrganization(name, orgType, address string) (*models.Organization, error)
	CreateQueueForOrg(orgID uint, name, queueKey string) (*models.QueueDef, error)
	GetOrgConfig(orgID uint) (*models.OrganizationConfig, error)
	CreateOrgConfig(orgID uint, req models.OrganizationConfigRequest) (*models.OrganizationConfig, error)
	UpdateOrgConfig(orgID uint, req models.OrganizationConfigRequest) (*models.OrganizationConfig, error)
	DeleteOrgConfig(orgID uint) error
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
	def := &models.QueueDef{
		OrganizationID: orgID,
		Name:           name,
		QueueKey:       queueKey,
	}
	err := s.orgRepo.CreateQueueDef(def)
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
