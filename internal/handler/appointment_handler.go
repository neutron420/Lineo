package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"queueless/internal/models"
	"queueless/internal/service"
	"queueless/pkg/utils"
)

type AppointmentHandler struct {
	apptService service.AppointmentService
}

func NewAppointmentHandler(s service.AppointmentService) *AppointmentHandler {
	return &AppointmentHandler{apptService: s}
}

func (h *AppointmentHandler) Book(c *gin.Context) {
	var req models.BookAppointmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	userID := c.MustGet("userID").(uint)
	appt, err := h.apptService.Book(userID, req)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Booking failed", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusCreated, "Appointment scheduled", appt)
}

func (h *AppointmentHandler) CheckIn(c *gin.Context) {
	idStr := c.Param("id")
	id, _ := strconv.Atoi(idStr)
	userID := c.MustGet("userID").(uint) // Extract for privacy check

	resp, err := h.apptService.CheckIn(uint(id), userID)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Check-in failed", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Checked in successfully. You are now in the live queue!", resp)
}

func (h *AppointmentHandler) List(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	appts, err := h.apptService.GetMyAppointments(userID)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to fetch appointments", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Your appointments", appts)
}

