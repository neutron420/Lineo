package handler

import (
	"fmt"
	"net/http"
	"path/filepath"
	"queueless/pkg/utils"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type UploadHandler struct {
	R2 *utils.R2Client
}

func NewUploadHandler() *UploadHandler {
	r2, err := utils.NewR2Client()
	if err != nil {
		fmt.Printf("Warning: R2 Client initialization failed: %v\n", err)
	}
	return &UploadHandler{R2: r2}
}

func (h *UploadHandler) Upload(c *gin.Context) {
	if h.R2 == nil {
		utils.RespondError(c, http.StatusInternalServerError, "Internal Server Error", "Storage service not initialized")
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Bad Request", "No file uploaded")
		return
	}

	// Read file
	f, err := file.Open()
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Internal Server Error", "Failed to read file")
		return
	}
	defer f.Close()

	// Generate unique filename
	ext := filepath.Ext(file.Filename)
	uniqueID := uuid.New().String()
	fileName := fmt.Sprintf("%d-%s%s", time.Now().Unix(), uniqueID, ext)

	// Determine content type
	contentType := file.Header.Get("Content-Type")

	// Upload to R2
	url, err := h.R2.UploadFile(c.Request.Context(), fileName, f, contentType)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Internal Server Error", fmt.Sprintf("Upload failed: %v", err))
		return
	}

	utils.RespondSuccess(c, http.StatusOK, "File uploaded successfully", gin.H{
		"url": url,
	})
}
