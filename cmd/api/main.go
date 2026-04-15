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

	"queueless/internal/events"
	"queueless/internal/handler"
	"queueless/internal/repository"
	"queueless/internal/service"
	"queueless/internal/worker"
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

	authService := service.NewAuthService(userRepo)
	orgService := service.NewOrganizationService(orgRepo)
	queueService := service.NewQueueService(queueRepo, orgRepo, bus)
	mapService := service.NewMapService(orgRepo)
	apptService := service.NewAppointmentService(orgRepo, queueService, bus)
	paymentService := service.NewPaymentService()
	feedbackService := service.NewFeedbackService(feedbackRepo, queueRepo)

	authHandler := handler.NewAuthHandler(authService)
	orgHandler := handler.NewOrgHandler(orgService)
	queueHandler := handler.NewQueueHandler(queueService)
	mapHandler := handler.NewMapHandler(mapService)
	apptHandler := handler.NewAppointmentHandler(apptService)
	paymentHandler := handler.NewPaymentHandler(paymentService)
	feedbackHandler := handler.NewFeedbackHandler(feedbackService)

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	r.Use(middleware.LoggerMiddleware())
	r.Use(gin.Recovery())
	r.Use(middleware.RateLimitMiddleware())

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
		}

		v1.POST("/org", orgHandler.CreateOrganization)
		v1.POST("/queue/kiosk", queueHandler.EnqueueKiosk)
		v1.GET("/queue/:key/state", queueHandler.GetState)
		v1.GET("/queue/:key/position/:token", queueHandler.GetPosition)
		v1.GET("/search/nearby", mapHandler.SearchNearby)
		v1.GET("/search/address", mapHandler.GetAddress)
		v1.POST("/payments/razorpay/webhook", paymentHandler.RazorpayWebhook)

		protected := v1.Group("/")
		protected.Use(middleware.AuthMiddleware())
		{
			protected.GET("/queue/active", queueHandler.GetActiveTicket)
			protected.GET("/queue/history", queueHandler.GetUserHistory)
			protected.POST("/queue/join", queueHandler.Enqueue)
			protected.POST("/queue/:key/cancel/:token", queueHandler.CancelTicket)
			protected.GET("/tickets/:id/status", queueHandler.StreamTicketStatus)

			protected.POST("/appointments/book", apptHandler.Book)
			protected.GET("/appointments", apptHandler.List)
			protected.POST("/appointments/:id/checkin", apptHandler.CheckIn)
			protected.POST("/payments/razorpay/order", paymentHandler.CreateRazorpayOrder)
			protected.POST("/payments/razorpay/verify", paymentHandler.VerifyRazorpayPayment)
			protected.POST("/feedback", feedbackHandler.Submit)

			staff := protected.Group("/staff")
			staff.Use(middleware.StaffMiddleware())
			{
				staff.POST("/queue/:key/next", queueHandler.CallNext)
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
				admin.GET("/feedback", feedbackHandler.GetByOrg)
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
	consumers := &worker.Consumers{
		Rabbit:   rabbitClient,
		Bus:      bus,
		QueueSvc: queueService,
		ApptSvc:  apptService,
		OrgRepo:  orgRepo,
		Logger:   slog.Default(),
	}
	cronRunner := consumers.Start(workerCtx, &workerWG)
	go handler.StartRedisBroadcaster(workerCtx)

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
	select {
	case <-ctxStopCron.Done():
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
