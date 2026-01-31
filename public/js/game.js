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
  let world = null;

  // Camera/viewport position (top-left corner in world pixels)
  let cameraX = 0;
  let cameraY = 0;

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

  network.on('gameStart', (data) => {
    world = World.fromJSON(data.world);
    // Center camera on the map
    const worldPixelWidth = world.width * CONSTANTS.TILE_WIDTH;
    const worldPixelHeight = world.height * CONSTANTS.TILE_HEIGHT;
    cameraX = (worldPixelWidth - canvas.width) / 2;
    cameraY = (worldPixelHeight - canvas.height) / 2;
    gameStatus.textContent = 'Game started!';
    console.log('World received:', world);
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

  // Render game
  function draw() {
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!world) {
      // Show waiting message if world not loaded
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for game to start...', canvas.width / 2, canvas.height / 2 - 20);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#888888';
      ctx.fillText(`Room: ${roomId} | Players: ${players.length}`, canvas.width / 2, canvas.height / 2 + 20);
      return;
    }

    // Draw map tiles
    drawMap();

    // Draw actors
    drawActors();

    // Draw UI overlay
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Room: ${roomId} | Players: ${players.length}`, 10, 20);
  }

  // Draw the map grid
  function drawMap() {
    const tileW = CONSTANTS.TILE_WIDTH;
    const tileH = CONSTANTS.TILE_HEIGHT;

    // Calculate visible tile range
    const startTileX = Math.floor(cameraX / tileW);
    const startTileY = Math.floor(cameraY / tileH);
    const endTileX = Math.ceil((cameraX + canvas.width) / tileW);
    const endTileY = Math.ceil((cameraY + canvas.height) / tileH);

    // Draw visible tiles
    for (let ty = startTileY; ty <= endTileY && ty < world.height; ty++) {
      for (let tx = startTileX; tx <= endTileX && tx < world.width; tx++) {
        if (tx < 0 || ty < 0) continue;

        const screenX = tx * tileW - cameraX;
        const screenY = ty * tileH - cameraY;

        // Alternate colors for checkerboard pattern
        ctx.fillStyle = (tx + ty) % 2 === 0 ? '#2a2a4e' : '#252545';
        ctx.fillRect(screenX, screenY, tileW, tileH);

        // Draw grid lines
        ctx.strokeStyle = '#3a3a5e';
        ctx.strokeRect(screenX, screenY, tileW, tileH);
      }
    }
  }

  // Draw all actors
  function drawActors() {
    const actors = world.getAllActors();
    for (const actor of actors) {
      drawActor(actor);
    }
  }

  // Draw a single actor
  function drawActor(actor) {
    const screenX = actor.x - cameraX;
    const screenY = actor.y - cameraY;

    // Skip if off-screen
    if (screenX < -32 || screenX > canvas.width + 32 ||
        screenY < -32 || screenY > canvas.height + 32) {
      return;
    }

    // Draw actor as a circle (placeholder sprite)
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(screenX, screenY, 16, 0, Math.PI * 2);
    ctx.fill();

    // Draw outline
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
});
