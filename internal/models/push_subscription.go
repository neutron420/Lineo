package models

import (
	"time"

	"gorm.io/gorm"
)

type PushSubscription struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	UserID    uint           `gorm:"not null;index" json:"user_id"`
	Endpoint  string         `gorm:"uniqueIndex;not null" json:"endpoint"`
	P256dh    string         `gorm:"not null" json:"p256dh"`
	Auth      string         `gorm:"not null" json:"auth"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// PushSubscribeRequest is the JSON body the frontend sends after subscribing.
type PushSubscribeRequest struct {
	Endpoint string `json:"endpoint" binding:"required"`
	Keys     struct {
		P256dh string `json:"p256dh" binding:"required"`
		Auth   string `json:"auth" binding:"required"`
	} `json:"keys" binding:"required"`
}
