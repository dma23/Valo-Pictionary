package game

import (
	"encoding/json"
	"log"
	"math/rand"
	"time"
)

type Player struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Score int    `json:"score"`
}

type Message struct {
	Type       string      `json:"type"`
	PlayerID   string      `json:"playerId,omitempty"`
	PlayerName string      `json:"playerName,omitempty"`
	Content    interface{} `json:"content,omitempty"`
}

type Game struct {
	CurrentWord    string            `json:"currentWord,omitempty"`
	CurrentDrawer  string            `json:"currentDrawer,omitempty"`
	Players        map[string]Player `json:"players"`
	Round          int               `json:"round"`
	MaxRounds      int               `json:"maxRounds"`
	State          string            `json:"state"`
	WordList       []string          `json:"wordList,omitempty"`
	RoundTimeLimit int               `json:"roundTimeLimit"`
	TimerEnd       time.Time         `json:"-"`
}

type DrawData struct {
	X         int    `json:"x"`
	Y         int    `json:"y"`
	PrevX     int    `json:"prevX"`
	PrevY     int    `json:"prevY"`
	Color     string `json:"color"`
	LineWidth int    `json:"lineWidth"`
	Type      string `json:"type"`
}

func NewGame() *Game {
	return &Game{
		Players:        make(map[string]Player),
		Round:          0,
		MaxRounds:      3,
		State:          "waiting",
		WordList:       defaultWordList(),
		RoundTimeLimit: 60, // 60 seconds per round
	}
}

func (g *Game) ProcessMessage(messageBytes []byte, playerID, playerName string) []byte {
	var msg Message
	err := json.Unmarshal(messageBytes, &msg)
	if err != nil {
		log.Printf("Error unmarshaling message: %v", err)
		return nil
	}

	msg.PlayerID = playerID
	msg.PlayerName = playerName

	switch msg.Type {
	case "join":
		g.handlePlayerJoin(msg)
	case "start":
		g.handleGameStart()
	case "draw":

		if playerID == g.CurrentDrawer {

			return messageBytes
		}
		return nil
	case "guess":
		g.handleGuess(msg)
	case "clearCanvas":
		if playerID == g.CurrentDrawer {
			return messageBytes
		}
		return nil
	}

	response := Message{
		Type:    "gameState",
		Content: g,
	}

	responseBytes, err := json.Marshal(response)
	if err != nil {
		log.Printf("Error marshaling response: %v", err)
		return nil
	}

	return responseBytes
}

func (g *Game) handlePlayerJoin(msg Message) {
	if _, exists := g.Players[msg.PlayerID]; !exists {
		g.Players[msg.PlayerID] = Player{
			ID:    msg.PlayerID,
			Name:  msg.PlayerName,
			Score: 0,
		}
	}
}

func (g *Game) handleGameStart() {
	if g.State != "waiting" || len(g.Players) < 2 {
		return
	}

	g.Round = 1
	g.State = "drawing"
	g.selectDrawer()
	g.selectWord()
	g.TimerEnd = time.Now().Add(time.Duration(g.RoundTimeLimit) * time.Second)

	go g.roundTimer()
}

func (g *Game) handleGuess(msg Message) {
	if g.State != "drawing" {
		return
	}

	guess, ok := msg.Content.(string)
	if !ok {
		log.Println("Invalid guess format")
		return
	}

	if msg.PlayerID == g.CurrentDrawer {
		return
	}

	if guess == g.CurrentWord {

		player := g.Players[msg.PlayerID]
		player.Score += 100
		g.Players[msg.PlayerID] = player

		drawer := g.Players[g.CurrentDrawer]
		drawer.Score += 50
		g.Players[g.CurrentDrawer] = drawer

		g.endRound()
	}
}

func (g *Game) selectDrawer() {
	playerIDs := make([]string, 0, len(g.Players))
	for id := range g.Players {
		playerIDs = append(playerIDs, id)
	}

	rand.Seed(time.Now().UnixNano())
	g.CurrentDrawer = playerIDs[rand.Intn(len(playerIDs))]
}

func (g *Game) selectWord() {
	rand.Seed(time.Now().UnixNano())
	g.CurrentWord = g.WordList[rand.Intn(len(g.WordList))]
}

func (g *Game) endRound() {
	g.State = "roundEnd"

	time.Sleep(5 * time.Second)

	g.Round++
	if g.Round > g.MaxRounds {
		g.State = "gameEnd"
	} else {
		g.State = "drawing"
		g.selectDrawer()
		g.selectWord()
		g.TimerEnd = time.Now().Add(time.Duration(g.RoundTimeLimit) * time.Second)
		go g.roundTimer()
	}
}

func (g *Game) roundTimer() {
	for time.Now().Before(g.TimerEnd) {
		time.Sleep(1 * time.Second)
	}

	if g.State == "drawing" {
		g.endRound()
	}
}

func defaultWordList() []string {
	return []string{
		"Jett", "Raze", "Breach", "Phoenix",
		// insert more valorant terms here
	}
}
