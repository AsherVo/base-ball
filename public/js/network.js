// Socket.io client wrapper
class NetworkClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.handlers = {};
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = io();

      this.socket.on('connect', () => {
        this.connected = true;
        console.log('Connected to server');
        resolve();
      });

      this.socket.on('disconnect', () => {
        this.connected = false;
        console.log('Disconnected from server');
        this.trigger('disconnected');
      });

      this.socket.on('connect_error', (err) => {
        console.error('Connection error:', err);
        reject(err);
      });

      // Register server event handlers
      this.socket.on('roomCreated', (data) => this.trigger('roomCreated', data));
      this.socket.on('roomJoined', (data) => this.trigger('roomJoined', data));
      this.socket.on('playerJoined', (data) => this.trigger('playerJoined', data));
      this.socket.on('playerLeft', (data) => this.trigger('playerLeft', data));
      this.socket.on('matchReady', (data) => this.trigger('matchReady', data));
      this.socket.on('waitingForMatch', (data) => this.trigger('waitingForMatch', data));
      this.socket.on('readyUpdate', (data) => this.trigger('readyUpdate', data));
      this.socket.on('countdown', (data) => this.trigger('countdown', data));
      this.socket.on('countdownCanceled', (data) => this.trigger('countdownCanceled', data));
      this.socket.on('gameStart', (data) => this.trigger('gameStart', data));
      this.socket.on('gameState', (data) => this.trigger('gameState', data));
      this.socket.on('attackEvent', (data) => this.trigger('attackEvent', data));
      this.socket.on('actorDeath', (data) => this.trigger('actorDeath', data));
      this.socket.on('gameOver', (data) => this.trigger('gameOver', data));
      this.socket.on('error', (data) => this.trigger('error', data));
    });
  }

  // Event handler registration
  on(event, callback) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(callback);
  }

  off(event, callback) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(cb => cb !== callback);
    }
  }

  trigger(event, data) {
    if (this.handlers[event]) {
      this.handlers[event].forEach(callback => callback(data));
    }
  }

  // Player actions
  setName(name) {
    this.socket.emit('setName', name);
  }

  createRoom() {
    this.socket.emit('createRoom');
  }

  createRoomWithAI(aiType = 'normal') {
    this.socket.emit('createRoomWithAI', { aiType });
  }

  joinRoom(roomId) {
    this.socket.emit('joinRoom', roomId);
  }

  leaveRoom() {
    this.socket.emit('leaveRoom');
  }

  quickMatch() {
    this.socket.emit('quickMatch');
  }

  playerReady() {
    this.socket.emit('playerReady');
  }

  // Send a player command to the server
  sendCommand(command) {
    this.socket.emit('playerCommand', command);
  }

  // Generic emit for future game events
  emit(event, data) {
    this.socket.emit(event, data);
  }
}

// Global instance
const network = new NetworkClient();
