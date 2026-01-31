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

  // Unit selection state
  let selectedUnit = null;
  const UNIT_RADIUS = 16; // Collision radius for selection

  // Unit movement targets (actorId -> {x, y})
  const unitMoveTargets = new Map();

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
    // Clear any selection state
    selectedUnit = null;
    unitMoveTargets.clear();
    updateUnitInfoPanel();
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

    // Escape key deselects unit
    if (e.key === 'Escape') {
      deselectUnit();
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

  // Camera controls - Mouse drag pan (middle click) or move command (right click)
  let rightClickStartX = 0;
  let rightClickStartY = 0;
  let isRightClickDrag = false;

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1) { // Middle click - always pan
      e.preventDefault();
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragCameraStartX = cameraX;
      dragCameraStartY = cameraY;
      canvas.style.cursor = 'grabbing';
    } else if (e.button === 2) { // Right click - could be move command or pan
      e.preventDefault();
      rightClickStartX = e.clientX;
      rightClickStartY = e.clientY;
      isRightClickDrag = false;

      // Start potential drag
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragCameraStartX = cameraX;
      dragCameraStartY = cameraY;
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      // Check if this is a significant drag (more than 5 pixels)
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isRightClickDrag = true;
        canvas.style.cursor = 'grabbing';
      }

      // Only actually pan if we've determined this is a drag
      if (isRightClickDrag) {
        cameraX = dragCameraStartX - dx / cameraZoom;
        cameraY = dragCameraStartY - dy / cameraZoom;
        clampCamera();
      }
    } else if (isMinimapDragging) {
      handleMinimapNavigation(e.clientX, e.clientY);
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 1) { // Middle click
      isDragging = false;
      canvas.style.cursor = 'default';
    } else if (e.button === 2) { // Right click
      isDragging = false;
      canvas.style.cursor = 'default';

      // If this wasn't a drag and we have a selected unit, issue move command
      if (!isRightClickDrag && selectedUnit && world) {
        handleMoveCommand(e.clientX, e.clientY);
      }
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

  // Left click: minimap navigation or unit selection
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left click
      // First check if clicking on minimap
      if (handleMinimapNavigation(e.clientX, e.clientY)) {
        isMinimapDragging = true;
        canvas.style.cursor = 'crosshair';
        return;
      }

      // Otherwise, handle unit selection
      if (world) {
        handleUnitSelection(e.clientX, e.clientY);
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

    // Update unit positions (move toward targets)
    if (world) {
      updateUnitMovement(deltaTime);
    }
  }

  // Update unit movement toward targets
  function updateUnitMovement(deltaTime) {
    const MOVE_SPEED = 150; // pixels per second

    for (const [actorId, target] of unitMoveTargets.entries()) {
      const actor = world.getActor(actorId);
      if (!actor) {
        unitMoveTargets.delete(actorId);
        continue;
      }

      const dx = target.x - actor.x;
      const dy = target.y - actor.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 2) {
        // Arrived at target
        actor.x = target.x;
        actor.y = target.y;
        unitMoveTargets.delete(actorId);
      } else {
        // Move toward target
        const moveAmount = MOVE_SPEED * deltaTime;
        const ratio = Math.min(moveAmount / dist, 1);
        actor.x += dx * ratio;
        actor.y += dy * ratio;
      }
    }

    // Update unit info panel if selected unit moved
    if (selectedUnit) {
      updateUnitInfoPanel();
    }
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
    ctx.fillText('Left-click: Select unit | Right-click: Move | Escape: Deselect | WASD: Pan | Wheel: Zoom', 10, canvas.height - 10);

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

  // Draw a single actor (unit)
  function drawActor(actor) {
    const screenX = (actor.x - cameraX) * cameraZoom;
    const screenY = (actor.y - cameraY) * cameraZoom;
    const radius = UNIT_RADIUS * cameraZoom;

    // Skip if off-screen
    if (screenX < -radius * 2 || screenX > canvas.width + radius * 2 ||
        screenY < -radius * 2 || screenY > canvas.height + radius * 2) {
      return;
    }

    const isSelected = selectedUnit && selectedUnit.id === actor.id;

    // Draw selection indicator (ring behind the unit)
    if (isSelected) {
      ctx.strokeStyle = '#4aff4a';
      ctx.lineWidth = 3 * cameraZoom;
      ctx.beginPath();
      ctx.arc(screenX, screenY, radius + 6 * cameraZoom, 0, Math.PI * 2);
      ctx.stroke();

      // Draw pulsing glow effect
      const pulse = Math.sin(performance.now() / 200) * 0.3 + 0.5;
      ctx.strokeStyle = `rgba(74, 255, 74, ${pulse})`;
      ctx.lineWidth = 2 * cameraZoom;
      ctx.beginPath();
      ctx.arc(screenX, screenY, radius + 10 * cameraZoom, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw actor as a circle (placeholder sprite)
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw outline
    ctx.strokeStyle = isSelected ? '#4aff4a' : '#ffffff';
    ctx.lineWidth = 2 * cameraZoom;
    ctx.stroke();

    // Draw move target indicator if this unit has one
    const target = unitMoveTargets.get(actor.id);
    if (target) {
      drawMoveTarget(actor, target);
    }
  }

  // Draw move target indicator
  function drawMoveTarget(actor, target) {
    const targetScreenX = (target.x - cameraX) * cameraZoom;
    const targetScreenY = (target.y - cameraY) * cameraZoom;
    const actorScreenX = (actor.x - cameraX) * cameraZoom;
    const actorScreenY = (actor.y - cameraY) * cameraZoom;

    // Draw line from actor to target
    ctx.strokeStyle = 'rgba(74, 255, 74, 0.5)';
    ctx.lineWidth = 2 * cameraZoom;
    ctx.setLineDash([5 * cameraZoom, 5 * cameraZoom]);
    ctx.beginPath();
    ctx.moveTo(actorScreenX, actorScreenY);
    ctx.lineTo(targetScreenX, targetScreenY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw target marker (X)
    const markerSize = 8 * cameraZoom;
    ctx.strokeStyle = '#4aff4a';
    ctx.lineWidth = 2 * cameraZoom;
    ctx.beginPath();
    ctx.moveTo(targetScreenX - markerSize, targetScreenY - markerSize);
    ctx.lineTo(targetScreenX + markerSize, targetScreenY + markerSize);
    ctx.moveTo(targetScreenX + markerSize, targetScreenY - markerSize);
    ctx.lineTo(targetScreenX - markerSize, targetScreenY + markerSize);
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

  // Convert screen coordinates to world coordinates
  function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleFactorX = canvas.width / rect.width;
    const scaleFactorY = canvas.height / rect.height;
    const canvasX = (clientX - rect.left) * scaleFactorX;
    const canvasY = (clientY - rect.top) * scaleFactorY;
    const worldX = cameraX + canvasX / cameraZoom;
    const worldY = cameraY + canvasY / cameraZoom;
    return { x: worldX, y: worldY };
  }

  // Handle unit selection on left click
  function handleUnitSelection(clientX, clientY) {
    const worldPos = screenToWorld(clientX, clientY);
    const actors = world.getAllActors();

    // Find the unit closest to the click (within selection radius)
    let closestUnit = null;
    let closestDist = Infinity;

    for (const actor of actors) {
      const dx = actor.x - worldPos.x;
      const dy = actor.y - worldPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= UNIT_RADIUS * 1.5 && dist < closestDist) {
        closestDist = dist;
        closestUnit = actor;
      }
    }

    if (closestUnit) {
      // Toggle selection if clicking the same unit
      if (selectedUnit && selectedUnit.id === closestUnit.id) {
        deselectUnit();
      } else {
        selectUnit(closestUnit);
      }
    } else {
      // Clicked on empty space - deselect
      deselectUnit();
    }
  }

  // Select a unit
  function selectUnit(unit) {
    selectedUnit = unit;
    updateUnitInfoPanel();
  }

  // Deselect the current unit
  function deselectUnit() {
    selectedUnit = null;
    updateUnitInfoPanel();
  }

  // Update the unit info panel display
  function updateUnitInfoPanel() {
    const panel = document.getElementById('unit-info-panel');
    if (!panel) return;

    // Verify selected unit still exists in world
    if (selectedUnit && world) {
      const currentUnit = world.getActor(selectedUnit.id);
      if (!currentUnit) {
        // Unit was removed from world
        selectedUnit = null;
      } else {
        // Update reference in case world was replaced
        selectedUnit = currentUnit;
      }
    }

    if (selectedUnit) {
      panel.classList.remove('hidden');
      document.getElementById('unit-id').textContent = selectedUnit.id;
      document.getElementById('unit-x').textContent = Math.round(selectedUnit.x);
      document.getElementById('unit-y').textContent = Math.round(selectedUnit.y);
      document.getElementById('unit-sprite').textContent = selectedUnit.sprite || 'default';
    } else {
      panel.classList.add('hidden');
    }
  }

  // Handle move command on right click
  function handleMoveCommand(clientX, clientY) {
    if (!selectedUnit) return;

    const worldPos = screenToWorld(clientX, clientY);

    // Set the move target for this unit
    unitMoveTargets.set(selectedUnit.id, {
      x: worldPos.x,
      y: worldPos.y
    });
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
