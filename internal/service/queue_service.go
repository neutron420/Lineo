package service

import (
	"context"
	cryptorand "crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"sync"
	"time"

	"golang.org/x/time/rate"

	"queueless/internal/events"
	"queueless/internal/models"
	"queueless/internal/repository"
	"queueless/internal/ticket"
	"queueless/pkg/db"
	"queueless/pkg/metrics"
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
	GetActiveTicket(userID uint) (*models.QueueResponse, error)
	GetUserHistory(userID uint) ([]models.QueueHistory, error)
	MarkNoShow(queueKey string, tokenNumber string, orgID uint, actorID uint) error
	ReorderPriority(queueKey, tokenNumber string, position int, orgID uint, actorID uint) error
	GetTicketStatus(tokenNumber string) (*models.QueueHistory, error)
	GetPeakHoursByOrg(orgID uint, rangeExpr string) (map[string]int, error)
}

type queueService struct {
	repo    repository.QueueRepository
	orgRepo repository.OrganizationRepository
	bus     events.Bus

	limiters   sync.Map
	limiterRPS rate.Limit
}

func NewQueueService(repo repository.QueueRepository, orgRepo repository.OrganizationRepository, bus events.Bus) QueueService {
	return &queueService{
		repo:       repo,
		orgRepo:    orgRepo,
		bus:        bus,
		limiterRPS: 8,
	}
}

func (s *queueService) limiterForOrg(orgID uint) *rate.Limiter {
	if limiter, ok := s.limiters.Load(orgID); ok {
		return limiter.(*rate.Limiter)
	}
	created := rate.NewLimiter(s.limiterRPS, 20)
	actual, _ := s.limiters.LoadOrStore(orgID, created)
	return actual.(*rate.Limiter)
}

func (s *queueService) Enqueue(userID uint, username string, req models.EnqueueRequest) (*models.QueueResponse, error) {
	queueDef, err := s.orgRepo.GetQueueDefByKey(req.QueueKey)
	if err != nil {
		return nil, errors.New("queue not found")
	}

	if !s.limiterForOrg(queueDef.OrganizationID).Allow() {
		return nil, errors.New("organization queue joins are currently rate-limited")
	}

	org, err := s.orgRepo.GetOrganizationByID(queueDef.OrganizationID)
	if err != nil {
		return nil, errors.New("organization not found")
	}

	cfg, err := s.orgRepo.GetOrCreateOrgConfig(queueDef.OrganizationID)
	if err != nil {
		return nil, err
	}

	if err := s.checkBusinessHours(org, cfg); err != nil {
		return nil, err
	}

	if req.Priority && org.SubscriptionStatus == "free" {
		return nil, errors.New("priority queuing is a premium feature. please upgrade")
	}

	if cfg.GeofenceRadiusMeters <= 0 {
		cfg.GeofenceRadiusMeters = 1000
	}

	if org.Latitude != 0 && org.Longitude != 0 && req.UserLat != 0 && req.UserLon != 0 {
		distanceKM := utils.CalculateDistance(org.Latitude, org.Longitude, req.UserLat, req.UserLon)
		distanceMeters := distanceKM * 1000
		if distanceMeters > float64(cfg.GeofenceRadiusMeters) {
			return nil, fmt.Errorf("geofencing block: you are %.0f meters away", distanceMeters)
		}
	}

	if queueDef.IsPaused {
		return nil, errors.New("queue is currently paused")
	}

	waiting, err := s.repo.GetQueueList(req.QueueKey)
	if err == nil && cfg.MaxQueueSize > 0 && len(waiting) >= cfg.MaxQueueSize {
		return nil, errors.New("queue is full for this organization")
	}

	return s.processEnqueue(userID, username, "", false, req.Priority, req.QueueKey, queueDef.OrganizationID, req.UserLat, req.UserLon)
}

func (s *queueService) EnqueueKiosk(req models.EnqueueKioskRequest) (*models.QueueResponse, error) {
	queueDef, err := s.orgRepo.GetQueueDefByKey(req.QueueKey)
	if err != nil {
		return nil, errors.New("queue not found")
	}

	org, err := s.orgRepo.GetOrganizationByID(queueDef.OrganizationID)
	if err != nil {
		return nil, errors.New("organization not found")
	}
	cfg, cfgErr := s.orgRepo.GetOrCreateOrgConfig(queueDef.OrganizationID)
	if cfgErr != nil {
		return nil, cfgErr
	}
	if err := s.checkBusinessHours(org, cfg); err != nil {
		return nil, err
	}

	if queueDef.IsPaused {
		return nil, errors.New("queue is currently paused")
	}

	return s.processEnqueue(0, req.Name, req.PhoneNumber, true, false, req.QueueKey, queueDef.OrganizationID, 0, 0)
}

