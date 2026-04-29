package chatbot

import (
	"crypto/hmac"
	"crypto/sha1" // #nosec G505 - Twilio requires SHA1 for signature verification
	"encoding/base64"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type SMSHandler struct {
	service   *ChatbotService
	authToken string // TWILIO_AUTH_TOKEN
}

func NewSMSHandler(svc *ChatbotService, authToken string) *SMSHandler {
	return &SMSHandler{
		service:   svc,
		authToken: authToken,
	}
}

// POST /api/v1/webhook/sms  ← Register this URL in your Twilio console
func (h *SMSHandler) HandleIncomingSMS(c *gin.Context) {
	// 1. Verify request is genuinely from Twilio
	if !h.verifyTwilioSignature(c.Request) {
		c.JSON(http.StatusForbidden, gin.H{"error": "invalid twilio signature"})
		return
	}

	// 2. Parse Twilio webhook payload
	fromPhone := c.PostForm("From")  // e.g. "+12025551234"
	body := c.PostForm("Body")       // the user's message

	// 3. For now, create an anonymous user context based on phone number
	// In reality, you would look up the user via h.service.FindUserByPhone
	user := UserContext{
		ID:    "anon_" + fromPhone,
		Name:  "Customer",
		Phone: fromPhone,
		OrgID: "1", // Default testing org ID
	}

	// 4. Generate session ID (1 session per phone number per day)
	sessionID := "sms:" + fromPhone + ":" + time.Now().Format("2006-01-02")

	// 5. Process message
	response, err := h.service.ProcessMessage(c.Request.Context(),
		sessionID, body, user, "sms")
	if err != nil {
		response = "Sorry, something went wrong processing your message. Please try again later."
	}

	// 6. Respond with TwiML (Twilio Markup Language)
	twiml := `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>` + response + `</Message>
</Response>`

	c.Header("Content-Type", "text/xml")
	c.String(http.StatusOK, twiml)
}

// verifyTwilioSignature — important for security, prevents fake webhook calls
func (h *SMSHandler) verifyTwilioSignature(r *http.Request) bool {
	twilioSignature := r.Header.Get("X-Twilio-Signature")
	if twilioSignature == "" {
		// For local testing/development, allow it to pass if no auth token is configured
		if h.authToken == "" {
			return true
		}
		return false
	}

	if err := r.ParseForm(); err != nil {
		return false
	}
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

	// #nosec G505 - Twilio signature validation requires SHA1 HMAC as per their legacy protocol
	mac := hmac.New(sha1.New, []byte(h.authToken))
	mac.Write([]byte(sb.String()))
	expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(twilioSignature), []byte(expected))
}
