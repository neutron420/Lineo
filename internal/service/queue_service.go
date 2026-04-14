package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"queueless/internal/models"
	"queueless/internal/repository"
	"queueless/pkg/db"
	"queueless/pkg/redis"
	"queueless/pkg/utils"
)

type QueueService interface {
	Enqueue(userID uint, username string, req models.EnqueueRequest) (*models.QueueResponse, error)
	EnqueueKiosk(req models.EnqueueKioskRequest) (*models.QueueResponse, error)
	GetQueueState(queueKey string) (*models.QueueState, error)
	CallNext(queueKey string, orgID uint, agentID uint) (*models.QueueEntry, error)
	MarkHolding(queueKey string, orgID uint) error
	CallFromHolding(queueKey string, tokenNumber string, orgID uint) error
	PauseQueue(queueKey string, isPaused bool, orgID uint) error
	GetUserPosition(queueKey string, tokenNumber string) (*models.QueueResponse, error)
	GetAnalytics(queueKey string, orgID uint) (*models.AnalyticsResponse, error)
	CancelTicket(queueKey string, tokenNumber string, userID uint) error
	GetLocalUpdatesChan() chan string // Exposed for the handler
}

type queueService struct {
	repo    repository.QueueRepository
	orgRepo repository.OrganizationRepository
	localUpdates chan string
}

const PubSubChannel = "queueless_updates"

func NewQueueService(repo repository.QueueRepository, orgRepo repository.OrganizationRepository) QueueService {
	s := &queueService{
		repo:    repo, 
		orgRepo: orgRepo,
		localUpdates: make(chan string, 100),
	}
	
	// Start a background subscriber for distributed updates
	go s.listenForDistributedUpdates()
	
	return s
}

func (s *queueService) GetLocalUpdatesChan() chan string {
	return s.localUpdates
}

func (s *queueService) listenForDistributedUpdates() {
	pubsub := redis.Client.Subscribe(context.Background(), PubSubChannel)
	defer pubsub.Close()

	ch := pubsub.Channel()
	for msg := range ch {
		// Pass the signal to our local handler
		select {
		case s.localUpdates <- msg.Payload:
		default:
		}
	}
}

func (s *queueService) notifyUpdate(queueKey string) {
	// Publish to Redis so ALL instances know about it
	redis.Client.Publish(context.Background(), PubSubChannel, queueKey)
}

func (s *queueService) Enqueue(userID uint, username string, req models.EnqueueRequest) (*models.QueueResponse, error) {
	queueDef, err := s.orgRepo.GetQueueDefByKey(req.QueueKey)
	if err != nil { return nil, errors.New("queue not found") }
	
	org, err := s.orgRepo.GetOrganizationByID(queueDef.OrganizationID)
	if err != nil { return nil, errors.New("organization not found") }

	if err := s.checkBusinessHours(org); err != nil { return nil, err }

	if req.Priority && org.SubscriptionStatus == "free" {
		return nil, errors.New("priority queuing is a premium feature. please upgrade.")
	}

	if org.Latitude != 0 && org.Longitude != 0 {
		if req.UserLat != 0 && req.UserLon != 0 {
			distance := utils.CalculateDistance(org.Latitude, org.Longitude, req.UserLat, req.UserLon)
			if distance > 1.0 { return nil, fmt.Errorf("geofencing block: You are %.2f km away", distance) }
		}
	}

	if queueDef.IsPaused { return nil, errors.New("queue is currently paused") }

	return s.processEnqueue(userID, username, "", false, req.Priority, req.QueueKey, queueDef.OrganizationID)
}

func (s *queueService) EnqueueKiosk(req models.EnqueueKioskRequest) (*models.QueueResponse, error) {
	queueDef, err := s.orgRepo.GetQueueDefByKey(req.QueueKey)
	if err != nil { return nil, errors.New("queue not found") }
	
	org, _ := s.orgRepo.GetOrganizationByID(queueDef.OrganizationID)
	if err := s.checkBusinessHours(org); err != nil { return nil, err }

	if queueDef.IsPaused { return nil, errors.New("queue is currently paused") }

	return s.processEnqueue(0, req.Name, req.PhoneNumber, true, false, req.QueueKey, queueDef.OrganizationID)
}

