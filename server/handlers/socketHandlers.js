// Room state
const rooms = new Map();
const players = new Map();
const waitingQueue = [];

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
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
        host: socket.id
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

      // Check if match is ready (2 players)
      if (room.players.length === 2) {
        io.to(roomId).emit('matchReady', { players: roomPlayers });
        console.log(`Match ready in room ${roomId}`);
      }
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
            host: opponentId
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

    // Notify others
    socket.to(roomId).emit('playerLeft', { playerId: socket.id });

    // Delete room if empty
    if (room.players.length === 0) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted (empty)`);
    }
  }

  socket.leave(roomId);
  player.roomId = null;
}

module.exports = { setupSocketHandlers };
