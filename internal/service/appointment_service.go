package service

import (
	"errors"
	"fmt"
	"log"
	"time"

	"queueless/internal/models"
	"queueless/internal/repository"
	"queueless/pkg/db"
	"queueless/pkg/utils"
)

type AppointmentService interface {
	Book(userID uint, req models.BookAppointmentRequest) (*models.Appointment, error)
	CheckIn(appointmentID uint, userID uint) (*models.QueueResponse, error) // Added userID for check
	GetMyAppointments(userID uint) ([]models.Appointment, error) // Privacy logic!
	CommuteWorker()
}

type appointmentService struct {
	orgRepo    repository.OrganizationRepository
	queueSvc   QueueService
	googleMaps *utils.GoogleMapsClient
}

func NewAppointmentService(orgRepo repository.OrganizationRepository, queueSvc QueueService) AppointmentService {
	return &appointmentService{
		orgRepo:    orgRepo,
		queueSvc:   queueSvc,
		googleMaps: utils.NewGoogleMapsClient(),
	}
}

func (s *appointmentService) Book(userID uint, req models.BookAppointmentRequest) (*models.Appointment, error) {
	queueDef, err := s.orgRepo.GetQueueDefByKey(req.QueueKey)
	if err != nil { return nil, errors.New("queue not found") }

	startTime, err := time.Parse("2006-01-02 15:04", req.StartTime)
	if err != nil { return nil, errors.New("invalid date format") }

	appt := &models.Appointment{
		OrganizationID: queueDef.OrganizationID,
		QueueKey:       req.QueueKey,
		UserID:         userID,
		StartTime:      startTime,
		Status:         models.ApptScheduled,
	}

	if err := db.DB.Create(appt).Error; err != nil { return nil, err }
	return appt, nil
}

func (s *appointmentService) CheckIn(appointmentID uint, userID uint) (*models.QueueResponse, error) {
	var appt models.Appointment
	// Securely find appointment by checking both ID and the logged-in UserID
	if err := db.DB.Where("id = ? AND user_id = ?", appointmentID, userID).First(&appt).Error; err != nil {
		return nil, errors.New("unauthorized or appointment not found")
	}

	if appt.Status != models.ApptScheduled {
		return nil, errors.New("appointment already processed or cancelled")
	}

	resp, err := s.queueSvc.Enqueue(appt.UserID, "patient", models.EnqueueRequest{
		QueueKey: appt.QueueKey,
		Priority: true,
	})

	if err == nil {
		appt.Status = models.ApptCheckedIn
		appt.TokenNumber = resp.TokenNumber // Link it!
		db.DB.Save(&appt)
	}

	return resp, err
}

func (s *appointmentService) GetMyAppointments(userID uint) ([]models.Appointment, error) {
	var appts []models.Appointment
	// Privacy Layer: We filter by UserID so users ONLY see their own!
	err := db.DB.Where("user_id = ?", userID).Find(&appts).Error
	return appts, err
}

func (s *appointmentService) CommuteWorker() {
	for {
		time.Sleep(1 * time.Minute)
		var upcomings []models.Appointment
		window := time.Now().Add(2 * time.Hour)
		db.DB.Where("status = ? AND start_time > ? AND start_time < ? AND commute_notified = ?", 
			models.ApptScheduled, time.Now(), window, false).Find(&upcomings)

		for _, appt := range upcomings {
			queueDef, err := s.orgRepo.GetQueueDefByKey(appt.QueueKey)
			if err != nil { continue }
			org, _ := s.orgRepo.GetOrganizationByID(queueDef.OrganizationID)
			userLat, userLon := 28.6139, 77.2090

			commute, err := s.googleMaps.GetDistanceMatrix(userLat, userLon, org.Latitude, org.Longitude)
			if err != nil { 
				log.Println("Commute Error:", err)
				continue 
			}

			leaveTime := appt.StartTime.Add(-time.Duration(commute.DurationSec) * time.Second).Add(-10 * time.Minute)
			if time.Now().After(leaveTime) {
				msg := fmt.Sprintf("Smart Alert! Traffic to %s is %s. Leave NOW to arrive on time!", org.Name, commute.DurationText)
				utils.SendSMS(appt.PhoneNumber, msg)
				appt.CommuteNotified = true
				db.DB.Save(&appt)
			}
		}
	}
}
