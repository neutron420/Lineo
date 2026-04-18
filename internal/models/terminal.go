package models

import (
	"time"
	"gorm.io/gorm"
)

type Terminal struct {
	ID        string         `gorm:"primaryKey;type:varchar(50)" json:"id"`
	Name      string         `gorm:"type:varchar(100);not null" json:"name"`
	OrgName   string         `gorm:"type:varchar(100);not null" json:"org"`
	Status    string         `gorm:"type:varchar(20);default:'ONLINE'" json:"status"`
	Health    int            `gorm:"default:100" json:"health"`
	LastSeen  time.Time      `json:"lastSeen"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