func (s *queueService) checkBusinessHours(org *models.Organization, cfg *models.OrganizationConfig) error {
	openTime := org.OpenTime
	closeTime := org.CloseTime
	if cfg != nil && len(cfg.OperatingHoursJSON) > 0 {
		var payload struct {
			OpenTime  string `json:"open_time"`
			CloseTime string `json:"close_time"`
		}
		if err := json.Unmarshal([]byte(cfg.OperatingHoursJSON), &payload); err == nil {
			if payload.OpenTime != "" {
				openTime = payload.OpenTime
			}
			if payload.CloseTime != "" {
				closeTime = payload.CloseTime
			}
		}
	}

	now := time.Now()
	currentTime := now.Format("15:04")
	if currentTime < openTime || currentTime > closeTime {
		return fmt.Errorf("business is currently closed. hours: %s - %s", openTime, closeTime)
	}
	return nil
}

func (s *queueService) processEnqueue(userID uint, username, phone string, isKiosk, priority bool, queueKey string, orgID uint, userLat, userLon float64) (*models.QueueResponse, error) {
	token := s.generateToken()
	now := time.Now()

	score := float64(now.UnixNano())
	if priority {
		score = score - float64(24*time.Hour.Nanoseconds())
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
		Status:         models.StatusPending,
		Priority:       priority,
		UserLat:        userLat,
		UserLon:        userLon,
		JoinedAt:       now,
	}

	if err := s.repo.SaveHistory(history); err != nil {
		return nil, err
	}
	if err := s.repo.Enqueue(queueKey, entry); err != nil {
		return nil, err
	}

	if err := s.transitionTicket(orgID, 0, queueKey, token, models.StatusPending, models.StatusWaiting, map[string]interface{}{"priority": priority}); err != nil {
		return nil, err
	}
	metrics.IncQueueJoin(orgID)

	pos, _ := s.repo.GetPosition(queueKey, token)
	avgWait, _, _ := s.repo.CalculateAverages(queueKey)

	return &models.QueueResponse{
		TokenNumber:    token,
		QueueKey:       queueKey,
		OrganizationID: orgID,
		Position:       pos,
		EstimatedWait:  pos * avgWait,
		IsVIP:          priority,
		JoinedAt:       now,
	}, nil
}

func (s *queueService) CallNext(queueKey string, orgID uint, agentID uint) (*models.QueueEntry, error) {
	if err := s.verifyOwnership(queueKey, orgID); err != nil {
		return nil, err
	}

	now := time.Now()

	currentServing, _ := s.repo.GetCurrentServing(queueKey)
	if currentServing != nil {
		var history models.QueueHistory
		db.DB.Where("token_number = ?", currentServing.TokenNumber).First(&history)

		if history.ServedAt != nil {
			duration := int(now.Sub(*history.ServedAt).Seconds())
			db.DB.Model(&history).Updates(map[string]interface{}{
				"serving_duration": duration,
			})
		}

		if err := s.transitionTicket(orgID, agentID, queueKey, currentServing.TokenNumber, models.StatusServing, models.StatusCompleted, nil); err != nil {
			return nil, err
		}
			db.DB.Model(&models.Appointment{}).Where("token_number = ?", currentServing.TokenNumber).Update("status", models.ApptCompleted)
	}

	nextEntry, err := s.repo.DequeueMin(queueKey)
	if err != nil || nextEntry == nil {
		return nil, err
	}

	if err := s.transitionTicket(orgID, agentID, queueKey, nextEntry.TokenNumber, models.StatusWaiting, models.StatusCalled, nil); err != nil {
		return nil, err
	}
	if history, historyErr := s.repo.GetHistoryByToken(nextEntry.TokenNumber); historyErr == nil {
		metrics.ObserveQueueWaitDuration(time.Since(history.JoinedAt).Seconds())
	}
	if err := s.transitionTicket(orgID, agentID, queueKey, nextEntry.TokenNumber, models.StatusCalled, models.StatusServing, nil); err != nil {
		return nil, err
	}

	var agent models.User
	db.DB.First(&agent, agentID)

	nextEntry.Status = models.StatusServing
	if err := s.repo.SetCurrentServing(queueKey, nextEntry); err != nil {
		return nil, err
	}

	nowServing := time.Now()
	db.DB.Model(&models.QueueHistory{}).Where("token_number = ?", nextEntry.TokenNumber).Updates(map[string]interface{}{
		"served_at":      nowServing,
		"counter_number": agent.CounterNumber,
	})

	return nextEntry, nil
}

