// Shared constants for server and client
const CONSTANTS = {
  // Game loop timing
  TICK_RATE: 60,

  // Room settings
  MAX_PLAYERS_PER_ROOM: 2,

  // Network
  DEFAULT_PORT: 3000
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTS;
}
