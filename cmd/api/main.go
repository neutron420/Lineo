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

const (
	envVar      = "ENV"
	prodEnv     = "production"
	configPath  = "/config"
	apiV1Path   = "/api/v1"
)

func main() {
	logger.Init()
	loadEnv()

	metrics.Register()
	db.InitDB()
	redis.InitRedis()

	bus, rabbitClient := initInfrastructure()
	repos := initRepositories()
	services := initServices(repos, bus)
	handlers := initHandlers(services, repos)

	r := setupRouter(handlers)
	srv := startServer(r)

	// Background processes
	workerCtx, workerCancel := context.WithCancel(context.Background())
	var workerWG sync.WaitGroup
	
	initBackgroundWorkers(workerCtx, &workerWG, services, bus, rabbitClient, repos)
	setupShutdownHandler(srv, workerCancel, &workerWG, rabbitClient)
}

func loadEnv() {
	if os.Getenv(envVar) != prodEnv {
		if err := godotenv.Load(); err != nil {
			slog.Info("no .env file found, relying on environment variables")
		}
	}
}

func initInfrastructure() (events.Bus, *broker.RabbitMQ) {
	rabbitURL := config.Secret("RABBITMQ_URL")
	rabbitClient, err := broker.NewRabbitMQ(rabbitURL, slog.Default())
	if err != nil {
		slog.Warn("rabbitmq not available at startup, will keep retrying in background", "error", err)
	}
	return events.NewRabbitBus(rabbitClient), rabbitClient
}


func initRepositories() map[string]interface{} {
	return map[string]interface{}{
		"user":           repository.NewUserRepository(),
		"org":            repository.NewOrganizationRepository(),
		"queue":          repository.NewQueueRepository(),
		"feedback":       repository.NewFeedbackRepository(),
		"push":           repository.NewPushSubscriptionRepository(),
		"slotAnalytics": repository.NewSlotAnalyticsRepository(db.DB),
	}
}

func initServices(repos map[string]interface{}, bus events.Bus) map[string]interface{} {
	uRepo := repos["user"].(repository.UserRepository)
	oRepo := repos["org"].(repository.OrganizationRepository)
	qRepo := repos["queue"].(repository.QueueRepository)
	pRepo := repos["push"].(repository.PushSubscriptionRepository)
	sRepo := repos["slotAnalytics"].(repository.SlotAnalyticsRepository)

	userSub := service.NewUserSubscriptionService()
	push := service.NewPushService(pRepo)
	queue := service.NewQueueService(qRepo, oRepo, userSub, bus, push)
	
	return map[string]interface{}{
		"auth":     service.NewAuthService(uRepo),
		"org":      service.NewOrganizationService(oRepo),
		"userSub":  userSub,
		"push":     push,
		"queue":    queue,
		"map":      service.NewMapService(oRepo, redis.Client),
		"appt":     service.NewAppointmentService(oRepo, queue, userSub, bus, push, sRepo),
		"payment":  service.NewPaymentService(),
		"feedback": service.NewFeedbackService(repos["feedback"].(repository.FeedbackRepository), qRepo),
	}
}

func initHandlers(services map[string]interface{}, repos map[string]interface{}) map[string]interface{} {
	authSvc := services["auth"].(service.AuthService)
	orgSvc := services["org"].(service.OrganizationService)
	queueSvc := services["queue"].(service.QueueService)
	apptSvc := services["appt"].(service.AppointmentService)
	userSubSvc := services["userSub"].(service.UserSubscriptionService)
	
	// AI Components
	sqlDB, _ := db.DB.DB()
	waitTimeSvc := waittime.NewWaitTimeService(&waittime.WaitTimeRepo{DB: sqlDB}, redis.Client)
	
	chatRepo := chatbot.NewChatRepo(db.DB)
	chatAdapter := service.NewChatbotAdapter(queueSvc, apptSvc, orgSvc)
	chatSvc := chatbot.NewChatbotService(chatRepo, chatAdapter, chatAdapter, chatAdapter)
	
	aiSlotSvc := slots.NewAISlotService(repos["slotAnalytics"].(repository.SlotAnalyticsRepository), repos["org"].(repository.OrganizationRepository), chatbot.NewOpenAIChatbot())

	return map[string]interface{}{
		"auth":      handler.NewAuthHandler(authSvc, userSubSvc),
		"org":       handler.NewOrgHandler(orgSvc),
		"queue":     handler.NewQueueHandler(queueSvc),
		"aiQueue":   api.NewQueueHandler(waitTimeSvc),
		"sms":       chatbot.NewSMSHandler(chatSvc, os.Getenv("TWILIO_AUTH_TOKEN")),
		"webChat":   chatbot.NewWebChatHandler(chatSvc),
		"map":       handler.NewMapHandler(services["map"].(service.MapService)),
		"appt":      handler.NewAppointmentHandler(apptSvc),
		"payment":   handler.NewPaymentHandler(services["payment"].(service.PaymentService)),
		"sub":       handler.NewSubscriptionHandler(userSubSvc),
		"feedback":  handler.NewFeedbackHandler(services["feedback"].(service.FeedbackService)),
		"push":      handler.NewPushHandler(repos["push"].(repository.PushSubscriptionRepository)),
		"upload":    handler.NewUploadHandler(),
		"admin":     handler.NewAdminHandler(),
		"aiSlot":    slots.NewAISlotHandler(aiSlotSvc, repos["org"].(repository.OrganizationRepository)),
	}
}

