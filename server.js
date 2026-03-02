const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' directory
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Game State
let gameState = 'waiting'; // 'waiting', 'playing', 'finished', 'countdown'
let players = {};
let winner = null;
let roomName = 'Tap Tap Championship';

const WINNING_SCORE = 120;

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // When a player joins
  socket.on('join', (data) => {
    if (data.role === 'player') {
      players[socket.id] = {
        name: data.name || `Player ${Math.floor(Math.random() * 1000)}`,
        score: 0,
        id: socket.id
      };

      // Tell everyone about the new player list
      io.emit('update-players', Object.values(players));
    }

    // Just send current game state to the joining socket
    socket.emit('game-state', { state: gameState, winner, roomName });
  });

  socket.on('start-game', (data) => {
    if (gameState === 'waiting' || gameState === 'finished') {
      gameState = 'countdown';
      winner = null;
      if (data && data.roomName) {
        roomName = data.roomName;
      }

      // Reset scores
      for (let id in players) {
        players[id].score = 0;
      }

      io.emit('update-players', Object.values(players));
      io.emit('game-started');
      console.log('Game countdown started');

      // Wait for the 3-2-1 GO frontend animation before counting taps
      setTimeout(() => {
        if (gameState === 'countdown') {
          gameState = 'playing';
          console.log('Game playing now');
        }
      }, 3200);
    }
  });

  socket.on('tap', () => {
    if (gameState === 'playing' && players[socket.id]) {
      players[socket.id].score++;

      io.emit('update-score', { id: socket.id, score: players[socket.id].score });

      // In real-time broadcast we should also give the full player update occasionally
      // but to optimize, we can just let 'update-score' handle the individual bar
      // and update the whole board
      io.emit('update-players', Object.values(players));

      if (players[socket.id].score >= WINNING_SCORE) {
        gameState = 'finished';
        winner = players[socket.id].name;
        io.emit('game-over', { winner: winner, roomName: roomName });
        console.log(`Game over. Winner: ${winner} in room ${roomName}`);
      }
    }
  });

  socket.on('reset-game', () => {
    gameState = 'waiting';
    winner = null;
    for (let id in players) {
      players[id].score = 0;
    }
    io.emit('update-players', Object.values(players));
    io.emit('game-reset');
    console.log('Game reset to waiting');
  });

  socket.on('close-room', () => {
    gameState = 'waiting';
    winner = null;
    players = {};
    io.emit('room-closed');
    console.log('Room closed by GM. All players kicked.');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (players[socket.id]) {
      delete players[socket.id];
      io.emit('update-players', Object.values(players));
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port :${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser.`);
});
