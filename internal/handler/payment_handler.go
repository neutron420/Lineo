package handler

import (
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"queueless/internal/models"
	"queueless/internal/service"
	"queueless/pkg/utils"
)

type PaymentHandler struct {
	paymentService service.PaymentService
}

func NewPaymentHandler(paymentService service.PaymentService) *PaymentHandler {
	return &PaymentHandler{paymentService: paymentService}
}

func (h *PaymentHandler) CreateRazorpayOrder(c *gin.Context) {
	var req models.RazorpayOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	userID := c.MustGet("userID").(uint)
	order, err := h.paymentService.CreateRazorpayOrder(userID, req)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Payment order failed", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Razorpay order created", order)
}

func (h *PaymentHandler) VerifyRazorpayPayment(c *gin.Context) {
	var req models.RazorpayVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	userID := c.MustGet("userID").(uint)
	if err := h.paymentService.VerifyRazorpayPayment(userID, req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Payment verification failed", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Payment verified", gin.H{"status": "verified"})
}

func (h *PaymentHandler) RazorpayWebhook(c *gin.Context) {
	signature := c.GetHeader("X-Razorpay-Signature")
	if signature == "" {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", "missing webhook signature")
		return
	}

	rawBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	if err := h.paymentService.ProcessRazorpayWebhook(signature, rawBody); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Webhook processing failed", err.Error())
		return
	}
	utils.RespondSuccess(c, http.StatusOK, "Webhook processed", gin.H{"status": "ok"})
}
