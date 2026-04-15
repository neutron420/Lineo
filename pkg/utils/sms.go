package utils

import (
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

	data := url.Values{}
	data.Set("To", to)
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
		slog.Error("failed to send twilio sms", "error", err, "to", to)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		slog.Info("twilio sms sent", "to", to)
	} else {
		slog.Warn("twilio sms failed", "status_code", resp.StatusCode, "to", to)
	}
}
