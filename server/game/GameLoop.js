const CONSTANTS = require('../../shared/constants');
const { CommandTypes } = require('../../shared/commands');

// Server-side game simulation loop
class GameLoop {
  constructor(world, io, roomId, players) {
    this.world = world;
    this.io = io;
    this.roomId = roomId;
    this.players = players; // Map of playerId -> playerState
    this.running = false;
    this.tickInterval = null;
    this.lastTickTime = Date.now();
    this.tickCount = 0;

    // Broadcast rate (send state every N ticks)
    this.broadcastInterval = Math.floor(CONSTANTS.TICK_RATE / 20); // ~20 updates/sec

    // Pending commands queue per player
    this.commandQueues = new Map();
    for (const playerId of players.keys()) {
      this.commandQueues.set(playerId, []);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTickTime = Date.now();

    const tickMs = 1000 / CONSTANTS.TICK_RATE;
    this.tickInterval = setInterval(() => this.tick(), tickMs);
    console.log(`GameLoop started for room ${this.roomId}`);
  }

  stop() {
    if (!this.running) return;
    this.running = false;

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    console.log(`GameLoop stopped for room ${this.roomId}`);
  }

  // Add a command to be processed
  queueCommand(playerId, command) {
    const queue = this.commandQueues.get(playerId);
    console.log('queueCommand:', { playerId, commandType: command.type, hasQueue: !!queue });
    if (queue) {
      queue.push(command);
      console.log('Command queued, queue length:', queue.length);
    } else {
      console.log('No queue found for player! Available queues:', Array.from(this.commandQueues.keys()));
    }
  }

  // Main game tick
  tick() {
    const now = Date.now();
    const deltaTime = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;
    this.tickCount++;

    // Process all queued commands
    this.processCommands();

    // Update game simulation
    this.update(deltaTime);

    // Broadcast state periodically
    if (this.tickCount % this.broadcastInterval === 0) {
      this.broadcastState();
    }
  }

  // Process all queued commands
  processCommands() {
    for (const [playerId, queue] of this.commandQueues) {
      while (queue.length > 0) {
        const command = queue.shift();
        this.executeCommand(playerId, command);
      }
    }
  }

  // Execute a single command
  executeCommand(playerId, command) {
    const player = this.players.get(playerId);
    if (!player) return;

    switch (command.type) {
      case CommandTypes.MOVE:
        this.executeMoveCommand(playerId, command);
        break;
      case CommandTypes.ATTACK:
        this.executeAttackCommand(playerId, command);
        break;
      case CommandTypes.BUILD:
        this.executeBuildCommand(playerId, command);
        break;
      case CommandTypes.GATHER:
        this.executeGatherCommand(playerId, command);
        break;
      case CommandTypes.PUSH_BALL:
        this.executePushBallCommand(playerId, command);
        break;
      case CommandTypes.TRAIN:
        this.executeTrainCommand(playerId, command);
        break;
      case CommandTypes.STOP:
        this.executeStopCommand(playerId, command);
        break;
    }
  }

  // Move command - set movement target for units
  executeMoveCommand(playerId, command) {
    const { actorIds, targetX, targetY } = command;
    console.log('executeMoveCommand:', { playerId, actorIds, targetX, targetY });

    for (const actorId of actorIds) {
      const actor = this.world.getActor(actorId);
      console.log('Processing actor', actorId, ':', actor ? { ownerId: actor.ownerId, type: actor.type } : 'NOT FOUND');

      if (!actor || actor.ownerId !== playerId) {
        console.log('Skipping actor - not found or ownership mismatch', { actorOwnerId: actor?.ownerId, playerId });
        continue;
      }

      // Set move target
      actor.targetX = targetX;
      actor.targetY = targetY;
      actor.state = 'moving';
      actor.attackTargetId = null;
      actor.gatherTargetId = null;
      console.log('Actor', actorId, 'now moving to', targetX, targetY);
    }
  }

  // Attack command - set attack target
  executeAttackCommand(playerId, command) {
    const { actorIds, targetId } = command;
    const target = this.world.getActor(targetId);
    if (!target) return;

    for (const actorId of actorIds) {
      const actor = this.world.getActor(actorId);
      if (!actor || actor.ownerId !== playerId) continue;
      if (!actor.attack) continue; // Can't attack

      actor.attackTargetId = targetId;
      actor.state = 'attacking';
      actor.gatherTargetId = null;
    }
  }

  // Build command - start building construction
  executeBuildCommand(playerId, command) {
    const { workerId, buildingType, x, y } = command;
    const worker = this.world.getActor(workerId);
    if (!worker || worker.ownerId !== playerId) return;
    if (worker.subtype !== 'worker') return;

    const player = this.players.get(playerId);
    const entityDefs = this.world.entityDefs;
    const buildingDef = entityDefs.buildings[buildingType];

    if (!buildingDef) return;
    if (player.minerals < buildingDef.cost) return;

    // Deduct cost
    player.minerals -= buildingDef.cost;

    // Create building in construction state
    const building = this.world.createActorFromDef('building', buildingType, x, y, playerId);
    building.constructionProgress = 0;
    building.maxConstructionTime = buildingDef.buildTime || 10;
    building.health = 1; // Vulnerable during construction
    building.state = 'constructing';

    // Send worker to build
    worker.buildTargetId = building.id;
    worker.targetX = x;
    worker.targetY = y;
    worker.state = 'building';
    worker.gatherTargetId = null;
  }

  // Gather command - send workers to gather resources
  executeGatherCommand(playerId, command) {
    const { workerIds, resourceId } = command;
    const resource = this.world.getActor(resourceId);
    if (!resource || resource.type !== 'resource') return;

    for (const workerId of workerIds) {
      const worker = this.world.getActor(workerId);
      if (!worker || worker.ownerId !== playerId) continue;
      if (worker.subtype !== 'worker') continue;

      worker.gatherTargetId = resourceId;
      worker.targetX = resource.x;
      worker.targetY = resource.y;
      worker.state = 'gathering';
      worker.attackTargetId = null;
      worker.buildTargetId = null;
    }
  }

  // Push ball command
  executePushBallCommand(playerId, command) {
    const { actorIds } = command;
    const ball = this.world.getBall();
    if (!ball) return;

    for (const actorId of actorIds) {
      const actor = this.world.getActor(actorId);
      if (!actor || actor.ownerId !== playerId) continue;
      if (actor.type !== 'unit') continue;

      // Check if close enough to ball
      const dx = ball.x - actor.x;
      const dy = ball.y - actor.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= CONSTANTS.PUSH_RANGE) {
        // Push the ball away from the unit
        const pushForce = 75; // Reduced for heavier ball
        const normalX = dx / dist;
        const normalY = dy / dist;
        ball.velocityX = (ball.velocityX || 0) + normalX * pushForce;
        ball.velocityY = (ball.velocityY || 0) + normalY * pushForce;
      }
    }
  }

