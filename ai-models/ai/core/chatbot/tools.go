package chatbot

// ChatbotTools defines the functions OpenAI can invoke
var ChatbotTools = []map[string]interface{}{
	{
		"type": "function",
		"function": map[string]interface{}{
			"name":        "get_queue_status",
			"description": "Get the current queue position and estimated wait time for a user",
			"parameters": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"user_id": map[string]string{
						"type":        "string",
						"description": "The user's ID",
					},
					"org_id": map[string]string{
						"type":        "string",
						"description": "The organization's ID",
					},
				},
				"required": []string{"user_id", "org_id"},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]interface{}{
			"name":        "get_upcoming_appointments",
			"description": "Get a user's upcoming appointments",
			"parameters": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"user_id": map[string]string{"type": "string"},
				},
				"required": []string{"user_id"},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]interface{}{
			"name":        "get_available_slots",
			"description": "Get available appointment slots for an organization on a given date",
			"parameters": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"org_id": map[string]string{"type": "string"},
					"date": map[string]string{
						"type":        "string",
						"description": "Date in YYYY-MM-DD format",
					},
				},
				"required": []string{"org_id", "date"},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]interface{}{
			"name":        "book_appointment",
			"description": "Book an appointment for a user",
			"parameters": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"user_id":      map[string]string{"type": "string"},
					"org_id":       map[string]string{"type": "string"},
					"slot_id":      map[string]string{"type": "string"},
					"scheduled_at": map[string]string{
						"type":        "string",
						"description": "ISO8601 datetime string",
					},
				},
				"required": []string{"user_id", "org_id", "scheduled_at"},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]interface{}{
			"name":        "cancel_appointment",
			"description": "Cancel an upcoming appointment",
			"parameters": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"appointment_id": map[string]string{"type": "string"},
					"user_id":        map[string]string{"type": "string"},
				},
				"required": []string{"appointment_id", "user_id"},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]interface{}{
			"name":        "get_org_info",
			"description": "Get information about an organization: hours, services, location",
			"parameters": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"org_id": map[string]string{"type": "string"},
					"topic": map[string]string{
						"type":        "string",
						"description": "What info: 'hours', 'services', 'documents', 'location'",
					},
				},
				"required": []string{"org_id"},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]interface{}{
			"name":        "escalate_to_human",
			"description": "Escalate the conversation to a human agent when the AI cannot help",
			"parameters": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"reason": map[string]string{"type": "string"},
				},
				"required": []string{"reason"},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]interface{}{
			"name":        "set_reminder",
			"description": "Schedule a reminder message to be sent to the user after a certain number of minutes.",
			"parameters": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"delay_minutes": map[string]interface{}{
						"type":        "integer",
						"description": "The number of minutes from now to send the reminder.",
					},
					"message": map[string]interface{}{
						"type":        "string",
						"description": "The message to send to the user as a reminder.",
					},
				},
				"required": []string{"delay_minutes", "message"},
			},
		},
	},
}

