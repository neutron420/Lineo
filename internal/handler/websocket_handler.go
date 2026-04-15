package handler

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"queueless/pkg/metrics"
	"queueless/pkg/redis"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Client struct {
	Conn  *websocket.Conn
	OrgID uint
}

var (
	clients   = make(map[*Client]bool)
	clientsMu sync.Mutex
)

func WsHandler(c *gin.Context) {
	orgIDRaw := c.Query("org_id")
	if orgIDRaw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "org_id query param is required"})
		return
	}

	orgID, err := strconv.ParseUint(orgIDRaw, 10, 64)
	if err != nil || orgID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org_id"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := &Client{Conn: conn, OrgID: uint(orgID)}

	clientsMu.Lock()
	clients[client] = true
	clientsMu.Unlock()
	metrics.IncWSConnections()

	defer func() {
		clientsMu.Lock()
		delete(clients, client)
		clientsMu.Unlock()
		metrics.DecWSConnections()
		_ = conn.Close()
	}()

	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			return
		}
	}
}

func StartRedisBroadcaster(ctx context.Context) {
	pubsub := redis.Client.PSubscribe(ctx, "org:*:queue")
	defer pubsub.Close()

	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}

			parts := strings.Split(msg.Channel, ":")
			if len(parts) != 3 {
				continue
			}
			orgID64, err := strconv.ParseUint(parts[1], 10, 64)
			if err != nil {
				continue
			}

			clientsMu.Lock()
			for client := range clients {
				if client.OrgID != uint(orgID64) {
					continue
				}
				_ = client.Conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
				if err := client.Conn.WriteMessage(websocket.TextMessage, []byte(msg.Payload)); err != nil {
					_ = client.Conn.Close()
					delete(clients, client)
				}
			}
			clientsMu.Unlock()
		}
	}
}

func ShutdownWebsocketHub() {
	clientsMu.Lock()
	defer clientsMu.Unlock()

	for client := range clients {
		_ = client.Conn.WriteControl(
			websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseNormalClosure, "server shutdown"),
			time.Now().Add(3*time.Second),
		)
		_ = client.Conn.Close()
		delete(clients, client)
	}
}

func OrgQueueChannel(orgID uint) string {
	return fmt.Sprintf("org:%d:queue", orgID)
}
