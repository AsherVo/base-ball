// Lobby UI Logic
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const nameSection = document.getElementById('name-section');
  const lobbySection = document.getElementById('lobby-section');
  const roomSection = document.getElementById('room-section');

  const playerNameInput = document.getElementById('player-name');
  const setNameBtn = document.getElementById('set-name-btn');
  const displayName = document.getElementById('display-name');

  const createRoomBtn = document.getElementById('create-room-btn');
  const roomIdInput = document.getElementById('room-id-input');
  const joinRoomBtn = document.getElementById('join-room-btn');
  const quickMatchBtn = document.getElementById('quick-match-btn');

  const currentRoomId = document.getElementById('current-room-id');
  const playersList = document.getElementById('players');
  const roomStatus = document.getElementById('room-status');
  const leaveRoomBtn = document.getElementById('leave-room-btn');
  const startGameBtn = document.getElementById('start-game-btn');

  const statusMessage = document.getElementById('status-message');

  // State
  let playerName = '';
  let currentRoom = null;
  let players = [];
  let matchReady = false;

  // Helper functions
  function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = isError ? 'error' : 'success';
    setTimeout(() => {
      statusMessage.textContent = '';
      statusMessage.className = '';
    }, 3000);
  }

  function updatePlayersDisplay() {
    playersList.innerHTML = '';
    players.forEach(player => {
      const li = document.createElement('li');
      li.textContent = player.name;
      li.dataset.id = player.id;
      playersList.appendChild(li);
    });
  }

  function showLobby() {
    nameSection.classList.add('hidden');
    lobbySection.classList.remove('hidden');
    roomSection.classList.add('hidden');
  }

  function showRoom() {
    nameSection.classList.add('hidden');
    lobbySection.classList.add('hidden');
    roomSection.classList.remove('hidden');
  }

  // Connect to server
  network.connect().then(() => {
    showStatus('Connected to server');
  }).catch(err => {
    showStatus('Failed to connect to server', true);
  });

  // Name handling
  setNameBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name) {
      playerName = name;
      network.setName(name);
      displayName.textContent = name;
      showLobby();
    }
  });

  playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') setNameBtn.click();
  });

  // Room actions
  createRoomBtn.addEventListener('click', () => {
    network.createRoom();
  });

  joinRoomBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim().toUpperCase();
    if (roomId) {
      network.joinRoom(roomId);
    }
  });

  roomIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoomBtn.click();
  });

  quickMatchBtn.addEventListener('click', () => {
    network.quickMatch();
    showStatus('Looking for opponent...');
  });

  leaveRoomBtn.addEventListener('click', () => {
    network.leaveRoom();
    currentRoom = null;
    players = [];
    matchReady = false;
    showLobby();
  });

  startGameBtn.addEventListener('click', () => {
    if (matchReady && currentRoom) {
      // Store room info for game page
      sessionStorage.setItem('roomId', currentRoom);
      sessionStorage.setItem('playerName', playerName);
      window.location.href = '/game.html';
    }
  });

  // Network event handlers
  network.on('roomCreated', (data) => {
    showStatus(`Room ${data.roomId} created!`);
  });

  network.on('roomJoined', (data) => {
    currentRoom = data.roomId;
    players = data.players;
    currentRoomId.textContent = data.roomId;
    updatePlayersDisplay();
    showRoom();
    roomStatus.textContent = 'Waiting for opponent...';
    startGameBtn.classList.add('hidden');
    showStatus(`Joined room ${data.roomId}`);
  });

  network.on('playerJoined', (data) => {
    players.push(data.player);
    updatePlayersDisplay();
    showStatus(`${data.player.name} joined the room`);
  });

  network.on('playerLeft', (data) => {
    players = players.filter(p => p.id !== data.playerId);
    updatePlayersDisplay();
    matchReady = false;
    startGameBtn.classList.add('hidden');
    roomStatus.textContent = 'Waiting for opponent...';
    showStatus('Opponent left the room');
  });

  network.on('matchReady', (data) => {
    players = data.players;
    updatePlayersDisplay();
    matchReady = true;
    roomStatus.textContent = 'Match ready!';
    startGameBtn.classList.remove('hidden');
    showStatus('Match ready! Click Start Game to begin.');
  });

  network.on('waitingForMatch', (data) => {
    showStatus(`In matchmaking queue (position: ${data.position})`);
  });

  network.on('error', (data) => {
    showStatus(data.message, true);
  });

  network.on('disconnected', () => {
    showStatus('Disconnected from server', true);
  });
});
