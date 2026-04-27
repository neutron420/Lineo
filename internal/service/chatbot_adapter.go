package service

import (
	"context"
	"errors"
	"strconv"
	"time"

	"queueless/internal/models"
)

// ChatbotAdapter bridges the internal services to the AI Chatbot's interfaces
type ChatbotAdapter struct {
	queueSvc QueueService
	apptSvc  AppointmentService
	orgSvc   OrganizationService
}

func NewChatbotAdapter(q QueueService, a AppointmentService, o OrganizationService) *ChatbotAdapter {
	return &ChatbotAdapter{
		queueSvc: q,
		apptSvc:  a,
		orgSvc:   o,
	}
}

// GetUserStatus implements chatbot.QueueService
func (a *ChatbotAdapter) GetUserStatus(ctx context.Context, userIDStr string, orgIDStr string) (interface{}, error) {
	userID, _ := strconv.ParseUint(userIDStr, 10, 32)
	
	resp, err := a.queueSvc.GetActiveTicket(uint(userID))
	if err != nil {
		return nil, err
	}
	if resp == nil {
		return nil, errors.New("no active ticket found")
	}

	return map[string]interface{}{
		"position":               resp.Position,
		"token_number":           resp.TokenNumber,
		"estimated_wait_minutes": resp.EstimatedWait,
		"queue_key":              resp.QueueKey,
	}, nil
}

// GetUpcoming implements chatbot.AppointmentService
func (a *ChatbotAdapter) GetUpcoming(ctx context.Context, userIDStr string) (interface{}, error) {
	userID, _ := strconv.ParseUint(userIDStr, 10, 32)
	return a.apptSvc.GetMyAppointments(uint(userID))
}

// GetAvailableSlots implements chatbot.AppointmentService (placeholder logic)
func (a *ChatbotAdapter) GetAvailableSlots(ctx context.Context, orgIDStr string, date string) (interface{}, error) {
	// For now, return some mock slots or implement real logic if available
	return []string{"09:00 AM", "11:30 AM", "02:00 PM", "04:30 PM"}, nil
}

// Book implements chatbot.AppointmentService
func (a *ChatbotAdapter) Book(ctx context.Context, userIDStr, orgIDStr string, scheduledAt time.Time) (interface{}, error) {
	userID, _ := strconv.ParseUint(userIDStr, 10, 32)
	// We need a queue key to book. We'll default to the first queue if not specified.
	// In a real scenario, the AI should ask for the service type.
	return a.apptSvc.Book(uint(userID), models.BookAppointmentRequest{
		QueueKey:  "general", // Default
		StartTime: scheduledAt.Format("2006-01-02 15:04"),
	})
}

// Cancel implements chatbot.AppointmentService
func (a *ChatbotAdapter) Cancel(ctx context.Context, apptIDStr, userIDStr string) error {
	apptID, _ := strconv.ParseUint(apptIDStr, 10, 32)
	userID, _ := strconv.ParseUint(userIDStr, 10, 32)
	return a.apptSvc.Cancel(uint(apptID), uint(userID))
}

// GetInfo implements chatbot.OrgService
func (a *ChatbotAdapter) GetInfo(ctx context.Context, orgIDStr string, topic string) (string, error) {
	orgID, _ := strconv.ParseUint(orgIDStr, 10, 32)
	org, err := a.orgSvc.GetOrganizationByID(uint(orgID))
	if err != nil {
		return "", err
	}

	switch topic {
	case "hours":
		return "Our standard hours are 9 AM to 6 PM, Monday to Saturday.", nil
	case "location":
		return org.Address, nil
	default:
		return "We offer high-quality queue management and priority services.", nil
	}
}

// GetOrg implements chatbot.OrgService
func (a *ChatbotAdapter) GetOrg(ctx context.Context, orgIDStr string) (struct{ Name, Type string }, error) {
	orgID, _ := strconv.ParseUint(orgIDStr, 10, 32)
	org, err := a.orgSvc.GetOrganizationByID(uint(orgID))
	if err != nil {
		return struct{ Name, Type string }{}, err
	}
	return struct{ Name, Type string }{Name: org.Name, Type: "Service Provider"}, nil
}
