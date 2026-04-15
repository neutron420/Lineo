package service

import (
	"errors"
	"queueless/internal/models"
	"queueless/internal/repository"
)

type FeedbackService interface {
	SubmitFeedback(userID uint, req models.FeedbackRequest) error
	GetOrgFeedback(orgID uint) ([]models.Feedback, error)
}

type feedbackService struct {
	repo      repository.FeedbackRepository
	queueRepo repository.QueueRepository
}

func NewFeedbackService(repo repository.FeedbackRepository, queueRepo repository.QueueRepository) FeedbackService {
	return &feedbackService{
		repo:      repo,
		queueRepo: queueRepo,
	}
}

func (s *feedbackService) SubmitFeedback(userID uint, req models.FeedbackRequest) error {
	history, err := s.queueRepo.GetHistoryByToken(req.TokenNumber)
	if err != nil {
		return errors.New("ticket history not found")
	}

	if history.UserID != userID {
		return errors.New("unauthorized feedback submission")
	}

	if history.Status != models.StatusCompleted {
		return errors.New("feedback can only be submitted for completed sessions")
	}

	feedback := &models.Feedback{
		OrgID:    history.OrganizationID,
		UserID:   userID,
		TicketID: history.ID,
		Rating:   req.Rating,
		Comment:  req.Comment,
	}

	return s.repo.Create(feedback)
}

func (s *feedbackService) GetOrgFeedback(orgID uint) ([]models.Feedback, error) {
	return s.repo.GetByOrgID(orgID)
}
