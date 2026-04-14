package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"queueless/internal/handler"
	"queueless/internal/repository"
	"queueless/internal/service"
	"queueless/pkg/db"
	"queueless/pkg/middleware"
	"queueless/pkg/redis"
)

func main() {
	if os.Getenv("ENV") != "production" {
		err := godotenv.Load()
		if err != nil {
			log.Println("No .env file found, relying on environment variables")
		}
	}

	// Initialize Storage
	db.InitDB()
	redis.InitRedis()

	// Setup Repositories
	userRepo := repository.NewUserRepository()
	orgRepo := repository.NewOrganizationRepository()
	queueRepo := repository.NewQueueRepository()

	// Setup Services
	authService := service.NewAuthService(userRepo)
	orgService := service.NewOrganizationService(orgRepo)
	queueService := service.NewQueueService(queueRepo, orgRepo)
	mapService := service.NewMapService(orgRepo)
	apptService := service.NewAppointmentService(orgRepo, queueService)

	// Start Workers
	go handler.StartBroadcaster(queueService)
	go apptService.CommuteWorker()

	// Setup Handlers
	authHandler := handler.NewAuthHandler(authService)
	orgHandler := handler.NewOrgHandler(orgService)
	queueHandler := handler.NewQueueHandler(queueService)
	mapHandler := handler.NewMapHandler(mapService)
	apptHandler := handler.NewAppointmentHandler(apptService)

	// Setup Gin Engine
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	r.Use(middleware.LoggerMiddleware())
	r.Use(gin.Recovery())
	r.Use(middleware.RateLimitMiddleware())

	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AddAllowHeaders("Authorization", "Content-Type")
	r.Use(cors.New(config))

	// Routes
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Welcome to QueueLess API - Enterprise Multi-Tenant Queue System",
			"version": "1.0.0",
			"status": "Running",
		})
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

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

		protected := v1.Group("/")
		protected.Use(middleware.AuthMiddleware())
		{
			protected.GET("/queue/active", queueHandler.GetActiveTicket)
			protected.GET("/queue/history", queueHandler.GetUserHistory)
			protected.POST("/queue/join", queueHandler.Enqueue)
			protected.POST("/queue/:key/cancel/:token", queueHandler.CancelTicket)

			protected.POST("/appointments/book", apptHandler.Book)
			protected.GET("/appointments", apptHandler.List)
			protected.POST("/appointments/:id/checkin", apptHandler.CheckIn)

			admin := protected.Group("/admin")
			admin.Use(middleware.AdminMiddleware())
			{
				admin.POST("/queue", orgHandler.CreateQueue)
				admin.POST("/queue/:key/next", queueHandler.CallNext)
				admin.POST("/queue/:key/hold", queueHandler.MarkHolding)
				admin.POST("/queue/:key/pause", queueHandler.PauseQueue)
				admin.GET("/queue/:key/analytics", queueHandler.GetAnalytics)
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

	go func() {
		log.Printf("QueueLess Server starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	db.CloseDB()
	redis.CloseRedis()

	log.Println("Server exiting")
}
