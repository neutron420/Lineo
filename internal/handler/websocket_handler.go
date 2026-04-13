package handler

import (
	"log"
	"net/http"
	"strings"
	"sync"
	"queueless/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for now
	},
}

type Client struct {
	Conn      *websocket.Conn
	QueueName string // The queue this client is subscribed to
}

var (
	clients   = make(map[*Client]bool)
	clientsMu sync.Mutex
)

// WsHandler upgrades the HTTP connection and handles websocket clients
func WsHandler(c *gin.Context) {
	queueName := c.Query("queue")
	if queueName == "" {
		queueName = "default" // or reject
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("WebSocket Upgrade Error:", err)
		return
	}

	client := &Client{Conn: conn, QueueName: queueName}

	clientsMu.Lock()
	clients[client] = true
	clientsMu.Unlock()

	defer func() {
		clientsMu.Lock()
		delete(clients, client)
		clientsMu.Unlock()
		conn.Close()
	}()

	// Read messages (could be used for ping/pong to keep connection alive)
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

// Broadcaster listens to queue updates and sends to relevant clients
func StartBroadcaster(queueSvc service.QueueService) {
	for {
		queueName := <-service.Broadcast
		
		state, err := queueSvc.GetQueueState(queueName)
		if err != nil {
			log.Println("Error fetching state for broadcast:", err)
			continue
		}

		clientsMu.Lock()
		for client := range clients {
			if client.QueueName == queueName || client.QueueName == "all" || strings.HasPrefix(client.QueueName, queueName) {
				err := client.Conn.WriteJSON(state)
				if err != nil {
					client.Conn.Close()
					delete(clients, client)
				}
			}
		}
		clientsMu.Unlock()
	}
}
