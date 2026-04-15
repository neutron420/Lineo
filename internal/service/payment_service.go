package service

import (
	"bytes"
	"crypto/sha256"
	"crypto/hmac"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"queueless/internal/models"
	"queueless/pkg/config"
	"queueless/pkg/db"
	"gorm.io/gorm"
)

type PaymentService interface {
	CreateRazorpayOrder(userID uint, req models.RazorpayOrderRequest) (map[string]interface{}, error)
	VerifyRazorpayPayment(userID uint, req models.RazorpayVerifyRequest) error
	ProcessRazorpayWebhook(signature string, rawBody []byte) error
}

type paymentService struct{}

func NewPaymentService() PaymentService {
	return &paymentService{}
}

func (s *paymentService) CreateRazorpayOrder(userID uint, req models.RazorpayOrderRequest) (map[string]interface{}, error) {
	keyID := config.Secret("RAZORPAY_KEY_ID")
	keySecret := config.Secret("RAZORPAY_KEY_SECRET")
	if keyID == "" || keySecret == "" {
		return nil, errors.New("razorpay credentials are not configured")
	}
	if req.Currency == "" {
		req.Currency = "INR"
	}

	bodyMap := map[string]interface{}{
		"amount":   req.Amount,
		"currency": req.Currency,
		"receipt":  req.Receipt,
	}
	body, _ := json.Marshal(bodyMap)

	httpReq, err := http.NewRequest("POST", "https://api.razorpay.com/v1/orders", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	httpReq.SetBasicAuth(keyID, keySecret)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("razorpay order create failed with status %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	providerOrderID, _ := result["id"].(string)
	payment := models.PaymentTransaction{
		OrgID:           req.OrgID,
		UserID:          userID,
		Provider:        "razorpay",
		ProviderOrderID: providerOrderID,
		AmountMinor:     req.Amount,
		Currency:        req.Currency,
		Receipt:         req.Receipt,
		Status:          models.PaymentCreated,
	}
	if err := db.DB.Create(&payment).Error; err != nil {
		return nil, err
	}

	return result, nil
}

func (s *paymentService) VerifyRazorpayPayment(userID uint, req models.RazorpayVerifyRequest) error {
	keySecret := config.Secret("RAZORPAY_KEY_SECRET")
	if keySecret == "" {
		return errors.New("razorpay secret not configured")
	}

	message := req.OrderID + "|" + req.PaymentID
	mac := hmac.New(sha256.New, []byte(keySecret))
	_, _ = mac.Write([]byte(message))
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(req.Signature)) {
		return errors.New("invalid razorpay signature")
	}

	return db.DB.Model(&models.PaymentTransaction{}).
		Where("provider_order_id = ? AND user_id = ?", req.OrderID, userID).
		Updates(map[string]interface{}{
			"provider_payment_id": req.PaymentID,
			"status":              models.PaymentVerified,
		}).Error
}

func (s *paymentService) ProcessRazorpayWebhook(signature string, rawBody []byte) error {
	keySecret := config.Secret("RAZORPAY_WEBHOOK_SECRET")
	if keySecret == "" {
		keySecret = config.Secret("RAZORPAY_KEY_SECRET")
	}
	if keySecret == "" {
		return errors.New("razorpay webhook secret not configured")
	}

	mac := hmac.New(sha256.New, []byte(keySecret))
	_, _ = mac.Write(rawBody)
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(signature)) {
		return errors.New("invalid webhook signature")
	}

	var payload models.RazorpayWebhookRequest
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return err
	}

	eventID := payload.Payload.Payment.Entity.ID
	if eventID == "" {
		// Fallback deterministic idempotency key.
		eventID = payload.Event + ":" + expected
	}
	hash := sha256.Sum256(rawBody)

	event := models.PaymentWebhookEvent{
		Provider:    "razorpay",
		EventID:     eventID,
		EventType:   payload.Event,
		PayloadHash: hex.EncodeToString(hash[:]),
		ProcessedAt: time.Now().UTC(),
	}
	if err := db.DB.Create(&event).Error; err != nil {
		// Already processed: idempotent success.
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil
		}
		// Postgres duplicate fallback (without translated errors).
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			return nil
		}
		return err
	}

	orderID := payload.Payload.Payment.Entity.OrderID
	paymentID := payload.Payload.Payment.Entity.ID
	status := payload.Payload.Payment.Entity.Status
	if orderID == "" {
		return nil
	}

	nextStatus := models.PaymentCreated
	switch status {
	case "captured":
		nextStatus = models.PaymentCaptured
	case "authorized":
		nextStatus = models.PaymentVerified
	case "failed":
		nextStatus = models.PaymentFailed
	}

	return db.DB.Model(&models.PaymentTransaction{}).
		Where("provider_order_id = ?", orderID).
		Updates(map[string]interface{}{
			"provider_payment_id": paymentID,
			"status":              nextStatus,
		}).Error
}