  // Train command - queue unit training at building
  executeTrainCommand(playerId, command) {
    const { buildingId, unitType } = command;
    const building = this.world.getActor(buildingId);
    if (!building || building.ownerId !== playerId) return;
    if (building.type !== 'building') return;
    if (building.state === 'constructing') return;

    const player = this.players.get(playerId);
    const entityDefs = this.world.entityDefs;
    const unitDef = entityDefs.units[unitType];

    if (!unitDef) return;
    if (player.minerals < unitDef.cost) return;

    // Check if building can train this unit
    const buildingDef = entityDefs.buildings[building.subtype];
    if (!buildingDef.trains || !buildingDef.trains.includes(unitType)) return;

    // Check supply
    if (player.supply + (unitDef.supply || 1) > player.maxSupply) return;

    // Deduct cost and add to training queue
    player.minerals -= unitDef.cost;
    building.trainingQueue = building.trainingQueue || [];
    building.trainingQueue.push({
      unitType,
      progress: 0,
      trainTime: unitDef.trainTime || 5
    });
  }

  // Stop command - halt units
  executeStopCommand(playerId, command) {
    const { actorIds } = command;

    for (const actorId of actorIds) {
      const actor = this.world.getActor(actorId);
      if (!actor || actor.ownerId !== playerId) continue;

      actor.targetX = null;
      actor.targetY = null;
      actor.attackTargetId = null;
      actor.gatherTargetId = null;
      actor.buildTargetId = null;
      actor.state = 'idle';
    }
  }

