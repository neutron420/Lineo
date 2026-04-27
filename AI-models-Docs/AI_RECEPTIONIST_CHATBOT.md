# 🤖 AI Receptionist Chatbot — Implementation Guide

> **For QueueLess (Lineo)** — Go Backend | PostgreSQL | Redis | Claude AI | Twilio SMS

---

## 📌 What This Feature Does

An intelligent AI receptionist that handles **real conversations** with patients/customers via SMS (Twilio already connected!) or a web chat widget. It can:

- ✅ Answer "What's my queue position?" or "How long is the wait?"
- ✅ Book, reschedule, or cancel appointments via natural language
- ✅ Find nearby clinics/banks (Google Places API already connected!)
- ✅ Answer FAQs about the organization (hours, services, documents needed)
- ✅ Escalate to a human agent when it can't help
- ✅ Send queue updates without the user needing the app

**Example SMS Conversation:**
```
User:   "Hey when is my turn?"
Bot:    "Hi! You're currently #3 in line at City Clinic.
         Estimated wait: ~12 minutes. I'll text you when
         you're next! 📋"

User:   "Can I reschedule my 3pm appointment to tomorrow?"
Bot:    "Sure! I have openings at 10:00 AM, 2:00 PM, and
         4:30 PM tomorrow. Which works for you?"

User:   "2pm"
Bot:    "Done! Your appointment is rescheduled to tomorrow
         at 2:00 PM. See you then! 👍"
```

---

## 🏗️ Architecture Overview

```
SMS (Twilio) ──────────────────────────────────┐
Web Chat Widget ────────────────────────────────┤
                                                ▼
                                    Webhook Handler (Go)
                                           │
                                           ▼
                                  Chatbot Service (Go)
                                           │
                              ┌────────────┴──────────────┐
                              │                            │
                    Load conversation               Claude AI API
                    history from Redis              (with your tools)
                              │                            │
                              └────────────┬──────────────┘
                                           │
                              ┌────────────┴──────────────┐
                              │            │               │
                          Queue DB    Appointment DB   Redis Queue
                         (position)   (book/cancel)  (live status)
                              │
                              ▼
                     Response back to user
                     (SMS via Twilio / WebSocket)
```

---

## 🗄️ Step 1 — Database: Conversation State

```sql
-- Store conversation history per user (for multi-turn chat)
CREATE TABLE chat_conversations (
    id              SERIAL PRIMARY KEY,
    user_id         UUID,                    -- NULL for anonymous kiosk users
    phone_number    VARCHAR(20),             -- for SMS users
    session_id      VARCHAR(100) NOT NULL,   -- unique per conversation
    org_id          UUID,                    -- which org context
    channel         VARCHAR(10) NOT NULL,    -- 'sms', 'web', 'kiosk'
    created_at      TIMESTAMP DEFAULT NOW(),
    last_active     TIMESTAMP DEFAULT NOW(),
    status          VARCHAR(20) DEFAULT 'active'  -- active, escalated, closed
);

CREATE TABLE chat_messages (
    id              SERIAL PRIMARY KEY,
    session_id      VARCHAR(100) NOT NULL,
    role            VARCHAR(10) NOT NULL,    -- 'user' or 'assistant'
    content         TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- FAQ knowledge base per org
CREATE TABLE org_faq (
    id          SERIAL PRIMARY KEY,
    org_id      UUID NOT NULL,
    question    TEXT NOT NULL,
    answer      TEXT NOT NULL,
    category    VARCHAR(50),   -- 'hours', 'documents', 'services', 'pricing'
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);
CREATE INDEX idx_chat_conversations_phone ON chat_conversations(phone_number);
```

---

## 📦 Step 2 — Go Package Structure

```
internal/
└── chatbot/
    ├── service.go       ← main orchestrator
    ├── repository.go    ← conversation history DB queries
    ├── claude.go        ← Claude AI with tool use
    ├── tools.go         ← defines tools Claude can call (queue, appointments)
    └── sms.go           ← Twilio webhook handler
pkg/
└── chatbot/
    └── session.go       ← session ID generation & Redis caching
```

---

## 🔧 Step 3 — Tool Definitions for Claude

Claude AI supports **function/tool calling** — it can decide to call your Go functions to get real data. Define the tools Claude can use:

