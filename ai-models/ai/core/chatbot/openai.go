package chatbot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type OpenAIChatbot struct {
	apiKey string
	client *http.Client
}

func NewOpenAIChatbot() *OpenAIChatbot {
	return &OpenAIChatbot{
		apiKey: os.Getenv("OPENAI_API_KEY"),
		client: &http.Client{},
	}
}

type Message struct {
	Role       string `json:"role"`
	Content    string `json:"content,omitempty"`
	Name       string `json:"name,omitempty"`
	ToolCallID string `json:"tool_call_id,omitempty"`
	ToolCalls  any    `json:"tool_calls,omitempty"`
}

type ChatResponse struct {
	Type         string      // "message" or "tool_use"
	TextResponse string      // if Type == "message"
	ToolName     string      // if Type == "tool_use"
	ToolInput    interface{} // if Type == "tool_use"
	ToolUseID    string      // needed to send tool result back
}

// SystemPrompt — this is ChatGPT's persona and context
func buildSystemPrompt(orgName, orgType string, userInfo UserContext) string {
	return fmt.Sprintf(`You are an AI receptionist for %s, a %s using the QueueLess system.

YOUR PERSONALITY:
- Friendly, concise, and professional
- Use plain language — no medical or banking jargon
- Be empathetic (patients/customers may be stressed)
- Use appropriate emojis sparingly for warmth

CURRENT USER:
- Name: %s
- User ID: %s
- Organization: %s (org_id: %s)

YOUR CAPABILITIES (use the provided tools):
- Check queue position & wait time
- View upcoming appointments
- Book new appointments
- Reschedule or cancel appointments
- Answer questions about organization hours, services, documents needed
- Escalate to a human agent when needed

RULES:
- Always confirm before booking or cancelling anything
- Never make up queue positions or wait times — use the tools
- If a user asks something you can't answer, escalate_to_human
- Keep responses under 160 characters when on SMS channel
- If the user seems angry or distressed, escalate immediately`,
		orgName, orgType,
		userInfo.Name, userInfo.ID,
		orgName, userInfo.OrgID,
	)
}

func (c *OpenAIChatbot) Chat(ctx context.Context,
	messages []Message,
	orgName, orgType string,
	userInfo UserContext) (ChatResponse, error) {

	// Build the messages payload
	payloadMessages := []map[string]interface{}{}
	payloadMessages = append(payloadMessages, map[string]interface{}{
		"role":    "system",
		"content": buildSystemPrompt(orgName, orgType, userInfo),
	})

	for _, m := range messages {
		msgMap := map[string]interface{}{
			"role": m.Role,
		}
		if m.Content != "" {
			msgMap["content"] = m.Content
		}
		if m.ToolCallID != "" {
			msgMap["tool_call_id"] = m.ToolCallID
		}
		if m.ToolCalls != nil {
			msgMap["tool_calls"] = m.ToolCalls
		}
		payloadMessages = append(payloadMessages, msgMap)
	}

	body, _ := json.Marshal(map[string]interface{}{
		"model":       "gpt-4o",
		"messages":    payloadMessages,
		"tools":       ChatbotTools,
		"temperature": 0.7,
	})

	req, _ := http.NewRequestWithContext(ctx, "POST",
		"https://api.openai.com/v1/chat/completions", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return ChatResponse{}, err
	}
	defer resp.Body.Close()

	var openaiResp struct {
		Choices []struct {
			Message struct {
				Role      string `json:"role"`
				Content   string `json:"content"`
				ToolCalls []struct {
					ID       string `json:"id"`
					Type     string `json:"type"`
					Function struct {
						Name      string `json:"name"`
						Arguments string `json:"arguments"`
					} `json:"function"`
				} `json:"tool_calls"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&openaiResp); err != nil {
		return ChatResponse{}, err
	}

	if len(openaiResp.Choices) == 0 {
		return ChatResponse{}, fmt.Errorf("empty response from OpenAI")
	}

	message := openaiResp.Choices[0].Message

	// Check if OpenAI wants to use a tool
	if len(message.ToolCalls) > 0 {
		toolCall := message.ToolCalls[0]
		var input interface{}
		if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &input); err != nil {
			return ChatResponse{}, fmt.Errorf("failed to parse tool arguments: %w", err)
		}
		return ChatResponse{
			Type:      "tool_use",
			ToolName:  toolCall.Function.Name,
			ToolInput: input,
			ToolUseID: toolCall.ID,
		}, nil
	}

	return ChatResponse{
		Type:         "message",
		TextResponse: message.Content,
	}, nil
}

// GenerateOneOff — used for proactive notifications (reminders)
func (c *OpenAIChatbot) GenerateOneOff(ctx context.Context, system, user string) (string, error) {
	body, _ := json.Marshal(map[string]interface{}{
		"model": "gpt-4o",
		"messages": []map[string]interface{}{
			{"role": "system", "content": system},
			{"role": "user", "content": user},
		},
		"temperature": 0.7,
	})

	req, _ := http.NewRequestWithContext(ctx, "POST",
		"https://api.openai.com/v1/chat/completions", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	if len(result.Choices) == 0 {
		return "", fmt.Errorf("no response")
	}
	return result.Choices[0].Message.Content, nil
}

