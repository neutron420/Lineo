package chatbot

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type ChatRepo struct {
	DB *gorm.DB
}

func NewChatRepo(db *gorm.DB) *ChatRepo {
	return &ChatRepo{DB: db}
}

func (r *ChatRepo) GetHistory(ctx context.Context, sessionID string) ([]ChatMessage, error) {
	var messages []ChatMessage
	err := r.DB.WithContext(ctx).
		Where("session_id = ?", sessionID).
		Order("created_at asc").
		Find(&messages).Error
	return messages, err
}

func (r *ChatRepo) SaveMessage(ctx context.Context, sessionID, role, content string) error {
	msg := ChatMessage{
		SessionID: sessionID,
		Role:      role,
		Content:   content,
	}
	
	// Also update the conversation's LastActive timestamp
	r.DB.WithContext(ctx).Model(&ChatConversation{}).
		Where("session_id = ?", sessionID).
		Update("last_active", time.Now())

	return r.DB.WithContext(ctx).Create(&msg).Error
}

func (r *ChatRepo) UpdateStatus(ctx context.Context, userID uint, status string) error {
	return r.DB.WithContext(ctx).Model(&ChatConversation{}).
		Where("user_id = ?", userID).
		Update("status", status).Error
}

func (r *ChatRepo) CreateSession(ctx context.Context, conv *ChatConversation) error {
	return r.DB.WithContext(ctx).Create(conv).Error
}

func (r *ChatRepo) GetSessionByPhone(ctx context.Context, phone string) (*ChatConversation, error) {
	var conv ChatConversation
	err := r.DB.WithContext(ctx).
		Where("phone_number = ? AND status != 'closed'", phone).
		Order("last_active desc").
		First(&conv).Error
	if err != nil {
		return nil, err
	}
	return &conv, nil
}
func (r *ChatRepo) GetUserPhone(userID interface{}) string {
	var phone string
	// We use a raw query or a local model to avoid importing internal/models if possible,
	// but since we are already in the same package or can use a generic map, let's keep it simple.
	r.DB.Table("users").Select("phone_number").Where("id = ?", userID).Scan(&phone)
	return phone
}
