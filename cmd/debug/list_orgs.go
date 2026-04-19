package main

import (
	"fmt"
	"log"
	"queueless/internal/models"
	"queueless/pkg/db"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		fmt.Println("No .env file found")
	}

	db.InitDB()

	var orgs []models.Organization
	if err := db.DB.Find(&orgs).Error; err != nil {
		log.Fatal(err)
	}

	fmt.Println("--- ORGANIZATIONS IN DB ---")
	for _, o := range orgs {
		fmt.Printf("ID: %d, Name: %s, Verified: %v, Lat: %f, Lng: %f, Type: %s\n", o.ID, o.Name, o.IsVerified, o.Latitude, o.Longitude, o.Type)
	}
	fmt.Println("---------------------------")
}
