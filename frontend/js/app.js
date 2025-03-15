document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const screens = {
        join: document.getElementById('joinScreen'),
        lobby: document.getElementById('lobbyScreen'),
        game: document.getElementById('gameScreen'),
        roundEnd: document.getElementById('roundEndScreen'),
        gameEnd: document.getElementById('gameEndScreen')
    };
    
    const elements = {
        playerName: document.getElementById('playerName'),
        joinButton: document.getElementById('joinButton'),
        startButton: document.getElementById('startButton'),
        playersConnected: document.getElementById('playersConnected'),
        canvas: document.getElementById('drawingCanvas'),
        wordDisplay: document.getElementById('wordDisplay'),
        colorButtons: document.querySelectorAll('.color-btn'),
        sizeButtons: document.querySelectorAll('.size-btn'),
        clearButton: document.getElementById('clearButton'),
        chatMessages: document.getElementById('chatMessages'),
        guessInput: document.getElementById('guessInput'),
        sendGuess: document.getElementById('sendGuess'),
        scoreList: document.getElementById('scoreList'),
        currentRound: document.getElementById('currentRound'),
        maxRounds: document.getElementById('maxRounds'),
        timer: document.getElementById('timer'),
        revealedWord: document.getElementById('revealedWord'),
        roundScores: document.getElementById('roundScores'),
        finalScores: document.getElementById('finalScores'),
        newGameButton: document.getElementById('newGameButton')
    };

    // Game variables
    let socket;
    let playerID = generateID();
    let isDrawing = false;
    let currentColor = '#000';
    let currentSize = 5;
    let lastX = 0;
    let lastY = 0;
    let isDrawer = false;
    let ctx = elements.canvas.getContext('2d');
    let timerInterval;

    // Initialize canvas
    function initCanvas() {
        // Set canvas dimensions based on its container
        const container = elements.canvas.parentElement;
        elements.canvas.width = container.clientWidth * 0.9;
        elements.canvas.height = elements.canvas.width * 0.6;
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }

    // Show a specific screen
    function showScreen(screenName) {
        Object.values(screens).forEach(screen => {
            screen.classList.remove('active');
        });
        screens[screenName].classList.add('active');
    }

    // Generate a random ID for the player
    function generateID() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Connect to WebSocket server
    function connectToServer(playerName) {
        // Create WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname === '' ? 'localhost:8080' : window.location.host;
        socket = new WebSocket(`${protocol}//${host}/ws?id=${playerID}&name=${encodeURIComponent(playerName)}`);
        
        // Connection opened
        socket.addEventListener('open', (event) => {
            console.log('Connected to server');
            
            // Send join message
            sendMessage({
                type: 'join'
            });
            
            showScreen('lobby');
        });
        
        // Listen for messages
        socket.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            handleMessage(message);
        });
        
        // Connection closed
        socket.addEventListener('close', (event) => {
            console.log('Disconnected from server');
            alert('Connection to the server was lost. Please refresh the page.');
        });
        
        // Error handling
        socket.addEventListener('error', (event) => {
            console.error('WebSocket error:', event);
        });
    }
    
    // Handle received messages
    function handleMessage(message) {
        console.log('Received message:', message);
        
        switch (message.type) {
            case 'gameState':
                updateGameState(message.content);
                break;
            case 'draw':
                handleDrawData(message.content);
                break;
            case 'clearCanvas':
                clearCanvas();
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }
    
    // Update game state based on server message
    function updateGameState(gameState) {
        // Update round information
        elements.currentRound.textContent = gameState.round;
        elements.maxRounds.textContent = gameState.maxRounds;
        
        // Update player list and scores
        updatePlayers(gameState.players);
        
        // Handle game state changes
        switch (gameState.state) {
            case 'waiting':
                showScreen('lobby');
                break;
            case 'drawing':
                handleDrawingState(gameState);
                break;
            case 'roundEnd':
                handleRoundEnd(gameState);
                break;
            case 'gameEnd':
                handleGameEnd(gameState);
                break;
        }
    }
    
    // Update the list of players
    function updatePlayers(players) {
        // Update lobby player list
        elements.playersConnected.innerHTML = '';
        
        // Update scoreboard
        elements.scoreList.innerHTML = '';
        
        Object.values(players).forEach(player => {
            // Add to lobby list
            const lobbyItem = document.createElement('li');
            lobbyItem.textContent = player.name;
            elements.playersConnected.appendChild(lobbyItem);
            
            // Add to scoreboard
            const scoreItem = document.createElement('li');
            scoreItem.innerHTML = `<span>${player.name}</span><span>${player.score}</span>`;
            elements.scoreList.appendChild(scoreItem);
        });
    }
    
    // Handle the drawing state
    function handleDrawingState(gameState) {
        showScreen('game');
        
        // Check if this client is the drawer
        isDrawer = gameState.currentDrawer === playerID;
        
        // Update word display
        if (isDrawer) {
            elements.wordDisplay.textContent = `Draw: ${gameState.currentWord}`;
            enableDrawing();
        } else {
            elements.wordDisplay.textContent = `Guess the word!`;
            disableDrawing();
        }
        
        // Update timer
        startTimer(gameState.roundTimeLimit);
    }
    
    // Handle round end
    function handleRoundEnd(gameState) {
        clearInterval(timerInterval);
        
        // Show the round end screen
        showScreen('roundEnd');
        
        // Show the word
        elements.revealedWord.textContent = gameState.currentWord;
        
        // Show scores
        elements.roundScores.innerHTML = '';
        Object.values(gameState.players).forEach(player => {
            const scoreDiv = document.createElement('div');
            scoreDiv.textContent = `${player.name}: ${player.score} points`;
            elements.roundScores.appendChild(scoreDiv);
        });
    }
    
    // Handle game end
    function handleGameEnd(gameState) {
        clearInterval(timerInterval);
        
        // Show the game end screen
        showScreen('gameEnd');
        
        // Sort players by score
        const sortedPlayers = Object.values(gameState.players).sort((a, b) => b.score - a.score);
        
        // Show final scores
        elements.finalScores.innerHTML = '';
        sortedPlayers.forEach((player, index) => {
            const scoreDiv = document.createElement('div');
            scoreDiv.textContent = `${index + 1}. ${player.name}: ${player.score} points`;
            if (index === 0) {
                scoreDiv.style.fontWeight = 'bold';
                scoreDiv.style.fontSize = '1.2em';
            }
            elements.finalScores.appendChild(scoreDiv);
        });
    }
    
    // Start the round timer
    function startTimer(duration) {
        // Clear existing timer
        clearInterval(timerInterval);
        
        // Set initial time
        let timeLeft = duration;
        elements.timer.textContent = timeLeft;
        
        // Start timer interval
        timerInterval = setInterval(() => {
            timeLeft--;
            elements.timer.textContent = timeLeft;
            
            if (timeLeft <= 10) {
                elements.timer.style.color = 'red';
            } else {
                elements.timer.style.color = 'black';
            }
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
            }
        }, 1000);
    }
    
    // Handle drawing data from other players
    function handleDrawData(drawData) {
        if (isDrawer) return; // Don't process drawing data if you're the drawer
        
        ctx.strokeStyle = drawData.color;
        ctx.lineWidth = drawData.lineWidth;
        
        switch (drawData.type) {
            case 'start':
                ctx.beginPath();
                ctx.moveTo(drawData.x, drawData.y);
                break;
            case 'draw':
                ctx.beginPath();
                ctx.moveTo(drawData.prevX, drawData.prevY);
                ctx.lineTo(drawData.x, drawData.y);
                ctx.stroke();
                break;
            case 'end':
                ctx.closePath();
                break;
        }
    }
    
    // Send a message to the server
    function sendMessage(message) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
        } else {
            console.error('Socket is not connected');
        }
    }
    
    // Clear the canvas
    function clearCanvas() {
        ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    }
    
    // Enable drawing on the canvas
    function enableDrawing() {
        // Show drawing tools
        document.getElementById('drawingTools').style.display = 'flex';
        
        // Mouse events for desktop
        elements.canvas.addEventListener('mousedown', startDrawing);
        elements.canvas.addEventListener('mousemove', draw);
        elements.canvas.addEventListener('mouseup', stopDrawing);
        elements.canvas.addEventListener('mouseout', stopDrawing);
        
        // Touch events for mobile
        elements.canvas.addEventListener('touchstart', handleTouchStart);
        elements.canvas.addEventListener('touchmove', handleTouchMove);
        elements.canvas.addEventListener('touchend', handleTouchEnd);
    }
    
    // Disable drawing on the canvas
    function disableDrawing() {
        // Hide drawing tools
        document.getElementById('drawingTools').style.display = 'none';
        
        // Remove event listeners
        elements.canvas.removeEventListener('mousedown', startDrawing);
        elements.canvas.removeEventListener('mousemove', draw);
        elements.canvas.removeEventListener('mouseup', stopDrawing);
        elements.canvas.removeEventListener('mouseout', stopDrawing);
        
        elements.canvas.removeEventListener('touchstart', handleTouchStart);
        elements.canvas.removeEventListener('touchmove', handleTouchMove);
        elements.canvas.removeEventListener('touchend', handleTouchEnd);
    }
    
    // Drawing functions
    function getCanvasCoordinates(event) {
        const rect = elements.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }
    
    function startDrawing(event) {
        isDrawing = true;
        const { x, y } = getCanvasCoordinates(event);
        lastX = x;
        lastY = y;
        
        // Start path
        ctx.beginPath();
        ctx.moveTo(x, y);
        
        // Send start drawing message
        sendMessage({
            type: 'draw',
            content: {
                type: 'start',
                x: x,
                y: y,
                color: currentColor,
                lineWidth: currentSize
            }
        });
    }
    
    function draw(event) {
        if (!isDrawing) return;
        
        const { x, y } = getCanvasCoordinates(event);
        
        // Draw line
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        
        // Send draw message
        sendMessage({
            type: 'draw',
            content: {
                type: 'draw',
                prevX: lastX,
                prevY: lastY,
                x: x,
                y: y,
                color: currentColor,
                lineWidth: currentSize
            }
        });
        
        // Update last position
        lastX = x;
        lastY = y;
    }
    
    function stopDrawing() {
        if (isDrawing) {
            isDrawing = false;
            
            // Send end drawing message
            sendMessage({
                type: 'draw',
                content: {
                    type: 'end'
                }
            });
        }
    }
    
    // Touch event handlers for mobile
    function handleTouchStart(event) {
        event.preventDefault();
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            startDrawing(mouseEvent);
        }
    }
    
    function handleTouchMove(event) {
        event.preventDefault();
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            draw(mouseEvent);
        }
    }
    
    function handleTouchEnd(event) {
        event.preventDefault();
        stopDrawing();
    }
    
    // Add a chat message
    function addChatMessage(playerName, message, type = 'player-message') {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type);
        
        if (type === 'player-message') {
            messageElement.textContent = `${playerName}: ${message}`;
        } else if (type === 'system-message') {
            messageElement.textContent = message;
        } else if (type === 'correct-guess') {
            messageElement.textContent = `${playerName} guessed the word correctly!`;
        }
        
        elements.chatMessages.appendChild(messageElement);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
    
    // Event Listeners
    elements.joinButton.addEventListener('click', () => {
        const playerName = elements.playerName.value.trim();
        if (playerName) {
            connectToServer(playerName);
        } else {
            alert('Please enter your name');
        }
    });
    
    elements.startButton.addEventListener('click', () => {
        sendMessage({
            type: 'start'
        });
    });
    
    elements.colorButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update selected color
            elements.colorButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            currentColor = button.dataset.color;
        });
    });
    
    elements.sizeButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update selected size
            elements.sizeButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            currentSize = parseInt(button.dataset.size);
        });
    });
    
    elements.clearButton.addEventListener('click', () => {
        clearCanvas();
        sendMessage({
            type: 'clearCanvas'
        });
    });
    
    elements.sendGuess.addEventListener('click', () => {
        const guess = elements.guessInput.value.trim();
        if (guess && !isDrawer) {
            sendMessage({
                type: 'guess',
                content: guess
            });
            
            // Add to chat
            addChatMessage('You', guess);
            
            // Clear input
            elements.guessInput.value = '';
        }
    });
    
    elements.guessInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            elements.sendGuess.click();
        }
    });
    
    elements.newGameButton.addEventListener('click', () => {
        location.reload(); // Reload the page for a new game
    });
    
    // Initialize the game
    initCanvas();
    showScreen('join');
});