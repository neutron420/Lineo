package models

import (
	"time"
	"gorm.io/gorm"
)

type Feedback struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	OrgID     uint           `gorm:"index" json:"org_id"`
	UserID    uint           `gorm:"index" json:"user_id"`
	TicketID  uint           `gorm:"index" json:"ticket_id"`
	Rating    int            `gorm:"check:rating >= 1 AND rating <= 5" json:"rating"`
	Comment   string         `gorm:"type:text" json:"comment"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type FeedbackRequest struct {
	TokenNumber string `json:"token_number" binding:"required"`
	Rating      int    `json:"rating" binding:"required,min=1,max=5"`
	Comment     string `json:"comment"`
}
