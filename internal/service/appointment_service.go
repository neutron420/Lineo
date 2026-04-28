package service

import (
	"context"
	"errors"
	"time"

	"queueless/internal/events"
	"queueless/internal/models"
	"queueless/internal/repository"
	"queueless/pkg/db"
)

type AppointmentService interface {
	Book(userID uint, req models.BookAppointmentRequest) (*models.Appointment, error)
	CheckIn(appointmentID uint, userID uint) (*models.QueueResponse, error)
	GetMyAppointments(userID uint) ([]models.Appointment, error)
	Reschedule(appointmentID uint, userID uint, newTime string) (*models.Appointment, error)
	Cancel(appointmentID uint, userID uint) error
	GetOrgAppointments(orgID uint) ([]models.Appointment, error)
	CommuteWorker()
	QueueCommuteChecks(ctx context.Context) error
}

type appointmentService struct {
	orgRepo  repository.OrganizationRepository
	queueSvc QueueService
	subSvc   UserSubscriptionService
	bus      events.Bus
	pushSvc  PushService
	slotRepo repository.SlotAnalyticsRepository
}

func NewAppointmentService(orgRepo repository.OrganizationRepository, queueSvc QueueService, subSvc UserSubscriptionService, bus events.Bus, pushSvc PushService, slotRepo ...repository.SlotAnalyticsRepository) AppointmentService {
	svc := &appointmentService{
		orgRepo:  orgRepo,
		queueSvc: queueSvc,
		subSvc:   subSvc,
		bus:      bus,
		pushSvc:  pushSvc,
	}
	if len(slotRepo) > 0 {
		svc.slotRepo = slotRepo[0]
	}
	return svc
}

func (s *appointmentService) Book(userID uint, req models.BookAppointmentRequest) (*models.Appointment, error) {
	queueDef, err := s.orgRepo.GetQueueDefByKey(req.QueueKey)
	if err != nil {
		return nil, errors.New("queue not found")
	}

	// Check subscription limit
	if err := s.subSvc.CheckApptLimit(userID); err != nil {
		return nil, err
	}

	startTime, err := time.Parse("2006-01-02 15:04", req.StartTime)
	if err != nil {
		return nil, errors.New("invalid date format")
	}

	appt := &models.Appointment{
		OrganizationID: queueDef.OrganizationID,
		QueueKey:       req.QueueKey,
		UserID:         userID,
		StartTime:      startTime,
		Status:         models.ApptScheduled,
		UserLat:        req.UserLat,
		UserLon:        req.UserLon,
	}

	if err := db.DB.Create(appt).Error; err != nil {
		return nil, err
	}

	// Increment usage
	_ = s.subSvc.IncrementAppts(userID)

	// AI Smart Slot: Learn user preferences from this booking
	if s.slotRepo != nil {
		go func() {
			_ = s.slotRepo.UpdateUserPreferences(userID, startTime.Hour(), int(startTime.Weekday()))
		}()
	}

	// Push notification: appointment confirmed
	if s.pushSvc != nil {
		go func() {
			_ = s.pushSvc.SendToUser(context.Background(), userID, PushPayload{
				Title:     "Appointment Confirmed",
				Body:      "Your appointment on " + appt.StartTime.Format("Jan 02 at 03:04 PM") + " has been booked.",
				URL:       "/dashboard/appointments",
				NotifType: "appointment",
			})
		}()
	}

	if s.bus != nil {
		_ = s.bus.PublishCommuteTrigger(context.Background(), events.CommuteTriggerJob{
			AppointmentID:    appt.ID,
			UserID:           appt.UserID,
			OrgID:            appt.OrganizationID,
			QueueKey:         appt.QueueKey,
			AppointmentTime:  appt.StartTime,
			UserLat:          appt.UserLat,
			UserLng:          appt.UserLon,
			PhoneNumber:      appt.PhoneNumber,
			ThresholdMinutes: 10,
			RequestedAt:      time.Now().UTC(),
		})
	}

	return appt, nil
}

