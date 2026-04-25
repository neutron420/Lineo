package db

import (
	"fmt"
	"log/slog"
	"os"
	"strings"

	"queueless/internal/models"
	"queueless/pkg/config"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() {
	dsn := config.Secret("DATABASE_URL")
	if dsn == "" {
		dsn = fmt.Sprintf(
			"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC prepare_threshold=0",
			config.Secret("DB_HOST"), config.Secret("DB_USER"), config.Secret("DB_PASSWORD"),
			config.Secret("DB_NAME"), config.Secret("DB_PORT"),
		)
	} else {
		// Ensure prepare_threshold=0 is present in the provided DATABASE_URL
		if !strings.Contains(dsn, "prepare_threshold=0") {
			if strings.Contains(dsn, "?") {
				dsn += "&prepare_threshold=0"
			} else {
				dsn += "?prepare_threshold=0"
			}
		}
	}

	var err error
	DB, err = gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true, // Disables prepared statements entirely — fixes 'cached plan' on Neon
	}), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Error),
	})
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		slog.Error("failed to get db instance", "error", err)
		os.Exit(1)
	}
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	modelsToMigrate := []interface{}{
		&models.Organization{},
		&models.User{},
		&models.QueueDef{},
		&models.QueueHistory{},
		&models.Appointment{},
		&models.OrganizationConfig{},
		&models.AuditLog{},
		&models.PaymentTransaction{},
		&models.PaymentWebhookEvent{},
		&models.Feedback{},
		&models.Terminal{},
		&models.Announcement{},
		&models.PushSubscription{},
	}

	// Auto-migrate models. Some managed Postgres setups hit a pgx/sql interpolation
	// issue during column introspection on existing tables. In that case, we fall back
	// to creating only missing tables so startup is not blocked.
	err = DB.AutoMigrate(modelsToMigrate...)
	if err != nil {
		if strings.Contains(err.Error(), "insufficient arguments") {
			slog.Warn("auto-migrate fallback enabled for existing tables", "error", err)
			for _, model := range modelsToMigrate {
				if DB.Migrator().HasTable(model) {
					continue
				}
				if createErr := DB.Migrator().CreateTable(model); createErr != nil {
					slog.Error("failed to create missing table during migration fallback", "error", createErr)
					os.Exit(1)
				}
			}
		} else {
			slog.Error("failed to migrate database", "error", err)
			os.Exit(1)
		}
	}

	// MANUAL MIGRATION: Ensure all new organization fields exist (Neon GORM fallback doesn't always add columns)
	_ = DB.Exec("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pincode text").Error
	_ = DB.Exec("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS state text").Error
	_ = DB.Exec("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS latitude double precision").Error
	_ = DB.Exec("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS longitude double precision").Error
	_ = DB.Exec("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS owner_name text").Error
	_ = DB.Exec("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS owner_phone text").Error
	_ = DB.Exec("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS office_image_url text").Error
	_ = DB.Exec("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS cert_pdf_url text").Error
	_ = DB.Exec("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ptax_paper_url text").Error
	_ = DB.Exec("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false").Error
	_ = DB.Exec("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'starter'").Error
	_ = DB.Exec("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_tier integer DEFAULT 0").Error
	_ = DB.Exec("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_queues integer DEFAULT 2").Error
	_ = DB.Exec("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS daily_ticket_limit integer DEFAULT 50").Error
	
	// USER SUBSCRIPTION SCHEMA
	_ = DB.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'basic'").Error
	_ = DB.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_joins integer DEFAULT 0").Error
	_ = DB.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_appts integer DEFAULT 0").Error
	_ = DB.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_action_date timestamp with time zone").Error
	_ = DB.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_exp timestamp with time zone").Error
	_ = DB.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS razorpay_id text").Error
	_ = DB.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number text").Error
	_ = DB.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS dob text").Error
	_ = DB.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS gender text").Error
	_ = DB.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS has_disability boolean DEFAULT false").Error
	_ = DB.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS disability_type text").Error
	_ = DB.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_attempts integer DEFAULT 0").Error
	_ = DB.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS lockout_until timestamp with time zone").Error

	// ANNOUNCEMENT TIMER SCHEMA
	_ = DB.Exec("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone").Error

	// PUSH SUBSCRIPTION SCHEMA
	_ = DB.Exec(`CREATE TABLE IF NOT EXISTS push_subscriptions (
		id BIGSERIAL PRIMARY KEY,
		user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		endpoint TEXT NOT NULL,
		p256dh TEXT NOT NULL,
		auth TEXT NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		deleted_at TIMESTAMP WITH TIME ZONE
	)`).Error
	_ = DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint) WHERE deleted_at IS NULL").Error
	_ = DB.Exec("CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id)").Error

	slog.Info("database connection established and migrated")

	// Explicit high-cardinality indexes for analytics/compliance queries.
	_ = DB.Exec("CREATE INDEX IF NOT EXISTS idx_queue_histories_org_created ON queue_histories(organization_id, created_at)").Error
	_ = DB.Exec("CREATE INDEX IF NOT EXISTS idx_queue_histories_org_joined ON queue_histories(organization_id, joined_at)").Error
	_ = DB.Exec("CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(org_id, created_at)").Error
	_ = DB.Exec("CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at)").Error
}

func CloseDB() {
	sqlDB, err := DB.DB()
	if err != nil {
		slog.Error("error getting DB instance to close", "error", err)
		return
	}
	slog.Info("closing database connections")
	_ = sqlDB.Close()
}
