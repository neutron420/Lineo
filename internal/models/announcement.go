package models

import (
	"time"
	"gorm.io/gorm"
)

type Announcement struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Title     string         `gorm:"type:varchar(255);not null" json:"title"`
	Message   string         `gorm:"type:text;not null" json:"message"`
	Level     string         `gorm:"type:varchar(20);default:'INFO'" json:"level"`
	Actor     string         `gorm:"type:varchar(100)" json:"actor"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
