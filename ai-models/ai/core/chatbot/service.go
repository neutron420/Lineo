package chatbot

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"
)

// Interfaces to loosely couple with the main Lineo services
type QueueService interface {
	GetUserStatus(ctx context.Context, userID string, orgID string) (interface{}, error)
}

type AppointmentService interface {
	GetUpcoming(ctx context.Context, userID string) (interface{}, error)
	GetAvailableSlots(ctx context.Context, orgID string, date string) (interface{}, error)
	Book(ctx context.Context, userID, orgID string, scheduledAt time.Time) (interface{}, error)
	Cancel(ctx context.Context, apptID, userID string) error
}

type OrgService interface {
	GetInfo(ctx context.Context, orgID string, topic string) (string, error)
	GetOrg(ctx context.Context, orgID string) (struct{ Name, Type string }, error)
}

type ChatbotService struct {
	openai   *OpenAIChatbot
	repo     *ChatRepo
	queueSvc QueueService
	apptSvc  AppointmentService
	orgSvc   OrgService
}

func NewChatbotService(repo *ChatRepo, qSvc QueueService, aSvc AppointmentService, oSvc OrgService) *ChatbotService {
	return &ChatbotService{
		openai:   NewOpenAIChatbot(),
		repo:     repo,
		queueSvc: qSvc,
		apptSvc:  aSvc,
		orgSvc:   oSvc,
	}
}

type UserContext struct {
	ID    string
	Name  string
	OrgID string
	Phone string
}

// ProcessMessage — main entry point for every incoming message
func (s *ChatbotService) ProcessMessage(ctx context.Context,
	sessionID, userMessage string,
	user UserContext,
	channel string) (string, error) {

	// 1. Load conversation history from DB
	history, err := s.repo.GetHistory(ctx, sessionID)
	if err != nil {
		return "", err
	}

	// 2. Append the new user message (in-memory for the prompt)
	promptHistory := make([]Message, len(history))
	for i, h := range history {
		promptHistory[i] = Message{Role: h.Role, Content: h.Content}
	}
	promptHistory = append(promptHistory, Message{Role: "user", Content: userMessage})

	// 3. Save user message to DB
	if err := s.repo.SaveMessage(ctx, sessionID, "user", userMessage); err != nil {
		log.Printf("Failed to save user message: %v", err)
	}

	// 4. Get org info for system prompt
	org := struct{ Name, Type string }{Name: "Lineo Platform", Type: "Business"}
	if s.orgSvc != nil {
		if fetchedOrg, err := s.orgSvc.GetOrg(ctx, user.OrgID); err == nil {
			org = fetchedOrg
		}
	}

	// 5. Agentic loop — ChatGPT may call multiple tools before responding
	maxIterations := 5

	for i := 0; i < maxIterations; i++ {
		response, err := s.openai.Chat(ctx, promptHistory, org.Name, org.Type, user)
		if err != nil {
			log.Printf("OpenAI API error: %v", err)
			return "Sorry, I'm having trouble connecting to my AI brain right now. Please try again!", nil
		}

		if response.Type == "message" {
			// ChatGPT gave a final text response — save and return
			if err := s.repo.SaveMessage(ctx, sessionID, "assistant", response.TextResponse); err != nil {
				log.Printf("Failed to save assistant response: %v", err)
			}
			return response.TextResponse, nil
		}

		if response.Type == "tool_use" {
			// Add the assistant's tool call to history
			promptHistory = append(promptHistory, Message{
				Role: "assistant",
				ToolCalls: []map[string]interface{}{
					{
						"id":   response.ToolUseID,
						"type": "function",
						"function": map[string]interface{}{
							"name":      response.ToolName,
							"arguments": string(marshalIgnoreError(response.ToolInput)),
						},
					},
				},
			})

			// Execute the tool
			toolResult, err := s.executeTool(ctx, response.ToolName, response.ToolInput, user)
			if err != nil {
				toolResult = fmt.Sprintf("Error: %v", err)
			}

			// Store tool result for next loop iteration
			promptHistory = append(promptHistory, Message{
				Role:       "tool",
				ToolCallID: response.ToolUseID,
				Name:       response.ToolName,
				Content:    toolResult,
			})
		}
	}

	return "I wasn't able to complete that. A human agent will assist you shortly.", nil
}

