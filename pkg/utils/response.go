package utils

import (
	"log/slog"
	"net/http"
	"github.com/gin-gonic/gin"
)

type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

type SuccessResponse struct {
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func RespondError(c *gin.Context, statusCode int, err string, message string) {
	c.JSON(statusCode, ErrorResponse{
		Error:   err,
		Message: message,
	})
	c.Abort()
}

// RespondServerError hides internal technical errors (like SQL details) from the client
func RespondServerError(c *gin.Context, internalErr error) {
	// Log the actual error for staff eyes
	if internalErr != nil {
		slog.Error("internal server error", "error", internalErr)
	}

	c.JSON(http.StatusInternalServerError, ErrorResponse{
		Error:   "Internal Server Error",
		Message: "An unexpected error occurred. Please try again later.",
	})
	c.Abort()
}

func RespondSuccess(c *gin.Context, statusCode int, message string, data interface{}) {
	c.JSON(statusCode, SuccessResponse{
		Message: message,
		Data:    data,
	})
}
