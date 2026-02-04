// Entity definitions for all game entities
const EntityDefs = {
  units: {
    worker: {
      type: 'unit',
      subtype: 'worker',
      health: 50,
      speed: 100,
      attack: 5,
      attackRange: 30,
      attackSpeed: 1,
      cost: 50,
      trainTime: 8,
      supply: 1,
      radius: 16,
      visionRadius: 200,
      canGather: true,
      canBuild: true
    },
    soldier: {
      type: 'unit',
      subtype: 'soldier',
      health: 80,
      speed: 100,
      attack: 15,
      attackRange: 50,
      attackSpeed: 1.2,
      cost: 100,
      trainTime: 10,
      supply: 2,
      radius: 20,
      visionRadius: 250
    }
  },

  buildings: {
    base: {
      type: 'building',
      subtype: 'base',
      health: 1000,
      cost: 0, // Starting building
      buildTime: 0,
      trains: ['worker'],
      suppliesProvided: 10,
      radius: 50,
      visionRadius: 350
    },
    barracks: {
      type: 'building',
      subtype: 'barracks',
      health: 400,
      cost: 150,
      buildTime: 15,
      trains: ['soldier'],
      suppliesProvided: 0,
      radius: 40,
      visionRadius: 250
    },
    supplyDepot: {
      type: 'building',
      subtype: 'supplyDepot',
      health: 200,
      cost: 100,
      buildTime: 10,
      trains: [],
      suppliesProvided: 8,
      radius: 30,
      visionRadius: 200
    }
  },

  resources: {
    minerals: {
      type: 'resource',
      subtype: 'minerals',
      amount: 1500,
      gatherRate: 10, // minerals per second when gathering
      radius: 40
    }
  },

  special: {
    ball: {
      type: 'ball',
      subtype: 'ball',
      radius: 120,
      visionRadius: 300  // Both players get vision from the ball
    },
    avatar: {
      type: 'avatar',
      subtype: 'avatar',
      health: 200,
      speed: 150,
      radius: 20,
      visionRadius: 400,
      pickupRange: 50,
      interactionRange: 100
    }
  }
};

// Helper to get stats for creating an actor
function getEntityDef(category, subtype) {
  const categoryDefs = EntityDefs[category];
  if (!categoryDefs) return null;
  return categoryDefs[subtype] || null;
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EntityDefs, getEntityDef };
} else if (typeof window !== 'undefined') {
  window.EntityDefs = EntityDefs;
  window.getEntityDef = getEntityDef;
}
