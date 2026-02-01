// Actor - A physical entity that exists on the map
class Actor {
  constructor(id, x, y, sprite) {
    this.id = id;
    this.x = x;           // Position in pixels
    this.y = y;           // Position in pixels
    this.sprite = sprite; // Sprite identifier for rendering

    // Entity classification
    this.type = 'unit';   // 'unit', 'building', 'resource', 'ball'
    this.subtype = null;  // 'worker', 'soldier', 'base', 'barracks', 'minerals', etc.

    // Ownership
    this.ownerId = null;  // Player socket ID who owns this actor

    // Combat stats
    this.health = 100;
    this.maxHealth = 100;
    this.attack = 0;
    this.attackRange = 50;
    this.attackSpeed = 1;
    this.attackCooldown = 0;

    // Movement
    this.speed = 100;     // Pixels per second
    this.targetX = null;
    this.targetY = null;

    // State machine
    this.state = 'idle';  // 'idle', 'moving', 'attacking', 'gathering', 'building', 'returning', 'constructing'

    // Unit-specific
    this.attackTargetId = null;
    this.gatherTargetId = null;
    this.buildTargetId = null;
    this.carryAmount = 0;
    this.gatherProgress = 0;

    // Building-specific
    this.constructionProgress = null;
    this.maxConstructionTime = null;
    this.trainingQueue = [];
    this.rallyX = 50;
    this.rallyY = 0;

    // Resource-specific
    this.amount = 0;

    // Ball-specific
    this.velocityX = 0;
    this.velocityY = 0;

    // Collision radius (used by all types)
    this.radius = 16; // Default for units

    // Vision radius for fog of war
    this.visionRadius = 200; // Default vision
  }

  // Apply stats from entity definition
  applyDef(def) {
    if (!def) return;

    this.type = def.type || this.type;
    this.subtype = def.subtype || this.subtype;
    this.health = def.health || this.health;
    this.maxHealth = def.health || this.maxHealth;
    this.attack = def.attack || 0;
    this.attackRange = def.attackRange || 50;
    this.attackSpeed = def.attackSpeed || 1;
    this.speed = def.speed || 0;
    this.amount = def.amount || 0;
    this.radius = def.radius || 30;
    this.visionRadius = def.visionRadius || 200;
  }

  // Serialize actor state for network transmission
  toJSON() {
    const data = {
      id: this.id,
      x: this.x,
      y: this.y,
      sprite: this.sprite,
      type: this.type,
      subtype: this.subtype,
      ownerId: this.ownerId,
      health: this.health,
      maxHealth: this.maxHealth,
      state: this.state,
      radius: this.radius,
      visionRadius: this.visionRadius
    };

    // Only include relevant fields based on type
    if (this.type === 'unit') {
      data.attack = this.attack;
      data.speed = this.speed;
      data.targetX = this.targetX;
      data.targetY = this.targetY;
      data.carryAmount = this.carryAmount;
    } else if (this.type === 'building') {
      if (this.state === 'constructing') {
        data.constructionProgress = this.constructionProgress;
        data.maxConstructionTime = this.maxConstructionTime;
      }
      if (this.trainingQueue && this.trainingQueue.length > 0) {
        data.trainingQueue = this.trainingQueue.map(t => ({
          unitType: t.unitType,
          progress: t.progress,
          trainTime: t.trainTime
        }));
      }
    } else if (this.type === 'resource') {
      data.amount = this.amount;
    } else if (this.type === 'ball') {
      data.velocityX = this.velocityX;
      data.velocityY = this.velocityY;
    }

    return data;
  }

  // Create actor from serialized data
  static fromJSON(data) {
    const actor = new Actor(data.id, data.x, data.y, data.sprite);
    actor.type = data.type || 'unit';
    actor.subtype = data.subtype || null;
    actor.ownerId = data.ownerId || null;
    actor.health = data.health ?? 100;
    actor.maxHealth = data.maxHealth ?? 100;
    actor.state = data.state || 'idle';
    actor.radius = data.radius || 16;
    actor.visionRadius = data.visionRadius || 200;

    if (data.type === 'unit') {
      actor.attack = data.attack || 0;
      actor.speed = data.speed || 100;
      actor.targetX = data.targetX;
      actor.targetY = data.targetY;
      actor.carryAmount = data.carryAmount || 0;
    } else if (data.type === 'building') {
      actor.constructionProgress = data.constructionProgress;
      actor.maxConstructionTime = data.maxConstructionTime;
      actor.trainingQueue = data.trainingQueue || [];
    } else if (data.type === 'resource') {
      actor.amount = data.amount || 0;
    } else if (data.type === 'ball') {
      actor.velocityX = data.velocityX || 0;
      actor.velocityY = data.velocityY || 0;
    }

    return actor;
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Actor;
} else if (typeof window !== 'undefined') {
  window.Actor = Actor;
}
