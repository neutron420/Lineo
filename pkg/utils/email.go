package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"queueless/pkg/config"
)

type ResendPayload struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	Html    string   `json:"html"`
}

func SendOTPEmail(email, otp string) error {
	apiKey := config.Secret("RESEND_API_KEY")
	if apiKey == "" {
		return fmt.Errorf("RESEND_API_KEY not set")
	}

	htmlContent := fmt.Sprintf(`
		<!DOCTYPE html>
		<html>
		<head>
			<style>
				body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f7f9; margin: 0; padding: 0; }
				.container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
				.header { background: #6366f1; padding: 40px; text-align: center; color: white; background-image: linear-gradient(135deg, #6366f1 0%%, #4f46e5 100%%); }
				.content { padding: 40px; text-align: center; color: #1e293b; }
				.otp-container { margin: 32px 0; }
				.otp { font-size: 42px; font-weight: 800; color: #4f46e5; letter-spacing: 12px; margin: 10px 0; padding: 24px; background: #f5f3ff; border-radius: 12px; border: 2px solid #ddd6fe; display: inline-block; min-width: 200px; }
				.expiry { color: #64748b; font-size: 14px; margin-bottom: 8px; }
				.footer { padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; background: #f8fafc; border-top: 1px solid #f1f5f9; }
				.warning { color: #94a3b8; font-size: 13px; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 24px; }
				h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.025em; }
				h2 { margin: 0; font-size: 22px; font-weight: 600; }
				p { line-height: 1.6; }
			</style>
		</head>
		<body>
			<div class="container">
				<div class="header">
					<h1>Lineo Security</h1>
				</div>
				<div class="content">
					<h2>Verification Code</h2>
					<p>You recently requested to reset your password. Use the following code to proceed with the reset.</p>
					
					<div class="otp-container">
						<div class="expiry">This code expires in <strong>5 minutes</strong></div>
						<div class="otp">%s</div>
					</div>
					
					<p>If you didn't request this, you can safely ignore this email. No changes will be made to your account until you verify this code.</p>
					
					<div class="warning">
						For security reasons, do not share this code with anyone. Lineo staff will never ask for your verification code.
					</div>
				</div>
				<div class="footer">
					&copy; 2026 Lineo Platform &bull; Secure Queue Management<br>
					This is an automated security notification.
				</div>
			</div>
		</body>
		</html>
	`, otp)

	payload := ResendPayload{
		From:    "Lineo Security <onboarding@resend.dev>",
		To:      []string{email},
		Subject: otp + " is your Lineo verification code",
		Html:    htmlContent,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewBuffer(jsonPayload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("resend api error: status %d", resp.StatusCode)
	}

	return nil
}