```go
package chatbot

// tools.go — These are the "functions" Claude can invoke

var ChatbotTools = []map[string]interface{}{
    {
        "name":        "get_queue_status",
        "description": "Get the current queue position and estimated wait time for a user",
        "input_schema": map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "user_id": map[string]string{
                    "type":        "string",
                    "description": "The user's ID",
                },
                "org_id": map[string]string{
                    "type":        "string",
                    "description": "The organization's ID",
                },
            },
            "required": []string{"user_id", "org_id"},
        },
    },
    {
        "name":        "get_upcoming_appointments",
        "description": "Get a user's upcoming appointments",
        "input_schema": map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "user_id": map[string]string{"type": "string"},
            },
            "required": []string{"user_id"},
        },
    },
    {
        "name":        "get_available_slots",
        "description": "Get available appointment slots for an organization on a given date",
        "input_schema": map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "org_id": map[string]string{"type": "string"},
                "date":   map[string]string{
                    "type":        "string",
                    "description": "Date in YYYY-MM-DD format",
                },
            },
            "required": []string{"org_id", "date"},
        },
    },
    {
        "name":        "book_appointment",
        "description": "Book an appointment for a user",
        "input_schema": map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "user_id":      map[string]string{"type": "string"},
                "org_id":       map[string]string{"type": "string"},
                "slot_id":      map[string]string{"type": "string"},
                "scheduled_at": map[string]string{
                    "type":        "string",
                    "description": "ISO8601 datetime string",
                },
            },
            "required": []string{"user_id", "org_id", "scheduled_at"},
        },
    },
    {
        "name":        "cancel_appointment",
        "description": "Cancel an upcoming appointment",
        "input_schema": map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "appointment_id": map[string]string{"type": "string"},
                "user_id":        map[string]string{"type": "string"},
            },
            "required": []string{"appointment_id", "user_id"},
        },
    },
    {
        "name":        "get_org_info",
        "description": "Get information about an organization: hours, services, location",
        "input_schema": map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "org_id": map[string]string{"type": "string"},
                "topic":  map[string]string{
                    "type":        "string",
                    "description": "What info: 'hours', 'services', 'documents', 'location'",
                },
            },
            "required": []string{"org_id"},
        },
    },
    {
        "name":        "escalate_to_human",
        "description": "Escalate the conversation to a human agent when the AI cannot help",
        "input_schema": map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "reason": map[string]string{"type": "string"},
            },
        },
    },
}
```

---

## 🤖 Step 4 — Claude AI with Tool Use (`claude.go`)

```go
package chatbot

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "os"
)

type ClaudeChatbot struct {
    apiKey string
    client *http.Client
}

func NewClaudeChatbot() *ClaudeChatbot {
    return &ClaudeChatbot{
        apiKey: os.Getenv("ANTHROPIC_API_KEY"),
        client: &http.Client{},
    }
}

type Message struct {
    Role    string `json:"role"`
    Content string `json:"content"`
}

type ChatResponse struct {
    Type         string      // "message" or "tool_use"
    TextResponse string      // if Type == "message"
    ToolName     string      // if Type == "tool_use"
    ToolInput    interface{} // if Type == "tool_use"
    ToolUseID    string      // needed to send tool result back
}

// SystemPrompt — this is Claude's persona and context
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

func (c *ClaudeChatbot) Chat(ctx context.Context,
    messages []Message,
    orgName, orgType string,
    userInfo UserContext) (ChatResponse, error) {

    // Convert our messages to Claude format
    claudeMessages := make([]map[string]string, len(messages))
    for i, m := range messages {
        claudeMessages[i] = map[string]string{
            "role": m.Role, "content": m.Content,
        }
    }

    body, _ := json.Marshal(map[string]interface{}{
        "model":      "claude-sonnet-4-20250514",
        "max_tokens": 500,
        "system":     buildSystemPrompt(orgName, orgType, userInfo),
        "tools":      ChatbotTools,
        "messages":   claudeMessages,
    })

    req, _ := http.NewRequestWithContext(ctx, "POST",
        "https://api.anthropic.com/v1/messages", bytes.NewBuffer(body))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("x-api-key", c.apiKey)
    req.Header.Set("anthropic-version", "2023-06-01")

    resp, err := c.client.Do(req)
    if err != nil {
        return ChatResponse{}, err
    }
    defer resp.Body.Close()

    var claudeResp struct {
        StopReason string `json:"stop_reason"`
        Content    []struct {
            Type  string          `json:"type"`
            Text  string          `json:"text"`
            Name  string          `json:"name"`
            ID    string          `json:"id"`
            Input json.RawMessage `json:"input"`
        } `json:"content"`
    }
    json.NewDecoder(resp.Body).Decode(&claudeResp)

    // Check if Claude wants to use a tool
    for _, block := range claudeResp.Content {
        if block.Type == "tool_use" {
            var input interface{}
            json.Unmarshal(block.Input, &input)
            return ChatResponse{
                Type:      "tool_use",
                ToolName:  block.Name,
                ToolInput: input,
                ToolUseID: block.ID,
            }, nil
        }
        if block.Type == "text" {
            return ChatResponse{
                Type:         "message",
                TextResponse: block.Text,
            }, nil
        }
    }

    return ChatResponse{}, fmt.Errorf("empty response from Claude")
}
```

