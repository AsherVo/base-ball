const { Commands } = require('../../shared/commands');
const CONSTANTS = require('../../shared/constants');

// AI Player that makes decisions and issues commands
class AIPlayer {
  constructor(playerId, gameLoop, playerIndex) {
    this.playerId = playerId;
    this.gameLoop = gameLoop;
    this.playerIndex = playerIndex;
    this.tickCount = 0;
    this.decisionInterval = 30; // Make decisions every 30 ticks (~0.5 sec)

    // Track what workers are assigned to
    this.workerAssignments = new Map(); // workerId -> 'gathering' | 'building' | 'idle'

    // Track pending builds
    this.pendingBarracks = false;
    this.pendingSupplyDepot = false;
  }

  // Called every game tick
  update() {
    this.tickCount++;

    // Only make decisions periodically to avoid spam
    if (this.tickCount % this.decisionInterval !== 0) {
      return;
    }

    const world = this.gameLoop.world;
    const playerState = this.gameLoop.players.get(this.playerId);
    if (!playerState) return;

    // Get my units and buildings
    const myUnits = this.getMyUnits(world);
    const myBuildings = this.getMyBuildings(world);
    const myWorkers = myUnits.filter(u => u.subtype === 'worker');
    const mySoldiers = myUnits.filter(u => u.subtype === 'soldier');
    const myBase = myBuildings.find(b => b.subtype === 'base');
    const myBarracks = myBuildings.filter(b => b.subtype === 'barracks' && b.state !== 'constructing');
    const mySupplyDepots = myBuildings.filter(b => b.subtype === 'supplyDepot');

    // Get resources and ball
    const resources = this.getResources(world);
    const ball = world.getBall();

    // Decision priority:
    // 1. Assign idle workers to gather
    // 2. Build supply depot if supply blocked
    // 3. Build barracks if we don't have one
    // 4. Train workers (up to 8)
    // 5. Train soldiers
    // 6. Send soldiers to push ball toward enemy goal

    // 1. Assign idle workers to gather
    this.assignWorkersToGather(myWorkers, resources, world);

    // 2. Build supply depot if supply blocked (or close to it)
    const supplyBuffer = 2;
    const needSupply = playerState.supply + supplyBuffer >= playerState.maxSupply;
    const constructingSupply = myBuildings.some(b => b.subtype === 'supplyDepot' && b.state === 'constructing');

    if (needSupply && !constructingSupply && playerState.minerals >= 100) {
      this.buildStructure(myWorkers, myBase, 'supplyDepot', world);
    }

    // 3. Build barracks if we don't have one
    const hasBarracks = myBarracks.length > 0;
    const constructingBarracks = myBuildings.some(b => b.subtype === 'barracks' && b.state === 'constructing');

    if (!hasBarracks && !constructingBarracks && playerState.minerals >= 150) {
      this.buildStructure(myWorkers, myBase, 'barracks', world);
    }

    // 4. Train workers (up to 8)
    if (myWorkers.length < 8 && myBase && myBase.state !== 'constructing') {
      const workerCost = 50;
      const workerSupply = 1;
      if (playerState.minerals >= workerCost && playerState.supply + workerSupply <= playerState.maxSupply) {
        // Check if not already training
        const trainingQueue = myBase.trainingQueue || [];
        if (trainingQueue.length < 2) {
          this.queueCommand(Commands.train(myBase.id, 'worker'));
        }
      }
    }

    // 5. Train soldiers from barracks
    for (const barracks of myBarracks) {
      const soldierCost = 100;
      const soldierSupply = 2;
      if (playerState.minerals >= soldierCost && playerState.supply + soldierSupply <= playerState.maxSupply) {
        const trainingQueue = barracks.trainingQueue || [];
        if (trainingQueue.length < 2) {
          this.queueCommand(Commands.train(barracks.id, 'soldier'));
        }
      }
    }

    // 6. Send soldiers to push ball toward enemy goal
    if (mySoldiers.length > 0 && ball) {
      this.commandSoldiersToPushBall(mySoldiers, ball, world);
    }
  }

  getMyUnits(world) {
    return world.getAllActors().filter(a =>
      a.type === 'unit' && a.ownerId === this.playerId
    );
  }

