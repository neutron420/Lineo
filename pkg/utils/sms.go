package utils

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"queueless/pkg/config"
)

func SendSMS(to string, message string) {
	if to == "" {
		return 
	}

	accountSid := config.Secret("TWILIO_ACCOUNT_SID")
	authToken := config.Secret("TWILIO_AUTH_TOKEN")
	fromNumber := config.Secret("TWILIO_PHONE_NUMBER")
	
	if accountSid == "" || authToken == "" || fromNumber == "" {
		slog.Info("mock twilio sms sent", "to", to)
		return
	}

	apiURL := "https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/Messages.json"

	// Ensure E.164 format (defaulting to +91 for 10-digit numbers)
	cleanTo := strings.ReplaceAll(to, " ", "")
	if len(cleanTo) == 10 && !strings.HasPrefix(cleanTo, "+") {
		cleanTo = "+91" + cleanTo
	} else if !strings.HasPrefix(cleanTo, "+") {
		cleanTo = "+" + cleanTo
	}

	data := url.Values{}
	data.Set("To", cleanTo)
	data.Set("From", fromNumber)
	data.Set("Body", message)

	client := &http.Client{}
	req, err := http.NewRequest("POST", apiURL, strings.NewReader(data.Encode()))
	if err != nil {
		slog.Error("error creating twilio request", "error", err)
		return
	}

	req.SetBasicAuth(accountSid, authToken)
	req.Header.Add("Accept", "application/json")
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	resp, err := client.Do(req)
	if err != nil {
		slog.Error("failed to send twilio sms", "error", err, "to", cleanTo)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		slog.Info("twilio sms sent", "to", cleanTo)
	} else {
		// Read body to see exact error from Twilio
		var twilioErr map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&twilioErr)
		slog.Warn("twilio sms failed", "status_code", resp.StatusCode, "to", cleanTo, "error", twilioErr["message"])
	}
}
