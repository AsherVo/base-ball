// Map boundary utilities for octagonal map with diagonal corners

const MapBounds = {
  // Check if a point is inside the playable area (considering diagonal corners)
  isInsidePlayableArea(x, y, worldWidth, worldHeight, cornerCut) {
    // Check rectangular bounds first
    if (x < 0 || x > worldWidth || y < 0 || y > worldHeight) {
      return false;
    }

    // Check diagonal corners
    // Top-left: x + y must be >= cornerCut
    if (x + y < cornerCut) return false;
    // Top-right: (worldWidth - x) + y must be >= cornerCut
    if ((worldWidth - x) + y < cornerCut) return false;
    // Bottom-left: x + (worldHeight - y) must be >= cornerCut
    if (x + (worldHeight - y) < cornerCut) return false;
    // Bottom-right: (worldWidth - x) + (worldHeight - y) must be >= cornerCut
    if ((worldWidth - x) + (worldHeight - y) < cornerCut) return false;

    return true;
  },

  // Clamp a position to stay inside the playable area
  // Returns { x, y, hitCorner, normalX, normalY }
  clampToPlayableArea(x, y, radius, worldWidth, worldHeight, cornerCut) {
    let clampedX = x;
    let clampedY = y;
    let hitCorner = null;
    let normalX = 0;
    let normalY = 0;

    // Clamp to rectangular bounds first
    if (clampedX < radius) {
      clampedX = radius;
      normalX = 1;
    } else if (clampedX > worldWidth - radius) {
      clampedX = worldWidth - radius;
      normalX = -1;
    }

    if (clampedY < radius) {
      clampedY = radius;
      normalY = 1;
    } else if (clampedY > worldHeight - radius) {
      clampedY = worldHeight - radius;
      normalY = -1;
    }

    // Adjust corner cut for radius (entity needs to stay cornerCut + radius from corner)
    const effectiveCut = cornerCut + radius * Math.SQRT2;

    // Check and clamp diagonal corners
    // Top-left corner: x + y >= effectiveCut
    const topLeftDist = clampedX + clampedY;
    if (topLeftDist < effectiveCut) {
      // Project onto the diagonal line x + y = effectiveCut
      const adjustment = (effectiveCut - topLeftDist) / 2;
      clampedX += adjustment;
      clampedY += adjustment;
      hitCorner = 'top-left';
      // Normal points away from corner (into playable area): (1, 1) normalized
      normalX = Math.SQRT1_2;
      normalY = Math.SQRT1_2;
    }

    // Top-right corner: (worldWidth - x) + y >= effectiveCut
    const topRightDist = (worldWidth - clampedX) + clampedY;
    if (topRightDist < effectiveCut) {
      const adjustment = (effectiveCut - topRightDist) / 2;
      clampedX -= adjustment;
      clampedY += adjustment;
      hitCorner = 'top-right';
      normalX = -Math.SQRT1_2;
      normalY = Math.SQRT1_2;
    }

    // Bottom-left corner: x + (worldHeight - y) >= effectiveCut
    const bottomLeftDist = clampedX + (worldHeight - clampedY);
    if (bottomLeftDist < effectiveCut) {
      const adjustment = (effectiveCut - bottomLeftDist) / 2;
      clampedX += adjustment;
      clampedY -= adjustment;
      hitCorner = 'bottom-left';
      normalX = Math.SQRT1_2;
      normalY = -Math.SQRT1_2;
    }

    // Bottom-right corner: (worldWidth - x) + (worldHeight - y) >= effectiveCut
    const bottomRightDist = (worldWidth - clampedX) + (worldHeight - clampedY);
    if (bottomRightDist < effectiveCut) {
      const adjustment = (effectiveCut - bottomRightDist) / 2;
      clampedX -= adjustment;
      clampedY -= adjustment;
      hitCorner = 'bottom-right';
      normalX = -Math.SQRT1_2;
      normalY = -Math.SQRT1_2;
    }

    return { x: clampedX, y: clampedY, hitCorner, normalX, normalY };
  },

  // Get the corner that a point is violating (if any)
  getViolatedCorner(x, y, radius, worldWidth, worldHeight, cornerCut) {
    const effectiveCut = cornerCut + radius * Math.SQRT2;

    if (x + y < effectiveCut) return 'top-left';
    if ((worldWidth - x) + y < effectiveCut) return 'top-right';
    if (x + (worldHeight - y) < effectiveCut) return 'bottom-left';
    if ((worldWidth - x) + (worldHeight - y) < effectiveCut) return 'bottom-right';

    return null;
  }
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapBounds;
} else if (typeof window !== 'undefined') {
  window.MapBounds = MapBounds;
}
