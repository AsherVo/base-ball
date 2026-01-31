const World = require('../../shared/world');
const CONSTANTS = require('../../shared/constants');
const GameLoop = require('../game/GameLoop');
const MapGenerator = require('../game/MapGenerator');

// Room state
const rooms = new Map();
const players = new Map();
const waitingQueue = [];

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Start countdown and then launch game
function startCountdown(io, roomId) {
  const room = rooms.get(roomId);
  if (!room || room.countdownActive) return;

  room.countdownActive = true;
  let count = 3;

  io.to(roomId).emit('countdown', { count });
  console.log(`Countdown started in room ${roomId}: ${count}`);

  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      io.to(roomId).emit('countdown', { count });
      console.log(`Countdown in room ${roomId}: ${count}`);
    } else {
      clearInterval(interval);
      room.countdownInterval = null;
      room.countdownActive = false;

      // Generate the map and start the game
      startGame(io, roomId);
    }
  }, 1000);

  room.countdownInterval = interval;
}

// Start the actual game
function startGame(io, roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  // Generate map with players
  const { world, playerStates } = MapGenerator.generate(room.players);
  room.world = world;
  room.playerStates = playerStates;

  // Create and start the game loop
  room.gameLoop = new GameLoop(world, io, roomId, playerStates);
  room.gameLoop.start();

  // Send initial state to all players with their player index
  for (const playerId of room.players) {
    const playerSocket = io.sockets.sockets.get(playerId);
    if (playerSocket) {
      const playerIndex = world.getPlayerIndex(playerId);
      const playerState = playerStates.get(playerId);
      playerSocket.emit('gameStart', {
        world: world.toJSON(),
        playerId: playerId,
        playerIndex: playerIndex,
        playerState: playerState.toJSON()
      });
    }
  }

  console.log(`Game started in room ${roomId}`);
}

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Initialize player data
    players.set(socket.id, {
      id: socket.id,
      name: 'Anonymous',
      roomId: null
    });

    // Set player name
    socket.on('setName', (name) => {
      const player = players.get(socket.id);
      if (player) {
        player.name = name || 'Anonymous';
        console.log(`Player ${socket.id} set name to: ${player.name}`);
      }
    });

    // Create a new room
    socket.on('createRoom', () => {
      const player = players.get(socket.id);
      if (!player) return;

      // Leave current room if in one
      if (player.roomId) {
        leaveRoom(socket, io);
      }

      const roomId = generateRoomId();
      rooms.set(roomId, {
        id: roomId,
        players: [socket.id],
        host: socket.id,
        readyPlayers: new Set()
      });

      player.roomId = roomId;
      socket.join(roomId);

      socket.emit('roomCreated', { roomId });
      socket.emit('roomJoined', {
        roomId,
        players: [{ id: player.id, name: player.name }]
      });

      console.log(`Room ${roomId} created by ${player.name}`);
    });

    // Join existing room
    socket.on('joinRoom', (roomId) => {
      const player = players.get(socket.id);
      if (!player) return;

      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (room.players.length >= 2) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }

      // Leave current room if in one
      if (player.roomId) {
        leaveRoom(socket, io);
      }

      room.players.push(socket.id);
      player.roomId = roomId;
      socket.join(roomId);

      // Cancel cleanup timer if someone rejoins
      if (room.cleanupTimer) {
        clearTimeout(room.cleanupTimer);
        room.cleanupTimer = null;
      }

      // Get all players in room
      const roomPlayers = room.players.map(pid => {
        const p = players.get(pid);
        return { id: p.id, name: p.name };
      });

      socket.emit('roomJoined', { roomId, players: roomPlayers });

      // Notify others in room
      socket.to(roomId).emit('playerJoined', {
        player: { id: player.id, name: player.name }
      });

      console.log(`${player.name} joined room ${roomId}`);

      // If room already has a world (game in progress), send it to the joining player
      if (room.world) {
        const playerIndex = room.world.getPlayerIndex(socket.id);
        const playerState = room.playerStates?.get(socket.id);
        socket.emit('gameStart', {
          world: room.world.toJSON(),
          playerId: socket.id,
          playerIndex: playerIndex ?? room.players.indexOf(socket.id),
          playerState: playerState?.toJSON()
        });
        console.log(`Sent existing world to ${player.name}`);
      }

      // Check if match is ready (2 players) and no world yet
      if (room.players.length === 2 && !room.world) {
        io.to(roomId).emit('matchReady', { players: roomPlayers });
        console.log(`Match ready in room ${roomId}`);
      }
    });

    // Player ready toggle
    socket.on('playerReady', () => {
      const player = players.get(socket.id);
      if (!player || !player.roomId) return;

      const room = rooms.get(player.roomId);
      if (!room || room.world) return; // Can't ready if game already started

      // Toggle ready state
      if (room.readyPlayers.has(socket.id)) {
        room.readyPlayers.delete(socket.id);
      } else {
        room.readyPlayers.add(socket.id);
      }

      // Broadcast ready state to room
      const readyState = room.players.map(pid => ({
        id: pid,
        ready: room.readyPlayers.has(pid)
      }));
      io.to(player.roomId).emit('readyUpdate', { players: readyState });

      console.log(`${player.name} is ${room.readyPlayers.has(socket.id) ? 'ready' : 'not ready'}`);

      // Check if all players are ready (need exactly 2 players)
      if (room.players.length === 2 && room.readyPlayers.size === 2) {
        startCountdown(io, player.roomId);
      }
    });

    // Handle player commands
    socket.on('playerCommand', (command) => {
      const player = players.get(socket.id);
      if (!player || !player.roomId) return;

      const room = rooms.get(player.roomId);
      if (!room || !room.gameLoop) return;

      // Queue the command for processing
      room.gameLoop.queueCommand(socket.id, command);
    });

    // Quick match - auto matchmaking
    socket.on('quickMatch', () => {
      const player = players.get(socket.id);
      if (!player) return;

      // Leave current room if in one
      if (player.roomId) {
        leaveRoom(socket, io);
      }

      // Remove from queue if already in it
      const queueIndex = waitingQueue.indexOf(socket.id);
      if (queueIndex > -1) {
        waitingQueue.splice(queueIndex, 1);
      }

      // Check if someone is waiting
      if (waitingQueue.length > 0) {
        const opponentId = waitingQueue.shift();
        const opponent = players.get(opponentId);

        if (opponent && !opponent.roomId) {
          // Create room and add both players
          const roomId = generateRoomId();
          rooms.set(roomId, {
            id: roomId,
            players: [opponentId, socket.id],
            host: opponentId,
            readyPlayers: new Set()
          });

          opponent.roomId = roomId;
          player.roomId = roomId;

          const opponentSocket = io.sockets.sockets.get(opponentId);
          if (opponentSocket) {
            opponentSocket.join(roomId);
          }
          socket.join(roomId);

          const roomPlayers = [
            { id: opponent.id, name: opponent.name },
            { id: player.id, name: player.name }
          ];

          io.to(roomId).emit('roomJoined', { roomId, players: roomPlayers });
          io.to(roomId).emit('matchReady', { players: roomPlayers });

          console.log(`Quick match: ${opponent.name} vs ${player.name} in room ${roomId}`);
          return;
        }
      }

      // No one waiting, add to queue
      waitingQueue.push(socket.id);
      socket.emit('waitingForMatch', { position: waitingQueue.length });
      console.log(`${player.name} added to matchmaking queue`);
    });

    // Leave current room
    socket.on('leaveRoom', () => {
      leaveRoom(socket, io);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      const player = players.get(socket.id);
      console.log(`Player disconnected: ${socket.id} (${player?.name || 'Unknown'})`);

      // Remove from matchmaking queue
      const queueIndex = waitingQueue.indexOf(socket.id);
      if (queueIndex > -1) {
        waitingQueue.splice(queueIndex, 1);
      }

      leaveRoom(socket, io);
      players.delete(socket.id);
    });
  });
}

