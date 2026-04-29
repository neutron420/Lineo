package slots

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"queueless/ai-models/ai/core/chatbot"
	aimodels "queueless/ai-models/ai/models"
	"queueless/internal/repository"
)

// AISlotService is the interface for AI-driven slot recommendations
type AISlotService interface {
	GetRecommendedSlots(ctx context.Context, userID uint, orgID uint, date string) (interface{}, error)
}

type aiSlotService struct {
	repo    repository.SlotAnalyticsRepository
	orgRepo repository.OrganizationRepository
	openai  *chatbot.OpenAIChatbot
}

func NewAISlotService(repo repository.SlotAnalyticsRepository, orgRepo repository.OrganizationRepository, openai *chatbot.OpenAIChatbot) AISlotService {
	return &aiSlotService{
		repo:    repo,
		orgRepo: orgRepo,
		openai:  openai,
	}
}

func (s *aiSlotService) GetRecommendedSlots(ctx context.Context, userID uint, orgID uint, date string) (interface{}, error) {
	// 1. Fetch Org Config for operating hours
	config, _ := s.orgRepo.GetOrCreateOrgConfig(orgID)

	// 2. Fetch Org name for AI prompt context
	org, _ := s.orgRepo.GetOrganizationByID(orgID)
	orgName := "Organization"
	if org != nil {
		orgName = org.Name
	}

	// 3. Fetch Historical Analytics for this org/day
	parsedDate, _ := time.Parse("2006-01-02", date)
	dayOfWeek := int(parsedDate.Weekday())
	analytics, _ := s.repo.GetSlotAnalytics(orgID, dayOfWeek)

	// 4. Fetch User Preferences
	userPref, _ := s.repo.GetUserPreferences(userID)

	// 5. Generate Base Slots from operating hours
	baseSlots := []string{"09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"}
	if config != nil && config.SlotDurationMinutes > 0 {
		// Future: parse config.OperatingHoursJSON for custom slots

	}

	// 6. Pre-score each slot with analytics signals (scorer.go)
	scored := ScoreSlots(baseSlots, parsedDate, analytics, userPref)

	// 7. Build structured AI prompt with the scored table
	prompt := buildStructuredPrompt(scored, userPref, orgName)

	systemPrompt := "You are the Lineo AI Slot Recommender. Analyze the scored slots table and pick the TOP 3 best slots for the user. Return ONLY valid JSON, no markdown fences."

	// 8. Call AI
	aiResp, err := s.openai.GenerateOneOff(ctx, systemPrompt, prompt)
	if err != nil {
		// Fallback: return top 3 by wait score without AI
		return fallbackRecommend(scored, len(baseSlots)), nil
	}

	// 9. Parse AI response
	var result aimodels.RecommendationResponse
	cleaned := cleanAIResponse(aiResp)
	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		return fallbackRecommend(scored, len(baseSlots)), nil
	}

	// 10. Save recommendation for feedback tracking
	if len(result.RecommendedSlots) > 0 {
		_ = s.repo.SaveRecommendation(userID, orgID,
			result.RecommendedSlots[0].SlotID,
			result.RecommendedSlots[0].Score,
		)
	}

	result.AllSlotsAvailable = len(baseSlots)
	return result, nil
}

// buildStructuredPrompt creates the detailed table prompt from the doc
func buildStructuredPrompt(slots []ScoredSlot, prefs *aimodels.UserBookingPreference, orgName string) string {
	var sb strings.Builder

	prefHours := []int64{}
	prefDays := []int64{}
	totalBookings := 0
	avgAdvance := 0
	if prefs != nil {
		prefHours = prefs.PreferredHours
		prefDays = prefs.PreferredDays
		totalBookings = prefs.TotalBookings
		avgAdvance = prefs.AvgAdvanceDays
	}

	sb.WriteString(fmt.Sprintf(`You are a smart appointment slot recommender for "%s".

Your job: Analyze the available slots below and recommend the TOP 3 best ones for the user.

USER PREFERENCES:
- Preferred hours: %v (empty = no clear preference)
- Preferred days: %v
- Total past bookings: %d
- Average days booked in advance: %d

AVAILABLE SLOTS WITH ANALYTICS:
(Scores are 0.0-1.0 where HIGHER = BETTER for the user)

`, orgName, prefHours, prefDays, totalBookings, avgAdvance))

	sb.WriteString("slot_id | label | wait_score | busy_score | user_match | avg_wait_mins | avg_queue | confidence\n")
	sb.WriteString("--------|-------|------------|------------|------------|---------------|-----------|----------\n")

	for _, s := range slots {
		sb.WriteString(fmt.Sprintf("%s | %s | %.2f | %.2f | %.2f | %.1f min | %.1f people | %s\n",
			s.SlotID, s.Label,
			s.WaitTimeScore, s.BusynessScore, s.UserMatchScore,
			s.AvgWaitMins, s.AvgQueueDepth, s.DataConfidence,
		))
	}

	sb.WriteString(`
SCORING GUIDANCE:
- wait_score: Higher = historically shorter wait times at this slot
- busy_score: Higher = fewer people in queue at this time  
- user_match: Higher = this slot matches the user's past booking preferences
- avg_wait_mins: Raw average wait in minutes (lower = better)
- avg_queue: Raw average people in queue (lower = better)
- confidence: How much historical data backs these scores

RULES FOR PICKING TOP 3:
1. Prioritize low avg_wait_mins and low avg_queue above all else
2. If user_match is high AND wait is low, boost that slot
3. If confidence is "low", mention it in the reason as a caveat
4. Give each slot a badge: "Best Pick", "Quick In & Out", "Also Great", "Early Bird", "Afternoon Pick"
5. Write reasons in plain English, 1 sentence max, friendly tone
6. Score field should be your overall composite recommendation score (0.0-1.0)

Respond ONLY with this exact JSON format, no extra text:
{
  "recommended_slots": [
    {
      "slot_id": "<exact slot_id from table>",
      "datetime": "<ISO8601 datetime>",
      "label": "<exact label from table>",
      "score": <float>,
      "badge": "<badge text>",
      "reason": "<1 sentence friendly reason>"
    }
  ],
  "explanation": "<1 sentence summary of overall recommendation strategy>"
}`)

	return sb.String()
}

// cleanAIResponse strips markdown code fences from AI responses
func cleanAIResponse(text string) string {
	text = strings.TrimSpace(text)
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	return strings.TrimSpace(text)
}

// fallbackRecommend returns top 3 by wait score if AI fails
func fallbackRecommend(scored []ScoredSlot, total int) aimodels.RecommendationResponse {
	sort.Slice(scored, func(i, j int) bool {
		return scored[i].WaitTimeScore > scored[j].WaitTimeScore
	})

	badges := []string{"Best Pick", "Quick In & Out", "Also Available"}
	var slots []aimodels.RecommendedSlot
	for i, s := range scored {
		if i >= 3 {
			break
		}
		badge := "Recommended"
		if i < len(badges) {
			badge = badges[i]
		}

		slots = append(slots, aimodels.RecommendedSlot{
			SlotID:   s.SlotID,
			DateTime: s.StartsAt.Format(time.RFC3339),
			Label:    s.Label,
			Score:    s.WaitTimeScore,
			Badge:    badge,
			Reason:   fmt.Sprintf("Historically low wait time: ~%.0f minutes.", s.AvgWaitMins),
		})
	}
	return aimodels.RecommendationResponse{
		RecommendedSlots:  slots,
		AllSlotsAvailable: total,
		Explanation:       "Based on historical wait time data (AI unavailable).",
	}
}
