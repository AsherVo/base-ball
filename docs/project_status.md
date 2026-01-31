# Project Status

This project is solidly in a "prototype" state. 

## What Works

### Lobby System (Complete)
- Name entry and validation
- Room creation with shareable codes
- Joining rooms by code
- Quick match queue with automatic pairing
- Player list display in rooms with ready state indicators
- Ready-up system: both players must click "Ready" to start
- 3-second countdown when both players ready
- Countdown canceled if player leaves or unreadies
- Automatic navigation to game page when countdown completes

### Networking Infrastructure (Complete)
- Socket.io server setup with CORS
- Event-based communication protocol
- Room cleanup on player disconnect
- NetworkClient abstraction on frontend

### Game Page Shell (Complete)
- Canvas element (800x600)
- Game loop using requestAnimationFrame
- Player sidebar display
- Session data retrieval from sessionStorage

### World/Map/Actor System (Complete)
- World class representing the physical state of a game match
- 100x100 tile map (32x32 pixel tiles)
- Actor class for physical entities with position and sprite
- Server creates shared world when match starts
- Client receives world state via `gameStart` event
- Tile grid rendering with camera/viewport system
- Actor rendering (placeholder circle sprites)
- Serialization/deserialization for network transmission

### Camera Controls (Complete)
- Pan with WASD or arrow keys (smooth, frame-rate independent)
- Pan with middle-click drag
- Zoom with mouse scroll wheel (zooms toward cursor position)
- Zoom with +/- keys
- Zoom range: 50% to 200%
- Camera clamped to map boundaries with padding
- MacBook trackpad support: two-finger scroll to pan, pinch to zoom
- Auto-detection of trackpad vs mouse input
- On-screen controls hint
- Minimap in lower-left corner showing map overview and camera viewport

### Unit Selection (Complete)
- Left-click on unit to select it (green selection indicator with pulsing glow)
- Unit info panel appears in bottom-right corner showing ID, position, and type
- Click on blank space or press Escape to deselect
- Right-click to issue move commands (unit moves to clicked position)
- Move target indicator shows destination with dashed line path
- Smooth unit movement (150 pixels/second)

## What's Missing

### Game Mechanics (Partial)
- No game rules or win conditions
- No physics or collision detection
- Only a single test actor exists
- Unit movement is client-side only (not synced with server)

### Game State Synchronization (Partial)
- Server creates initial world state
- Clients receive world on game start
- No continuous state updates during gameplay
- No input validation or anti-cheat

### Development Tooling (Not Configured)
- No test framework
- No linter
- No build/bundle process
- No hot reload for development

## Summary

The project has a fully functional lobby and matchmaking system. The networking layer is ready for game events. The game client renders a tile-based world with camera controls (pan and zoom) and unit selection/movement. Unit selection allows clicking on actors (units) to see their info and issuing move commands via right-click. Movement is currently client-side only. The next steps are server-side movement synchronization, game rules, and win conditions.
