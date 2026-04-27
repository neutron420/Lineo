package chatbot

import (
	"time"

	"gorm.io/gorm"
)

// ChatConversation tracks the multi-turn session state
type ChatConversation struct {
	ID          uint      `gorm:"primaryKey"`
	UserID      *uint     // Nullable for anonymous SMS/Kiosk users
	PhoneNumber *string   `gorm:"type:varchar(20);index"`
	SessionID   string    `gorm:"type:varchar(100);not null;index:idx_chat_conversations_session"`
	OrgID       uint      `gorm:"not null"`
	Channel     string    `gorm:"type:varchar(10);not null"` // 'sms', 'web', 'kiosk'
	Status      string    `gorm:"type:varchar(20);default:'active'"`
	LastActive  time.Time `gorm:"default:CURRENT_TIMESTAMP"`
	CreatedAt   time.Time `gorm:"default:CURRENT_TIMESTAMP"`
}

// ChatMessage stores individual messages inside a conversation
type ChatMessage struct {
	ID        uint      `gorm:"primaryKey"`
	SessionID string    `gorm:"type:varchar(100);not null;index:idx_chat_messages_session"`
	Role      string    `gorm:"type:varchar(10);not null"` // 'user' or 'assistant'
	Content   string    `gorm:"type:text;not null"`
	CreatedAt time.Time `gorm:"default:CURRENT_TIMESTAMP"`
}

// OrgFAQ stores knowledge base questions/answers for an organization
type OrgFAQ struct {
	ID             uint      `gorm:"primaryKey"`
	OrganizationID uint      `gorm:"index;not null"`
	Question       string    `gorm:"type:text;not null"`
	Answer         string    `gorm:"type:text;not null"`
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type ChatReminder struct {
	ID          uint      `gorm:"primaryKey"`
	UserID      string    `gorm:"index"`
	PhoneNumber string
	Email       string
	Message     string    `gorm:"type:text"`
	RemindAt    time.Time `gorm:"index"`
	IsSent      bool      `gorm:"default:false"`
	CreatedAt   time.Time
}

// BeforeCreate hooks
func (c *ChatConversation) BeforeCreate(tx *gorm.DB) (err error) {
	c.LastActive = time.Now()
	c.CreatedAt = time.Now()
	return
}

func (m *ChatMessage) BeforeCreate(tx *gorm.DB) (err error) {
	m.CreatedAt = time.Now()
	return
}
