// Game client - handles rendering and player input
document.addEventListener('DOMContentLoaded', () => {
  // Get room info from session storage
  const roomId = sessionStorage.getItem('roomId');
  const playerName = sessionStorage.getItem('playerName');

  // Elements
  const roomIdDisplay = document.getElementById('room-id');
  const playerNameDisplay = document.getElementById('player-name');
  const mineralsDisplay = document.getElementById('minerals-display');
  const supplyDisplay = document.getElementById('supply-display');
  const playersList = document.getElementById('players-list');
  const gameStatus = document.getElementById('game-status');
  const leaveBtn = document.getElementById('leave-btn');
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const unitInfoPanel = document.getElementById('unit-info-panel');
  const buildMenu = document.getElementById('build-menu');
  const gameOverOverlay = document.getElementById('game-over-overlay');

  // State
  let players = [];
  let gameRunning = false;
  let world = null;
  let myPlayerId = null;
  let myPlayerIndex = 0;
  let myPlayerState = null;

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

  // Selection state
  let selectedActors = [];
  let lastPanelActorId = null; // Track what actor the panel is showing
  let lastPanelActorHealth = null;
  const UNIT_RADIUS = 16;

  // Selection box state
  let isSelectingBox = false;
  let selectBoxStartX = 0;
  let selectBoxStartY = 0;
  let selectBoxEndX = 0;
  let selectBoxEndY = 0;
  let selectBoxShiftKey = false;

  // Build mode
  let buildMode = null; // null or building type string
  let buildGhostX = 0;
  let buildGhostY = 0;

  // Visual effects
  const attackEffects = []; // {x, y, targetX, targetY, time}

  // Fog of war - visibility cache (updated each frame)
  let visibilityGrid = null;  // 2D array of boolean values
  let fogGridWidth = 0;
  let fogGridHeight = 0;

  // Debug settings
  let debugFogDisabled = false;
  const debugFogToggle = document.getElementById('debug-fog-toggle');
  if (debugFogToggle) {
    debugFogToggle.addEventListener('change', (e) => {
      debugFogDisabled = e.target.checked;
    });
  }

  // Initialize
  if (!roomId || !playerName) {
    window.location.href = '/';
    return;
  }

  roomIdDisplay.textContent = roomId;
  playerNameDisplay.textContent = playerName;

  // Resize canvas to fit container
  function resizeCanvas() {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  // Initial resize and listen for window resize
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

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
    myPlayerId = data.playerId;
    myPlayerIndex = data.playerIndex;
    if (data.playerState) {
      myPlayerState = data.playerState;
    }

    // Center camera on player's base
    const myBase = world.getPlayerBase(myPlayerId);
    if (myBase) {
      cameraX = myBase.x - canvas.width / 2;
      cameraY = myBase.y - canvas.height / 2;
    } else {
      const worldPixelWidth = world.width * CONSTANTS.TILE_WIDTH;
      const worldPixelHeight = world.height * CONSTANTS.TILE_HEIGHT;
      cameraX = (worldPixelWidth - canvas.width) / 2;
      cameraY = (worldPixelHeight - canvas.height) / 2;
    }

    clampCamera();
    selectedActors = [];
    updateUnitInfoPanel();
    updateResourceDisplay();
    gameStatus.textContent = 'Game started!';
    console.log('World received:', world, 'I am player', myPlayerIndex, 'myPlayerId:', myPlayerId);
  });

  network.on('gameState', (data) => {
    // Update world from server state
    world = World.fromJSON(data.world);

    // Update player state
    if (data.players && data.players[myPlayerId]) {
      myPlayerState = data.players[myPlayerId];
      updateResourceDisplay();
    }

    // Update selection references
    updateSelectionReferences();
  });

  network.on('attackEvent', (data) => {
    const attacker = world?.getActor(data.attackerId);
    const target = world?.getActor(data.targetId);
    if (attacker && target) {
      attackEffects.push({
        x: attacker.x,
        y: attacker.y,
        targetX: target.x,
        targetY: target.y,
        time: 0.2
      });
    }
  });

  network.on('actorDeath', (data) => {
    // Remove from selection if dead
    selectedActors = selectedActors.filter(a => a.id !== data.actorId);
    updateUnitInfoPanel(true);
  });

  network.on('gameOver', (data) => {
    const isWinner = data.winnerId === myPlayerId;
    showGameOver(isWinner, data.reason);
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

  // Return to lobby button
  document.getElementById('return-to-lobby-btn')?.addEventListener('click', () => {
    network.leaveRoom();
    sessionStorage.removeItem('roomId');
    window.location.href = '/';
  });

  // Build menu buttons
  document.querySelectorAll('.build-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const buildingType = btn.dataset.building;
      enterBuildMode(buildingType);
    });
  });

  document.getElementById('cancel-build-btn')?.addEventListener('click', () => {
    exitBuildMode();
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

    // Escape key - deselect or exit build mode
    if (e.key === 'Escape') {
      if (buildMode) {
        exitBuildMode();
      } else {
        deselectAll();
      }
    }

    // B key - open build menu if worker selected
    if (e.key === 'b' || e.key === 'B') {
      if (hasSelectedWorker()) {
        toggleBuildMenu();
      }
    }

    // P key - push ball
    if (e.key === 'p' || e.key === 'P') {
      if (selectedActors.length > 0) {
        sendPushBallCommand();
      }
    }

    // S key - stop
    if (e.key === 's' && !keysPressed.has('control')) {
      if (selectedActors.length > 0) {
        sendStopCommand();
      }
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
      const zoomDelta = e.deltaY > 0 ? -CONSTANTS.CAMERA_ZOOM_SPEED * 0.5 : CONSTANTS.CAMERA_ZOOM_SPEED * 0.5;
      zoomCameraAt(zoomDelta, mouseX, mouseY);
    } else if (isTrackpadScroll(e)) {
      cameraX += e.deltaX / cameraZoom;
      cameraY += e.deltaY / cameraZoom;
      clampCamera();
    } else {
      const zoomDelta = e.deltaY > 0 ? -CONSTANTS.CAMERA_ZOOM_SPEED : CONSTANTS.CAMERA_ZOOM_SPEED;
      zoomCameraAt(zoomDelta, mouseX, mouseY);
    }
  }, { passive: false });

  function isTrackpadScroll(e) {
    if (e.deltaMode !== 0) return false;
    if (Math.abs(e.deltaX) > 0) return true;
    const dominated = Math.abs(e.deltaY);
    if (dominated > 0 && dominated < 50) return true;
    if (e.deltaY % 1 !== 0) return true;
    return false;
  }

  // Mouse controls
  let rightClickStartX = 0;
  let rightClickStartY = 0;
  let isRightClickDrag = false;
  let isRightClickAction = false; // Track if we started a right-click action

  // Helper to detect right-click (button 2 or Ctrl+click on Mac)
  function isRightClick(e) {
    return e.button === 2 || (e.button === 0 && e.ctrlKey);
  }

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1) {
      e.preventDefault();
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragCameraStartX = cameraX;
      dragCameraStartY = cameraY;
      canvas.style.cursor = 'grabbing';
    } else if (isRightClick(e)) {
      e.preventDefault();
      rightClickStartX = e.clientX;
      rightClickStartY = e.clientY;
      isRightClickDrag = false;
      isRightClickAction = true;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragCameraStartX = cameraX;
      dragCameraStartY = cameraY;
    } else if (e.button === 0) {
      if (buildMode) {
        handleBuildPlacement(e.clientX, e.clientY);
        return;
      }
      if (handleMinimapNavigation(e.clientX, e.clientY)) {
        isMinimapDragging = true;
        canvas.style.cursor = 'crosshair';
        return;
      }
      if (world) {
        // Start potential selection box
        const worldPos = screenToWorld(e.clientX, e.clientY);
        selectBoxStartX = worldPos.x;
        selectBoxStartY = worldPos.y;
        selectBoxEndX = worldPos.x;
        selectBoxEndY = worldPos.y;
        selectBoxShiftKey = e.shiftKey;
        isSelectingBox = true;
      }
    }
  });

  window.addEventListener('mousemove', (e) => {
    // Update build ghost position
    if (buildMode && world) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      buildGhostX = worldPos.x;
      buildGhostY = worldPos.y;
    }

    // Update selection box
    if (isSelectingBox && world) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      selectBoxEndX = worldPos.x;
      selectBoxEndY = worldPos.y;
    }

    if (isDragging) {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isRightClickDrag = true;
        canvas.style.cursor = 'grabbing';
      }
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
    if (e.button === 1) {
      isDragging = false;
      canvas.style.cursor = 'default';
    } else if (isRightClickAction && (e.button === 2 || e.button === 0)) {
      isDragging = false;
      isRightClickAction = false;
      canvas.style.cursor = 'default';
      if (!isRightClickDrag && selectedActors.length > 0 && world) {
        handleRightClick(e.clientX, e.clientY);
      }
    }
    if (e.button === 0 && isMinimapDragging) {
      isMinimapDragging = false;
      canvas.style.cursor = 'default';
    }
    // Handle selection box completion
    if (e.button === 0 && isSelectingBox && world) {
      isSelectingBox = false;
      const worldPos = screenToWorld(e.clientX, e.clientY);
      selectBoxEndX = worldPos.x;
      selectBoxEndY = worldPos.y;

      // Check if this was a drag (box) or a click
      const boxWidth = Math.abs(selectBoxEndX - selectBoxStartX);
      const boxHeight = Math.abs(selectBoxEndY - selectBoxStartY);

      if (boxWidth > 10 || boxHeight > 10) {
        // Box selection
        handleBoxSelection(selectBoxShiftKey);
      } else {
        // Single click selection
        handleLeftClick(e.clientX, e.clientY, selectBoxShiftKey);
      }
    }
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Command helpers
  function sendMoveCommand(targetX, targetY) {
    console.log('sendMoveCommand called', { targetX, targetY });
    console.log('selectedActors:', selectedActors.map(a => ({ id: a.id, type: a.type, ownerId: a.ownerId })));
    console.log('myPlayerId:', myPlayerId);

    const myUnitIds = selectedActors
      .filter(a => a.ownerId === myPlayerId && a.type === 'unit')
      .map(a => a.id);

    console.log('Filtered unit IDs to move:', myUnitIds);

    if (myUnitIds.length > 0) {
      console.log('Sending MOVE command');
      network.sendCommand(Commands.move(myUnitIds, targetX, targetY));
    } else {
      console.log('No units to move - ownership mismatch or no units selected');
    }
  }

  function sendAttackCommand(targetId) {
    const myUnitIds = selectedActors
      .filter(a => a.ownerId === myPlayerId && a.type === 'unit' && a.attack > 0)
      .map(a => a.id);
    if (myUnitIds.length > 0) {
      network.sendCommand(Commands.attack(myUnitIds, targetId));
    }
  }

  function sendGatherCommand(resourceId) {
    const myWorkerIds = selectedActors
      .filter(a => a.ownerId === myPlayerId && a.subtype === 'worker')
      .map(a => a.id);
    if (myWorkerIds.length > 0) {
      network.sendCommand(Commands.gather(myWorkerIds, resourceId));
    }
  }

  function sendBuildCommand(workerId, buildingType, x, y) {
    network.sendCommand(Commands.build(workerId, buildingType, x, y));
  }

  function sendAssistBuildCommand(buildingId) {
    const myWorkerIds = selectedActors
      .filter(a => a.ownerId === myPlayerId && a.subtype === 'worker')
      .map(a => a.id);
    if (myWorkerIds.length > 0) {
      network.sendCommand(Commands.assistBuild(myWorkerIds, buildingId));
    }
  }

  function sendTrainCommand(buildingId, unitType) {
    network.sendCommand(Commands.train(buildingId, unitType));
  }

  function sendPushBallCommand() {
    const myUnitIds = selectedActors
      .filter(a => a.ownerId === myPlayerId && a.type === 'unit')
      .map(a => a.id);
    if (myUnitIds.length > 0) {
      network.sendCommand(Commands.pushBall(myUnitIds));
    }
  }

  function sendStopCommand() {
    const myUnitIds = selectedActors
      .filter(a => a.ownerId === myPlayerId && a.type === 'unit')
      .map(a => a.id);
    if (myUnitIds.length > 0) {
      network.sendCommand(Commands.stop(myUnitIds));
    }
  }

  // Click handlers
  function handleLeftClick(clientX, clientY, shiftKey) {
    const worldPos = screenToWorld(clientX, clientY);
    const clickedActor = getActorAtPosition(worldPos.x, worldPos.y);

    console.log('handleLeftClick at world pos:', worldPos);
    console.log('clickedActor:', clickedActor);

    if (clickedActor) {
      if (shiftKey) {
        // Shift+click: toggle selection
        const idx = selectedActors.findIndex(a => a.id === clickedActor.id);
        if (idx >= 0) {
          selectedActors.splice(idx, 1);
        } else {
          selectedActors.push(clickedActor);
        }
      } else {
        // Regular click: replace selection
        selectedActors = [clickedActor];
      }
      console.log('Selected actor:', clickedActor.id, 'ownerId:', clickedActor.ownerId, 'myPlayerId:', myPlayerId);
    } else {
      if (!shiftKey) {
        deselectAll();
      }
    }
    updateUnitInfoPanel(true);
  }

  function handleRightClick(clientX, clientY) {
    console.log('handleRightClick called at', clientX, clientY);
    const worldPos = screenToWorld(clientX, clientY);
    const clickedActor = getActorAtPosition(worldPos.x, worldPos.y);

    if (clickedActor) {
      if (clickedActor.type === 'resource') {
        // Right-click on resource: gather
        sendGatherCommand(clickedActor.id);
      } else if (clickedActor.type === 'ball') {
        // Right-click on ball: attack to shoot it
        sendAttackCommand(clickedActor.id);
      } else if (clickedActor.ownerId && clickedActor.ownerId !== myPlayerId) {
        // Right-click on enemy: attack
        sendAttackCommand(clickedActor.id);
      } else if (clickedActor.type === 'building' && clickedActor.ownerId === myPlayerId && clickedActor.state === 'constructing') {
        // Right-click on own building under construction: assist build
        sendAssistBuildCommand(clickedActor.id);
      } else {
        // Right-click on friendly/neutral: move
        sendMoveCommand(worldPos.x, worldPos.y);
      }
    } else {
      // Right-click on empty space: move
      sendMoveCommand(worldPos.x, worldPos.y);
    }
  }

  function getActorAtPosition(worldX, worldY) {
    if (!world) return null;
    const actors = world.getAllActors();
    let closest = null;
    let closestDist = Infinity;

    for (const actor of actors) {
      // Skip enemy actors in fog of war
      const isEnemy = actor.ownerId != null && actor.ownerId !== myPlayerId;
      if (isEnemy && !isPositionVisible(actor.x, actor.y)) {
        continue;
      }

      // Use actual radius for ball, slightly expanded radius for small actors
      const baseRadius = actor.radius || UNIT_RADIUS;
      const clickRadius = actor.type === 'ball' ? baseRadius : baseRadius * 1.5;
      const dx = actor.x - worldX;
      const dy = actor.y - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= clickRadius && dist < closestDist) {
        closestDist = dist;
        closest = actor;
      }
    }
    return closest;
  }

  function handleBoxSelection(shiftKey) {
    if (!world) return;

    // Get box bounds
    const minX = Math.min(selectBoxStartX, selectBoxEndX);
    const maxX = Math.max(selectBoxStartX, selectBoxEndX);
    const minY = Math.min(selectBoxStartY, selectBoxEndY);
    const maxY = Math.max(selectBoxStartY, selectBoxEndY);

    // Find all actors within the box
    const actorsInBox = world.getAllActors().filter(actor => {
      const radius = actor.radius || UNIT_RADIUS;
      // Check if actor's bounding circle intersects the box
      return actor.x + radius >= minX && actor.x - radius <= maxX &&
             actor.y + radius >= minY && actor.y - radius <= maxY;
    });

    // Apply smart filtering
    const filtered = filterSelectionByPriority(actorsInBox);

    if (shiftKey) {
      // Add to existing selection
      for (const actor of filtered) {
        if (!selectedActors.some(a => a.id === actor.id)) {
          selectedActors.push(actor);
        }
      }
    } else {
      // Replace selection
      selectedActors = filtered;
    }

    updateUnitInfoPanel(true);
  }

  function filterSelectionByPriority(actors) {
    // Filter out enemies in fog of war first
    const visibleActors = actors.filter(a => {
      const isEnemy = a.ownerId != null && a.ownerId !== myPlayerId;
      return !isEnemy || isPositionVisible(a.x, a.y);
    });

    // Separate actors by category
    const myUnits = visibleActors.filter(a => a.ownerId === myPlayerId && a.type === 'unit');
    const myBuildings = visibleActors.filter(a => a.ownerId === myPlayerId && a.type === 'building');
    const enemyActors = visibleActors.filter(a => a.ownerId != null && a.ownerId !== myPlayerId);
    const neutralActors = visibleActors.filter(a => a.ownerId == null && a.type !== 'ball');
    const ball = visibleActors.find(a => a.type === 'ball');

    // Priority 1: If we have my units, prefer them over everything else
    if (myUnits.length > 0) {
      return myUnits;
    }

    // Priority 2: If we have my buildings but no units, select buildings
    if (myBuildings.length > 0) {
      return myBuildings;
    }

    // Priority 3: If we have enemy actors, select them (for inspection)
    if (enemyActors.length > 0) {
      return enemyActors;
    }

    // Priority 4: Neutral actors (resources)
    if (neutralActors.length > 0) {
      return neutralActors;
    }

    // Priority 5: Ball
    if (ball) {
      return [ball];
    }

    return [];
  }

  // Build mode
  function hasSelectedWorker() {
    return selectedActors.some(a => a.ownerId === myPlayerId && a.subtype === 'worker');
  }

  function toggleBuildMenu() {
    buildMenu.classList.toggle('hidden');
    updateBuildButtons();
  }

  function enterBuildMode(buildingType) {
    buildMode = buildingType;
    buildMenu.classList.add('hidden');
    canvas.style.cursor = 'crosshair';
  }

  function exitBuildMode() {
    buildMode = null;
    canvas.style.cursor = 'default';
  }

  function updateBuildButtons() {
    const buttons = document.querySelectorAll('.build-btn');
    buttons.forEach(btn => {
      const buildingType = btn.dataset.building;
      const def = EntityDefs.buildings[buildingType];
      const canAfford = myPlayerState && myPlayerState.minerals >= def.cost;
      btn.disabled = !canAfford;
    });
  }

  function handleBuildPlacement(clientX, clientY) {
    if (!buildMode || !hasSelectedWorker()) return;

    const worldPos = screenToWorld(clientX, clientY);
    const worker = selectedActors.find(a => a.ownerId === myPlayerId && a.subtype === 'worker');
    if (worker) {
      sendBuildCommand(worker.id, buildMode, worldPos.x, worldPos.y);
    }
    exitBuildMode();
  }

  // Selection helpers
  function deselectAll() {
    selectedActors = [];
    buildMenu.classList.add('hidden');
    updateUnitInfoPanel(true);
  }

  function updateSelectionReferences() {
    // Update actor references from new world state
    selectedActors = selectedActors
      .map(a => world?.getActor(a.id))
      .filter(a => a != null);
    updateUnitInfoPanel();
  }

  // Minimap helpers
  function getMinimapBounds() {
    return {
      x: CONSTANTS.MINIMAP_PADDING,
      y: canvas.height - CONSTANTS.MINIMAP_HEIGHT - CONSTANTS.MINIMAP_PADDING - 20,
      width: CONSTANTS.MINIMAP_WIDTH,
      height: CONSTANTS.MINIMAP_HEIGHT
    };
  }

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

  // UI Updates
  function updatePlayersList() {
    playersList.innerHTML = '';
    players.forEach((player, index) => {
      const li = document.createElement('li');
      const color = CONSTANTS.TEAM_COLORS[index] || '#fff';
      li.innerHTML = `<span style="color: ${color};">\u25CF</span> ${player.name}`;
      playersList.appendChild(li);
    });
  }

  function updateResourceDisplay() {
    if (myPlayerState) {
      mineralsDisplay.textContent = `Minerals: ${myPlayerState.minerals}`;
      supplyDisplay.textContent = `Supply: ${myPlayerState.supply}/${myPlayerState.maxSupply}`;
    }
  }

  function updateUnitInfoPanel(forceRebuild = false) {
    if (selectedActors.length === 0) {
      unitInfoPanel.classList.add('hidden');
      lastPanelActorId = null;
      lastPanelActorHealth = null;
      return;
    }

    unitInfoPanel.classList.remove('hidden');
    const actor = selectedActors[0];

    // Always update the dynamic stats (health, position)
    document.getElementById('unit-health').textContent = `${Math.round(actor.health)}/${actor.maxHealth}`;
    document.getElementById('unit-x').textContent = Math.round(actor.x);
    document.getElementById('unit-y').textContent = Math.round(actor.y);

    // Only rebuild the panel fully if the selection changed
    const selectionChanged = actor.id !== lastPanelActorId;
    if (!selectionChanged && !forceRebuild) {
      // Just update button disabled states without recreating them
      updateActionButtonStates();
      return;
    }

    lastPanelActorId = actor.id;
    lastPanelActorHealth = actor.health;

    document.getElementById('unit-id').textContent = actor.id;
    document.getElementById('unit-type').textContent = actor.subtype || actor.type;

    // Show actions for owned units/buildings
    const actionsDiv = document.getElementById('unit-actions');
    actionsDiv.innerHTML = '';

    if (actor.ownerId === myPlayerId) {
      if (actor.type === 'building' && actor.state !== 'constructing') {
        const def = EntityDefs.buildings[actor.subtype];
        if (def && def.trains) {
          def.trains.forEach(unitType => {
            const unitDef = EntityDefs.units[unitType];
            const btn = document.createElement('button');
            btn.className = 'train-btn';
            btn.dataset.unitType = unitType;
            btn.dataset.cost = unitDef.cost;
            btn.textContent = `Train ${unitType} (${unitDef.cost})`;
            btn.disabled = !myPlayerState || myPlayerState.minerals < unitDef.cost;
            btn.addEventListener('click', () => sendTrainCommand(actor.id, unitType));
            actionsDiv.appendChild(btn);
          });
        }
      }

      if (actor.subtype === 'worker') {
        const buildBtn = document.createElement('button');
        buildBtn.textContent = 'Build (B)';
        buildBtn.addEventListener('click', toggleBuildMenu);
        actionsDiv.appendChild(buildBtn);
      }
    }
  }

  function updateActionButtonStates() {
    // Update train button disabled states without recreating them
    const trainButtons = document.querySelectorAll('#unit-actions .train-btn');
    trainButtons.forEach(btn => {
      const cost = parseInt(btn.dataset.cost, 10);
      btn.disabled = !myPlayerState || myPlayerState.minerals < cost;
    });
  }

  function showGameOver(isWinner, reason) {
    gameOverOverlay.classList.remove('hidden');
    const content = gameOverOverlay.querySelector('.game-over-content');
    const title = document.getElementById('game-over-title');
    const message = document.getElementById('game-over-message');

    if (isWinner) {
      content.classList.add('victory');
      content.classList.remove('defeat');
      title.textContent = 'Victory!';
      message.textContent = 'You pushed the ball into the enemy goal!';
    } else {
      content.classList.add('defeat');
      content.classList.remove('victory');
      title.textContent = 'Defeat';
      message.textContent = 'The enemy scored a goal.';
    }
  }

  // Game loop
  function startGameLoop() {
    if (gameRunning) return;
    gameRunning = true;
    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
  }

  function gameLoop(timestamp) {
    if (!gameRunning) return;

    const deltaTime = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;

    update(deltaTime);
    draw();

    requestAnimationFrame(gameLoop);
  }

  function update(deltaTime) {
    // Handle keyboard camera panning
    if (world) {
      const panSpeed = CONSTANTS.CAMERA_PAN_SPEED / cameraZoom;
      const panAmount = panSpeed * deltaTime;

      if (keysPressed.has('w') || keysPressed.has('arrowup')) cameraY -= panAmount;
      if (keysPressed.has('s') || keysPressed.has('arrowdown')) cameraY += panAmount;
      if (keysPressed.has('a') || keysPressed.has('arrowleft')) cameraX -= panAmount;
      if (keysPressed.has('d') || keysPressed.has('arrowright')) cameraX += panAmount;
      clampCamera();
    }

    // Update attack effects
    for (let i = attackEffects.length - 1; i >= 0; i--) {
      attackEffects[i].time -= deltaTime;
      if (attackEffects[i].time <= 0) {
        attackEffects.splice(i, 1);
      }
    }
  }

  // Fog of War functions
  function calculateVisibility() {
    if (!world) return;

    const fogTileSize = CONSTANTS.FOG_TILE_SIZE;
    const worldPixelWidth = world.width * CONSTANTS.TILE_WIDTH;
    const worldPixelHeight = world.height * CONSTANTS.TILE_HEIGHT;

    // Initialize fog grid
    fogGridWidth = Math.ceil(worldPixelWidth / fogTileSize);
    fogGridHeight = Math.ceil(worldPixelHeight / fogTileSize);

    // Reset visibility grid to all false (fog)
    visibilityGrid = [];
    for (let y = 0; y < fogGridHeight; y++) {
      visibilityGrid[y] = new Array(fogGridWidth).fill(false);
    }

    // Get all vision sources for this player
    const visionSources = [];

    // Add own units and buildings
    const actors = world.getAllActors();
    for (const actor of actors) {
      if (actor.ownerId === myPlayerId && (actor.type === 'unit' || actor.type === 'building')) {
        visionSources.push({
          x: actor.x,
          y: actor.y,
          radius: actor.visionRadius || CONSTANTS.DEFAULT_VISION_RADIUS
        });
      }
    }

    // Ball provides vision to both players
    const ball = world.getBall();
    if (ball) {
      visionSources.push({
        x: ball.x,
        y: ball.y,
        radius: ball.visionRadius || 300
      });
    }

    // Mark visible cells
    for (const source of visionSources) {
      const radiusTiles = Math.ceil(source.radius / fogTileSize);
      const centerTileX = Math.floor(source.x / fogTileSize);
      const centerTileY = Math.floor(source.y / fogTileSize);

      // Check tiles within bounding box of vision radius
      for (let dy = -radiusTiles; dy <= radiusTiles; dy++) {
        for (let dx = -radiusTiles; dx <= radiusTiles; dx++) {
          const tileX = centerTileX + dx;
          const tileY = centerTileY + dy;

          // Skip out of bounds
          if (tileX < 0 || tileX >= fogGridWidth || tileY < 0 || tileY >= fogGridHeight) {
            continue;
          }

          // Check if tile center is within vision radius
          const tileCenterX = (tileX + 0.5) * fogTileSize;
          const tileCenterY = (tileY + 0.5) * fogTileSize;
          const distX = tileCenterX - source.x;
          const distY = tileCenterY - source.y;
          const dist = Math.sqrt(distX * distX + distY * distY);

          if (dist <= source.radius) {
            visibilityGrid[tileY][tileX] = true;
          }
        }
      }
    }
  }

  function isPositionVisible(worldX, worldY) {
    if (debugFogDisabled) return true;
    if (!visibilityGrid) return true;

    const fogTileSize = CONSTANTS.FOG_TILE_SIZE;
    const tileX = Math.floor(worldX / fogTileSize);
    const tileY = Math.floor(worldY / fogTileSize);

    if (tileX < 0 || tileX >= fogGridWidth || tileY < 0 || tileY >= fogGridHeight) {
      return false;
    }

    return visibilityGrid[tileY][tileX];
  }

  function drawFogOfWar() {
    if (debugFogDisabled) return;
    if (!visibilityGrid || !world) return;

    const fogTileSize = CONSTANTS.FOG_TILE_SIZE;
    const scaledTileSize = fogTileSize * cameraZoom;

    // Calculate visible area in fog tiles
    const viewWidth = canvas.width / cameraZoom;
    const viewHeight = canvas.height / cameraZoom;
    const startTileX = Math.floor(cameraX / fogTileSize);
    const startTileY = Math.floor(cameraY / fogTileSize);
    const endTileX = Math.ceil((cameraX + viewWidth) / fogTileSize);
    const endTileY = Math.ceil((cameraY + viewHeight) / fogTileSize);

    ctx.fillStyle = CONSTANTS.FOG_COLOR;

    for (let ty = startTileY; ty <= endTileY && ty < fogGridHeight; ty++) {
      for (let tx = startTileX; tx <= endTileX && tx < fogGridWidth; tx++) {
        if (tx < 0 || ty < 0) continue;

        // Only draw fog on non-visible tiles
        if (!visibilityGrid[ty][tx]) {
          const screenX = (tx * fogTileSize - cameraX) * cameraZoom;
          const screenY = (ty * fogTileSize - cameraY) * cameraZoom;
          ctx.fillRect(screenX, screenY, scaledTileSize + 1, scaledTileSize + 1);
        }
      }
    }
  }

  function draw() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!world) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for game to start...', canvas.width / 2, canvas.height / 2 - 20);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#888888';
      ctx.fillText(`Room: ${roomId} | Players: ${players.length}`, canvas.width / 2, canvas.height / 2 + 20);
      return;
    }

    // Calculate fog of war visibility
    calculateVisibility();

    drawMap();
    drawGoals();
    drawActors();
    drawFogOfWar();
    drawAttackEffects();
    drawBuildGhost();
    drawSelectionBox();
    drawUI();
    drawMinimap();
  }

  function drawMap() {
    const tileW = CONSTANTS.TILE_WIDTH;
    const tileH = CONSTANTS.TILE_HEIGHT;
    const scaledTileW = tileW * cameraZoom;
    const scaledTileH = tileH * cameraZoom;
    const worldPixelWidth = world.width * tileW;
    const worldPixelHeight = world.height * tileH;
    const cornerCut = CONSTANTS.CORNER_CUT_SIZE;

    const viewWidth = canvas.width / cameraZoom;
    const viewHeight = canvas.height / cameraZoom;
    const startTileX = Math.floor(cameraX / tileW);
    const startTileY = Math.floor(cameraY / tileH);
    const endTileX = Math.ceil((cameraX + viewWidth) / tileW);
    const endTileY = Math.ceil((cameraY + viewHeight) / tileH);

    for (let ty = startTileY; ty <= endTileY && ty < world.height; ty++) {
      for (let tx = startTileX; tx <= endTileX && tx < world.width; tx++) {
        if (tx < 0 || ty < 0) continue;

        const screenX = (tx * tileW - cameraX) * cameraZoom;
        const screenY = (ty * tileH - cameraY) * cameraZoom;

        // Check if tile center is in the corner cut-off area
        const tileCenterX = (tx + 0.5) * tileW;
        const tileCenterY = (ty + 0.5) * tileH;
        const isInCorner = !MapBounds.isInsidePlayableArea(
          tileCenterX, tileCenterY, worldPixelWidth, worldPixelHeight, cornerCut
        );

        if (isInCorner) {
          // Draw darker color for out-of-bounds corner areas
          ctx.fillStyle = '#0a0a15';
          ctx.fillRect(screenX, screenY, scaledTileW, scaledTileH);
        } else {
          ctx.fillStyle = (tx + ty) % 2 === 0 ? '#2a2a4e' : '#252545';
          ctx.fillRect(screenX, screenY, scaledTileW, scaledTileH);

          ctx.strokeStyle = '#3a3a5e';
          ctx.strokeRect(screenX, screenY, scaledTileW, scaledTileH);
        }
      }
    }

    // Draw diagonal corner boundary lines
    drawCornerBoundaries();
  }

  function drawCornerBoundaries() {
    const worldPixelWidth = world.width * CONSTANTS.TILE_WIDTH;
    const worldPixelHeight = world.height * CONSTANTS.TILE_HEIGHT;
    const cut = CONSTANTS.CORNER_CUT_SIZE;

    ctx.strokeStyle = '#5a5a8e';
    ctx.lineWidth = 2 * cameraZoom;

    // Top-left diagonal: from (cut, 0) to (0, cut)
    ctx.beginPath();
    ctx.moveTo((cut - cameraX) * cameraZoom, (0 - cameraY) * cameraZoom);
    ctx.lineTo((0 - cameraX) * cameraZoom, (cut - cameraY) * cameraZoom);
    ctx.stroke();

    // Top-right diagonal: from (worldWidth - cut, 0) to (worldWidth, cut)
    ctx.beginPath();
    ctx.moveTo((worldPixelWidth - cut - cameraX) * cameraZoom, (0 - cameraY) * cameraZoom);
    ctx.lineTo((worldPixelWidth - cameraX) * cameraZoom, (cut - cameraY) * cameraZoom);
    ctx.stroke();

    // Bottom-left diagonal: from (0, worldHeight - cut) to (cut, worldHeight)
    ctx.beginPath();
    ctx.moveTo((0 - cameraX) * cameraZoom, (worldPixelHeight - cut - cameraY) * cameraZoom);
    ctx.lineTo((cut - cameraX) * cameraZoom, (worldPixelHeight - cameraY) * cameraZoom);
    ctx.stroke();

    // Bottom-right diagonal: from (worldWidth, worldHeight - cut) to (worldWidth - cut, worldHeight)
    ctx.beginPath();
    ctx.moveTo((worldPixelWidth - cameraX) * cameraZoom, (worldPixelHeight - cut - cameraY) * cameraZoom);
    ctx.lineTo((worldPixelWidth - cut - cameraX) * cameraZoom, (worldPixelHeight - cameraY) * cameraZoom);
    ctx.stroke();
  }

  function drawGoals() {
    const worldWidth = world.width * CONSTANTS.TILE_WIDTH;
    const worldHeight = world.height * CONSTANTS.TILE_HEIGHT;
    const goalWidth = CONSTANTS.GOAL_WIDTH;
    const goalHeight = CONSTANTS.GOAL_HEIGHT;
    const goalTop = (worldHeight - goalHeight) / 2;

    // Left goal (blue team defends)
    const leftGoalScreenX = (0 - cameraX) * cameraZoom;
    const leftGoalScreenY = (goalTop - cameraY) * cameraZoom;
    ctx.fillStyle = 'rgba(74, 144, 217, 0.3)';
    ctx.fillRect(leftGoalScreenX, leftGoalScreenY, goalWidth * cameraZoom, goalHeight * cameraZoom);
    ctx.strokeStyle = CONSTANTS.TEAM_COLORS[0];
    ctx.lineWidth = 3;
    ctx.strokeRect(leftGoalScreenX, leftGoalScreenY, goalWidth * cameraZoom, goalHeight * cameraZoom);

    // Right goal (red team defends)
    const rightGoalScreenX = (worldWidth - goalWidth - cameraX) * cameraZoom;
    const rightGoalScreenY = (goalTop - cameraY) * cameraZoom;
    ctx.fillStyle = 'rgba(217, 74, 74, 0.3)';
    ctx.fillRect(rightGoalScreenX, rightGoalScreenY, goalWidth * cameraZoom, goalHeight * cameraZoom);
    ctx.strokeStyle = CONSTANTS.TEAM_COLORS[1];
    ctx.lineWidth = 3;
    ctx.strokeRect(rightGoalScreenX, rightGoalScreenY, goalWidth * cameraZoom, goalHeight * cameraZoom);
  }

  function drawActors() {
    const actors = world.getAllActors();
    // Sort by y position for pseudo-depth
    actors.sort((a, b) => a.y - b.y);

    for (const actor of actors) {
      // Check fog of war visibility for enemy actors
      const isEnemy = actor.ownerId != null && actor.ownerId !== myPlayerId;
      if (isEnemy && !isPositionVisible(actor.x, actor.y)) {
        continue; // Skip rendering enemy actors in fog
      }

      if (actor.type === 'ball') {
        drawBall(actor);
      } else if (actor.type === 'resource') {
        drawResource(actor);
      } else if (actor.type === 'building') {
        drawBuilding(actor);
      } else {
        drawUnit(actor);
      }
    }
  }

  function drawUnit(actor) {
    const screenX = (actor.x - cameraX) * cameraZoom;
    const screenY = (actor.y - cameraY) * cameraZoom;
    const radius = UNIT_RADIUS * cameraZoom;

    if (screenX < -radius * 2 || screenX > canvas.width + radius * 2 ||
        screenY < -radius * 2 || screenY > canvas.height + radius * 2) {
      return;
    }

    const isSelected = selectedActors.some(a => a.id === actor.id);
    const playerIndex = world.getPlayerIndex(actor.ownerId);
    const color = playerIndex != null ? CONSTANTS.TEAM_COLORS[playerIndex] : '#888';

    // Selection indicator
    if (isSelected) {
      ctx.strokeStyle = '#4aff4a';
      ctx.lineWidth = 3 * cameraZoom;
      ctx.beginPath();
      ctx.arc(screenX, screenY, radius + 6 * cameraZoom, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Unit body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Unit outline
    ctx.strokeStyle = isSelected ? '#4aff4a' : '#fff';
    ctx.lineWidth = 2 * cameraZoom;
    ctx.stroke();

    // Worker/soldier indicator
    if (actor.subtype === 'worker') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(screenX, screenY, radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (actor.subtype === 'soldier') {
      ctx.fillStyle = '#fff';
      const size = radius * 0.4;
      ctx.fillRect(screenX - size/2, screenY - size/2, size, size);
    }

    // Health bar
    drawHealthBar(screenX, screenY - radius - 10 * cameraZoom, actor);

    // Carry indicator for workers
    if (actor.carryAmount > 0) {
      ctx.fillStyle = '#4aefff';
      ctx.font = `${10 * cameraZoom}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`+${actor.carryAmount}`, screenX, screenY + radius + 12 * cameraZoom);
    }
  }

  function drawBuilding(actor) {
    const screenX = (actor.x - cameraX) * cameraZoom;
    const screenY = (actor.y - cameraY) * cameraZoom;
    const size = 40 * cameraZoom;

    const isSelected = selectedActors.some(a => a.id === actor.id);
    const playerIndex = world.getPlayerIndex(actor.ownerId);
    const color = playerIndex != null ? CONSTANTS.TEAM_COLORS[playerIndex] : '#888';

    // Selection indicator
    if (isSelected) {
      ctx.strokeStyle = '#4aff4a';
      ctx.lineWidth = 3 * cameraZoom;
      ctx.strokeRect(screenX - size/2 - 6*cameraZoom, screenY - size/2 - 6*cameraZoom,
                     size + 12*cameraZoom, size + 12*cameraZoom);
    }

    // Building body
    ctx.fillStyle = actor.state === 'constructing' ? `${color}88` : color;
    ctx.fillRect(screenX - size/2, screenY - size/2, size, size);

    ctx.strokeStyle = isSelected ? '#4aff4a' : '#fff';
    ctx.lineWidth = 2 * cameraZoom;
    ctx.strokeRect(screenX - size/2, screenY - size/2, size, size);

    // Building type indicator
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${12 * cameraZoom}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = actor.subtype === 'base' ? 'B' : actor.subtype === 'barracks' ? 'R' : 'S';
    ctx.fillText(label, screenX, screenY);

    // Health bar
    drawHealthBar(screenX, screenY - size/2 - 10 * cameraZoom, actor);

    // Construction progress
    if (actor.state === 'constructing' && actor.constructionProgress != null) {
      const progress = actor.constructionProgress / actor.maxConstructionTime;
      const barWidth = size;
      const barHeight = 6 * cameraZoom;
      const barY = screenY + size/2 + 4 * cameraZoom;

      ctx.fillStyle = '#333';
      ctx.fillRect(screenX - barWidth/2, barY, barWidth, barHeight);
      ctx.fillStyle = '#ffa500';
      ctx.fillRect(screenX - barWidth/2, barY, barWidth * progress, barHeight);
    }

    // Training indicator
    if (actor.trainingQueue && actor.trainingQueue.length > 0) {
      const training = actor.trainingQueue[0];
      const progress = training.progress / training.trainTime;
      const barWidth = size;
      const barHeight = 4 * cameraZoom;
      const barY = screenY + size/2 + 12 * cameraZoom;

      ctx.fillStyle = '#333';
      ctx.fillRect(screenX - barWidth/2, barY, barWidth, barHeight);
      ctx.fillStyle = '#4aff4a';
      ctx.fillRect(screenX - barWidth/2, barY, barWidth * progress, barHeight);

      ctx.fillStyle = '#fff';
      ctx.font = `${8 * cameraZoom}px sans-serif`;
      ctx.fillText(`${actor.trainingQueue.length}`, screenX + barWidth/2 + 8*cameraZoom, barY + barHeight/2);
    }
  }

  function drawResource(actor) {
    const screenX = (actor.x - cameraX) * cameraZoom;
    const screenY = (actor.y - cameraY) * cameraZoom;
    const size = 25 * cameraZoom;

    // Crystal shape
    ctx.fillStyle = '#4aefff';
    ctx.beginPath();
    ctx.moveTo(screenX, screenY - size);
    ctx.lineTo(screenX + size * 0.7, screenY);
    ctx.lineTo(screenX, screenY + size * 0.5);
    ctx.lineTo(screenX - size * 0.7, screenY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2 * cameraZoom;
    ctx.stroke();

    // Amount display
    ctx.fillStyle = '#fff';
    ctx.font = `${10 * cameraZoom}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(actor.amount.toString(), screenX, screenY + size + 10 * cameraZoom);
  }

  function drawBall(actor) {
    const screenX = (actor.x - cameraX) * cameraZoom;
    const screenY = (actor.y - cameraY) * cameraZoom;
    const radius = actor.radius * cameraZoom;

    // Ball shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(screenX + 5*cameraZoom, screenY + 5*cameraZoom, radius, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ball body
    const gradient = ctx.createRadialGradient(
      screenX - radius*0.3, screenY - radius*0.3, 0,
      screenX, screenY, radius
    );
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(0.5, '#ddd');
    gradient.addColorStop(1, '#888');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2 * cameraZoom;
    ctx.stroke();

    // Ball pattern
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1 * cameraZoom;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawHealthBar(screenX, screenY, actor) {
    if (actor.health === actor.maxHealth) return;

    const barWidth = 30 * cameraZoom;
    const barHeight = 4 * cameraZoom;
    const healthPercent = actor.health / actor.maxHealth;

    ctx.fillStyle = '#333';
    ctx.fillRect(screenX - barWidth/2, screenY, barWidth, barHeight);

    ctx.fillStyle = healthPercent > 0.5 ? '#4aff4a' : healthPercent > 0.25 ? '#ffa500' : '#ff4a4a';
    ctx.fillRect(screenX - barWidth/2, screenY, barWidth * healthPercent, barHeight);
  }

  function drawAttackEffects() {
    for (const effect of attackEffects) {
      // Only draw attack effects if either end is visible
      if (!isPositionVisible(effect.x, effect.y) && !isPositionVisible(effect.targetX, effect.targetY)) {
        continue;
      }

      const startX = (effect.x - cameraX) * cameraZoom;
      const startY = (effect.y - cameraY) * cameraZoom;
      const endX = (effect.targetX - cameraX) * cameraZoom;
      const endY = (effect.targetY - cameraY) * cameraZoom;

      const alpha = effect.time / 0.2;
      ctx.strokeStyle = `rgba(255, 100, 100, ${alpha})`;
      ctx.lineWidth = 3 * cameraZoom;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }

  function drawBuildGhost() {
    if (!buildMode) return;

    const screenX = (buildGhostX - cameraX) * cameraZoom;
    const screenY = (buildGhostY - cameraY) * cameraZoom;
    const size = 40 * cameraZoom;

    ctx.fillStyle = 'rgba(74, 255, 74, 0.3)';
    ctx.fillRect(screenX - size/2, screenY - size/2, size, size);

    ctx.strokeStyle = '#4aff4a';
    ctx.lineWidth = 2 * cameraZoom;
    ctx.setLineDash([5 * cameraZoom, 5 * cameraZoom]);
    ctx.strokeRect(screenX - size/2, screenY - size/2, size, size);
    ctx.setLineDash([]);
  }

  function drawSelectionBox() {
    if (!isSelectingBox) return;

    // Check if the box is large enough to draw
    const boxWidth = Math.abs(selectBoxEndX - selectBoxStartX);
    const boxHeight = Math.abs(selectBoxEndY - selectBoxStartY);
    if (boxWidth < 5 && boxHeight < 5) return;

    const startScreenX = (Math.min(selectBoxStartX, selectBoxEndX) - cameraX) * cameraZoom;
    const startScreenY = (Math.min(selectBoxStartY, selectBoxEndY) - cameraY) * cameraZoom;
    const width = boxWidth * cameraZoom;
    const height = boxHeight * cameraZoom;

    // Draw selection box fill
    ctx.fillStyle = 'rgba(74, 255, 74, 0.15)';
    ctx.fillRect(startScreenX, startScreenY, width, height);

    // Draw selection box border
    ctx.strokeStyle = '#4aff4a';
    ctx.lineWidth = 2;
    ctx.strokeRect(startScreenX, startScreenY, width, height);
  }

  function drawUI() {
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Room: ${roomId} | Zoom: ${Math.round(cameraZoom * 100)}%`, 10, 20);

    ctx.fillStyle = '#888888';
    ctx.font = '12px sans-serif';
    const hint = buildMode
      ? 'Click to place building | Escape: Cancel'
      : 'Left: Select | Right: Command | B: Build | P: Push Ball | WASD: Pan';
    ctx.fillText(hint, 10, canvas.height - 10);
  }

  function drawMinimap() {
    const minimapW = CONSTANTS.MINIMAP_WIDTH;
    const minimapH = CONSTANTS.MINIMAP_HEIGHT;
    const padding = CONSTANTS.MINIMAP_PADDING;
    const borderWidth = CONSTANTS.MINIMAP_BORDER_WIDTH;

    const minimapX = padding;
    const minimapY = canvas.height - minimapH - padding - 20;

    const worldPixelWidth = world.width * CONSTANTS.TILE_WIDTH;
    const worldPixelHeight = world.height * CONSTANTS.TILE_HEIGHT;
    const scaleX = minimapW / worldPixelWidth;
    const scaleY = minimapH / worldPixelHeight;

    // Background
    ctx.fillStyle = 'rgba(20, 20, 40, 0.85)';
    ctx.fillRect(minimapX, minimapY, minimapW, minimapH);

    // Draw corner cut-offs on minimap
    const cornerCutX = CONSTANTS.CORNER_CUT_SIZE * scaleX;
    const cornerCutY = CONSTANTS.CORNER_CUT_SIZE * scaleY;
    ctx.fillStyle = 'rgba(5, 5, 15, 0.9)';

    // Top-left corner
    ctx.beginPath();
    ctx.moveTo(minimapX, minimapY);
    ctx.lineTo(minimapX + cornerCutX, minimapY);
    ctx.lineTo(minimapX, minimapY + cornerCutY);
    ctx.closePath();
    ctx.fill();

    // Top-right corner
    ctx.beginPath();
    ctx.moveTo(minimapX + minimapW, minimapY);
    ctx.lineTo(minimapX + minimapW - cornerCutX, minimapY);
    ctx.lineTo(minimapX + minimapW, minimapY + cornerCutY);
    ctx.closePath();
    ctx.fill();

    // Bottom-left corner
    ctx.beginPath();
    ctx.moveTo(minimapX, minimapY + minimapH);
    ctx.lineTo(minimapX + cornerCutX, minimapY + minimapH);
    ctx.lineTo(minimapX, minimapY + minimapH - cornerCutY);
    ctx.closePath();
    ctx.fill();

    // Bottom-right corner
    ctx.beginPath();
    ctx.moveTo(minimapX + minimapW, minimapY + minimapH);
    ctx.lineTo(minimapX + minimapW - cornerCutX, minimapY + minimapH);
    ctx.lineTo(minimapX + minimapW, minimapY + minimapH - cornerCutY);
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = '#4a4a6e';
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(minimapX, minimapY, minimapW, minimapH);

    // Goals on minimap
    const goalWidth = CONSTANTS.GOAL_WIDTH * scaleX;
    const goalHeight = CONSTANTS.GOAL_HEIGHT * scaleY;
    const goalTop = ((worldPixelHeight - CONSTANTS.GOAL_HEIGHT) / 2) * scaleY;

    ctx.fillStyle = 'rgba(74, 144, 217, 0.5)';
    ctx.fillRect(minimapX, minimapY + goalTop, goalWidth, goalHeight);

    ctx.fillStyle = 'rgba(217, 74, 74, 0.5)';
    ctx.fillRect(minimapX + minimapW - goalWidth, minimapY + goalTop, goalWidth, goalHeight);

    // Actors on minimap
    const actors = world.getAllActors();
    for (const actor of actors) {
      // Check fog of war visibility for enemy actors on minimap
      const isEnemy = actor.ownerId != null && actor.ownerId !== myPlayerId;
      if (isEnemy && !isPositionVisible(actor.x, actor.y)) {
        continue; // Skip rendering enemy actors in fog
      }

      const dotX = minimapX + actor.x * scaleX;
      const dotY = minimapY + actor.y * scaleY;
      let dotRadius = 3;
      let color = '#888';

      if (actor.type === 'ball') {
        dotRadius = 5;
        color = '#fff';
      } else if (actor.type === 'resource') {
        color = '#4aefff';
      } else {
        const playerIndex = world.getPlayerIndex(actor.ownerId);
        color = playerIndex != null ? CONSTANTS.TEAM_COLORS[playerIndex] : '#888';
        if (actor.type === 'building') dotRadius = 5;
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw fog overlay on minimap
    if (visibilityGrid && !debugFogDisabled) {
      const fogTileSize = CONSTANTS.FOG_TILE_SIZE;
      const minimapFogScaleX = scaleX * fogTileSize;
      const minimapFogScaleY = scaleY * fogTileSize;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      for (let ty = 0; ty < fogGridHeight; ty++) {
        for (let tx = 0; tx < fogGridWidth; tx++) {
          if (!visibilityGrid[ty][tx]) {
            const fogX = minimapX + tx * minimapFogScaleX;
            const fogY = minimapY + ty * minimapFogScaleY;
            ctx.fillRect(fogX, fogY, minimapFogScaleX + 0.5, minimapFogScaleY + 0.5);
          }
        }
      }
    }

    // Camera viewport
    const viewWidth = canvas.width / cameraZoom;
    const viewHeight = canvas.height / cameraZoom;
    const viewRectX = minimapX + cameraX * scaleX;
    const viewRectY = minimapY + cameraY * scaleY;
    const viewRectW = viewWidth * scaleX;
    const viewRectH = viewHeight * scaleY;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(viewRectX, viewRectY, viewRectW, viewRectH);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(viewRectX, viewRectY, viewRectW, viewRectH);
  }

  // Camera helpers
  function zoomCamera(delta) {
    const oldZoom = cameraZoom;
    cameraZoom = Math.max(CONSTANTS.CAMERA_ZOOM_MIN,
                          Math.min(CONSTANTS.CAMERA_ZOOM_MAX, cameraZoom + delta));
    return oldZoom !== cameraZoom;
  }

  function zoomCameraAt(delta, screenX, screenY) {
    if (!world) return;
    const worldX = cameraX + screenX / cameraZoom;
    const worldY = cameraY + screenY / cameraZoom;
    if (!zoomCamera(delta)) return;
    cameraX = worldX - screenX / cameraZoom;
    cameraY = worldY - screenY / cameraZoom;
    clampCamera();
  }

  function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleFactorX = canvas.width / rect.width;
    const scaleFactorY = canvas.height / rect.height;
    const canvasX = (clientX - rect.left) * scaleFactorX;
    const canvasY = (clientY - rect.top) * scaleFactorY;
    return {
      x: cameraX + canvasX / cameraZoom,
      y: cameraY + canvasY / cameraZoom
    };
  }

  function clampCamera() {
    if (!world) return;
    const worldPixelWidth = world.width * CONSTANTS.TILE_WIDTH;
    const worldPixelHeight = world.height * CONSTANTS.TILE_HEIGHT;
    const viewWidth = canvas.width / cameraZoom;
    const viewHeight = canvas.height / cameraZoom;
    const padding = 100;
    cameraX = Math.max(-padding, Math.min(worldPixelWidth - viewWidth + padding, cameraX));
    cameraY = Math.max(-padding, Math.min(worldPixelHeight - viewHeight + padding, cameraY));
  }
});
