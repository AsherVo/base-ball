// Shared constants for server and client
const CONSTANTS = {
  // Game loop timing
  TICK_RATE: 60,
  STATE_BROADCAST_RATE: 20,   // state updates per second

  // Room settings
  MAX_PLAYERS_PER_ROOM: 2,

  // Network
  DEFAULT_PORT: 3000,

  // Map settings
  MAP_WIDTH: 100,   // tiles
  MAP_HEIGHT: 60,   // tiles (smaller height for ball game)
  TILE_WIDTH: 32,   // pixels
  TILE_HEIGHT: 32,  // pixels

  // Camera settings
  CAMERA_PAN_SPEED: 500,      // pixels per second
  CAMERA_ZOOM_MIN: 0.5,
  CAMERA_ZOOM_MAX: 2.0,
  CAMERA_ZOOM_SPEED: 0.1,     // zoom change per scroll tick
  CAMERA_EDGE_SCROLL_SIZE: 30, // pixels from edge to trigger scroll

  // Minimap settings
  MINIMAP_WIDTH: 200,         // pixels
  MINIMAP_HEIGHT: 120,        // pixels (adjusted for map aspect ratio)
  MINIMAP_PADDING: 10,        // pixels from canvas edge
  MINIMAP_BORDER_WIDTH: 2,

  // Game balance - Resources
  STARTING_MINERALS: 100,
  STARTING_WORKERS: 4,
  STARTING_SUPPLY: 4,
  STARTING_MAX_SUPPLY: 10,

  // Game balance - Ranges
  GATHER_RANGE: 40,
  BUILD_RANGE: 60,
  PUSH_RANGE: 80,

  // Goal settings
  GOAL_WIDTH: 100,
  GOAL_HEIGHT: 200,

  // Corner cut-off (diagonal corners create octagonal map)
  CORNER_CUT_SIZE: 300,  // pixels - distance from corner where diagonal starts

  // Ball settings
  BALL_RADIUS: 30,
  BALL_FRICTION: 0.95,
  BALL_PUSH_FORCE: 300,

  // Fog of war settings
  FOG_COLOR: 'rgba(0, 0, 0, 0.7)',
  FOG_TILE_SIZE: 32,  // Resolution for fog grid (pixels per cell)
  DEFAULT_VISION_RADIUS: 200,

  // Team colors
  TEAM_COLORS: ['#4a90d9', '#d94a4a'] // Blue, Red
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTS;
} else if (typeof window !== 'undefined') {
  window.CONSTANTS = CONSTANTS;
}
