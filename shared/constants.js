// Shared constants for server and client
const CONSTANTS = {
  // Game loop timing
  TICK_RATE: 60,

  // Room settings
  MAX_PLAYERS_PER_ROOM: 2,

  // Network
  DEFAULT_PORT: 3000,

  // Map settings
  MAP_WIDTH: 100,   // tiles
  MAP_HEIGHT: 100,  // tiles
  TILE_WIDTH: 32,   // pixels
  TILE_HEIGHT: 32   // pixels
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTS;
} else if (typeof window !== 'undefined') {
  window.CONSTANTS = CONSTANTS;
}
