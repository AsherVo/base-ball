const CONSTANTS = require('../../shared/constants');
const World = require('../../shared/world');
const PlayerState = require('../../shared/playerState');

// Generate initial map with players, bases, resources, and ball
class MapGenerator {
  static generate(playerIds) {
    const world = new World();
    const playerStates = new Map();

    const worldPixelWidth = CONSTANTS.MAP_WIDTH * CONSTANTS.TILE_WIDTH;
    const worldPixelHeight = CONSTANTS.MAP_HEIGHT * CONSTANTS.TILE_HEIGHT;
    const centerX = worldPixelWidth / 2;
    const centerY = worldPixelHeight / 2;

    // Add players to world
    playerIds.forEach((playerId, index) => {
      world.addPlayer(playerId, index);
      playerStates.set(playerId, new PlayerState(playerId, index));
    });

    // Create bases for each player
    const baseOffsetX = 200; // Distance from edge
    const baseY = centerY;

    playerIds.forEach((playerId, index) => {
      const baseX = index === 0 ? baseOffsetX : worldPixelWidth - baseOffsetX;
      const base = world.createActorFromDef('building', 'base', baseX, baseY, playerId);

      // Create starting workers around base
      for (let i = 0; i < CONSTANTS.STARTING_WORKERS; i++) {
        const angle = (i / CONSTANTS.STARTING_WORKERS) * Math.PI * 2;
        const workerSpawnRadius = 80; // Far enough to avoid base collision
        const workerX = baseX + Math.cos(angle) * workerSpawnRadius;
        const workerY = baseY + Math.sin(angle) * workerSpawnRadius;
        world.createActorFromDef('unit', 'worker', workerX, workerY, playerId);
      }
    });

    // Create mineral nodes
    // Near each base (easy access)
    playerIds.forEach((playerId, index) => {
      const baseX = index === 0 ? baseOffsetX : worldPixelWidth - baseOffsetX;

      // Minerals near each base
      const mineralOffset = 150;
      const mineralY1 = baseY - 150;
      const mineralY2 = baseY + 150;
      const mineralX = index === 0 ? baseX + mineralOffset : baseX - mineralOffset;

      world.createActorFromDef('resource', 'minerals', mineralX, mineralY1, null);
      world.createActorFromDef('resource', 'minerals', mineralX, mineralY2, null);
    });

    // Center minerals (contested)
    const centerMineralOffsetY = 200;
    world.createActorFromDef('resource', 'minerals', centerX, centerY - centerMineralOffsetY, null);
    world.createActorFromDef('resource', 'minerals', centerX, centerY + centerMineralOffsetY, null);

    // Create the ball in the center
    const ball = world.createActorFromDef('ball', 'ball', centerX, centerY, null);
    ball.velocityX = 0;
    ball.velocityY = 0;

    return { world, playerStates };
  }
}

module.exports = MapGenerator;
