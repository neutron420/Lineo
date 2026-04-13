package service

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"queueless/internal/models"
	"queueless/internal/repository"
	"queueless/pkg/db"
	"queueless/pkg/utils"
)

type QueueService interface {
	Enqueue(userID uint, username string, req models.EnqueueRequest) (*models.QueueResponse, error)
	EnqueueKiosk(req models.EnqueueKioskRequest) (*models.QueueResponse, error)
	GetQueueState(queueKey string) (*models.QueueState, error)
	CallNext(queueKey string, orgID uint) (*models.QueueEntry, error)
	MarkHolding(queueKey string, orgID uint) error
	CallFromHolding(queueKey string, tokenNumber string, orgID uint) error
	PauseQueue(queueKey string, isPaused bool, orgID uint) error
	GetUserPosition(queueKey string, tokenNumber string) (*models.QueueResponse, error)
	GetAnalytics(queueKey string, orgID uint) (*models.AnalyticsResponse, error)
	CancelTicket(queueKey string, tokenNumber string, userID uint) error
}

type queueService struct {
	repo    repository.QueueRepository
	orgRepo repository.OrganizationRepository
}

var Broadcast = make(chan string)

func NewQueueService(repo repository.QueueRepository, orgRepo repository.OrganizationRepository) QueueService {
	return &queueService{repo: repo, orgRepo: orgRepo}
}

func generateToken() string {
	bytes := make([]byte, 4)
	if _, err := rand.Read(bytes); err != nil {
		return time.Now().Format("150405")
	}
	return hex.EncodeToString(bytes)
}

func (s *queueService) Enqueue(userID uint, username string, req models.EnqueueRequest) (*models.QueueResponse, error) {
	queueDef, err := s.orgRepo.GetQueueDefByKey(req.QueueKey)
	if err != nil {
		return nil, errors.New("queue not found")
	}
	
	// Geofencing Check
	org, err := s.orgRepo.GetOrganizationByID(queueDef.OrganizationID)
	if err == nil && org.Latitude != 0 && org.Longitude != 0 {
		if req.UserLat != 0 && req.UserLon != 0 {
			distance := utils.CalculateDistance(org.Latitude, org.Longitude, req.UserLat, req.UserLon)
			if distance > 1.0 { // 1 km radius
				return nil, fmt.Errorf("geofencing block: You are %.2f km away, must be within 1km", distance)
			}
		}
	}

	if queueDef.IsPaused {
		return nil, errors.New("queue is currently paused")
	}

	return s.processEnqueue(userID, username, "", false, req.Priority, req.QueueKey, queueDef.OrganizationID)
}

func (s *queueService) EnqueueKiosk(req models.EnqueueKioskRequest) (*models.QueueResponse, error) {
	queueDef, err := s.orgRepo.GetQueueDefByKey(req.QueueKey)
	if err != nil {
		return nil, errors.New("queue not found")
	}
	if queueDef.IsPaused {
		return nil, errors.New("queue is currently paused")
	}

	// Kiosk users are marked with UserID 0, IsKiosk true, and carry phone numbers for SMS
	return s.processEnqueue(0, req.Name, req.PhoneNumber, true, false, req.QueueKey, queueDef.OrganizationID)
}

func (s *queueService) processEnqueue(userID uint, username, phone string, isKiosk, priority bool, queueKey string, orgID uint) (*models.QueueResponse, error) {
	token := generateToken()
	now := time.Now()

	score := float64(now.UnixNano())
	if priority {
		score = score - float64(time.Hour.Nanoseconds()*24)
	}

	entry := &models.QueueEntry{
		TokenNumber: token,
		UserID:      userID,
		Username:    username,
		PhoneNumber: phone,
		IsKiosk:     isKiosk,
		Priority:    priority,
		Status:      models.StatusWaiting,
		JoinedAt:    now,
		Score:       score,
	}

	history := &models.QueueHistory{
		OrganizationID: orgID,
		QueueKey:       queueKey,
		TokenNumber:    token,
		UserID:         userID,
		PhoneNumber:    phone,
		IsKiosk:        isKiosk,
		Status:         models.StatusWaiting,
		Priority:       priority,
		JoinedAt:       now,
	}
	
	if err := s.repo.SaveHistory(history); err != nil { return nil, err }
	if err := s.repo.Enqueue(queueKey, entry); err != nil { return nil, err }

	pos, _ := s.repo.GetPosition(queueKey, token)
	avgWait, _, _ := s.repo.CalculateAverages(queueKey)
	
	baseURL := "https://queueless.app"
	qrLink := fmt.Sprintf("%s/join?q=%s", baseURL, queueKey)

	s.notifyUpdate(queueKey)

	return &models.QueueResponse{
		TokenNumber:   token,
		QueueKey:      queueKey,
		Position:      pos,
		EstimatedWait: pos * avgWait,
		IsVIP:         priority,
		JoinedAt:      now,
		QRCodeURL:     qrLink,
	}, nil
}


func (s *queueService) GetQueueState(queueKey string) (*models.QueueState, error) {
	queueDef, err := s.orgRepo.GetQueueDefByKey(queueKey)
	if err != nil {
		return nil, err
	}

	serving, _ := s.repo.GetCurrentServing(queueKey)
	waiting, _ := s.repo.GetQueueList(queueKey)
	holding, _ := s.repo.GetHoldingList(queueKey)
	_, avgService, _ := s.repo.CalculateAverages(queueKey)

	return &models.QueueState{
		QueueKey:         queueKey,
		IsPaused:         queueDef.IsPaused,
		EstServiceTime:   avgService,
		CurrentlyServing: serving,
		HoldingList:      holding,
		WaitingList:      waiting,
	}, nil
}