func (s *queueService) transitionTicket(orgID, actorID uint, queueKey, token string, from, to models.QueueStatus, metadata map[string]interface{}) error {
	if err := ticket.ValidateTransition(ticket.State(from), ticket.State(to)); err != nil {
		return err
	}

	now := time.Now()
	if err := s.repo.UpdateHistoryStatus(token, to, &now); err != nil {
		return err
	}

	if s.bus != nil {
		event := events.QueueEvent{
			EventID:     fmt.Sprintf("%s-%d", token, time.Now().UnixNano()),
			OrgID:       orgID,
			QueueKey:    queueKey,
			TokenNumber: token,
			ActorID:     actorID,
			FromState:   string(from),
			NewState:    string(to),
			OccurredAt:  now.UTC(),
			Metadata:    metadata,
		}
		if err := s.bus.PublishQueueEvent(context.Background(), event); err != nil {
			return err
		}
	}

	if to == models.StatusCompleted || to == models.StatusNoShow {
		nextStatus := models.ApptCompleted
		if to == models.StatusNoShow {
			nextStatus = models.ApptNoShow
		}
		db.DB.Model(&models.Appointment{}).Where("token_number = ?", token).Update("status", nextStatus)

		// Trigger feedback SMS for completed tickets
		if to == models.StatusCompleted {
			go func() {
				var history models.QueueHistory
				if err := db.DB.Where("token_number = ?", token).First(&history).Error; err == nil && (history.PhoneNumber != "" || history.UserID != 0) {
					phone := history.PhoneNumber
					if phone == "" && history.UserID != 0 {
						var user models.User
						db.DB.First(&user, history.UserID)
						phone = user.PhoneNumber
					}

					if phone != "" {
						msg := fmt.Sprintf("How was your visit at Lineo? Rate your experience: http://lineo.ai/rate/%s", token)
						_ = s.bus.PublishSMSNotification(context.Background(), events.SMSNotification{
							OrgID:       orgID,
							UserID:      history.UserID,
							PhoneNumber: phone,
							Message:     msg,
							Type:        "feedback_request",
							CreatedAt:   time.Now().UTC(),
						})
					}
				}
			}()
		}
	}

	return nil
}

