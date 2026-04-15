package repository

import (
	"queueless/internal/models"
	"queueless/pkg/db"
)

type FeedbackRepository interface {
	Create(feedback *models.Feedback) error
	GetByOrgID(orgID uint) ([]models.Feedback, error)
}

type feedbackRepository struct{}

func NewFeedbackRepository() FeedbackRepository {
	return &feedbackRepository{}
}

func (r *feedbackRepository) Create(feedback *models.Feedback) error {
	return db.DB.Create(feedback).Error
}

func (r *feedbackRepository) GetByOrgID(orgID uint) ([]models.Feedback, error) {
	var feedbacks []models.Feedback
	err := db.DB.Where("org_id = ?", orgID).Order("created_at desc").Find(&feedbacks).Error
	return feedbacks, err
}
