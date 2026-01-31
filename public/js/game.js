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
  let cameraZoom = 1.0;

  // Input state
  const keysPressed = new Set();
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragCameraStartX = 0;
  let dragCameraStartY = 0;
  let lastFrameTime = 0;
  let isMinimapDragging = false;

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
    gameStatus.textContent = 'Disconnected - returning to lobby...';
    gameRunning = false;
    sessionStorage.removeItem('roomId');
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  });

  // Leave button
  leaveBtn.addEventListener('click', () => {
    network.leaveRoom();
    sessionStorage.removeItem('roomId');
    window.location.href = '/';
  });

  // Camera controls - Keyboard
  window.addEventListener('keydown', (e) => {
    keysPressed.add(e.key.toLowerCase());

    // Handle zoom with +/- keys
    if (e.key === '=' || e.key === '+') {
      zoomCamera(CONSTANTS.CAMERA_ZOOM_SPEED);
    } else if (e.key === '-' || e.key === '_') {
      zoomCamera(-CONSTANTS.CAMERA_ZOOM_SPEED);
    }
  });

  window.addEventListener('keyup', (e) => {
    keysPressed.delete(e.key.toLowerCase());
  });

  // Camera controls - Mouse wheel / trackpad
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (e.ctrlKey) {
      // Pinch-to-zoom gesture (macOS trackpad sends ctrlKey + wheel for pinch)
      // Use smaller zoom speed for smoother pinch control
      const zoomDelta = e.deltaY > 0 ? -CONSTANTS.CAMERA_ZOOM_SPEED * 0.5 : CONSTANTS.CAMERA_ZOOM_SPEED * 0.5;
      zoomCameraAt(zoomDelta, mouseX, mouseY);
    } else if (isTrackpadScroll(e)) {
      // Trackpad two-finger scroll → pan
      cameraX += e.deltaX / cameraZoom;
      cameraY += e.deltaY / cameraZoom;
      clampCamera();
    } else {
      // Mouse wheel → zoom
      const zoomDelta = e.deltaY > 0 ? -CONSTANTS.CAMERA_ZOOM_SPEED : CONSTANTS.CAMERA_ZOOM_SPEED;
      zoomCameraAt(zoomDelta, mouseX, mouseY);
    }
  }, { passive: false });

  // Detect if wheel event is from trackpad vs mouse
  function isTrackpadScroll(e) {
    // deltaMode 0 = pixels (trackpad), 1 = lines, 2 = pages (mouse)
    if (e.deltaMode !== 0) return false;

    // Trackpads often have horizontal scroll component
    if (Math.abs(e.deltaX) > 0) return true;

    // Mouse wheels typically report discrete values (multiples of ~100-120)
    // Trackpads report smaller, more precise values
    const dominated = Math.abs(e.deltaY);
    if (dominated > 0 && dominated < 50) return true;

    // Check for non-integer values (common with trackpads)
    if (e.deltaY % 1 !== 0) return true;

    return false;
  }

  // Camera controls - Mouse drag pan
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 || e.button === 2) { // Middle or right click
      e.preventDefault();
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragCameraStartX = cameraX;
      dragCameraStartY = cameraY;
      canvas.style.cursor = 'grabbing';
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      cameraX = dragCameraStartX - dx / cameraZoom;
      cameraY = dragCameraStartY - dy / cameraZoom;
      clampCamera();
    } else if (isMinimapDragging) {
      handleMinimapNavigation(e.clientX, e.clientY);
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 1 || e.button === 2) {
      isDragging = false;
      canvas.style.cursor = 'default';
    }
    if (e.button === 0 && isMinimapDragging) {
      isMinimapDragging = false;
      canvas.style.cursor = 'default';
    }
  });

  // Disable context menu on canvas for right-click drag
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Helper to get minimap bounds
  function getMinimapBounds() {
    return {
      x: CONSTANTS.MINIMAP_PADDING,
      y: canvas.height - CONSTANTS.MINIMAP_HEIGHT - CONSTANTS.MINIMAP_PADDING - 20,
      width: CONSTANTS.MINIMAP_WIDTH,
      height: CONSTANTS.MINIMAP_HEIGHT
    };
  }

  // Helper to check if point is in minimap and move camera there
  function handleMinimapNavigation(clientX, clientY) {
    if (!world) return false;

    const rect = canvas.getBoundingClientRect();
    const scaleFactorX = canvas.width / rect.width;
    const scaleFactorY = canvas.height / rect.height;
    const canvasX = (clientX - rect.left) * scaleFactorX;
    const canvasY = (clientY - rect.top) * scaleFactorY;

    const minimap = getMinimapBounds();

    if (canvasX >= minimap.x && canvasX <= minimap.x + minimap.width &&
        canvasY >= minimap.y && canvasY <= minimap.y + minimap.height) {

      const worldPixelWidth = world.width * CONSTANTS.TILE_WIDTH;
      const worldPixelHeight = world.height * CONSTANTS.TILE_HEIGHT;
      const scaleX = minimap.width / worldPixelWidth;
      const scaleY = minimap.height / worldPixelHeight;

      const worldX = (canvasX - minimap.x) / scaleX;
      const worldY = (canvasY - minimap.y) / scaleY;

      const viewWidth = canvas.width / cameraZoom;
      const viewHeight = canvas.height / cameraZoom;
      cameraX = worldX - viewWidth / 2;
      cameraY = worldY - viewHeight / 2;
      clampCamera();
      return true;
    }
    return false;
  }

  // Minimap click/drag to navigate
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left click
      if (handleMinimapNavigation(e.clientX, e.clientY)) {
        isMinimapDragging = true;
        canvas.style.cursor = 'crosshair';
      }
    }
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

  // Update game state
  function update() {
    const currentTime = performance.now();
    const deltaTime = lastFrameTime ? (currentTime - lastFrameTime) / 1000 : 0;
    lastFrameTime = currentTime;

    // Handle keyboard camera panning
    if (world) {
      const panSpeed = CONSTANTS.CAMERA_PAN_SPEED / cameraZoom;
      const panAmount = panSpeed * deltaTime;

      if (keysPressed.has('w') || keysPressed.has('arrowup')) {
        cameraY -= panAmount;
      }
      if (keysPressed.has('s') || keysPressed.has('arrowdown')) {
        cameraY += panAmount;
      }
      if (keysPressed.has('a') || keysPressed.has('arrowleft')) {
        cameraX -= panAmount;
      }
      if (keysPressed.has('d') || keysPressed.has('arrowright')) {
        cameraX += panAmount;
      }

      clampCamera();
    }

    // TODO: Additional game logic
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
    ctx.fillText(`Room: ${roomId} | Players: ${players.length} | Zoom: ${Math.round(cameraZoom * 100)}%`, 10, 20);

    // Draw controls hint
    ctx.fillStyle = '#888888';
    ctx.font = '12px sans-serif';
    ctx.fillText('WASD/Arrows: Pan | Mouse wheel/+/-: Zoom | Right-drag: Pan | Trackpad: Scroll to pan, Pinch to zoom', 10, canvas.height - 10);

    // Draw minimap
    drawMinimap();
  }

  // Draw the map grid
  function drawMap() {
    const tileW = CONSTANTS.TILE_WIDTH;
    const tileH = CONSTANTS.TILE_HEIGHT;
    const scaledTileW = tileW * cameraZoom;
    const scaledTileH = tileH * cameraZoom;

    // Calculate visible tile range (accounting for zoom)
    const viewWidth = canvas.width / cameraZoom;
    const viewHeight = canvas.height / cameraZoom;
    const startTileX = Math.floor(cameraX / tileW);
    const startTileY = Math.floor(cameraY / tileH);
    const endTileX = Math.ceil((cameraX + viewWidth) / tileW);
    const endTileY = Math.ceil((cameraY + viewHeight) / tileH);

    // Draw visible tiles
    for (let ty = startTileY; ty <= endTileY && ty < world.height; ty++) {
      for (let tx = startTileX; tx <= endTileX && tx < world.width; tx++) {
        if (tx < 0 || ty < 0) continue;

        const screenX = (tx * tileW - cameraX) * cameraZoom;
        const screenY = (ty * tileH - cameraY) * cameraZoom;

        // Alternate colors for checkerboard pattern
        ctx.fillStyle = (tx + ty) % 2 === 0 ? '#2a2a4e' : '#252545';
        ctx.fillRect(screenX, screenY, scaledTileW, scaledTileH);

        // Draw grid lines
        ctx.strokeStyle = '#3a3a5e';
        ctx.strokeRect(screenX, screenY, scaledTileW, scaledTileH);
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
    const screenX = (actor.x - cameraX) * cameraZoom;
    const screenY = (actor.y - cameraY) * cameraZoom;
    const radius = 16 * cameraZoom;

    // Skip if off-screen
    if (screenX < -radius || screenX > canvas.width + radius ||
        screenY < -radius || screenY > canvas.height + radius) {
      return;
    }

    // Draw actor as a circle (placeholder sprite)
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw outline
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * cameraZoom;
    ctx.stroke();
  }

  // Draw minimap in lower-left corner
  function drawMinimap() {
    const minimapW = CONSTANTS.MINIMAP_WIDTH;
    const minimapH = CONSTANTS.MINIMAP_HEIGHT;
    const padding = CONSTANTS.MINIMAP_PADDING;
    const borderWidth = CONSTANTS.MINIMAP_BORDER_WIDTH;

    // Position in lower-left corner
    const minimapX = padding;
    const minimapY = canvas.height - minimapH - padding - 20; // 20px offset for controls hint

    // World dimensions in pixels
    const worldPixelWidth = world.width * CONSTANTS.TILE_WIDTH;
    const worldPixelHeight = world.height * CONSTANTS.TILE_HEIGHT;

    // Scale factor from world to minimap
    const scaleX = minimapW / worldPixelWidth;
    const scaleY = minimapH / worldPixelHeight;

    // Draw minimap background
    ctx.fillStyle = 'rgba(20, 20, 40, 0.85)';
    ctx.fillRect(minimapX, minimapY, minimapW, minimapH);

    // Draw minimap border
    ctx.strokeStyle = '#4a4a6e';
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(minimapX, minimapY, minimapW, minimapH);

    // Draw map representation (simplified grid)
    ctx.fillStyle = '#2a2a4e';
    ctx.fillRect(minimapX + borderWidth, minimapY + borderWidth,
                 minimapW - borderWidth * 2, minimapH - borderWidth * 2);

    // Draw actors on minimap
    const actors = world.getAllActors();
    for (const actor of actors) {
      const dotX = minimapX + actor.x * scaleX;
      const dotY = minimapY + actor.y * scaleY;
      const dotRadius = Math.max(3, 16 * scaleX);

      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw camera viewport rectangle
    const viewWidth = canvas.width / cameraZoom;
    const viewHeight = canvas.height / cameraZoom;

    const viewRectX = minimapX + cameraX * scaleX;
    const viewRectY = minimapY + cameraY * scaleY;
    const viewRectW = viewWidth * scaleX;
    const viewRectH = viewHeight * scaleY;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(viewRectX, viewRectY, viewRectW, viewRectH);

    // Fill viewport with semi-transparent white
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(viewRectX, viewRectY, viewRectW, viewRectH);
  }

  // Zoom camera by delta amount
  function zoomCamera(delta) {
    const oldZoom = cameraZoom;
    cameraZoom = Math.max(CONSTANTS.CAMERA_ZOOM_MIN,
                          Math.min(CONSTANTS.CAMERA_ZOOM_MAX, cameraZoom + delta));
    return oldZoom !== cameraZoom;
  }

  // Zoom camera toward a specific screen position
  function zoomCameraAt(delta, screenX, screenY) {
    if (!world) return;

    // Convert screen position to world position before zoom
    const worldX = cameraX + screenX / cameraZoom;
    const worldY = cameraY + screenY / cameraZoom;

    const oldZoom = cameraZoom;
    if (!zoomCamera(delta)) return;

    // Adjust camera so the world position stays under the mouse
    cameraX = worldX - screenX / cameraZoom;
    cameraY = worldY - screenY / cameraZoom;
    clampCamera();
  }

  // Clamp camera to world boundaries
  function clampCamera() {
    if (!world) return;

    const worldPixelWidth = world.width * CONSTANTS.TILE_WIDTH;
    const worldPixelHeight = world.height * CONSTANTS.TILE_HEIGHT;
    const viewWidth = canvas.width / cameraZoom;
    const viewHeight = canvas.height / cameraZoom;

    // Allow some padding beyond the map edges
    const padding = 100;
    const minX = -padding;
    const minY = -padding;
    const maxX = worldPixelWidth - viewWidth + padding;
    const maxY = worldPixelHeight - viewHeight + padding;

    cameraX = Math.max(minX, Math.min(maxX, cameraX));
    cameraY = Math.max(minY, Math.min(maxY, cameraY));
  }
});