function leaveRoom(socket, io) {
  const player = players.get(socket.id);
  if (!player || !player.roomId) return;

  const roomId = player.roomId;
  const room = rooms.get(roomId);

  if (room) {
    room.players = room.players.filter(id => id !== socket.id);

    // Remove from ready set
    if (room.readyPlayers) {
      room.readyPlayers.delete(socket.id);
    }

    // Cancel countdown if active
    if (room.countdownInterval) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;
      room.countdownActive = false;
      // Reset all ready states
      if (room.readyPlayers) {
        room.readyPlayers.clear();
      }
      io.to(roomId).emit('countdownCanceled', {});
    }

    // Notify others
    socket.to(roomId).emit('playerLeft', { playerId: socket.id });

    // Delete room if empty and no game in progress
    // Keep rooms with active games alive for players to rejoin
    if (room.players.length === 0 && !room.world) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted (empty)`);
    } else if (room.players.length === 0 && room.world) {
      // Stop the game loop
      if (room.gameLoop) {
        room.gameLoop.stop();
      }
      // Game room empty - schedule cleanup after grace period
      room.cleanupTimer = setTimeout(() => {
        if (rooms.has(roomId) && rooms.get(roomId).players.length === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (abandoned game)`);
        }
      }, 30000); // 30 second grace period
    }
  }

  socket.leave(roomId);
  player.roomId = null;
}

module.exports = { setupSocketHandlers };