  // Update game simulation
  update(deltaTime) {
    // Update all actors
    for (const actor of this.world.getAllActors()) {
      this.updateActor(actor, deltaTime);
    }

    // Update ball physics
    this.updateBall(deltaTime);

    // Check win condition
    this.checkWinCondition();
  }

  // Update a single actor
  updateActor(actor, deltaTime) {
    if (actor.type === 'unit') {
      this.updateUnit(actor, deltaTime);
    } else if (actor.type === 'building') {
      this.updateBuilding(actor, deltaTime);
    }
  }

  // Update unit behavior
  updateUnit(actor, deltaTime) {
    // Update attack cooldown
    if (actor.attackCooldown > 0) {
      actor.attackCooldown -= deltaTime;
    }

    // State machine for unit behavior
    switch (actor.state) {
      case 'moving':
        this.updateMovement(actor, deltaTime);
        break;
      case 'attacking':
        this.updateAttacking(actor, deltaTime);
        break;
      case 'gathering':
        this.updateGathering(actor, deltaTime);
        break;
      case 'building':
        this.updateBuildingWorker(actor, deltaTime);
        break;
      case 'returning':
        this.updateReturning(actor, deltaTime);
        break;
      default:
        // Idle - check for nearby enemies to auto-attack
        this.checkAutoAttack(actor);
        break;
    }
  }

  // Move actor toward target
  updateMovement(actor, deltaTime) {
    if (actor.targetX == null || actor.targetY == null) {
      actor.state = 'idle';
      return;
    }

    const dx = actor.targetX - actor.x;
    const dy = actor.targetY - actor.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) {
      actor.x = actor.targetX;
      actor.y = actor.targetY;
      actor.targetX = null;
      actor.targetY = null;
      actor.state = 'idle';
      return;
    }

