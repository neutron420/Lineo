package models

import (
	"time"
	"gorm.io/gorm"
)

type Organization struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Name        string         `gorm:"uniqueIndex;not null" json:"name"`
	Type        string         `gorm:"not null" json:"type"` // e.g., "bank", "clinic", "hospital"
	// Location & Identity
	Address     string         `json:"address"`
	Pincode     string         `json:"pincode"`
	State       string         `json:"state"`
	Latitude    float64        `json:"latitude"`
	Longitude   float64        `json:"longitude"`
	
	OwnerName   string         `json:"owner_name"`
	OwnerPhone  string         `json:"owner_phone"`
	
	// Verification Documents (Stored in R2/S3)
	OfficeImageURL string         `json:"office_image_url"`
	CertPdfURL     string         `json:"cert_pdf_url"`
	PTaxPaperURL   string         `json:"ptax_paper_url"`
	IsVerified     bool           `gorm:"default:false" json:"is_verified"`

	// Operating Settings
	OpenTime    string         `gorm:"default:'09:00'" json:"open_time"`  // 09:00
	CloseTime   string         `gorm:"default:'18:00'" json:"close_time"` // 18:00

	// Feature #4: SaaS Subscription
	SubscriptionStatus string    `gorm:"default:'free'" json:"subscription_status"` // free, pro, enterprise
	SubscriptionExpiry *time.Time `json:"subscription_expiry"`
	
	Admins      []User         `gorm:"foreignKey:OrganizationID" json:"admins,omitempty"`
	Queues      []QueueDef     `gorm:"foreignKey:OrganizationID" json:"queues,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type QueueDef struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	OrganizationID uint           `gorm:"not null;index" json:"organization_id"`
	Organization   Organization   `gorm:"foreignKey:OrganizationID" json:"organization,omitempty"`
	Name           string         `gorm:"not null" json:"name"`
	QueueKey       string         `gorm:"uniqueIndex;not null" json:"queue_key"`
	IsPaused       bool           `gorm:"default:false" json:"is_paused"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}
