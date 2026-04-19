package models

import (
	"time"

	"gorm.io/gorm"
)

type Role string

const (
	RoleUser  Role = "user"
	RoleAdmin Role = "admin" // Boss Admin
	RoleStaff Role = "staff" // Counter staff member
)

type User struct {
	ID             uint   `gorm:"primaryKey" json:"id"`
	Username       string `gorm:"uniqueIndex;not null" json:"username"`
	Email          string `gorm:"uniqueIndex;not null" json:"email"`
	Password       string `gorm:"not null" json:"-"`
	PhoneNumber    string `json:"phone_number"`
	Role           Role   `gorm:"type:varchar(20);default:'user'" json:"role"`
	OrganizationID *uint  `gorm:"index" json:"organization_id"`

	// Feature #2: Desk Assignment
	CounterNumber int `gorm:"default:0" json:"counter_number"`

	// Forgot Password logic
	ResetToken    string     `json:"-"`
	ResetTokenExp *time.Time `json:"-"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type LoginRequest struct {
	Email          string `json:"email" binding:"required,email"`
	Password       string `json:"password" binding:"required"`
	TurnstileToken string `json:"turnstile_token"` // For Cloudflare integration
}

type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type ResetPasswordRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

type RegisterRequest struct {
	Username       string `json:"username" binding:"required"`
	Email          string `json:"email" binding:"required,email"`
	Password       string `json:"password" binding:"required,min=6"`
	Role           string `json:"role"`
	PhoneNumber    string `json:"phone_number"`
	OrganizationID *uint  `json:"organization_id"`
	TurnstileToken string `json:"turnstile_token"`
	CounterNumber  int    `json:"counter_number"`
}

type OrgRegistrationRequest struct {
	// User Details
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`

	// Org Details
	OrgName string `json:"org_name" binding:"required"`
	OrgType string `json:"org_type" binding:"required"`
	Address string `json:"address" binding:"required"`
	Pincode string `json:"pincode" binding:"required"`
	State   string `json:"state" binding:"required"`
	Lat     float64 `json:"lat"`
	Lng     float64 `json:"lng"`

	// Owner details
	OwnerName  string `json:"owner_name" binding:"required"`
	OwnerPhone string `json:"owner_phone" binding:"required"`

	// Document URLs (Frontend should upload to R2 then send URLs)
	OfficeImageURL string `json:"office_image_url"`
	CertPdfURL     string `json:"cert_pdf_url"`
	PTaxPaperURL   string `json:"ptax_paper_url"`

	TurnstileToken string `json:"turnstile_token"`
}

type TokenResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}