func setupRouter(h map[string]interface{}) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	setupCORS(r)
	r.Use(middleware.LoggerMiddleware(), gin.Recovery(), middleware.SecurityHeaders(), middleware.RateLimitMiddleware())

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "Welcome to QueueLess API", "version": "2.0.0", "status": "Running"})
	})
	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "healthy"}) })
	r.GET("/metrics", gin.WrapH(metrics.Handler()))
	r.GET("/ws", handler.WsHandler)

	v1 := r.Group(apiV1Path)
	registerPublicRoutes(v1, h)
	registerProtectedRoutes(v1, h)

	return r
}

func setupCORS(r *gin.Engine) {
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowCredentials = true
	corsConfig.AddAllowHeaders("Authorization", "Content-Type", "X-Idempotency-Key")
	corsConfig.AddAllowMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")

	if os.Getenv(envVar) == prodEnv {
		origins := strings.Split(os.Getenv("ALLOWED_ORIGINS"), ",")
		var allow []string
		for _, item := range origins {
			if trimmed := strings.TrimSpace(item); trimmed != "" {
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
}

func registerPublicRoutes(v1 *gin.RouterGroup, h map[string]interface{}) {
	authH := h["auth"].(*handler.AuthHandler)
	orgH := h["org"].(*handler.OrgHandler)
	qH := h["queue"].(*handler.QueueHandler)
	aiQH := h["aiQueue"].(*api.QueueHandler)
	mapH := h["map"].(*handler.MapHandler)
	adminH := h["admin"].(*handler.AdminHandler)
	upH := h["upload"].(*handler.UploadHandler)
	payH := h["payment"].(*handler.PaymentHandler)
	pushH := h["push"].(*handler.PushHandler)
	smsH := h["sms"].(*chatbot.SMSHandler)

	auth := v1.Group("/auth")
	{
		auth.POST("/register", authH.Register)
		auth.POST("/login", authH.Login)
		auth.POST("/forgot-password", authH.ForgotPassword)
		auth.POST("/reset-password", authH.ResetPassword)
		auth.POST("/register-org", authH.RegisterOrganization)
	}

	v1.POST("/org", orgH.CreateOrganization)
	v1.POST("/queue/kiosk", qH.EnqueueKiosk)
	v1.GET("/queue/:key/wait-time", aiQH.GetWaitTime)
	v1.GET("/queue/:key/state", qH.GetState)
	v1.GET("/queue/:key/position/:token", qH.GetPosition)
	v1.GET("/search/nearby", mapH.SearchNearby)
	v1.GET("/search/address", mapH.GetAddress)
	v1.GET("/announcement/latest", adminH.GetLatestAnnouncement)
	v1.POST("/upload", upH.Upload)
	v1.POST("/payments/razorpay/webhook", payH.RazorpayWebhook)
	v1.GET("/push/vapid-key", pushH.VAPIDKey)
	v1.POST("/webhook/sms", smsH.HandleIncomingSMS)
}

func registerProtectedRoutes(v1 *gin.RouterGroup, h map[string]interface{}) {
	protected := v1.Group("/")
	protected.Use(middleware.AuthMiddleware())
	
	registerUserRoutes(protected, h)
	registerStaffRoutes(protected, h)
	registerAdminRoutes(protected, h)
}

func registerUserRoutes(p *gin.RouterGroup, h map[string]interface{}) {
	webCH := h["webChat"].(*chatbot.WebChatHandler)
	orgH := h["org"].(*handler.OrgHandler)
	qH := h["queue"].(*handler.QueueHandler)
	apptH := h["appt"].(*handler.AppointmentHandler)
	aiSlotH := h["aiSlot"].(*slots.AISlotHandler)
	payH := h["payment"].(*handler.PaymentHandler)
	subH := h["sub"].(*handler.SubscriptionHandler)
	authH := h["auth"].(*handler.AuthHandler)
	fH := h["feedback"].(*handler.FeedbackHandler)
	pushH := h["push"].(*handler.PushHandler)

	p.POST("/chat", webCH.HandleWebChat)
	p.GET("/chat/history", webCH.HandleGetHistory)
	p.GET("/org/my", orgH.GetMyOrganization)
	p.POST("/org/queue", orgH.CreateQueue)
	p.GET("/queue/active", qH.GetActiveTicket)
	p.GET("/queue/history", qH.GetUserHistory)
	p.POST("/queue/join", qH.Enqueue)
	p.POST("/queue/:key/cancel/:token", qH.CancelTicket)
	p.GET("/tickets/:id/status", qH.StreamTicketStatus)
	p.POST("/appointments/book", apptH.Book)
	p.GET("/appointments", apptH.List)
	p.POST("/appointments/:id/checkin", apptH.CheckIn)
	p.POST("/appointments/:id/reschedule", apptH.Reschedule)
	p.POST("/appointments/:id/cancel", apptH.Cancel)
	p.GET("/appointments/recommend", aiSlotH.GetRecommendations)
	p.POST("/payments/razorpay/order", payH.CreateRazorpayOrder)
	p.POST("/payments/razorpay/verify", payH.VerifyRazorpayPayment)
	p.POST("/user/upgrade", subH.UpgradeTier)
	p.GET("/user/me", authH.GetMe)
	p.PUT("/users/profile", authH.UpdateMe)
	p.POST("/users/change-password", authH.ChangePassword)
	p.DELETE("/users/deactivate", authH.DeactivateMe)
	p.POST("/feedback", fH.Submit)
	p.POST("/push/subscribe", pushH.Subscribe)
}

func registerStaffRoutes(p *gin.RouterGroup, h map[string]interface{}) {
	staff := p.Group("/staff")
	staff.Use(middleware.StaffMiddleware())
	
	apptH := h["appt"].(*handler.AppointmentHandler)
	qH := h["queue"].(*handler.QueueHandler)

	staff.GET("/appointments", apptH.ListForOrg)
	staff.POST("/queue/:key/next", qH.CallNext)
	staff.POST("/queue/:key/complete", qH.CompleteSession)
	staff.POST("/queue/:key/hold", qH.MarkHolding)
	staff.POST("/queue/:key/pause", qH.PauseQueue)
	staff.GET("/queue/:key/analytics", qH.GetAnalytics)
	staff.POST("/queue/:key/reorder", qH.ReorderQueue)
	staff.POST("/queue/:key/noshow/:token", qH.MarkNoShow)
	staff.GET("/analytics/peak-hours", qH.PeakHours)
}

func registerAdminRoutes(p *gin.RouterGroup, h map[string]interface{}) {
	admin := p.Group("/admin")
	admin.Use(middleware.AdminMiddleware())
	
	orgH := h["org"].(*handler.OrgHandler)
	qH := h["queue"].(*handler.QueueHandler)
	authH := h["auth"].(*handler.AuthHandler)
	fH := h["feedback"].(*handler.FeedbackHandler)
	adminH := h["admin"].(*handler.AdminHandler)

	admin.POST("/queue", orgH.CreateQueue)
	admin.POST("/queue/:key/next", qH.CallNext)
	admin.POST("/queue/:key/complete", qH.CompleteSession)
	admin.POST("/queue/:key/hold", qH.MarkHolding)
	admin.POST("/queue/:key/pause", qH.PauseQueue)
	admin.GET("/queue/:key/analytics", qH.GetAnalytics)
	admin.POST("/queue/:key/reorder", qH.ReorderQueue)
	admin.POST("/queue/:key/noshow/:token", qH.MarkNoShow)
	admin.GET("/analytics/peak-hours", qH.PeakHours)
	
	admin.POST(configPath, orgH.CreateOrgConfig)
	admin.GET(configPath, orgH.GetOrgConfig)
	admin.PUT(configPath, orgH.UpsertOrgConfig)
	admin.DELETE(configPath, orgH.DeleteOrgConfig)
	
	admin.POST("/upgrade-plan", orgH.UpgradePlan)
	admin.POST("/staff", authH.AddStaff)
	admin.GET("/feedback", fH.GetByOrg)
	admin.GET("/dashboard", adminH.GetSystemMetrics)
	admin.GET("/analytics", adminH.GetPlatformAnalytics)
	admin.GET("/verifications", adminH.GetVerifications)
	admin.GET("/users", adminH.GetUsers)
	admin.POST("/users/:id/ban", adminH.BanUser)
	admin.PUT("/verifications/:id/status", adminH.UpdateVerificationStatus)
	admin.PUT("/system/config", adminH.UpdateSystemConfig)
	admin.GET("/payments", adminH.GetPayments)
	admin.GET("/payments/users", adminH.GetUserPayments)
	admin.GET("/notifications", adminH.GetNotifications)
	admin.POST("/broadcast", adminH.SendBroadcast)
	admin.GET("/announcements", adminH.GetAnnouncements)
	admin.PUT("/announcements/:id", adminH.UpdateAnnouncement)
	admin.DELETE("/announcements/:id", adminH.DeleteAnnouncement)
	admin.GET("/terminals", adminH.GetTerminals)
}

func startServer(r *gin.Engine) *http.Server {
	port := os.Getenv("PORT")
	if port == "" { port = "8080" }
	
	srv := &http.Server{
		Addr: ":" + port,
		Handler: r,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		slog.Info("queueless server starting", "port", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server listen error", "error", err)
		}
	}()
	return srv
}

func initBackgroundWorkers(ctx context.Context, wg *sync.WaitGroup, services map[string]interface{}, bus events.Bus, rabbit *broker.RabbitMQ, repos map[string]interface{}) {
	qSvc := services["queue"].(service.QueueService)
	aSvc := services["appt"].(service.AppointmentService)
	pSvc := services["push"].(service.PushService)
	oRepo := repos["org"].(repository.OrganizationRepository)
	qRepo := repos["queue"].(repository.QueueRepository)

	aiProactive := chatbot.NewProactiveService(chatbot.NewOpenAIChatbot(), bus, db.DB)
	consumers := &worker.Consumers{
		Rabbit: rabbit, Bus: bus, QueueSvc: qSvc, ApptSvc: aSvc, OrgRepo: oRepo, PushSvc: pSvc, AIProactiveSvc: aiProactive, Logger: slog.Default(),
	}
	cronRunner := consumers.Start(ctx, wg)

	pushAdapter := &pushSenderAdapter{svc: pSvc}
	notifScheduler := cronjobs.NewScheduler(pushAdapter, qRepo, oRepo)
	notifScheduler.Register()
	notifScheduler.Start()
	aSvc.SetReminderService(notifScheduler.ApptService())

	go handler.StartRedisBroadcaster(ctx)
	go autoCancelNoShowsTask(ctx, aSvc)
	
	// Store runners for shutdown if needed, though they respond to ctx.Done()
	_ = cronRunner
}

func autoCancelNoShowsTask(ctx context.Context, apptSvc service.AppointmentService) {
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done(): return
		case <-ticker.C:
			if err := apptSvc.AutoCancelNoShows(); err != nil {
				slog.Error("AutoCancelNoShows failed", "error", err)
			}
		}
	}
}

func setupShutdownHandler(srv *http.Server, cancel context.CancelFunc, wg *sync.WaitGroup, rabbit *broker.RabbitMQ) {
	shutdownCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		defer stop()
		<-shutdownCtx.Done()
		slog.Info("shutdown signal received")

		httpCtx, httpCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer httpCancel()
		srv.Shutdown(httpCtx)
		cancel()
		
		wg.Wait()
		handler.ShutdownWebsocketHub()
		redis.FlushPipeline()
		rabbit.Close()
		db.CloseDB()
		redis.CloseRedis()
		slog.Info("server exited cleanly")
	}()
}

type pushSenderAdapter struct {
	svc service.PushService
}

func (a *pushSenderAdapter) SendToUser(ctx context.Context, userID uint, payload cronjobs.PushPayload) error {
	return a.svc.SendToUser(ctx, userID, service.PushPayload{
		Title: payload.Title, Body: payload.Body, URL: payload.URL, Icon: payload.Icon, NotifType: payload.NotifType,
	})
}
