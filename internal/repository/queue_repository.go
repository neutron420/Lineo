package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"queueless/internal/models"
	database "queueless/pkg/db"
	"queueless/pkg/redis"

	redisClient "github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type QueueRepository interface {
	// DB logic
	SaveHistory(history *models.QueueHistory) error
	UpdateHistoryStatus(tokenNumber string, status models.QueueStatus, timestamp *time.Time) error
	CalculateAverages(queueKey string) (int, int, error) // WaitTime, ServiceTime min averges
	GetDailyCount(queueKey string) (int64, error)
	GetPeakHours(queueKey string) (map[string]int, error)
	GetPeakHoursByOrgRange(orgID uint, since time.Time) (map[string]int, error)
	GetCounterAverages(queueKey string) (map[int]int, error)
	GetDailyTicketCountByOrg(orgID uint) (int, error)

	// Redis operations
	Enqueue(queueKey string, entry *models.QueueEntry) error
	DequeueMin(queueKey string) (*models.QueueEntry, error)
	GetQueueList(queueKey string) ([]models.QueueEntry, error)
	GetHoldingList(queueKey string) ([]models.QueueEntry, error)
	GetPosition(queueKey, tokenNumber string) (int, error)
	GetCurrentServing(queueKey string) (*models.QueueEntry, error)
	SetCurrentServing(queueKey string, entry *models.QueueEntry) error
	HoldToken(queueKey string, entry *models.QueueEntry) error
	RemoveFromQueue(queueKey, tokenNumber string) error
	ClearQueue(queueKey string) error
	GetActiveHistoryForUser(userID uint) (*models.QueueHistory, error)
	GetUserHistory(userID uint) ([]models.QueueHistory, error)
	GetHistoryByToken(tokenNumber string) (*models.QueueHistory, error)
	ReorderToken(queueKey, tokenNumber string, score float64) error
	BroadcastUpdate(orgID uint, data interface{}) error
}

type queueRepository struct {
	db    *gorm.DB
	redis *redisClient.Client
	ctx   context.Context
}

func NewQueueRepository() QueueRepository {
	return &queueRepository{
		db:    database.DB,
		redis: redis.Client,
		ctx:   redis.Ctx,
	}
}

// DB Operations
func (r *queueRepository) SaveHistory(history *models.QueueHistory) error {
	return r.db.Create(history).Error
}

func (r *queueRepository) UpdateHistoryStatus(tokenNumber string, status models.QueueStatus, timestamp *time.Time) error {
	updates := map[string]interface{}{"status": status}
	if status == models.StatusServing {
		updates["served_at"] = timestamp
	} else if status == models.StatusCompleted || status == models.StatusCancelled || status == models.StatusNoShow {
		updates["completed_at"] = timestamp
	}
	return r.db.Model(&models.QueueHistory{}).Where("token_number = ?", tokenNumber).Updates(updates).Error
}

func (r *queueRepository) CalculateAverages(queueKey string) (int, int, error) {
	var wait, serve float64

	// Avg Wait: Time between JoinedAt and ServedAt
	r.db.Model(&models.QueueHistory{}).
		Select("COALESCE(AVG(EXTRACT(EPOCH FROM (served_at - joined_at))) / 60, 0)").
		Where("queue_key = ? AND status IN ?", queueKey, []models.QueueStatus{models.StatusServing, models.StatusCompleted}).
		Scan(&wait)

	// Avg Service: Time between ServedAt and CompletedAt
	r.db.Model(&models.QueueHistory{}).
		Select("COALESCE(AVG(serving_duration) / 60, 0)").
		Where("queue_key = ? AND status = ?", queueKey, models.StatusCompleted).
		Scan(&serve)

	return int(wait), int(serve), nil
}

func (r *queueRepository) GetCounterAverages(queueKey string) (map[int]int, error) {
	averages := make(map[int]int)

	type result struct {
		Counter int
		Avg     float64
	}
	var res []result

	err := r.db.Model(&models.QueueHistory{}).
		Select("counter_number as counter, AVG(serving_duration) / 60 as avg").
		Where("queue_key = ? AND status = ? AND counter_number > 0", queueKey, models.StatusCompleted).
		Group("counter").
		Scan(&res).Error

	if err == nil {
		for _, row := range res {
			averages[row.Counter] = int(row.Avg)
		}
	}
	return averages, err
}

