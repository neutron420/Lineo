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
	ID             uint           `gorm:"primaryKey" json:"id"`
	Username       string         `gorm:"uniqueIndex;not null" json:"username"`
	Email          string         `gorm:"uniqueIndex;not null" json:"email"`
	Password       string         `gorm:"not null" json:"-"`
	PhoneNumber    string         `json:"phone_number"`
	Role           Role           `gorm:"type:varchar(20);default:'user'" json:"role"`
	OrganizationID *uint          `gorm:"index" json:"organization_id"`
	
	// Feature #2: Desk Assignment
	CounterNumber  int            `gorm:"default:0" json:"counter_number"` 
	
	// Forgot Password logic
	ResetToken      string         `json:"-"`
	ResetTokenExp  *time.Time      `json:"-"`

	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

type LoginRequest struct {
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required"`
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
	PhoneNumber    string `json:"phone_number"`
	OrganizationID *uint  `json:"organization_id"`
	TurnstileToken string `json:"turnstile_token"`
	CounterNumber  int    `json:"counter_number"`
}

type TokenResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}