---

## ⚙️ Step 5 — Main Service Orchestrator (`service.go`)

```go
package chatbot

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "time"
)

type ChatbotService struct {
    claude    *ClaudeChatbot
    repo      *ChatRepo
    queueSvc  QueueService
    apptSvc   AppointmentService
    orgSvc    OrgService
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

    // 2. Append the new user message
    history = append(history, Message{Role: "user", Content: userMessage})

    // 3. Save user message
    s.repo.SaveMessage(ctx, sessionID, "user", userMessage)

    // 4. Get org info for system prompt
    org, _ := s.orgSvc.GetOrg(ctx, user.OrgID)

    // 5. Agentic loop — Claude may call multiple tools before responding
    maxIterations := 5
    var assistantMessages []map[string]interface{}

    for i := 0; i < maxIterations; i++ {
        // Include any assistant/tool messages from this loop
        fullHistory := history
        for _, am := range assistantMessages {
            fullHistory = append(fullHistory, Message{
                Role:    am["role"].(string),
                Content: fmt.Sprintf("%v", am["content"]),
            })
        }

        response, err := s.claude.Chat(ctx, fullHistory, org.Name, org.Type, user)
        if err != nil {
            return "Sorry, I'm having trouble right now. Please try again!", nil
        }

        if response.Type == "message" {
            // Claude gave a final text response — save and return
            s.repo.SaveMessage(ctx, sessionID, "assistant", response.TextResponse)
            return response.TextResponse, nil
        }

        if response.Type == "tool_use" {
            // Execute the tool
            toolResult, err := s.executeTool(ctx, response.ToolName, response.ToolInput, user)
            if err != nil {
                toolResult = fmt.Sprintf("Error: %v", err)
            }

            // Store tool result for next loop iteration
            assistantMessages = append(assistantMessages,
                map[string]interface{}{
                    "role": "assistant",
                    "content": fmt.Sprintf("[Used tool: %s]", response.ToolName),
                },
                map[string]interface{}{
                    "role":    "user",
                    "content": fmt.Sprintf("[Tool result for %s]: %s", response.ToolName, toolResult),
                },
            )
        }
    }

    return "I wasn't able to complete that. A human agent will assist you shortly.", nil
}

// executeTool — maps Claude's tool calls to your actual Go services
func (s *ChatbotService) executeTool(ctx context.Context, toolName string,
    input interface{}, user UserContext) (string, error) {

    inputMap := input.(map[string]interface{})

    switch toolName {

    case "get_queue_status":
        status, err := s.queueSvc.GetUserStatus(ctx, user.ID, user.OrgID)
        if err != nil {
            return "User is not currently in any queue.", nil
        }
        result, _ := json.Marshal(status)
        return string(result), nil

    case "get_upcoming_appointments":
        appts, err := s.apptSvc.GetUpcoming(ctx, user.ID)
        if err != nil {
            return "No upcoming appointments found.", nil
        }
        result, _ := json.Marshal(appts)
        return string(result), nil

    case "get_available_slots":
        orgID := fmt.Sprintf("%v", inputMap["org_id"])
        date  := fmt.Sprintf("%v", inputMap["date"])
        slots, err := s.apptSvc.GetAvailableSlots(ctx, orgID, date)
        if err != nil {
            return "No available slots found for that date.", nil
        }
        result, _ := json.Marshal(slots)
        return string(result), nil

    case "book_appointment":
        scheduledAt := fmt.Sprintf("%v", inputMap["scheduled_at"])
        t, _ := time.Parse(time.RFC3339, scheduledAt)
        appt, err := s.apptSvc.Book(ctx, user.ID, user.OrgID, t)
        if err != nil {
            return fmt.Sprintf("Booking failed: %v", err), nil
        }
        result, _ := json.Marshal(appt)
        return string(result), nil

    case "cancel_appointment":
        apptID := fmt.Sprintf("%v", inputMap["appointment_id"])
        err := s.apptSvc.Cancel(ctx, apptID, user.ID)
        if err != nil {
            return "Could not cancel appointment.", nil
        }
        return `{"status": "cancelled", "message": "Appointment successfully cancelled"}`, nil

    case "get_org_info":
        orgID := fmt.Sprintf("%v", inputMap["org_id"])
        topic := fmt.Sprintf("%v", inputMap["topic"])
        info, err := s.orgSvc.GetInfo(ctx, orgID, topic)
        if err != nil {
            return "Organization info not available.", nil
        }
        return info, nil

    case "escalate_to_human":
        reason := fmt.Sprintf("%v", inputMap["reason"])
        log.Printf("ESCALATION - Session for user %s: %s", user.ID, reason)
        // Update DB conversation status
        s.repo.UpdateStatus(ctx, user.ID, "escalated")
        return `{"escalated": true}`, nil

    default:
        return fmt.Sprintf("Unknown tool: %s", toolName), nil
    }
}
```

