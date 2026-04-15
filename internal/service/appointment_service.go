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
	CommuteWorker()
	QueueCommuteChecks(ctx context.Context) error
}

type appointmentService struct {
	orgRepo  repository.OrganizationRepository
	queueSvc QueueService
	bus      events.Bus
}

func NewAppointmentService(orgRepo repository.OrganizationRepository, queueSvc QueueService, bus events.Bus) AppointmentService {
	return &appointmentService{
		orgRepo:  orgRepo,
		queueSvc: queueSvc,
		bus:      bus,
	}
}

func (s *appointmentService) Book(userID uint, req models.BookAppointmentRequest) (*models.Appointment, error) {
	queueDef, err := s.orgRepo.GetQueueDefByKey(req.QueueKey)
	if err != nil {
		return nil, errors.New("queue not found")
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

	resp, err := s.queueSvc.Enqueue(appt.UserID, "patient", models.EnqueueRequest{
		QueueKey: appt.QueueKey,
		Priority: true,
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