    const speed = actor.speed || 100;
    const moveAmount = speed * deltaTime;
    const ratio = Math.min(moveAmount / dist, 1);
    actor.x += dx * ratio;
    actor.y += dy * ratio;
  }

  // Handle attacking behavior
  updateAttacking(actor, deltaTime) {
    const target = this.world.getActor(actor.attackTargetId);
    if (!target || (target.type !== 'ball' && target.health <= 0)) {
      actor.attackTargetId = null;
      actor.state = 'idle';
      return;
    }

    const dx = target.x - actor.x;
    const dy = target.y - actor.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const attackRange = actor.attackRange || 50;
    const targetRadius = target.radius || 0; // Factor in ball radius
    const effectiveRange = attackRange + targetRadius;

    if (dist > effectiveRange) {
      // Move toward target
      actor.targetX = target.x;
      actor.targetY = target.y;
      this.updateMovement(actor, deltaTime);
    } else if (actor.attackCooldown <= 0) {
      // Attack
      const damage = actor.attack || 10;
      actor.attackCooldown = 1 / (actor.attackSpeed || 1);

      // If attacking the ball, push it in the direction of the shot
      if (target.type === 'ball') {
        const pushForce = 100; // Reduced for heavier ball
        const normalX = dx / dist;
        const normalY = dy / dist;
        target.velocityX = (target.velocityX || 0) + normalX * pushForce;
        target.velocityY = (target.velocityY || 0) + normalY * pushForce;

        // Emit attack event for visual feedback
        this.io.to(this.roomId).emit('attackEvent', {
          attackerId: actor.id,
          targetId: target.id,
          damage: 0
        });
      } else {
        target.health -= damage;

        // Emit attack event for visual feedback
        this.io.to(this.roomId).emit('attackEvent', {
          attackerId: actor.id,
          targetId: target.id,
          damage
        });

        if (target.health <= 0) {
          this.handleDeath(target);
        }
      }
    }
  }

  // Handle worker gathering
  updateGathering(actor, deltaTime) {
    const resource = this.world.getActor(actor.gatherTargetId);
    if (!resource || resource.amount <= 0) {
      actor.gatherTargetId = null;
      actor.state = 'idle';
      return;
    }

    const dx = resource.x - actor.x;
    const dy = resource.y - actor.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > CONSTANTS.GATHER_RANGE) {
      // Move toward resource
      actor.targetX = resource.x;
      actor.targetY = resource.y;
      this.updateMovement(actor, deltaTime);
    } else {
      // Gather
      actor.gatherProgress = (actor.gatherProgress || 0) + deltaTime;
      if (actor.gatherProgress >= 1) {
        const gatherAmount = Math.min(10, resource.amount);
        resource.amount -= gatherAmount;
        actor.carryAmount = (actor.carryAmount || 0) + gatherAmount;
        actor.gatherProgress = 0;

        // If carrying capacity reached, return to base
        if (actor.carryAmount >= 20) {
          actor.state = 'returning';
          this.setReturnTarget(actor);
        }

        // Remove depleted resource
        if (resource.amount <= 0) {
          this.world.removeActor(resource.id);
        }
      }
    }
  }

  // Handle worker returning with resources
  updateReturning(actor, deltaTime) {
    const player = this.players.get(actor.ownerId);
    if (!player) return;

    // Find player's base
    const base = this.world.getPlayerBase(actor.ownerId);
    if (!base) {
      actor.state = 'idle';
      return;
    }

    const dx = base.x - actor.x;
    const dy = base.y - actor.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 50) {
      actor.targetX = base.x;
      actor.targetY = base.y;
      this.updateMovement(actor, deltaTime);
    } else {
      // Deposit resources
      player.minerals += actor.carryAmount || 0;
      actor.carryAmount = 0;

      // Return to gathering if target still exists
      if (actor.gatherTargetId && this.world.getActor(actor.gatherTargetId)) {
        actor.state = 'gathering';
      } else {
        actor.state = 'idle';
      }
    }
  }

  // Set return target for worker
  setReturnTarget(actor) {
    const base = this.world.getPlayerBase(actor.ownerId);
    if (base) {
      actor.targetX = base.x;
      actor.targetY = base.y;
    }
  }

  // Handle worker building
  updateBuildingWorker(actor, deltaTime) {
    const building = this.world.getActor(actor.buildTargetId);
    if (!building || building.state !== 'constructing') {
      actor.buildTargetId = null;
      actor.state = 'idle';
      return;
    }

    const dx = building.x - actor.x;
    const dy = building.y - actor.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > CONSTANTS.BUILD_RANGE) {
      actor.targetX = building.x;
      actor.targetY = building.y;
      this.updateMovement(actor, deltaTime);
    } else {
      // Build
      building.constructionProgress += deltaTime;
      if (building.constructionProgress >= building.maxConstructionTime) {
        // Construction complete
        const entityDefs = this.world.entityDefs;
        const buildingDef = entityDefs.buildings[building.subtype];
        building.health = buildingDef.health;
        building.state = 'complete';
        building.constructionProgress = null;

        // Update player supply if this is a supply building
        if (buildingDef.suppliesProvided) {
          const player = this.players.get(building.ownerId);
          if (player) {
            player.maxSupply += buildingDef.suppliesProvided;
          }
        }

        actor.buildTargetId = null;
        actor.state = 'idle';
      }
    }
  }

  // Update building (training, etc.)
  updateBuilding(actor, deltaTime) {
    if (actor.state === 'constructing') return;

    // Process training queue
    if (actor.trainingQueue && actor.trainingQueue.length > 0) {
      const training = actor.trainingQueue[0];
      training.progress += deltaTime;

      if (training.progress >= training.trainTime) {
        // Spawn unit
        const spawnX = actor.x + (actor.rallyX || 50);
        const spawnY = actor.y + (actor.rallyY || 0);
        const unit = this.world.createActorFromDef('unit', training.unitType, spawnX, spawnY, actor.ownerId);

        // Update player supply
        const player = this.players.get(actor.ownerId);
        const entityDefs = this.world.entityDefs;
        const unitDef = entityDefs.units[training.unitType];
        if (player && unitDef) {
          player.supply += unitDef.supply || 1;
        }

        actor.trainingQueue.shift();
      }
    }
  }

  // Check for auto-attack on idle units
  checkAutoAttack(actor) {
    if (!actor.attack || actor.attack <= 0) return;

    const attackRange = actor.attackRange || 50;
    const sightRange = attackRange * 1.5;

    // Find nearest enemy
    for (const other of this.world.getAllActors()) {
      if (other.ownerId === actor.ownerId) continue;
      if (other.ownerId == null) continue; // Neutral
      if (other.health == null || other.health <= 0) continue;

      const dx = other.x - actor.x;
      const dy = other.y - actor.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= sightRange) {
        actor.attackTargetId = other.id;
        actor.state = 'attacking';
        break;
      }
    }
  }

  // Update ball physics
  updateBall(deltaTime) {
    const ball = this.world.getBall();
    if (!ball) return;

    // Apply velocity
    ball.x += (ball.velocityX || 0) * deltaTime;
    ball.y += (ball.velocityY || 0) * deltaTime;

    // Apply friction
    const friction = 0.95;
    ball.velocityX = (ball.velocityX || 0) * friction;
    ball.velocityY = (ball.velocityY || 0) * friction;

    // Stop if very slow
    if (Math.abs(ball.velocityX) < 1) ball.velocityX = 0;
    if (Math.abs(ball.velocityY) < 1) ball.velocityY = 0;

    // Bounce off map edges
    const worldWidth = this.world.width * CONSTANTS.TILE_WIDTH;
    const worldHeight = this.world.height * CONSTANTS.TILE_HEIGHT;
    const ballRadius = ball.radius || 120;

    if (ball.x < ballRadius) {
      ball.x = ballRadius;
      ball.velocityX = Math.abs(ball.velocityX || 0) * 0.8;
    } else if (ball.x > worldWidth - ballRadius) {
      ball.x = worldWidth - ballRadius;
      ball.velocityX = -Math.abs(ball.velocityX || 0) * 0.8;
    }

    if (ball.y < ballRadius) {
      ball.y = ballRadius;
      ball.velocityY = Math.abs(ball.velocityY || 0) * 0.8;
    } else if (ball.y > worldHeight - ballRadius) {
      ball.y = worldHeight - ballRadius;
      ball.velocityY = -Math.abs(ball.velocityY || 0) * 0.8;
    }
  }

  // Check win condition
  checkWinCondition() {
    const ball = this.world.getBall();
    if (!ball) return;

    const worldWidth = this.world.width * CONSTANTS.TILE_WIDTH;
    const goalWidth = 100;
    const goalTop = (this.world.height * CONSTANTS.TILE_HEIGHT) / 2 - 100;
    const goalBottom = goalTop + 200;

    // Left goal (Player 2 wins if ball enters)
    if (ball.x < goalWidth && ball.y > goalTop && ball.y < goalBottom) {
      this.endGame(this.getPlayerByIndex(1)); // Player 2 wins
    }
    // Right goal (Player 1 wins if ball enters)
    else if (ball.x > worldWidth - goalWidth && ball.y > goalTop && ball.y < goalBottom) {
      this.endGame(this.getPlayerByIndex(0)); // Player 1 wins
    }
  }

  getPlayerByIndex(index) {
    const playerIds = Array.from(this.players.keys());
    return playerIds[index] || null;
  }

  // Handle actor death
  handleDeath(actor) {
    // Update supply if unit died
    if (actor.type === 'unit' && actor.ownerId) {
      const player = this.players.get(actor.ownerId);
      const entityDefs = this.world.entityDefs;
      const unitDef = entityDefs.units[actor.subtype];
      if (player && unitDef) {
        player.supply -= unitDef.supply || 1;
      }
    }

    this.world.removeActor(actor.id);

    this.io.to(this.roomId).emit('actorDeath', { actorId: actor.id });
  }

  // End the game
  endGame(winnerId) {
    this.stop();

    this.io.to(this.roomId).emit('gameOver', {
      winnerId,
      reason: 'goal'
    });
  }

  // Broadcast current state to all players
  broadcastState() {
    const state = {
      world: this.world.toJSON(),
      players: {},
      tick: this.tickCount
    };

    for (const [playerId, playerState] of this.players) {
      state.players[playerId] = {
        minerals: playerState.minerals,
        supply: playerState.supply,
        maxSupply: playerState.maxSupply
      };
    }

    this.io.to(this.roomId).emit('gameState', state);
  }
}

module.exports = GameLoop;