---

## 📱 Step 6 — Twilio SMS Webhook (`sms.go`)

```go
package chatbot

import (
    "crypto/hmac"
    "crypto/sha1"
    "encoding/base64"
    "net/http"
    "net/url"
    "sort"
    "strings"

    "github.com/gin-gonic/gin"
)

type SMSHandler struct {
    service    *ChatbotService
    authToken  string // TWILIO_AUTH_TOKEN
}

// POST /api/v1/webhook/sms  ← Register this URL in your Twilio console
func (h *SMSHandler) HandleIncomingSMS(c *gin.Context) {
    // 1. Verify request is genuinely from Twilio
    if !h.verifyTwilioSignature(c.Request) {
        c.JSON(403, gin.H{"error": "invalid twilio signature"})
        return
    }

    // 2. Parse Twilio webhook payload
    fromPhone := c.PostForm("From")   // e.g. "+12025551234"
    toPhone   := c.PostForm("To")    // your Twilio number
    body      := c.PostForm("Body")  // the user's message

    // 3. Look up user by phone number
    user, err := h.service.FindUserByPhone(c.Request.Context(), fromPhone)
    if err != nil {
        // Unknown user — start anonymous session
        user = UserContext{ID: "anon", Name: "there", Phone: fromPhone}
    }

    // 4. Generate session ID (1 session per phone number per day)
    sessionID := "sms:" + fromPhone + ":" + time.Now().Format("2006-01-02")

    // 5. Process message
    response, err := h.service.ProcessMessage(c.Request.Context(),
        sessionID, body, user, "sms")
    if err != nil {
        response = "Sorry, something went wrong. Please call us directly."
    }

    // 6. Respond with TwiML (Twilio Markup Language)
    twiml := `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>` + response + `</Message>
</Response>`

    c.Header("Content-Type", "text/xml")
    c.String(200, twiml)
}

// verifyTwilioSignature — important for security, prevents fake webhook calls
func (h *SMSHandler) verifyTwilioSignature(r *http.Request) bool {
    twilioSignature := r.Header.Get("X-Twilio-Signature")
    if twilioSignature == "" {
        return false
    }

    r.ParseForm()
    params := r.Form
    keys := make([]string, 0, len(params))
    for k := range params {
        keys = append(keys, k)
    }
    sort.Strings(keys)

    fullURL := "https://" + r.Host + r.URL.String()
    var sb strings.Builder
    sb.WriteString(fullURL)
    for _, k := range keys {
        sb.WriteString(k)
        sb.WriteString(url.QueryEscape(params.Get(k)))
    }

    mac := hmac.New(sha1.New, []byte(h.authToken))
    mac.Write([]byte(sb.String()))
    expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))

    return hmac.Equal([]byte(twilioSignature), []byte(expected))
}
```

---

## 🌐 Step 7 — Web Chat WebSocket Handler

