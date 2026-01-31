// World - Represents the physical state of a game match
// Handles the map grid and all actors within it

(function() {
  // Get constants and Actor based on environment
  const isNode = typeof module !== 'undefined' && module.exports;
  const _CONSTANTS = isNode ? require('./constants') : window.CONSTANTS;
  const _Actor = isNode ? require('./actor') : window.Actor;

  class World {
    constructor(width = _CONSTANTS.MAP_WIDTH, height = _CONSTANTS.MAP_HEIGHT) {
      this.width = width;   // Map width in tiles
      this.height = height; // Map height in tiles
      this.actors = new Map();
      this.nextActorId = 1;
    }

    // Create a new actor and add it to the world
    createActor(x, y, sprite) {
      const id = this.nextActorId++;
      const actor = new _Actor(id, x, y, sprite);
      this.actors.set(id, actor);
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

    // Serialize world state for network transmission
    toJSON() {
      return {
        width: this.width,
        height: this.height,
        actors: this.getAllActors().map(a => a.toJSON()),
        nextActorId: this.nextActorId
      };
    }

    // Create world from serialized data
    static fromJSON(data) {
      const world = new World(data.width, data.height);
      world.nextActorId = data.nextActorId;
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
