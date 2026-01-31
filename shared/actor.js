// Actor - A physical entity that exists on the map
class Actor {
  constructor(id, x, y, sprite) {
    this.id = id;
    this.x = x;           // Position in pixels
    this.y = y;           // Position in pixels
    this.sprite = sprite; // Sprite identifier for rendering
  }

  // Serialize actor state for network transmission
  toJSON() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      sprite: this.sprite
    };
  }

  // Create actor from serialized data
  static fromJSON(data) {
    return new Actor(data.id, data.x, data.y, data.sprite);
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Actor;
} else if (typeof window !== 'undefined') {
  window.Actor = Actor;
}
