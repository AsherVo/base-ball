// World - Represents the physical state of a game match
// Handles the map grid and all actors within it

(function() {
  // Get dependencies based on environment
  const isNode = typeof module !== 'undefined' && module.exports;
  const _CONSTANTS = isNode ? require('./constants') : window.CONSTANTS;
  const _Actor = isNode ? require('./actor') : window.Actor;
  const _EntityDefs = isNode ? require('./entityDefs').EntityDefs : window.EntityDefs;

  class World {
    constructor(width = _CONSTANTS.MAP_WIDTH, height = _CONSTANTS.MAP_HEIGHT) {
      this.width = width;   // Map width in tiles
      this.height = height; // Map height in tiles
      this.actors = new Map();
      this.nextActorId = 1;
      this.players = new Map(); // playerId -> playerIndex (0 or 1)
      this.entityDefs = _EntityDefs;
    }

    // Add a player to the world
    addPlayer(playerId, playerIndex) {
      this.players.set(playerId, playerIndex);
    }

    // Get player index (0 or 1)
    getPlayerIndex(playerId) {
      return this.players.get(playerId);
    }

    // Get all player IDs
    getPlayerIds() {
      return Array.from(this.players.keys());
    }

    // Create a new actor and add it to the world
    createActor(x, y, sprite) {
      const id = this.nextActorId++;
      const actor = new _Actor(id, x, y, sprite);
      this.actors.set(id, actor);
      return actor;
    }

    // Create an actor from an entity definition
    createActorFromDef(category, subtype, x, y, ownerId = null) {
      const categoryMap = {
        'unit': 'units',
        'building': 'buildings',
        'resource': 'resources',
        'ball': 'special',
        'avatar': 'special'
      };
      const defCategory = categoryMap[category] || category;
      const def = this.entityDefs[defCategory]?.[subtype];

      const actor = this.createActor(x, y, subtype);
      if (def) {
        actor.applyDef(def);
      }
      actor.type = (category === 'ball' || category === 'avatar') ? category : category;
      actor.subtype = subtype;
      actor.ownerId = ownerId;
      actor.state = category === 'building' ? 'complete' : 'idle';

      return actor;
    }

    // Get an actor by ID
    getActor(id) {
      return this.actors.get(id);
    }

    // Remove an actor from the world
    removeActor(id) {
      return this.actors.delete(id);
    }

    // Get all actors as an array
    getAllActors() {
      return Array.from(this.actors.values());
    }

    // Get actors by type
    getActorsByType(type) {
      return this.getAllActors().filter(a => a.type === type);
    }

    // Get actors by owner
    getActorsByOwner(ownerId) {
      return this.getAllActors().filter(a => a.ownerId === ownerId);
    }

    // Get player's base
    getPlayerBase(ownerId) {
      return this.getAllActors().find(
        a => a.type === 'building' && a.subtype === 'base' && a.ownerId === ownerId
      );
    }

    // Get the ball
    getBall() {
      return this.getAllActors().find(a => a.type === 'ball');
    }

    // Get actors within range of a point
    getActorsInRange(x, y, range) {
      return this.getAllActors().filter(a => {
        const dx = a.x - x;
        const dy = a.y - y;
        return Math.sqrt(dx * dx + dy * dy) <= range;
      });
    }

    // Get enemy actors for a player
    getEnemyActors(playerId) {
      return this.getAllActors().filter(
        a => a.ownerId != null && a.ownerId !== playerId
      );
    }

    // Get player's avatar
    getPlayerAvatar(ownerId) {
      return this.getAllActors().find(
        a => a.type === 'avatar' && a.ownerId === ownerId
      );
    }

    // Get units within pickup range (owned by the player, not carried)
    getUnitsInPickupRange(x, y, range, ownerId) {
      return this.getAllActors().filter(a => {
        if (a.type !== 'unit') return false;
        if (a.ownerId !== ownerId) return false;
        if (a.isCarried) return false;
        const dx = a.x - x;
        const dy = a.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist <= range + (a.radius || 16);
      });
    }

    // Get buildings within interaction range (owned by the player)
    getBuildingsInRange(x, y, range, ownerId) {
      return this.getAllActors().filter(a => {
        if (a.type !== 'building') return false;
        if (a.ownerId !== ownerId) return false;
        const dx = a.x - x;
        const dy = a.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist <= range + (a.radius || 40);
      });
    }

    // Serialize world state for network transmission
    toJSON() {
      return {
        width: this.width,
        height: this.height,
        actors: this.getAllActors().map(a => a.toJSON()),
        nextActorId: this.nextActorId,
        players: Array.from(this.players.entries())
      };
    }

    // Create world from serialized data
    static fromJSON(data) {
      const world = new World(data.width, data.height);
      world.nextActorId = data.nextActorId;

      // Restore players
      if (data.players) {
        for (const [playerId, playerIndex] of data.players) {
          world.players.set(playerId, playerIndex);
        }
      }

      // Restore actors
      data.actors.forEach(actorData => {
        const actor = _Actor.fromJSON(actorData);
        world.actors.set(actor.id, actor);
      });

      return world;
    }
  }

  // Export for both Node.js and browser
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = World;
  } else if (typeof window !== 'undefined') {
    window.World = World;
  }
})();