func (r *queueRepository) GetDailyCount(queueKey string) (int64, error) {
	var count int64
	loc, _ := time.LoadLocation("Asia/Kolkata")
	today := time.Now().In(loc).Truncate(24 * time.Hour)
	err := r.db.Model(&models.QueueHistory{}).
		Where("queue_key = ? AND created_at >= ?", queueKey, today).
		Count(&count).Error
	return count, err
}

func (r *queueRepository) GetDailyTicketCountByOrg(orgID uint) (int, error) {
	var count int64
	loc, _ := time.LoadLocation("Asia/Kolkata")
	today := time.Now().In(loc).Truncate(24 * time.Hour)
	err := r.db.Model(&models.QueueHistory{}).
		Where("organization_id = ? AND created_at >= ?", orgID, today).
		Count(&count).Error
	return int(count), err
}

func (r *queueRepository) GetPeakHours(queueKey string) (map[string]int, error) {
	peakMap := make(map[string]int)

	type result struct {
		Hour  int
		Count int
	}
	var res []result

	// For production PG
	err := r.db.Model(&models.QueueHistory{}).
		Select("EXTRACT(HOUR FROM joined_at) as hour, count(*) as count").
		Where("queue_key = ?", queueKey).
		Group("hour").
		Scan(&res).Error

	if err == nil {
		for _, row := range res {
			peakMap[fmt.Sprintf("%02d:00", row.Hour)] = row.Count
		}
	}
	return peakMap, err
}

func (r *queueRepository) GetPeakHoursByOrgRange(orgID uint, since time.Time) (map[string]int, error) {
	peakMap := make(map[string]int)

	type result struct {
		Bucket time.Time
		Count  int
	}
	var res []result

	err := r.db.Model(&models.QueueHistory{}).
		Select("date_trunc('hour', joined_at) as bucket, count(*) as count").
		Where("organization_id = ? AND joined_at >= ?", orgID, since).
		Group("bucket").
		Order("bucket asc").
		Scan(&res).Error
	if err != nil {
		return nil, err
	}

	for _, row := range res {
		peakMap[row.Bucket.UTC().Format("2006-01-02 15:00")] = row.Count
	}
	return peakMap, nil
}

// Redis keys
func zqKey(qKey string) string      { return fmt.Sprintf("queue:%s:zwaiting", qKey) }
func servingKey(qKey string) string { return fmt.Sprintf("queue:%s:serving", qKey) }
func entriesKey(qKey string) string { return fmt.Sprintf("queue:%s:entries", qKey) }
func holdingKey(qKey string) string { return fmt.Sprintf("queue:%s:holding", qKey) } // List for No-Shows

// Redis logic handles ZSet (Sorted Set)
func (r *queueRepository) Enqueue(queueKey string, entry *models.QueueEntry) error {
	data, err := json.Marshal(entry)
	if err != nil {
		return err
	}

	// Add to ZSet with Score (lowest score served first)
	err = r.redis.ZAdd(r.ctx, zqKey(queueKey), redisClient.Z{
		Score:  entry.Score,
		Member: entry.TokenNumber,
	}).Err()
	if err != nil {
		return err
	}

	return r.redis.HSet(r.ctx, entriesKey(queueKey), entry.TokenNumber, data).Err()
}

func (r *queueRepository) DequeueMin(queueKey string) (*models.QueueEntry, error) {
	res, err := r.redis.ZPopMin(r.ctx, zqKey(queueKey), 1).Result()
	if err != nil || len(res) == 0 {
		return nil, nil // Empty queue
	}

	token := res[0].Member.(string)

	data, err := r.redis.HGet(r.ctx, entriesKey(queueKey), token).Result()
	if err != nil {
		return nil, err
	}

	var entry models.QueueEntry
	if err := json.Unmarshal([]byte(data), &entry); err != nil {
		return nil, err
	}

	// Remove from hash optionally, but keeping it makes lookup easier for "get position" by token.
	return &entry, nil
}

func (r *queueRepository) GetQueueList(queueKey string) ([]models.QueueEntry, error) {
	tokens, err := r.redis.ZRangeByScore(r.ctx, zqKey(queueKey), &redisClient.ZRangeBy{Min: "-inf", Max: "+inf"}).Result()
	if err != nil {
		return nil, err
	}

	var entries []models.QueueEntry
	if len(tokens) == 0 {
		return entries, nil
	}

	dataList, err := r.redis.HMGet(r.ctx, entriesKey(queueKey), tokens...).Result()
	if err != nil {
		return nil, err
	}

	for _, d := range dataList {
		if d == nil {
			continue
		}
		var entry models.QueueEntry
		if err := json.Unmarshal([]byte(d.(string)), &entry); err == nil {
			entries = append(entries, entry)
		}
	}
	return entries, nil
}