func (s *queueService) checkBusinessHours(org *models.Organization) error {
	now := time.Now()
	currentTime := now.Format("15:04")
	if currentTime < org.OpenTime || currentTime > org.CloseTime {
		return fmt.Errorf("business is currently closed. hours: %s - %s", org.OpenTime, org.CloseTime)
	}
	return nil
}

func (s *queueService) processEnqueue(userID uint, username, phone string, isKiosk, priority bool, queueKey string, orgID uint) (*models.QueueResponse, error) {
	token := s.generateToken()
	now := time.Now()

	score := float64(now.UnixNano())
	if priority { score = score - float64(time.Hour.Nanoseconds()*24) }

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
	
	// Async Persistence Feature #2 could go here with a goroutine
	if err := s.repo.SaveHistory(history); err != nil { return nil, err }
	if err := s.repo.Enqueue(queueKey, entry); err != nil { return nil, err }

	pos, _ := s.repo.GetPosition(queueKey, token)
	avgWait, _, _ := s.repo.CalculateAverages(queueKey)
	
	s.notifyUpdate(queueKey)

	return &models.QueueResponse{
		TokenNumber:   token,
		QueueKey:      queueKey,
		Position:      pos,
		EstimatedWait: pos * avgWait,
		IsVIP:         priority,
		JoinedAt:      now,
	}, nil
}

func (s *queueService) CallNext(queueKey string, orgID uint, agentID uint) (*models.QueueEntry, error) {
	if err := s.verifyOwnership(queueKey, orgID); err != nil { return nil, err }

	now := time.Now()

	currentServing, _ := s.repo.GetCurrentServing(queueKey)
	if currentServing != nil {
		var history models.QueueHistory
		db.DB.Where("token_number = ?", currentServing.TokenNumber).First(&history)
		
		if history.ServedAt != nil {
			duration := int(now.Sub(*history.ServedAt).Seconds())
			db.DB.Model(&history).Updates(map[string]interface{}{
				"status":           models.StatusCompleted,
				"completed_at":     now,
				"serving_duration": duration,
			})
		}
		
		db.DB.Model(&models.Appointment{}).Where("token_number = ?", currentServing.TokenNumber).Update("status", "completed")
	}

	nextEntry, err := s.repo.DequeueMin(queueKey)
	if err != nil || nextEntry == nil { return nil, err }

	var agent models.User
	db.DB.First(&agent, agentID)

	if err := s.repo.SetCurrentServing(queueKey, nextEntry); err != nil { return nil, err }

	nextEntry.Status = models.StatusServing
	db.DB.Model(&models.QueueHistory{}).Where("token_number = ?", nextEntry.TokenNumber).Updates(map[string]interface{}{
		"status":         models.StatusServing,
		"served_at":      now,
		"counter_number": agent.CounterNumber,
	})
	
	s.notifyUpdate(queueKey)
	return nextEntry, nil
}

func (s *queueService) generateToken() string {
	bytes := make([]byte, 4)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func (s *queueService) GetQueueState(queueKey string) (*models.QueueState, error) {
	queueDef, err := s.orgRepo.GetQueueDefByKey(queueKey)
	if err != nil { return nil, err }

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

func (s *queueService) MarkHolding(queueKey string, orgID uint) error {
	if err := s.verifyOwnership(queueKey, orgID); err != nil { return err }

	currentServing, err := s.repo.GetCurrentServing(queueKey)
	if err != nil || currentServing == nil { return errors.New("no user currently being served") }

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
	if err == nil { s.notifyUpdate(queueKey) }
	return err
}

func (s *queueService) GetUserPosition(queueKey string, tokenNumber string) (*models.QueueResponse, error) {
	pos, err := s.repo.GetPosition(queueKey, tokenNumber)
	if err != nil || pos == -1 { return nil, errors.New("token not found") }
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
	counters, _ := s.repo.GetCounterAverages(queueKey)
	
	return &models.AnalyticsResponse{
		TotalServedToday: count,
		AvgWaitTimeMins: wait,
		AvgServiceTimeMins: serve,
		PeakHours: peaks,
		CounterAverages: counters,
	}, nil
}

func (s *queueService) verifyOwnership(queueKey string, orgID uint) error {
	def, err := s.orgRepo.GetQueueDefByKey(queueKey)
	if err != nil { return errors.New("queue not found") }
	if def.OrganizationID != orgID { return errors.New("unauthorized queue access") }
	return nil
}
