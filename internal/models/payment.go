package models

import (
	"time"

	"gorm.io/gorm"
)

type PaymentStatus string

const (
	PaymentCreated   PaymentStatus = "created"
	PaymentCaptured  PaymentStatus = "captured"
	PaymentFailed    PaymentStatus = "failed"
	PaymentVerified  PaymentStatus = "verified"
)

type PaymentTransaction struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	OrgID             uint           `gorm:"index" json:"org_id"`
	Organization      Organization   `gorm:"foreignKey:OrgID" json:"organization,omitempty"`
	UserID            uint           `gorm:"index;not null" json:"user_id"`
	User              User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Provider          string         `gorm:"index;not null" json:"provider"`
	ProviderOrderID   string         `gorm:"index" json:"provider_order_id"`
	ProviderPaymentID string         `gorm:"index" json:"provider_payment_id"`
	AmountMinor       int64          `json:"amount_minor"`
	Currency          string         `json:"currency"`
	Receipt           string         `json:"receipt"`
	Status            PaymentStatus  `gorm:"index" json:"status"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

type PaymentWebhookEvent struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Provider    string         `gorm:"index;not null" json:"provider"`
	EventID     string         `gorm:"uniqueIndex;not null" json:"event_id"`
	EventType   string         `gorm:"index" json:"event_type"`
	PayloadHash string         `gorm:"size:64" json:"payload_hash"`
	ProcessedAt time.Time      `gorm:"index" json:"processed_at"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type RazorpayWebhookRequest struct {
	Event  string `json:"event"`
	Payload struct {
		Payment struct {
			Entity struct {
				ID      string `json:"id"`
				OrderID string `json:"order_id"`
				Status  string `json:"status"`
			} `json:"entity"`
		} `json:"payment"`
	} `json:"payload"`
}

type RazorpayOrderRequest struct {
	OrgID    uint   `json:"org_id"`
	Amount   int64  `json:"amount" binding:"required"`
	Currency string `json:"currency"`
	Receipt  string `json:"receipt"`
}

type RazorpayVerifyRequest struct {
	OrderID   string `json:"order_id" binding:"required"`
	PaymentID string `json:"payment_id" binding:"required"`
	Signature string `json:"signature" binding:"required"`
}