  getMyBuildings(world) {
    return world.getAllActors().filter(a =>
      a.type === 'building' && a.ownerId === this.playerId
    );
  }

  getResources(world) {
    return world.getAllActors().filter(a => a.type === 'resource');
  }

  assignWorkersToGather(workers, resources, world) {
    if (resources.length === 0) return;

    for (const worker of workers) {
      // Skip workers already gathering or building
      if (worker.state === 'gathering' || worker.state === 'returning' || worker.state === 'building') {
        continue;
      }

      // Find nearest resource
      let nearestResource = null;
      let nearestDist = Infinity;

      for (const resource of resources) {
        if (resource.amount <= 0) continue;
        const dx = resource.x - worker.x;
        const dy = resource.y - worker.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestResource = resource;
        }
      }

      if (nearestResource) {
        this.queueCommand(Commands.gather([worker.id], nearestResource.id));
      }
    }
  }

  buildStructure(workers, base, buildingType, world) {
    if (!base) return;

    // Find an idle or gathering worker
    const availableWorker = workers.find(w =>
      w.state === 'idle' || w.state === 'gathering' || w.state === 'returning'
    );

    if (!availableWorker) return;

    // Calculate build position (away from base toward center)
    const worldCenterX = (world.width * CONSTANTS.TILE_WIDTH) / 2;
    const directionX = worldCenterX > base.x ? 1 : -1;

    // Build position offset from base
    const offsetX = directionX * 120;
    const offsetY = buildingType === 'supplyDepot' ? -80 : 80; // Supply above, barracks below

    const buildX = base.x + offsetX;
    const buildY = base.y + offsetY;

    this.queueCommand(Commands.build(availableWorker.id, buildingType, buildX, buildY));
  }

  commandSoldiersToPushBall(soldiers, ball, world) {
    // Determine enemy goal position (opposite side of map)
    const worldWidth = world.width * CONSTANTS.TILE_WIDTH;
    const worldHeight = world.height * CONSTANTS.TILE_HEIGHT;
    const goalY = worldHeight / 2;

    // AI is playerIndex 1, so enemy goal is on the left (x = 0)
    // AI is playerIndex 0, so enemy goal is on the right (x = worldWidth)
    const enemyGoalX = this.playerIndex === 0 ? worldWidth : 0;

    // Get soldiers that aren't already attacking the ball
    const availableSoldiers = soldiers.filter(s =>
      s.state === 'idle' || s.state === 'moving' ||
      (s.state === 'attacking' && s.attackTargetId !== ball.id)
    );

    for (const soldier of availableSoldiers) {
      const dx = ball.x - soldier.x;
      const dy = ball.y - soldier.y;
      const distToBall = Math.sqrt(dx * dx + dy * dy);

      // Calculate position behind ball (relative to enemy goal) to push it in the right direction
      const ballToGoalX = enemyGoalX - ball.x;
      const ballToGoalY = goalY - ball.y;
      const ballToGoalDist = Math.sqrt(ballToGoalX * ballToGoalX + ballToGoalY * ballToGoalY);

      // If soldier is on the correct side of the ball (between ball and our goal), attack the ball
      // This makes them push it toward the enemy goal
      const soldierToBallX = ball.x - soldier.x;
      const dotProduct = soldierToBallX * ballToGoalX + (ball.y - soldier.y) * ballToGoalY;
      const isOnCorrectSide = dotProduct > 0;

      if (isOnCorrectSide && distToBall < 400) {
        // Attack the ball - this will make the soldier move toward it and continuously push it
        this.queueCommand(Commands.attack([soldier.id], ball.id));
      } else if (ballToGoalDist > 0) {
        // Move to position behind the ball (relative to enemy goal)
        const pushDistBehind = 200;
        const targetX = ball.x - (ballToGoalX / ballToGoalDist) * pushDistBehind;
        const targetY = ball.y - (ballToGoalY / ballToGoalDist) * pushDistBehind;

        this.queueCommand(Commands.move([soldier.id], targetX, targetY));
      }
    }
  }

  queueCommand(command) {
    this.gameLoop.queueCommand(this.playerId, command);
  }
}

module.exports = AIPlayer;
