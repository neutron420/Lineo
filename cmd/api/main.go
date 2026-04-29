package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"queueless/ai-models/ai/core/api"
	"queueless/ai-models/ai/core/chatbot"
	"queueless/ai-models/ai/core/waittime"
	"queueless/ai-models/ai/core/slots"

	"queueless/internal/events"
	"queueless/internal/handler"
	"queueless/internal/repository"
	"queueless/internal/service"
	"queueless/internal/worker"
	cronjobs "queueless/cron-jobs"
	"queueless/pkg/broker"
	"queueless/pkg/config"
	"queueless/pkg/db"
	"queueless/pkg/logger"
	"queueless/pkg/metrics"
	"queueless/pkg/middleware"
	"queueless/pkg/redis"
)

func main() {
	logger.Init()

	if os.Getenv("ENV") != "production" {
		if err := godotenv.Load(); err != nil {
			slog.Info("no .env file found, relying on environment variables")
		}
	}

	metrics.Register()

	db.InitDB()
	redis.InitRedis()

	rabbitURL := config.Secret("RABBITMQ_URL")
	rabbitClient, err := broker.NewRabbitMQ(rabbitURL, slog.Default())
	if err != nil {
		slog.Warn("rabbitmq not available at startup, will keep retrying in background", "error", err)
		// We still create the client if NewRabbitMQ returns it despite error (it handles reconnect)
		// If it's nil, we might need a dummy bus or handle it in NewRabbitBus
	}

	bus := events.NewRabbitBus(rabbitClient)

	userRepo := repository.NewUserRepository()
	orgRepo := repository.NewOrganizationRepository()
	queueRepo := repository.NewQueueRepository()

	feedbackRepo := repository.NewFeedbackRepository()
	pushRepo := repository.NewPushSubscriptionRepository()
	slotAnalyticsRepo := repository.NewSlotAnalyticsRepository(db.DB)

	authService := service.NewAuthService(userRepo)
	orgService := service.NewOrganizationService(orgRepo)
	userSubService := service.NewUserSubscriptionService()
	pushService := service.NewPushService(pushRepo)
	queueService := service.NewQueueService(queueRepo, orgRepo, userSubService, bus, pushService)
	mapService := service.NewMapService(orgRepo, redis.Client)
	apptService := service.NewAppointmentService(orgRepo, queueService, userSubService, bus, pushService, slotAnalyticsRepo)
	paymentService := service.NewPaymentService()
	feedbackService := service.NewFeedbackService(feedbackRepo, queueRepo)

	authHandler := handler.NewAuthHandler(authService, userSubService)
	orgHandler := handler.NewOrgHandler(orgService)
	queueHandler := handler.NewQueueHandler(queueService)
	
	// WaitTime AI Predictor Setup
	sqlDB, _ := db.DB.DB()
	waitTimeRepo := &waittime.WaitTimeRepo{DB: sqlDB}
	waitTimeService := waittime.NewWaitTimeService(waitTimeRepo, redis.Client)
	aiQueueHandler := api.NewQueueHandler(waitTimeService)
	
	// Chatbot AI Receptionist Setup
	chatRepo := chatbot.NewChatRepo(db.DB)
	chatAdapter := service.NewChatbotAdapter(queueService, apptService, orgService)
	chatSvc := chatbot.NewChatbotService(chatRepo, chatAdapter, chatAdapter, chatAdapter)
	smsHandler := chatbot.NewSMSHandler(chatSvc, os.Getenv("TWILIO_AUTH_TOKEN"))
	webChatHandler := chatbot.NewWebChatHandler(chatSvc)
	
	mapHandler := handler.NewMapHandler(mapService)
	apptHandler := handler.NewAppointmentHandler(apptService)
	paymentHandler := handler.NewPaymentHandler(paymentService)
	subHandler := handler.NewSubscriptionHandler(userSubService)
	feedbackHandler := handler.NewFeedbackHandler(feedbackService)
	pushHandler := handler.NewPushHandler(pushRepo)
	uploadHandler := handler.NewUploadHandler()
	adminHandler := handler.NewAdminHandler()

	// AI Smart Slot Recommendation Setup
	aiSlotService := slots.NewAISlotService(slotAnalyticsRepo, orgRepo, chatbot.NewOpenAIChatbot())
	aiSlotHandler := slots.NewAISlotHandler(aiSlotService, orgRepo)

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	corsConfig := cors.DefaultConfig()
	corsConfig.AllowCredentials = true
	corsConfig.AddAllowHeaders("Authorization", "Content-Type", "X-Idempotency-Key")
	corsConfig.AddAllowMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")

	if os.Getenv("ENV") == "production" {
		origins := strings.Split(os.Getenv("ALLOWED_ORIGINS"), ",")
		allow := make([]string, 0, len(origins))
		for _, item := range origins {
			trimmed := strings.TrimSpace(item)
			if trimmed != "" {
				allow = append(allow, trimmed)
			}
		}
		if len(allow) == 0 {
			slog.Error("ALLOWED_ORIGINS must be set in production")
			os.Exit(1)
		}
		corsConfig.AllowOrigins = allow
	} else {
		corsConfig.AllowAllOrigins = true
		corsConfig.AllowCredentials = false
	}
	r.Use(cors.New(corsConfig))

	r.Use(middleware.LoggerMiddleware())
	r.Use(gin.Recovery())
	r.Use(middleware.RateLimitMiddleware())

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Welcome to QueueLess API - Enterprise Multi-Tenant Queue System",
			"version": "2.0.0",
			"status":  "Running",
		})
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})
	r.GET("/metrics", gin.WrapH(metrics.Handler()))
	r.GET("/ws", handler.WsHandler)

	v1 := r.Group("/api/v1")
	{
		auth := v1.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/forgot-password", authHandler.ForgotPassword)
			auth.POST("/reset-password", authHandler.ResetPassword)
			auth.POST("/register-org", authHandler.RegisterOrganization)
			auth.PUT("/update-avatar-public", authHandler.UpdateAvatarPublic)
		}

		v1.POST("/org", orgHandler.CreateOrganization)
		v1.POST("/queue/kiosk", queueHandler.EnqueueKiosk)
		v1.GET("/queue/:key/wait-time", aiQueueHandler.GetWaitTime)
		v1.GET("/queue/:key/state", queueHandler.GetState)
		v1.GET("/queue/:key/position/:token", queueHandler.GetPosition)
		v1.GET("/search/nearby", mapHandler.SearchNearby)
		v1.GET("/search/address", mapHandler.GetAddress)
		v1.GET("/announcement/latest", adminHandler.GetLatestAnnouncement)
		v1.POST("/upload", uploadHandler.Upload)
		v1.POST("/payments/razorpay/webhook", paymentHandler.RazorpayWebhook)
		v1.GET("/push/vapid-key", pushHandler.VAPIDKey)
		
		// AI Chatbot Twilio Webhook (Still public)
		v1.POST("/webhook/sms", smsHandler.HandleIncomingSMS)

		protected := v1.Group("/")
		protected.Use(middleware.AuthMiddleware())
		{
			// AI Chatbot Web Routes (Protected)
			protected.POST("/chat", webChatHandler.HandleWebChat)
			protected.GET("/chat/history", webChatHandler.HandleGetHistory)

			protected.GET("/org/my", orgHandler.GetMyOrganization)
			protected.POST("/org/queue", orgHandler.CreateQueue)
			protected.GET("/queue/active", queueHandler.GetActiveTicket)
			protected.GET("/queue/history", queueHandler.GetUserHistory)
			protected.POST("/queue/join", queueHandler.Enqueue)
			protected.POST("/queue/:key/cancel/:token", queueHandler.CancelTicket)
			protected.GET("/tickets/:id/status", queueHandler.StreamTicketStatus)

			protected.POST("/appointments/book", apptHandler.Book)
			protected.GET("/appointments", apptHandler.List)
			protected.POST("/appointments/:id/checkin", apptHandler.CheckIn)
			protected.POST("/appointments/:id/reschedule", apptHandler.Reschedule)
			protected.POST("/appointments/:id/cancel", apptHandler.Cancel)
			protected.GET("/appointments/recommend", aiSlotHandler.GetRecommendations)
			protected.POST("/payments/razorpay/order", paymentHandler.CreateRazorpayOrder)
			protected.POST("/payments/razorpay/verify", paymentHandler.VerifyRazorpayPayment)
			protected.POST("/user/upgrade", subHandler.UpgradeTier)
			protected.GET("/user/me", authHandler.GetMe)
			protected.PUT("/users/profile", authHandler.UpdateMe)
			protected.POST("/users/change-password", authHandler.ChangePassword)
			protected.DELETE("/users/deactivate", authHandler.DeactivateMe)
			protected.POST("/feedback", feedbackHandler.Submit)
			protected.POST("/push/subscribe", pushHandler.Subscribe)

			staff := v1.Group("/staff")
			staff.Use(middleware.AuthMiddleware(), middleware.StaffMiddleware())
			{
				staff.GET("/appointments", apptHandler.ListForOrg)
				staff.POST("/queue/:key/next", queueHandler.CallNext)
				staff.POST("/queue/:key/complete", queueHandler.CompleteSession)
				staff.POST("/queue/:key/hold", queueHandler.MarkHolding)
				staff.POST("/queue/:key/pause", queueHandler.PauseQueue)
				staff.GET("/queue/:key/analytics", queueHandler.GetAnalytics)
				staff.POST("/queue/:key/reorder", queueHandler.ReorderQueue)
				staff.POST("/queue/:key/noshow/:token", queueHandler.MarkNoShow)
				staff.GET("/analytics/peak-hours", queueHandler.PeakHours)
			}

			admin := protected.Group("/admin")
			admin.Use(middleware.AdminMiddleware())
			{
				admin.POST("/queue", orgHandler.CreateQueue)
				// Backward-compatible aliases for existing admin clients.
				admin.POST("/queue/:key/next", queueHandler.CallNext)
				admin.POST("/queue/:key/complete", queueHandler.CompleteSession)
				admin.POST("/queue/:key/hold", queueHandler.MarkHolding)
				admin.POST("/queue/:key/pause", queueHandler.PauseQueue)
				admin.GET("/queue/:key/analytics", queueHandler.GetAnalytics)
				admin.POST("/queue/:key/reorder", queueHandler.ReorderQueue)
				admin.POST("/queue/:key/noshow/:token", queueHandler.MarkNoShow)
				admin.GET("/analytics/peak-hours", queueHandler.PeakHours)
				admin.POST("/config", orgHandler.CreateOrgConfig)
				admin.GET("/config", orgHandler.GetOrgConfig)
				admin.PUT("/config", orgHandler.UpsertOrgConfig)
				admin.DELETE("/config", orgHandler.DeleteOrgConfig)
				admin.POST("/upgrade-plan", orgHandler.UpgradePlan)
				admin.POST("/staff", authHandler.AddStaff)
				admin.GET("/feedback", feedbackHandler.GetByOrg)
				
				// Global Insights and Pipelines
				admin.GET("/dashboard", adminHandler.GetSystemMetrics)
				admin.GET("/analytics", adminHandler.GetPlatformAnalytics)
				admin.GET("/verifications", adminHandler.GetVerifications)
				admin.GET("/users", adminHandler.GetUsers)
				admin.POST("/users/:id/ban", adminHandler.BanUser)
				admin.PUT("/verifications/:id/status", adminHandler.UpdateVerificationStatus)
				admin.PUT("/system/config", adminHandler.UpdateSystemConfig)
				admin.GET("/payments", adminHandler.GetPayments)
				admin.GET("/payments/users", adminHandler.GetUserPayments)
				admin.GET("/notifications", adminHandler.GetNotifications)
				admin.POST("/broadcast", adminHandler.SendBroadcast)
				admin.GET("/announcements", adminHandler.GetAnnouncements)
				admin.PUT("/announcements/:id", adminHandler.UpdateAnnouncement)
				admin.DELETE("/announcements/:id", adminHandler.DeleteAnnouncement)
				admin.GET("/terminals", adminHandler.GetTerminals)
			}
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	workerCtx, workerCancel := context.WithCancel(context.Background())
	var workerWG sync.WaitGroup
	aiProactiveSvc := chatbot.NewProactiveService(chatbot.NewOpenAIChatbot(), bus, db.DB)

	consumers := &worker.Consumers{
		Rabbit:   rabbitClient,
		Bus:      bus,
		QueueSvc: queueService,
		ApptSvc:  apptService,
		OrgRepo:  orgRepo,
		PushSvc:  pushService,
		AIProactiveSvc: aiProactiveSvc,
		Logger:   slog.Default(),
	}
	cronRunner := consumers.Start(workerCtx, &workerWG)

	// ═══ Notification Cron Scheduler (Appointment + Queue Reminders) ═══
	pushAdapter := &pushSenderAdapter{svc: pushService}
	notifScheduler := cronjobs.NewScheduler(pushAdapter, queueRepo, orgRepo)
	notifScheduler.Register()
	notifScheduler.Start()

	// Wire reminder hooks into appointment service (Book → OnBookingConfirmed, etc.)
	apptService.SetReminderService(notifScheduler.ApptService())

	go handler.StartRedisBroadcaster(workerCtx)

	go func() {
		ticker := time.NewTicker(15 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-workerCtx.Done():
				return
			case <-ticker.C:
				if err := apptService.AutoCancelNoShows(); err != nil {
					slog.Error("AutoCancelNoShows failed", "error", err)
				}
			}
		}
	}()

	go func() {
		slog.Info("queueless server starting", "port", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server listen error", "error", err)
		}
	}()

	shutdownCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM, syscall.SIGINT)
	defer stop()
	<-shutdownCtx.Done()

	slog.Info("shutdown signal received")

	httpCtx, httpCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer httpCancel()
	if err := srv.Shutdown(httpCtx); err != nil {
		slog.Error("http server forced to shutdown", "error", err)
	}

	workerCancel()
	ctxStopCron := cronRunner.Stop()
	notifStopCtx := notifScheduler.Stop()
	select {
	case <-ctxStopCron.Done():
	case <-time.After(5 * time.Second):
	}
	select {
	case <-notifStopCtx.Done():
	case <-time.After(5 * time.Second):
	}

	waitDone := make(chan struct{})
	go func() {
		workerWG.Wait()
		close(waitDone)
	}()
	select {
	case <-waitDone:
	case <-time.After(10 * time.Second):
		slog.Warn("workers did not exit before timeout")
	}

	handler.ShutdownWebsocketHub()
	redis.FlushPipeline()
	rabbitClient.Close()
	db.CloseDB()
	redis.CloseRedis()

	slog.Info("server exited cleanly")
}

// pushSenderAdapter bridges service.PushService → cronjobs.PushSender.
// Needed because cronjobs cannot import internal/service (cycle), so it
// defines its own PushPayload with identical fields.
type pushSenderAdapter struct {
	svc service.PushService
}

func (a *pushSenderAdapter) SendToUser(ctx context.Context, userID uint, payload cronjobs.PushPayload) error {
	return a.svc.SendToUser(ctx, userID, service.PushPayload{
		Title:     payload.Title,
		Body:      payload.Body,
		URL:       payload.URL,
		Icon:      payload.Icon,
		NotifType: payload.NotifType,
	})
}
