package chatbot

import (
	"context"
	"fmt"
	"log"
	"queueless/internal/events"
	"queueless/internal/models"
	"time"

	"gorm.io/gorm"
)

type ProactiveService struct {
	chatbot *OpenAIChatbot
	bus     events.Bus
	db      *gorm.DB
}

func NewProactiveService(chatbot *OpenAIChatbot, bus events.Bus, db *gorm.DB) *ProactiveService {
	return &ProactiveService{
		chatbot: chatbot,
		bus:     bus,
		db:      db,
	}
}


// RunReminders — Scan for upcoming queue tickets and send AI-powered SMS reminders
func (s *ProactiveService) RunReminders(ctx context.Context) error {
	var entries []models.QueueHistory
	
	// Find users who are "waiting" and joined within the last hour
	// We could also refine this to specifically look for users at position #2 or #3
	err := s.db.Where("status = ? AND created_at > ?", "waiting", time.Now().Add(-1*time.Hour)).Find(&entries).Error
	if err != nil {
		return err
	}

	for _, entry := range entries {
		// Avoid double-notifying the same person too frequently
		// We'll use a simple cooldown or a flag if we had one
		
		// For demo, let's assume we send a reminder if they have been waiting > 5 mins
		if time.Since(entry.JoinedAt) < 5*time.Minute {
			continue
		}

		// Use AI to generate a unique, friendly reminder
		system := `You are Lineo's Premium AI Concierge. Write a stunning, personalized, and warm SMS reminder. 
		Use elegant language, a supportive tone, and subtle professional emojis. 
		Keep it very concise (max 140 characters). 
		Focus on making the customer feel valued and informed.`
		
		userPrompt := fmt.Sprintf("The customer's token is %s. They have been waiting at our unit. Let them know we haven't forgotten them and their turn is important.", entry.TokenNumber)
		
		msg, err := s.chatbot.GenerateOneOff(ctx, system, userPrompt)
		if err != nil {
			log.Printf("Failed to generate AI reminder: %v", err)
			continue
		}

		// Send via SMS Bus
		if entry.PhoneNumber != "" {
			_ = s.bus.PublishSMSNotification(ctx, events.SMSNotification{
				OrgID:       entry.OrganizationID,
				UserID:      entry.UserID,
				PhoneNumber: entry.PhoneNumber,
				Message:     msg,
				Type:        "proactive_reminder",
				TokenNumber: entry.TokenNumber,
				CreatedAt:   time.Now().UTC(),
			})
		}
	}

	// 2. Scan for ChatReminders set by AI
	var reminders []ChatReminder
	err = s.db.Where("is_sent = ? AND remind_at <= ?", false, time.Now()).Find(&reminders).Error
	if err == nil {
		for _, r := range reminders {
			if r.PhoneNumber != "" {
				_ = s.bus.PublishSMSNotification(ctx, events.SMSNotification{
					UserID:      0, // System
					PhoneNumber: r.PhoneNumber,
					Message:     r.Message,
					Type:        "ai_reminder",
					CreatedAt:   time.Now().UTC(),
				})
			}
			// Mark as sent
			s.db.Model(&r).Update("is_sent", true)
		}
	}

	return nil
}