func (s *appointmentService) CheckIn(appointmentID uint, userID uint) (*models.QueueResponse, error) {
	var appt models.Appointment
	if err := db.DB.Where("id = ? AND user_id = ?", appointmentID, userID).First(&appt).Error; err != nil {
		return nil, errors.New("unauthorized or appointment not found")
	}

	if appt.Status != models.ApptScheduled {
		return nil, errors.New("appointment already processed or cancelled")
	}

	var user models.User
	if err := db.DB.First(&user, appt.UserID).Error; err != nil {
		return nil, errors.New("failed to verify user profile")
	}

	resp, err := s.queueSvc.Enqueue(appt.UserID, user.Username, models.EnqueueRequest{
		QueueKey: appt.QueueKey,
		Priority: user.HasDisability, // Dynamically prioritize based on disability disclosure
		UserLat:  appt.UserLat,
		UserLon:  appt.UserLon,
	})

	if err == nil {
		appt.Status = models.ApptCheckedIn
		appt.TokenNumber = resp.TokenNumber
		db.DB.Save(&appt)
	}

	return resp, err
}

func (s *appointmentService) GetMyAppointments(userID uint) ([]models.Appointment, error) {
	var appts []models.Appointment
	err := db.DB.Where("user_id = ?", userID).Find(&appts).Error
	return appts, err
}

func (s *appointmentService) GetOrgAppointments(orgID uint) ([]models.Appointment, error) {
	var appts []models.Appointment
	// Preload User to get the user names for the org dashboard
	err := db.DB.Preload("User").Where("organization_id = ?", orgID).Order("start_time asc").Find(&appts).Error
	return appts, err
}

func (s *appointmentService) Reschedule(appointmentID uint, userID uint, newTime string) (*models.Appointment, error) {
	var appt models.Appointment
	if err := db.DB.Where("id = ? AND user_id = ?", appointmentID, userID).First(&appt).Error; err != nil {
		return nil, errors.New("appointment not found")
	}

	startTime, err := time.Parse("2006-01-02 15:04", newTime)
	if err != nil {
		return nil, errors.New("invalid date format")
	}

	appt.StartTime = startTime
	appt.Status = models.ApptScheduled // Reset status if it was something else
	appt.CommuteNotified = false      // Reset commute notification

	if err := db.DB.Save(&appt).Error; err != nil {
		return nil, err
	}

	// Re-trigger commute check if needed
	if s.bus != nil {
		_ = s.bus.PublishCommuteTrigger(context.Background(), events.CommuteTriggerJob{
			AppointmentID:    appt.ID,
			UserID:           appt.UserID,
			OrgID:            appt.OrganizationID,
			QueueKey:         appt.QueueKey,
			AppointmentTime:  appt.StartTime,
			UserLat:          appt.UserLat,
			UserLng:          appt.UserLon,
			PhoneNumber:      appt.PhoneNumber,
			ThresholdMinutes: 10,
			RequestedAt:      time.Now().UTC(),
		})
	}

	return &appt, nil
}

func (s *appointmentService) Cancel(appointmentID uint, userID uint) error {
	var appt models.Appointment
	if err := db.DB.Where("id = ? AND user_id = ?", appointmentID, userID).First(&appt).Error; err != nil {
		return errors.New("appointment not found")
	}

	appt.Status = models.ApptCancelled
	return db.DB.Save(&appt).Error
}

// Deprecated legacy entrypoint kept for interface compatibility.
func (s *appointmentService) CommuteWorker() {}

func (s *appointmentService) QueueCommuteChecks(ctx context.Context) error {
	window := time.Now().Add(2 * time.Hour)
	var upcomings []models.Appointment
	if err := db.DB.Where(
		"status = ? AND start_time > ? AND start_time < ? AND commute_notified = ?",
		models.ApptScheduled, time.Now(), window, false,
	).Find(&upcomings).Error; err != nil {
		return err
	}

	if s.bus == nil {
		return nil
	}

	for _, appt := range upcomings {
		_ = s.bus.PublishCommuteTrigger(ctx, events.CommuteTriggerJob{
			AppointmentID:    appt.ID,
			UserID:           appt.UserID,
			OrgID:            appt.OrganizationID,
			QueueKey:         appt.QueueKey,
			AppointmentTime:  appt.StartTime,
			UserLat:          appt.UserLat,
			UserLng:          appt.UserLon,
			PhoneNumber:      appt.PhoneNumber,
			ThresholdMinutes: 10,
			RequestedAt:      time.Now().UTC(),
		})
	}

	return nil
}
