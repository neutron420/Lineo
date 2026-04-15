package repository

import (
	"context"
	"testing"
	"time"

	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/glebarez/sqlite"
	redisClient "github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"queueless/internal/models"
)

func newTestQueueRepo(t *testing.T) *queueRepository {
	t.Helper()

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	t.Cleanup(mr.Close)

	rdb := redisClient.NewClient(&redisClient.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.QueueHistory{}); err != nil {
		t.Fatalf("failed to migrate: %v", err)
	}

	return &queueRepository{
		db:    db,
		redis: rdb,
		ctx:   context.Background(),
	}
}

func TestQueueRepository_EnqueueDequeueAndPosition(t *testing.T) {
	repo := newTestQueueRepo(t)
	queueKey := "clinic-a"

	entry := &models.QueueEntry{
		TokenNumber: "TK-1001",
		Username:    "alice",
		Status:      models.StatusWaiting,
		JoinedAt:    time.Now(),
		Score:       float64(time.Now().UnixNano()),
	}

	if err := repo.Enqueue(queueKey, entry); err != nil {
		t.Fatalf("enqueue failed: %v", err)
	}

	pos, err := repo.GetPosition(queueKey, entry.TokenNumber)
	if err != nil {
		t.Fatalf("get position failed: %v", err)
	}
	if pos != 1 {
		t.Fatalf("expected pos=1 got %d", pos)
	}

	got, err := repo.DequeueMin(queueKey)
	if err != nil {
		t.Fatalf("dequeue failed: %v", err)
	}
	if got == nil || got.TokenNumber != entry.TokenNumber {
		t.Fatalf("unexpected dequeued token: %+v", got)
	}
}

func TestQueueRepository_HistoryStatusFlow(t *testing.T) {
	repo := newTestQueueRepo(t)

	h := &models.QueueHistory{
		OrganizationID: 1,
		QueueKey:       "bank-main",
		TokenNumber:    "TK-2001",
		Status:         models.StatusPending,
		JoinedAt:       time.Now(),
	}
	if err := repo.SaveHistory(h); err != nil {
		t.Fatalf("save history failed: %v", err)
	}

	now := time.Now()
	if err := repo.UpdateHistoryStatus(h.TokenNumber, models.StatusServing, &now); err != nil {
		t.Fatalf("update serving failed: %v", err)
	}

	got, err := repo.GetHistoryByToken(h.TokenNumber)
	if err != nil {
		t.Fatalf("get history failed: %v", err)
	}
	if got.Status != models.StatusServing {
		t.Fatalf("expected status=serving got %s", got.Status)
	}
	if got.ServedAt == nil {
		t.Fatal("expected served_at to be set")
	}
}
