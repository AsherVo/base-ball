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
  TILE_HEIGHT: 32,  // pixels

  // Camera settings
  CAMERA_PAN_SPEED: 500,      // pixels per second
  CAMERA_ZOOM_MIN: 0.5,
  CAMERA_ZOOM_MAX: 2.0,
  CAMERA_ZOOM_SPEED: 0.1,     // zoom change per scroll tick
  CAMERA_EDGE_SCROLL_SIZE: 30 // pixels from edge to trigger scroll
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTS;
} else if (typeof window !== 'undefined') {
  window.CONSTANTS = CONSTANTS;
}