```go
// GET /api/v1/chat/ws  ← Web chat widget connects here
func (h *ChatHandler) HandleWebSocket(c *gin.Context) {
    conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
    if err != nil {
        return
    }
    defer conn.Close()

    userID    := c.GetString("user_id") // from JWT middleware
    sessionID := "web:" + userID + ":" + time.Now().Format("2006-01-02-15")

    user, _ := h.userRepo.GetByID(c.Request.Context(), userID)

    for {
        _, messageBytes, err := conn.ReadMessage()
        if err != nil {
            break
        }

        response, err := h.chatbotService.ProcessMessage(
            c.Request.Context(),
            sessionID,
            string(messageBytes),
            UserContext{ID: user.ID, Name: user.Name, OrgID: user.OrgID},
            "web",
        )
        if err != nil {
            response = "Something went wrong. Please try again."
        }

        conn.WriteMessage(websocket.TextMessage, []byte(response))
    }
}
```

---

## 🌐 Step 8 — Route Registration

```go
// In your routes setup
api := router.Group("/api/v1")
{
    // SMS webhook (no auth — Twilio calls this)
    router.POST("/webhook/sms", smsHandler.HandleIncomingSMS)

    // Web chat (requires JWT auth)
    api.GET("/chat/ws", middleware.Auth(), chatHandler.HandleWebSocket)

    // Admin — view all conversations
    api.GET("/admin/conversations", middleware.AdminAuth(), adminHandler.GetConversations)
    api.GET("/admin/conversations/:session_id", middleware.AdminAuth(), adminHandler.GetConversation)
}
```

---

## 🌍 Environment Variables Needed

Add to your `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx      # already in your .env
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx         # already in your .env
TWILIO_PHONE_NUMBER=+12025551234          # already in your .env

# Register your webhook URL in Twilio console:
# Messaging → Phone Numbers → Your Number → Webhook URL:
# https://yourdomain.com/webhook/sms
```

---

## 💬 Full SMS Conversation Flow

```
1. User texts your Twilio number: "Hi, what's my wait time?"

2. Twilio → POST /webhook/sms → Your Go server

3. Go server:
   a. Verify Twilio signature ✓
   b. Look up user by phone number
   c. Load conversation history from DB
   d. Send to Claude with context + tools

4. Claude decides to call tool: get_queue_status(user_id, org_id)

5. Your Go code executes the tool → Redis ZSet → returns position 4, wait 14min

6. Claude gets tool result → generates response:
   "You're #4 in line at City Clinic with about a 14-minute wait! 🏥"

7. TwiML response → Twilio sends SMS to user ✓
```

---

## 📊 Admin Dashboard — Conversation Overview

```sql
-- See all active conversations
SELECT c.session_id, c.channel, c.status, c.last_active,
       COUNT(m.id) as message_count
FROM chat_conversations c
LEFT JOIN chat_messages m ON m.session_id = c.session_id
WHERE c.org_id = $1
  AND c.last_active > NOW() - INTERVAL '24 hours'
GROUP BY c.session_id, c.channel, c.status, c.last_active
ORDER BY c.last_active DESC;

-- Find escalated conversations needing attention
SELECT * FROM chat_conversations
WHERE org_id = $1
  AND status = 'escalated'
  AND last_active > NOW() - INTERVAL '1 hour';
```

---

## ✅ Test Your Chatbot

Use Twilio's test console or text your Twilio number:

```
"What's my queue position?"       → Returns live position from Redis
"Book an appointment for tomorrow" → Claude checks slots, books, confirms
"Cancel my appointment"            → Claude confirms, then cancels
"What documents do I need?"        → Claude reads your org FAQ table
"I need to speak to someone"       → Escalates to human agent
```

---

## 🚀 What Makes This Powerful

| Feature | Without AI | With AI Chatbot |
|---|---|---|
| Check queue position | Open app, navigate | Text "where am I" |
| Book appointment | Fill form in app | Text "book me tomorrow 3pm" |
| Cancel appointment | Find in app, tap cancel | Text "cancel my appt" |
| Ask about hours | Call the clinic | Text "what time do you close?" |
| Human agent load | Handles ALL calls | Handles 80%+ automatically |

---

> **You now have all 3 AI features fully documented. Build in this order:**
> 1. `AI_WAIT_TIME_PREDICTION.md` — adds immediate value to every user
> 2. `AI_NOSHOW_PREDICTION.md` — saves orgs money passively
> 3. `AI_RECEPTIONIST_CHATBOT.md` — most complex, highest impact