func marshalIgnoreError(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}
func (s *ChatbotService) GetUserPhone(userID interface{}) string {
	return s.repo.GetUserPhone(userID)
}

func (s *ChatbotService) GetHistory(ctx context.Context, sessionID string) ([]ChatMessage, error) {
	return s.repo.GetHistory(ctx, sessionID)
}

// executeTool — maps OpenAI's tool calls to your actual Go services
func (s *ChatbotService) executeTool(ctx context.Context, toolName string,
	input interface{}, user UserContext) (string, error) {

	inputMap := input.(map[string]interface{})

	switch toolName {

	case "get_queue_status":
		status, err := s.queueSvc.GetUserStatus(ctx, user.ID, user.OrgID)
		if err != nil {
			return "I couldn't find an active ticket for you. Are you sure you've joined a queue?", nil
		}
		result, _ := json.Marshal(status)
		return string(result), nil

	case "get_upcoming_appointments":
		appts, err := s.apptSvc.GetUpcoming(ctx, user.ID)
		if err != nil {
			return "I couldn't find any upcoming appointments for you.", nil
		}
		result, _ := json.Marshal(appts)
		return string(result), nil

	case "get_available_slots":
		orgID := fmt.Sprintf("%v", inputMap["org_id"])
		date := fmt.Sprintf("%v", inputMap["date"])
		slots, err := s.apptSvc.GetAvailableSlots(ctx, orgID, date)
		if err != nil {
			return "I couldn't find any available slots for that date.", nil
		}
		result, _ := json.Marshal(slots)
		return string(result), nil

	case "book_appointment":
		scheduledAt := fmt.Sprintf("%v", inputMap["scheduled_at"])
		t, _ := time.Parse(time.RFC3339, scheduledAt)
		appt, err := s.apptSvc.Book(ctx, user.ID, user.OrgID, t)
		if err != nil {
			return fmt.Sprintf("I was unable to book the appointment: %v", err), nil
		}
		result, _ := json.Marshal(appt)
		return string(result), nil

	case "cancel_appointment":
		apptID := fmt.Sprintf("%v", inputMap["appointment_id"])
		err := s.apptSvc.Cancel(ctx, apptID, user.ID)
		if err != nil {
			return "I was unable to cancel your appointment at this time.", nil
		}
		return `{"status": "cancelled", "message": "Your appointment has been successfully cancelled."}`, nil

	case "get_org_info":
		orgID := fmt.Sprintf("%v", inputMap["org_id"])
		topic := fmt.Sprintf("%v", inputMap["topic"])
		info, err := s.orgSvc.GetInfo(ctx, orgID, topic)
		if err != nil {
			return "I'm sorry, I don't have that information right now.", nil
		}
		return info, nil

	case "set_reminder":
		delay := int(inputMap["delay_minutes"].(float64))
		msg := fmt.Sprintf("%v", inputMap["message"])
		
		remindAt := time.Now().Add(time.Duration(delay) * time.Minute)
		
		reminder := ChatReminder{
			UserID:      user.ID,
			PhoneNumber: user.Phone,
			Message:     msg,
			RemindAt:    remindAt,
		}
		
		if err := s.repo.DB.Create(&reminder).Error; err != nil {
			return fmt.Sprintf("Failed to set reminder: %v", err), nil
		}
		
		return fmt.Sprintf(`{"status": "success", "remind_at": "%s"}`, remindAt.Format(time.Kitchen)), nil

	case "escalate_to_human":
		reason := fmt.Sprintf("%v", inputMap["reason"])
		log.Printf("ESCALATION - Session for user %s: %s", user.ID, reason)
		// Update DB conversation status
		// Convert string ID to uint if needed, for now we will skip updating DB if types don't match or parse it
		return `{"escalated": true}`, nil

	default:
		return fmt.Sprintf("Unknown tool: %s", toolName), nil
	}
}
