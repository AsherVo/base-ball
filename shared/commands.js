// Command types for player actions
const CommandTypes = {
  MOVE: 'MOVE',
  ATTACK: 'ATTACK',
  BUILD: 'BUILD',
  ASSIST_BUILD: 'ASSIST_BUILD',
  GATHER: 'GATHER',
  PUSH_BALL: 'PUSH_BALL',
  TRAIN: 'TRAIN',
  STOP: 'STOP'
};

// Create a command object
function createCommand(type, data) {
  return {
    type,
    timestamp: Date.now(),
    ...data
  };
}

// Command factory functions
const Commands = {
  move(actorIds, targetX, targetY) {
    return createCommand(CommandTypes.MOVE, {
      actorIds: Array.isArray(actorIds) ? actorIds : [actorIds],
      targetX,
      targetY
    });
  },

  attack(actorIds, targetId) {
    return createCommand(CommandTypes.ATTACK, {
      actorIds: Array.isArray(actorIds) ? actorIds : [actorIds],
      targetId
    });
  },

  build(workerId, buildingType, x, y) {
    return createCommand(CommandTypes.BUILD, {
      workerId,
      buildingType,
      x,
      y
    });
  },

  assistBuild(workerIds, buildingId) {
    return createCommand(CommandTypes.ASSIST_BUILD, {
      workerIds: Array.isArray(workerIds) ? workerIds : [workerIds],
      buildingId
    });
  },

  gather(workerIds, resourceId) {
    return createCommand(CommandTypes.GATHER, {
      workerIds: Array.isArray(workerIds) ? workerIds : [workerIds],
      resourceId
    });
  },

  pushBall(actorIds) {
    return createCommand(CommandTypes.PUSH_BALL, {
      actorIds: Array.isArray(actorIds) ? actorIds : [actorIds]
    });
  },

  train(buildingId, unitType) {
    return createCommand(CommandTypes.TRAIN, {
      buildingId,
      unitType
    });
  },

  stop(actorIds) {
    return createCommand(CommandTypes.STOP, {
      actorIds: Array.isArray(actorIds) ? actorIds : [actorIds]
    });
  }
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CommandTypes, Commands, createCommand };
} else if (typeof window !== 'undefined') {
  window.CommandTypes = CommandTypes;
  window.Commands = Commands;
}
