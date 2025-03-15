package main

import (
	"flag"
	"log"
	"net/http"

	"github.com/dma23/Valo-Pictionary/game"
	"github.com/gorilla/websocket"
)

var addr = flag.String("addr", ":8080", "http service address")

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
	id   string
	name string
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	gameState  *game.Game
}

func newHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		gameState:  game.NewGame(),
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}

func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("upgrade:", err)
		return
	}

	client := &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, 256),
		id:   r.URL.Query().Get("id"),
		name: r.URL.Query().Get("name"),
	}
	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		processedMsg := c.hub.gameState.ProcessMessage(message, c.id, c.name)
		c.hub.broadcast <- processedMsg
	}
}

func (c *Client) writePump() {
	defer c.conn.Close()

	for {
		message, ok := <-c.send
		if !ok {
			c.conn.WriteMessage(websocket.CloseMessage, []byte{})
			return
		}

		err := c.conn.WriteMessage(websocket.TextMessage, message)
		if err != nil {
			log.Println("write error:", err)
			return
		}
	}
}

func main() {
	flag.Parse()

	hub := newHub()
	go hub.run()

	fs := http.FileServer(http.Dir("../frontend"))
	http.Handle("/", fs)

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})

	log.Printf("Starting server on %s", *addr)
	err := http.ListenAndServe(*addr, nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
