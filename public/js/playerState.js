// Player state for resource and supply tracking

// Get constants based on environment
const _getConstants = () => {
  if (typeof module !== 'undefined' && module.exports) {
    return require('./constants');
  }
  return window.CONSTANTS;
};

class PlayerState {
  constructor(playerId, playerIndex) {
    const CONSTANTS = _getConstants();

    this.playerId = playerId;
    this.playerIndex = playerIndex; // 0 or 1
    this.minerals = CONSTANTS.STARTING_MINERALS;
    this.supply = CONSTANTS.STARTING_SUPPLY;
    this.maxSupply = CONSTANTS.STARTING_MAX_SUPPLY;
  }

  canAfford(cost) {
    return this.minerals >= cost;
  }

  canSupport(supplyCost) {
    return this.supply + supplyCost <= this.maxSupply;
  }

  spend(amount) {
    if (!this.canAfford(amount)) return false;
    this.minerals -= amount;
    return true;
  }

  addMinerals(amount) {
    this.minerals += amount;
  }

  useSupply(amount) {
    this.supply += amount;
  }

  freeSupply(amount) {
    this.supply = Math.max(0, this.supply - amount);
  }

  addMaxSupply(amount) {
    this.maxSupply += amount;
  }

  toJSON() {
    return {
      playerId: this.playerId,
      playerIndex: this.playerIndex,
      minerals: this.minerals,
      supply: this.supply,
      maxSupply: this.maxSupply
    };
  }

  static fromJSON(data) {
    const state = new PlayerState(data.playerId, data.playerIndex);
    state.minerals = data.minerals;
    state.supply = data.supply;
    state.maxSupply = data.maxSupply;
    return state;
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlayerState;
} else if (typeof window !== 'undefined') {
  window.PlayerState = PlayerState;
}
