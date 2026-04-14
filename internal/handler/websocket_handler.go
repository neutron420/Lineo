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
		return true 
	},
}

type Client struct {
	Conn      *websocket.Conn
	QueueName string 
}

var (
	clients      = make(map[*Client]bool)
	clientsMu    sync.Mutex
)

func WsHandler(c *gin.Context) {
	queueName := c.Query("queue")
	if queueName == "" {
		queueName = "default"
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

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

// StartBroadcaster is the main loop that listens for both local and distributed (Redis) signals
func StartBroadcaster(queueSvc service.QueueService) {
	updateChan := queueSvc.GetLocalUpdatesChan()

	for {
		queueName := <-updateChan
		
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
