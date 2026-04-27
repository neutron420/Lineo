package waittime

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

type OpenAIPredictor struct {
	apiKey string
	client *http.Client
}

func NewOpenAIPredictor() *OpenAIPredictor {
	return &OpenAIPredictor{
		apiKey: os.Getenv("OPENAI_API_KEY"),
		client: &http.Client{},
	}
}

type WaitPrediction struct {
	EstimatedMinutes int    `json:"estimated_wait_minutes"`
	Confidence       string `json:"confidence"` // "high", "medium", "low"
	Message          string `json:"message"`
}

type PredictionInput struct {
	QueuePosition  int
	ActiveAgents   int
	AvgServiceSecs int
	P90ServiceSecs int
	RecentAvgSecs  int // last 30 min velocity
	TotalSamples   int
	HourOfDay      int
	DayOfWeek      string
	IsAppointment  bool
}

func (c *OpenAIPredictor) Predict(ctx context.Context, input PredictionInput) (WaitPrediction, error) {
	prompt := buildPrompt(input)

	requestBody, _ := json.Marshal(map[string]interface{}{
		"model": "gpt-4o",
		"messages": []map[string]string{
			{"role": "system", "content": "You are a queue wait time predictor for a hospital/clinic/bank management system."},
			{"role": "user", "content": prompt},
		},
		"response_format": map[string]string{"type": "json_object"},
		"temperature":     0.2,
	})

	req, err := http.NewRequestWithContext(ctx, "POST",
		"https://api.openai.com/v1/chat/completions",
		bytes.NewBuffer(requestBody))
	if err != nil {
		return WaitPrediction{}, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return WaitPrediction{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return WaitPrediction{}, fmt.Errorf("openai error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var openaiResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&openaiResp); err != nil {
		return WaitPrediction{}, err
	}

	if len(openaiResp.Choices) == 0 {
		return WaitPrediction{}, fmt.Errorf("empty response from openai")
	}

	return parseOpenAIResponse(openaiResp.Choices[0].Message.Content), nil
}

func buildPrompt(input PredictionInput) string {
	return fmt.Sprintf(`Given the following real-time data, predict the wait time for the customer.

CURRENT CONDITIONS:
- Queue position: %d (they are this many people ahead of them)
- Active agents/counters serving right now: %d
- Historical average service time: %d seconds per customer
- Historical 90th percentile service time: %d seconds (for busy periods)
- Recent service time (last 30 min): %d seconds (current velocity)
- Historical data samples: %d total records
- Current hour of day: %d (0-23)
- Day of week: %s
- Is this an appointment (vs walk-in): %v

INSTRUCTIONS:
1. Calculate estimated wait time in minutes (be realistic, not optimistic)
2. If recent velocity is much higher than historical avg, it is a busy period — use p90
3. Account for multiple agents (divide by agent count)
4. Set confidence: "high" if >500 samples, "medium" if 50-500, "low" if <50
5. Respond ONLY in this exact JSON format, nothing else:

{"estimated_wait_minutes": <number>, "confidence": "<high|medium|low>", "message": "<friendly 1-sentence message>"}`,
		input.QueuePosition,
		input.ActiveAgents,
		input.AvgServiceSecs,
		input.P90ServiceSecs,
		input.RecentAvgSecs,
		input.TotalSamples,
		input.HourOfDay,
		input.DayOfWeek,
		input.IsAppointment,
	)
}

func parseOpenAIResponse(text string) WaitPrediction {
	text = strings.TrimSpace(text)
	var prediction WaitPrediction
	if err := json.Unmarshal([]byte(text), &prediction); err != nil {
		return WaitPrediction{
			EstimatedMinutes: 15,
			Confidence:       "low",
			Message:          "Estimated wait time is approximately 15 minutes.",
		}
	}
	return prediction
}
