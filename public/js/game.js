// Game client stub
document.addEventListener('DOMContentLoaded', () => {
  // Get room info from session storage
  const roomId = sessionStorage.getItem('roomId');
  const playerName = sessionStorage.getItem('playerName');

  // Elements
  const roomIdDisplay = document.getElementById('room-id');
  const playerNameDisplay = document.getElementById('player-name');
  const playersList = document.getElementById('players-list');
  const gameStatus = document.getElementById('game-status');
  const leaveBtn = document.getElementById('leave-btn');
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // State
  let players = [];
  let gameRunning = false;

  // Initialize
  if (!roomId || !playerName) {
    window.location.href = '/';
    return;
  }

  roomIdDisplay.textContent = roomId;
  playerNameDisplay.textContent = playerName;

  // Connect and rejoin room
  network.connect().then(() => {
    network.setName(playerName);
    network.joinRoom(roomId);
    gameStatus.textContent = 'Connected';
  }).catch(err => {
    gameStatus.textContent = 'Connection failed';
  });

  // Network handlers
  network.on('roomJoined', (data) => {
    players = data.players;
    updatePlayersList();
    gameStatus.textContent = 'In room';
    startGameLoop();
  });

  network.on('playerJoined', (data) => {
    players.push(data.player);
    updatePlayersList();
  });

  network.on('playerLeft', (data) => {
    players = players.filter(p => p.id !== data.playerId);
    updatePlayersList();
    gameStatus.textContent = 'Opponent left';
  });

  network.on('error', (data) => {
    gameStatus.textContent = 'Error: ' + data.message;
  });

  network.on('disconnected', () => {
    gameStatus.textContent = 'Disconnected';
    gameRunning = false;
  });

  // Leave button
  leaveBtn.addEventListener('click', () => {
    network.leaveRoom();
    sessionStorage.removeItem('roomId');
    window.location.href = '/';
  });

  // Update players list UI
  function updatePlayersList() {
    playersList.innerHTML = '';
    players.forEach(player => {
      const li = document.createElement('li');
      li.textContent = player.name;
      playersList.appendChild(li);
    });
  }

  // Game loop placeholder
  function startGameLoop() {
    if (gameRunning) return;
    gameRunning = true;

    // Draw initial state
    draw();

    // Game loop using requestAnimationFrame
    function gameLoop() {
      if (!gameRunning) return;

      update();
      draw();

      requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
  }

  // Update game state (placeholder)
  function update() {
    // TODO: Game logic goes here
    // - Process input
    // - Update positions
    // - Handle collisions
    // - Sync with server
  }

  // Render game (placeholder)
  function draw() {
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw placeholder text
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Canvas Ready', canvas.width / 2, canvas.height / 2 - 20);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#888888';
    ctx.fillText(`Room: ${roomId} | Players: ${players.length}`, canvas.width / 2, canvas.height / 2 + 20);

    // TODO: Render game objects
    // - Draw players
    // - Draw game elements
    // - Draw UI overlay
  }
});