func (r *queueRepository) GetPosition(queueKey, tokenNumber string) (int, error) {
	// ZRank gets the index of the token, 0-based.
	rank, err := r.redis.ZRank(r.ctx, zqKey(queueKey), tokenNumber).Result()
	if err != nil {
		if err == redisClient.Nil {
			return -1, nil
		}
		return -1, err
	}
	return int(rank) + 1, nil
}

func (r *queueRepository) GetCurrentServing(queueKey string) (*models.QueueEntry, error) {
	data, err := r.redis.Get(r.ctx, servingKey(queueKey)).Result()
	if err != nil {
		if err == redisClient.Nil {
			return nil, nil
		}
		return nil, err
	}
	var entry models.QueueEntry
	if err := json.Unmarshal([]byte(data), &entry); err != nil {
		return nil, err
	}
	return &entry, nil
}

func (r *queueRepository) SetCurrentServing(queueKey string, entry *models.QueueEntry) error {
	if entry == nil {
		return r.redis.Del(r.ctx, servingKey(queueKey)).Err()
	}
	data, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	return r.redis.Set(r.ctx, servingKey(queueKey), data, 0).Err()
}

func (r *queueRepository) HoldToken(queueKey string, entry *models.QueueEntry) error {
	data, _ := json.Marshal(entry)
	// Add to holding set/list
	return r.redis.HSet(r.ctx, holdingKey(queueKey), entry.TokenNumber, data).Err()
}

func (r *queueRepository) GetHoldingList(queueKey string) ([]models.QueueEntry, error) {
	dataMap, err := r.redis.HGetAll(r.ctx, holdingKey(queueKey)).Result()
	if err != nil {
		return nil, err
	}

	var entries []models.QueueEntry
	for _, data := range dataMap {
		var entry models.QueueEntry
		if err := json.Unmarshal([]byte(data), &entry); err != nil {
			continue // Skip corrupted entries
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

func (r *queueRepository) RemoveFromQueue(queueKey, tokenNumber string) error {
	pipe := r.redis.Pipeline()
	pipe.ZRem(r.ctx, zqKey(queueKey), tokenNumber)
	pipe.HDel(r.ctx, entriesKey(queueKey), tokenNumber)
	pipe.HDel(r.ctx, holdingKey(queueKey), tokenNumber)
	_, err := pipe.Exec(r.ctx)
	return err
}

func (r *queueRepository) ClearQueue(queueKey string) error {
	return r.redis.Del(r.ctx, zqKey(queueKey), servingKey(queueKey), entriesKey(queueKey), holdingKey(queueKey)).Err()
}

func (r *queueRepository) GetActiveHistoryForUser(userID uint) (*models.QueueHistory, error) {
	var history models.QueueHistory
	err := r.db.Where("user_id = ? AND status IN ?", userID, []models.QueueStatus{models.StatusWaiting, models.StatusServing, models.StatusHolding}).
		Order("created_at DESC").
		First(&history).Error
	if err != nil {
		return nil, err
	}
	return &history, nil
}

func (r *queueRepository) GetUserHistory(userID uint) ([]models.QueueHistory, error) {
	var history []models.QueueHistory
	err := r.db.Where("user_id = ?", userID).Order("joined_at DESC").Limit(50).Find(&history).Error
	return history, err
}

func (r *queueRepository) GetHistoryByToken(tokenNumber string) (*models.QueueHistory, error) {
	var history models.QueueHistory
	if err := r.db.Where("token_number = ?", tokenNumber).Order("created_at desc").First(&history).Error; err != nil {
		return nil, err
	}
	return &history, nil
}

func (r *queueRepository) ReorderToken(queueKey, tokenNumber string, score float64) error {
	return r.redis.ZAdd(r.ctx, zqKey(queueKey), redisClient.Z{
		Score:  score,
		Member: tokenNumber,
	}).Err()
}

func (r *queueRepository) BroadcastUpdate(orgID uint, data interface{}) error {
	payload, err := json.Marshal(data)
	if err != nil {
		return err
	}
	channel := fmt.Sprintf("org:%d:queue", orgID)
	return r.redis.Publish(r.ctx, channel, payload).Err()
}
