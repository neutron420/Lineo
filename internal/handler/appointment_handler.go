package handler

import (
	"log/slog"
	"net/http"
	"strconv"

	"queueless/internal/models"
	"queueless/internal/service"
	"queueless/pkg/utils"

	"github.com/gin-gonic/gin"
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
		utils.RespondError(c, http.StatusBadRequest, "Check-in failed", err.Error())
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

func (h *AppointmentHandler) ListForOrg(c *gin.Context) {
	orgIDRaw, exists := c.Get("organizationID")
	if !exists || orgIDRaw == nil {
		utils.RespondError(c, http.StatusForbidden, "Forbidden", "Organization context missing")
		return
	}

	var orgID uint
	switch v := orgIDRaw.(type) {
	case uint:
		orgID = v
	case *uint:
		if v == nil {
			utils.RespondError(c, http.StatusForbidden, "Forbidden", "Organization ID is null")
			return
		}
		orgID = *v
	default:
		utils.RespondError(c, http.StatusInternalServerError, "Server Error", "Invalid organization ID type")
		return
	}

	appts, err := h.apptService.GetOrgAppointments(orgID)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to fetch organization appointments", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Organization appointments", appts)
}

func (h *AppointmentHandler) Reschedule(c *gin.Context) {
	idStr := c.Param("id")
	id, _ := strconv.Atoi(idStr)
	userID := c.MustGet("userID").(uint)

	var req struct {
		StartTime string `json:"start_time" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}

	appt, err := h.apptService.Reschedule(uint(id), userID, req.StartTime)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Reschedule failed", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Appointment rescheduled", appt)
}

func (h *AppointmentHandler) Cancel(c *gin.Context) {
	idStr := c.Param("id")
	id, _ := strconv.Atoi(idStr)
	userID := c.MustGet("userID").(uint)

	slog.Info("attempting to cancel appointment", "id", id, "user", userID)
	err := h.apptService.Cancel(uint(id), userID)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Cancel failed", err.Error())
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "Appointment cancelled", nil)
}

