// Lobby UI Logic
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const nameSection = document.getElementById('name-section');
  const lobbySection = document.getElementById('lobby-section');
  const roomSection = document.getElementById('room-section');

  const playerNameInput = document.getElementById('player-name');
  const setNameBtn = document.getElementById('set-name-btn');
  const displayName = document.getElementById('display-name');

  // Auto-populate with random name for faster testing
  const randomNames = ['Ashley', 'Bailey', 'Cathy', 'Denmark', 'Elana', 'Frank', 'Gabby', 'Hilda', 'Iris', 'Janet', 'Karen', 'Linda', 'Monica', 'Ophelia', 'Penelope', 'Quinn', 'Rosie', 'Sandra', 'Tamar', 'Uma', 'Veronica', 'Wanda', 'Xia', 'Y', 'Zelda'];
  playerNameInput.value = randomNames[Math.floor(Math.random() * randomNames.length)];

  const playAIBtn = document.getElementById('play-ai-btn');
  const aiTypeSelect = document.getElementById('ai-type-select');
  const createRoomBtn = document.getElementById('create-room-btn');
  const roomIdInput = document.getElementById('room-id-input');
  const joinRoomBtn = document.getElementById('join-room-btn');
  const quickMatchBtn = document.getElementById('quick-match-btn');

  const currentRoomId = document.getElementById('current-room-id');
  const playersList = document.getElementById('players');
  const roomStatus = document.getElementById('room-status');
  const leaveRoomBtn = document.getElementById('leave-room-btn');
  const readyBtn = document.getElementById('ready-btn');
  const countdownDisplay = document.getElementById('countdown');

  const statusMessage = document.getElementById('status-message');

  // State
  let playerName = '';
  let currentRoom = null;
  let myPlayerId = null;
  let players = [];
  let matchReady = false;
  let isReady = false;

  // Helper functions
  function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = isError ? 'error' : 'success';
    setTimeout(() => {
      statusMessage.textContent = '';
      statusMessage.className = '';
    }, 3000);
  }

  function updatePlayersDisplay(readyState = null) {
    playersList.innerHTML = '';
    players.forEach(player => {
      const li = document.createElement('li');
      const readyInfo = readyState?.find(p => p.id === player.id);
      const readyMarker = readyInfo?.ready ? ' [Ready]' : '';
      li.textContent = player.name + readyMarker;
      li.dataset.id = player.id;
      if (readyInfo?.ready) {
        li.classList.add('ready');
      }
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
  playAIBtn.addEventListener('click', () => {
    const aiType = aiTypeSelect.value;
    network.createRoomWithAI(aiType);
  });

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
    isReady = false;
    countdownDisplay.classList.add('hidden');
    showLobby();
  });

  readyBtn.addEventListener('click', () => {
    if (matchReady && currentRoom) {
      network.playerReady();
    }
  });

  // Network event handlers
  network.on('roomCreated', (data) => {
    showStatus(`Room ${data.roomId} created!`);
  });

  network.on('roomJoined', (data) => {
    console.log('roomJoined received:', data);
    console.log('players array:', data.players);
    currentRoom = data.roomId;
    myPlayerId = data.playerId;
    players = data.players;
    currentRoomId.textContent = data.roomId;
    updatePlayersDisplay();
    showRoom();
    roomStatus.textContent = 'Waiting for opponent...';
    readyBtn.classList.add('hidden');
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
    isReady = false;
    readyBtn.classList.add('hidden');
    readyBtn.textContent = 'Ready';
    countdownDisplay.classList.add('hidden');
    roomStatus.textContent = 'Waiting for opponent...';
    showStatus('Opponent left the room');
  });

  network.on('matchReady', (data) => {
    players = data.players;
    updatePlayersDisplay();
    matchReady = true;
    roomStatus.textContent = 'Both players here! Click Ready when you want to start.';
    readyBtn.classList.remove('hidden');
    showStatus('Click Ready when you want to start!');
  });

  network.on('readyUpdate', (data) => {
    updatePlayersDisplay(data.players);
    const myReady = data.players.find(p => p.id === myPlayerId);
    isReady = myReady?.ready || false;
    readyBtn.textContent = isReady ? 'Not Ready' : 'Ready';
  });

  network.on('countdown', (data) => {
    countdownDisplay.classList.remove('hidden');
    countdownDisplay.textContent = `Game starting in ${data.count}...`;
    readyBtn.classList.add('hidden');
    roomStatus.textContent = 'Get ready!';
  });

  network.on('countdownCanceled', () => {
    countdownDisplay.classList.add('hidden');
    isReady = false;
    readyBtn.textContent = 'Ready';
    readyBtn.classList.remove('hidden');
    roomStatus.textContent = 'Countdown canceled. Click Ready to try again.';
    showStatus('Countdown canceled - a player left or unreadied');
  });

  network.on('gameStart', (data) => {
    // Store room info and navigate to game page
    sessionStorage.setItem('roomId', currentRoom);
    sessionStorage.setItem('playerName', playerName);
    window.location.href = '/game.html';
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
