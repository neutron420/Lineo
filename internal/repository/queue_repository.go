package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	redisClient "github.com/redis/go-redis/v9"
	"gorm.io/gorm"
	"queueless/internal/models"
	database "queueless/pkg/db"
	"queueless/pkg/redis"
)

type QueueRepository interface {
	// DB logic
	SaveHistory(history *models.QueueHistory) error
	UpdateHistoryStatus(tokenNumber string, status models.QueueStatus, timestamp *time.Time) error
	CalculateAverages(queueKey string) (int, int, error) // WaitTime, ServiceTime min averges
	GetDailyCount(queueKey string) (int64, error)
	GetPeakHours(queueKey string) (map[string]int, error) // Returns counts grouped by hour
	
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
	} else if status == models.StatusCompleted || status == models.StatusCancelled {
		updates["completed_at"] = timestamp
	}
	return r.db.Model(&models.QueueHistory{}).Where("token_number = ?", tokenNumber).Updates(updates).Error
}

func (r *queueRepository) CalculateAverages(queueKey string) (int, int, error) {
	// Using Postgres to calculate avg difference between joined_at -> served_at (Wait Time) 
	// and served_at -> completed_at (Service Time)
	// Simplified mock return for performance in this demo, standard SQL averages would go here:
	// SELECT AVG(EXTRACT(EPOCH FROM (served_at - joined_at)))/60 ...
	return 5, 2, nil 
}

func (r *queueRepository) GetDailyCount(queueKey string) (int64, error) {
	var count int64
	today := time.Now().Truncate(24 * time.Hour)
	err := r.db.Model(&models.QueueHistory{}).
		Where("queue_key = ? AND status = ? AND created_at >= ?", queueKey, models.StatusCompleted, today).
		Count(&count).Error
	return count, err
}

func (r *queueRepository) GetPeakHours(queueKey string) (map[string]int, error) {
	// Simplified mock. Postgres query would ordinarily be:
	// SELECT EXTRACT(HOUR FROM joined_at) as hour, COUNT(*) FROM queue_histories GROUP BY hour
	
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

// Redis keys
func zqKey(qKey string) string       { return fmt.Sprintf("queue:%s:zwaiting", qKey) }
func servingKey(qKey string) string  { return fmt.Sprintf("queue:%s:serving", qKey) }
func entriesKey(qKey string) string  { return fmt.Sprintf("queue:%s:entries", qKey) }
func holdingKey(qKey string) string  { return fmt.Sprintf("queue:%s:holding", qKey) } // List for No-Shows

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
		if d == nil { continue }
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
		if err == redisClient.Nil { return nil, nil }
		return nil, err
	}
	var entry models.QueueEntry
	if err := json.Unmarshal([]byte(data), &entry); err != nil { return nil, err }
	return &entry, nil
}

func (r *queueRepository) SetCurrentServing(queueKey string, entry *models.QueueEntry) error {
	if entry == nil {
		return r.redis.Del(r.ctx, servingKey(queueKey)).Err()
	}
	data, err := json.Marshal(entry)
	if err != nil { return err }
	return r.redis.Set(r.ctx, servingKey(queueKey), data, 0).Err()
}

func (r *queueRepository) HoldToken(queueKey string, entry *models.QueueEntry) error {
	data, _ := json.Marshal(entry)
	// Add to holding set/list 
	return r.redis.HSet(r.ctx, holdingKey(queueKey), entry.TokenNumber, data).Err()
}

func (r *queueRepository) GetHoldingList(queueKey string) ([]models.QueueEntry, error) {
	dataMap, err := r.redis.HGetAll(r.ctx, holdingKey(queueKey)).Result()
	if err != nil { return nil, err }
	
	var entries []models.QueueEntry
	for _, data := range dataMap {
		var entry models.QueueEntry
		json.Unmarshal([]byte(data), &entry)
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