func (s *queueService) generateToken() string {
	n, err := cryptorand.Int(cryptorand.Reader, big.NewInt(9000))
	if err != nil {
		return fmt.Sprintf("TK-%d", time.Now().UnixNano()%10000+1000)
	}
	num := 1000 + int(n.Int64())
	return fmt.Sprintf("TK-%d", num)
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

func (s *queueService) MarkHolding(queueKey string, orgID uint) error {
	if err := s.verifyOwnership(queueKey, orgID); err != nil {
		return err
	}

	currentServing, err := s.repo.GetCurrentServing(queueKey)
	if err != nil || currentServing == nil {
		return errors.New("no user currently being served")
	}

	now := time.Now()
	currentServing.Status = models.StatusHolding

	if err := s.repo.HoldToken(queueKey, currentServing); err != nil {
		return err
	}
	if err := s.repo.SetCurrentServing(queueKey, nil); err != nil {
		return err
	}
	return s.repo.UpdateHistoryStatus(currentServing.TokenNumber, models.StatusHolding, &now)
}

func (s *queueService) CallFromHolding(queueKey string, tokenNumber string, orgID uint) error {
	if err := s.verifyOwnership(queueKey, orgID); err != nil {
		return err
	}
	return nil
}

func (s *queueService) PauseQueue(queueKey string, isPaused bool, orgID uint) error {
	if err := s.verifyOwnership(queueKey, orgID); err != nil {
		return err
	}

	return s.orgRepo.UpdateQueueDefPause(queueKey, isPaused)
}

func (s *queueService) GetUserPosition(queueKey string, tokenNumber string) (*models.QueueResponse, error) {
	pos, err := s.repo.GetPosition(queueKey, tokenNumber)
	if err != nil || pos == -1 {
		return nil, errors.New("token not found")
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
	history, err := s.repo.GetHistoryByToken(tokenNumber)
	if err == nil && history.UserID != userID {
		return errors.New("unauthorized cancellation")
	}

	now := time.Now()
	err = s.repo.RemoveFromQueue(queueKey, tokenNumber)
	if err != nil {
		return err
	}
	return s.repo.UpdateHistoryStatus(tokenNumber, models.StatusCancelled, &now)
}

func (s *queueService) MarkNoShow(queueKey string, tokenNumber string, orgID uint, actorID uint) error {
	if err := s.verifyOwnership(queueKey, orgID); err != nil {
		return err
	}

	h, err := s.repo.GetHistoryByToken(tokenNumber)
	if err != nil {
		return err
	}

	from := h.Status
	if from == models.StatusCompleted || from == models.StatusNoShow || from == models.StatusCancelled {
		return errors.New("ticket already finalized")
	}
	return s.transitionTicket(orgID, actorID, queueKey, tokenNumber, from, models.StatusNoShow, nil)
}

func (s *queueService) ReorderPriority(queueKey, tokenNumber string, position int, orgID uint, actorID uint) error {
	if err := s.verifyOwnership(queueKey, orgID); err != nil {
		return err
	}
	if position < 1 {
		return errors.New("position must be >= 1")
	}

	score := float64(time.Now().UnixNano()) - float64(position*int(time.Minute))
	if err := s.repo.ReorderToken(queueKey, tokenNumber, score); err != nil {
		return err
	}

	if s.bus != nil {
		_ = s.bus.PublishAuditEvent(context.Background(), events.AuditEvent{
			OrgID:      orgID,
			ActorID:    actorID,
			Action:     "queue.reordered",
			EntityType: "ticket",
			EntityID:   tokenNumber,
			Metadata: map[string]interface{}{
				"queue_key": queueKey,
				"position":  position,
			},
			CreatedAt: time.Now().UTC(),
		})
	}

	return nil
}

func (s *queueService) GetTicketStatus(tokenNumber string) (*models.QueueHistory, error) {
	return s.repo.GetHistoryByToken(tokenNumber)
}

func (s *queueService) GetActiveTicket(userID uint) (*models.QueueResponse, error) {
	history, err := s.repo.GetActiveHistoryForUser(userID)
	if err != nil {
		return nil, errors.New("no active ticket found")
	}

	pos, _ := s.repo.GetPosition(history.QueueKey, history.TokenNumber)
	avgWait, _, _ := s.repo.CalculateAverages(history.QueueKey)

	return &models.QueueResponse{
		TokenNumber:    history.TokenNumber,
		QueueKey:       history.QueueKey,
		OrganizationID: history.OrganizationID,
		Position:       pos,
		EstimatedWait:  pos * avgWait,
		JoinedAt:       history.JoinedAt,
	}, nil
}

func (s *queueService) GetUserHistory(userID uint) ([]models.QueueHistory, error) {
	return s.repo.GetUserHistory(userID)
}

func (s *queueService) GetAnalytics(queueKey string, orgID uint) (*models.AnalyticsResponse, error) {
	if err := s.verifyOwnership(queueKey, orgID); err != nil {
		return nil, err
	}

	count, _ := s.repo.GetDailyCount(queueKey)
	wait, serve, _ := s.repo.CalculateAverages(queueKey)
	peaks, _ := s.repo.GetPeakHours(queueKey)
	counters, _ := s.repo.GetCounterAverages(queueKey)

	return &models.AnalyticsResponse{
		TotalServedToday:   count,
		AvgWaitTimeMins:    wait,
		AvgServiceTimeMins: serve,
		PeakHours:          peaks,
		CounterAverages:    counters,
	}, nil
}

func (s *queueService) GetPeakHoursByOrg(orgID uint, rangeExpr string) (map[string]int, error) {
	if orgID == 0 {
		return nil, errors.New("org_id is required")
	}
	hours := ParseRangeToHours(rangeExpr)
	since := time.Now().Add(-time.Duration(hours) * time.Hour)
	return s.repo.GetPeakHoursByOrgRange(orgID, since)
}

func (s *queueService) verifyOwnership(queueKey string, orgID uint) error {
	def, err := s.orgRepo.GetQueueDefByKey(queueKey)
	if err != nil {
		return errors.New("queue not found")
	}
	if def.OrganizationID != orgID {
		return errors.New("unauthorized queue access")
	}
	return nil
}

func ParseRangeToHours(value string) int {
	switch value {
	case "7d":
		return 24 * 7
	case "30d":
		return 24 * 30
	default:
		if v, err := strconv.Atoi(value); err == nil {
			return v
		}
		return 24 * 7
	}
}