func (s *queueService) CallNext(queueKey string, orgID uint) (*models.QueueEntry, error) {
	if err := s.verifyOwnership(queueKey, orgID); err != nil { return nil, err }

	now := time.Now()

	currentServing, _ := s.repo.GetCurrentServing(queueKey)
	if currentServing != nil {
		s.repo.UpdateHistoryStatus(currentServing.TokenNumber, models.StatusCompleted, &now)
		// Sync Lifecycle: If this was a booked appointment, update that too!
		db.DB.Model(&models.Appointment{}).Where("token_number = ?", currentServing.TokenNumber).Update("status", "completed")
	}

	nextEntry, err := s.repo.DequeueMin(queueKey)
	if err != nil {
		return nil, err
	}

	if err := s.repo.SetCurrentServing(queueKey, nextEntry); err != nil {
		return nil, err
	}

	if nextEntry != nil {
		nextEntry.Status = models.StatusServing
		s.repo.UpdateHistoryStatus(nextEntry.TokenNumber, models.StatusServing, &now)
	}
	
	s.checkUpcomingSMS(queueKey)
	s.notifyUpdate(queueKey)
	
	return nextEntry, nil
}

func (s *queueService) checkUpcomingSMS(queueKey string) {
	// SMS Tracker: Check who is 3rd in line and send a Twilio warning
	waiting, err := s.repo.GetQueueList(queueKey)
	if err == nil && len(waiting) >= 3 {
		thirdPerson := waiting[2] // Index 2 is the 3rd person
		if thirdPerson.PhoneNumber != "" {
			msg := fmt.Sprintf("Hi %s! You are currently 3rd in line for %s. Please start making your way to the counter.", thirdPerson.Username, queueKey)
			go utils.SendSMS(thirdPerson.PhoneNumber, msg) // Async SMS trigger
		}
	}
}

func (s *queueService) MarkHolding(queueKey string, orgID uint) error {
	if err := s.verifyOwnership(queueKey, orgID); err != nil { return err }

	currentServing, err := s.repo.GetCurrentServing(queueKey)
	if err != nil || currentServing == nil {
		return errors.New("no user currently being served")
	}

	now := time.Now()
	currentServing.Status = models.StatusHolding

	s.repo.HoldToken(queueKey, currentServing)
	s.repo.SetCurrentServing(queueKey, nil)
	s.repo.UpdateHistoryStatus(currentServing.TokenNumber, models.StatusHolding, &now)
	
	s.notifyUpdate(queueKey)
	return nil
}

func (s *queueService) CallFromHolding(queueKey string, tokenNumber string, orgID uint) error {
	if err := s.verifyOwnership(queueKey, orgID); err != nil { return err }
	return nil
}

func (s *queueService) PauseQueue(queueKey string, isPaused bool, orgID uint) error {
	if err := s.verifyOwnership(queueKey, orgID); err != nil { return err }
	
	err := s.orgRepo.UpdateQueueDefPause(queueKey, isPaused)
	if err == nil {
		s.notifyUpdate(queueKey)
	}
	return err
}

func (s *queueService) GetUserPosition(queueKey string, tokenNumber string) (*models.QueueResponse, error) {
	pos, err := s.repo.GetPosition(queueKey, tokenNumber)
	if err != nil {
		return nil, err
	}
	if pos == -1 {
		return nil, errors.New("token not found in waiting list")
	}
	avgWait, _, _ := s.repo.CalculateAverages(queueKey)

	return &models.QueueResponse{
		TokenNumber:   tokenNumber,
		QueueKey:      queueKey,
		Position:      pos,
		EstimatedWait: pos * avgWait,
	}, nil
}

func (s *queueService) CancelTicket(queueKey string, tokenNumber string, userID uint) error {
	now := time.Now()
	err := s.repo.RemoveFromQueue(queueKey, tokenNumber)
	s.repo.UpdateHistoryStatus(tokenNumber, models.StatusCancelled, &now)
	s.notifyUpdate(queueKey)
	return err
}

func (s *queueService) GetAnalytics(queueKey string, orgID uint) (*models.AnalyticsResponse, error) {
	if err := s.verifyOwnership(queueKey, orgID); err != nil { return nil, err }
	
	count, _ := s.repo.GetDailyCount(queueKey)
	wait, serve, _ := s.repo.CalculateAverages(queueKey)
	peaks, _ := s.repo.GetPeakHours(queueKey)
	
	return &models.AnalyticsResponse{
		TotalServedToday: count,
		AvgWaitTimeMins: wait,
		AvgServiceTimeMins: serve,
		PeakHours: peaks,
	}, nil
}

func (s *queueService) verifyOwnership(queueKey string, orgID uint) error {
	def, err := s.orgRepo.GetQueueDefByKey(queueKey)
	if err != nil { return errors.New("queue not found") }
	if def.OrganizationID != orgID { return errors.New("unauthorized queue access") }
	return nil
}

func (s *queueService) notifyUpdate(queueKey string) {
	select { case Broadcast <- queueKey: default: }
}
