package db

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"queueless/internal/models"
)

var DB *gorm.DB

func InitDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = fmt.Sprintf(
			"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
			os.Getenv("DB_HOST"), os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"), 
			os.Getenv("DB_NAME"), os.Getenv("DB_PORT"),
		)
	}

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Error), // Only show real errors now!
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	
	sqlDB, err := DB.DB()
	if err != nil {
		log.Fatalf("Failed to get DB instance: %v", err)
	}
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	// Auto-migrate models
	err = DB.AutoMigrate(&models.Organization{}, &models.User{}, &models.QueueDef{}, &models.QueueHistory{}, &models.Appointment{})
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	// FORCE UPDATE business hours and DISABLE geofencing for demo (Allows testing from anywhere, at any time)
	DB.Model(&models.Organization{}).Where("1 = 1").Updates(map[string]interface{}{
		"open_time":  "00:00",
		"close_time": "23:59",
		"latitude":   0,
		"longitude":  0,
	})

	log.Println("Database connection established and migrated")
	SeedData()
}

func SeedData() {
	var count int64
	DB.Model(&models.QueueDef{}).Where("queue_key = ?", "SBI-MAIN-01").Count(&count)
	if count > 0 {
		return // SBI-MAIN-01 already exists
	}

	log.Println("Seeding initial data...")
	
	// Create Test Organization with 24/7 hours and no geofencing for testing
	org := models.Organization{
		Name:      "SBI Main Branch",
		Type:      "bank",
		Address:   "City Center, New Delhi",
		Latitude:  0,
		Longitude: 0,
		OpenTime:  "00:00",
		CloseTime: "23:59",
	}
	DB.Create(&org)

	// Create Queue Definitions
	queues := []models.QueueDef{
		{
			QueueKey:       "SBI-MAIN-01",
			OrganizationID: org.ID,
			Name:           "General Banking",
		},
		{
			QueueKey:       "APOLLO-ER-01",
			OrganizationID: org.ID,
			Name:           "Emergency Care",
		},
	}
	DB.Create(&queues)

	log.Println("Seeding completed successfully")
}

func CloseDB() {
	sqlDB, err := DB.DB()
	if err != nil {
		log.Printf("Error getting DB instance to close: %v", err)
		return
	}
	log.Println("Closing database connections...")
	sqlDB.Close()
}

