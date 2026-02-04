// Client-only UI constants (not shared with server)
window.UI = {
  // Camera settings
  CAMERA_PAN_SPEED: 500,        // pixels per second
  CAMERA_ZOOM_MIN: 0.5,
  CAMERA_ZOOM_MAX: 2.0,
  CAMERA_ZOOM_SPEED: 0.1,       // zoom change per scroll tick
  CAMERA_EDGE_SCROLL_SIZE: 30,  // pixels from edge to trigger scroll

  // Minimap settings
  MINIMAP_WIDTH: 200,           // pixels
  MINIMAP_HEIGHT: 120,          // pixels
  MINIMAP_PADDING: 10,          // pixels from canvas edge
  MINIMAP_BORDER_WIDTH: 2,

  // Fog of war settings
  FOG_COLOR: 'rgba(0, 0, 0, 0.7)',

  // Team colors
  TEAM_COLORS: ['#4a90d9', '#d94a4a'] // Blue, Red
};
