// SignalR client wrapper
class NetworkClient {
  constructor() {
    this.connection = null;
    this.connected = false;
    this.handlers = {};
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl("/game")
        .withAutomaticReconnect()
        .build();

      // Register server event handlers
      this.connection.on('roomCreated', (data) => this.trigger('roomCreated', data));
      this.connection.on('roomJoined', (data) => this.trigger('roomJoined', data));
      this.connection.on('playerJoined', (data) => this.trigger('playerJoined', data));
      this.connection.on('playerLeft', (data) => this.trigger('playerLeft', data));
      this.connection.on('matchReady', (data) => this.trigger('matchReady', data));
      this.connection.on('waitingForMatch', (data) => this.trigger('waitingForMatch', data));
      this.connection.on('readyUpdate', (data) => this.trigger('readyUpdate', data));
      this.connection.on('countdown', (data) => this.trigger('countdown', data));
      this.connection.on('countdownCanceled', (data) => this.trigger('countdownCanceled', data));
      this.connection.on('gameStart', (data) => this.trigger('gameStart', data));
      this.connection.on('gameState', (data) => this.trigger('gameState', data));
      this.connection.on('attackEvent', (data) => this.trigger('attackEvent', data));
      this.connection.on('actorDeath', (data) => this.trigger('actorDeath', data));
      this.connection.on('gameOver', (data) => this.trigger('gameOver', data));
      this.connection.on('error', (data) => this.trigger('error', data));

      this.connection.onclose(() => {
        this.connected = false;
        console.log('Disconnected from server');
        this.trigger('disconnected');
      });

      this.connection.onreconnecting(() => {
        console.log('Reconnecting to server...');
      });

      this.connection.onreconnected(() => {
        console.log('Reconnected to server');
        this.connected = true;
      });

      this.connection.start()
        .then(() => {
          this.connected = true;
          console.log('Connected to server');
          resolve();
        })
        .catch((err) => {
          console.error('Connection error:', err);
          reject(err);
        });
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
    this.connection.invoke('SetName', name);
  }

  createRoom() {
    this.connection.invoke('CreateRoom');
  }

  createRoomWithAI(aiType = 'normal') {
    this.connection.invoke('CreateRoomWithAI', { aiType });
  }

  joinRoom(roomId) {
    this.connection.invoke('JoinRoom', roomId);
  }

  rejoinGame(roomId, playerName) {
    this.connection.invoke('RejoinGame', roomId, playerName);
  }

  leaveRoom() {
    this.connection.invoke('LeaveRoom');
  }

  quickMatch() {
    this.connection.invoke('QuickMatch');
  }

  playerReady() {
    this.connection.invoke('PlayerReady');
  }

  // Send a player command to the server
  sendCommand(command) {
    this.connection.invoke('PlayerCommand', command);
  }

  // Generic invoke for future game events
  emit(event, data) {
    this.connection.invoke(event, data);
  }
}

// Global instance
const network = new NetworkClient();
