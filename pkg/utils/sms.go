package utils

import (
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
)

func SendSMS(to string, message string) {
	if to == "" {
		return 
	}

	accountSid := os.Getenv("TWILIO_ACCOUNT_SID")
	authToken := os.Getenv("TWILIO_AUTH_TOKEN")
	fromNumber := os.Getenv("TWILIO_PHONE_NUMBER")
	
	if accountSid == "" || authToken == "" || fromNumber == "" {
		log.Printf("[MOCK Twilio SMS Sent] To: %s -> Message: %s\n", to, message)
		return
	}

	apiURL := "https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/Messages.json"

	data := url.Values{}
	data.Set("To", to)
	data.Set("From", fromNumber)
	data.Set("Body", message)

	client := &http.Client{}
	req, err := http.NewRequest("POST", apiURL, strings.NewReader(data.Encode()))
	if err != nil {
		log.Println("Error creating Twilio request:", err)
		return
	}

	req.SetBasicAuth(accountSid, authToken)
	req.Header.Add("Accept", "application/json")
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	resp, err := client.Do(req)
	if err != nil {
		log.Println("Failed to send Twilio SMS:", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.Printf("[LIVE Twilio SMS Sent] Successfully sent to %s\n", to)
	} else {
		log.Printf("[Twilio Error] Failed to send SMS, status code: %d\n", resp.StatusCode)
	}
}
