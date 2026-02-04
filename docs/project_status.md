# Project Status

This project is undergoing a migration from Node.js to C# with an ECS architecture.

## Migration Status

### Phase 0: Project Setup ✅ Complete
- Deleted Node.js server directory
- Created C# ASP.NET Core project in `server/`
- Configured SignalR for WebSocket communication
- Set up static file serving for `public/` and `shared/`
- Updated `public/js/network.js` to use SignalR client
- Updated HTML files to reference SignalR JS client

### Phase 1: Core ECS Framework ✅ Complete
- Entity struct with ID wrapper
- Component base class for data containers
- Relation base class for entity references
- World class with in-memory Dictionary storage
- Filter and FilterBuilder for entity queries
- ISystem interface and SystemBase class
- WorldManipulator for systems that modify world structure
- Message queue system for cross-system events
- SystemRunner for orchestrating system execution

### Remaining Phases
- Phase 2: All Components (pending)
- Phase 3: Movement & Physics Systems (pending)
- Phase 4: Collision Systems (pending)
- Phase 5: Combat Systems (pending)
- Phase 6: Economy Systems (pending)
- Phase 7: Avatar & Win Systems (pending)
- Phase 8: Networking (pending)
- Phase 9: Room Management (pending)
- Phase 10: AI & Map Generation (pending)
- Phase 11: Integration Testing (pending)

---

## Previous Implementation (Node.js - Being Replaced)

This project was a functional RTS game prototype with all core mechanics implemented.

## What Works

### Lobby System (Complete)
- Name entry and validation
- Room creation with shareable codes
- Joining rooms by code
- Quick match queue with automatic pairing
- **Play vs AI option for single-player practice**
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
- Server-authoritative game loop at 60 ticks/second
- State broadcasting at 20 updates/second
- Command queue system for player inputs

### Game Page (Complete)
- Canvas element (800x600)
- Game loop using requestAnimationFrame
- Player sidebar display with team colors
- Session data retrieval from sessionStorage
- Resource display (minerals, supply)
- Unit info panel with actions
- Build menu for workers
- Game over overlay with victory/defeat

### World/Map/Actor System (Complete)
- World class representing the physical state of a game match
- 100x60 tile map (32x32 pixel tiles) with octagonal shape (diagonal corner cut-offs)
- Actor class with full entity properties (health, attack, speed, etc.)
- Entity definitions for all game units, buildings, and resources
- Server creates symmetrical map with bases, workers, resources, and ball
- Client receives world state via `gameStart` and `gameState` events
- Tile grid rendering with camera/viewport system
- Goals drawn at map edges for ball scoring
- Ball bounces realistically off diagonal corner boundaries

### Entity System (Complete)
- **Units**: Workers (can gather, build), Soldiers (combat)
- **Buildings**: Base (trains workers), Barracks (trains soldiers), Supply Depot (increases supply cap)
- **Resources**: Mineral nodes that deplete when gathered
- **Ball**: Physics-enabled ball that can be pushed toward goals

### Avatar-Based Control System (Complete)
- Each player controls an avatar (diamond-shaped entity)
- WASD/arrow keys move the avatar around the map
- Camera automatically follows the avatar with smooth lerp
- E key to pick up friendly units (one at a time)
- E key again to drop the carried unit
- Walk near buildings to interact (proximity-based UI)
- Building interaction panel appears when near owned buildings
- Dropped units become stationary and auto-attack only (don't move or chase)
- Avatars collide with other entities and can push the ball
- Minimap shows avatars as diamonds
- Zoom with mouse scroll wheel (zooms toward cursor position)
- Zoom with +/- keys
- Zoom range: 50% to 200%
- Camera clamped to map boundaries with padding
- MacBook trackpad support: pinch to zoom
- Minimap in lower-left corner showing map overview, actors, goals, and camera viewport

### Resource Gathering (Complete)
- Workers can be sent to mineral nodes via right-click
- Workers automatically gather and return to base
- Resources deposited at base, adding to player minerals
- Mineral nodes deplete over time and disappear when empty

### Building Construction (Complete)
- Press B with worker selected to open build menu
- Select building type (Barracks: 150, Supply Depot: 100)
- Click to place building ghost, worker moves to construct
- Building starts vulnerable (1 HP) and gains full HP when complete
- Construction progress bar shown during building
- Completed buildings provide their bonuses (supply, training)

### Unit Training (Complete)
- Select a completed building (Base or Barracks)
- Click "Train [unit]" button in unit info panel
- Cost deducted, unit added to training queue
- Training progress bar shown on building
- Units spawn near building when training completes
- Supply is consumed when unit spawns

### Combat System (Complete)
- Units automatically attack nearby enemies when idle
- Attack command via right-click on enemy
- Units move into range then attack
- Attack cooldown based on attack speed
- Health bars shown when damaged
- Visual attack effects (red line flash)
- Units die at 0 HP and are removed from world
- Death notifications sent to clients

### Ball & Win Condition (Complete)
- Ball spawns in center of map
- Units and avatars push ball when they collide with it
- Ball has velocity, friction, and bounces off map edges
- Goals at left and right edges of map
- Ball entering goal ends game with victory for the scoring team
- Game over overlay shows victory/defeat message

### Collision System (Complete)
- All actors have collision radii (units: 16-20px, buildings: 30-50px, ball: 120px)
- Units cannot overlap with other units, buildings, or resources
- Collision resolution pushes units apart when they attempt to occupy same space
- Ball bounces off buildings with velocity reflection
- Ball bounces off units (absorbs more energy than buildings)
- Units walking into ball push it gently
- Unit spawn positions validated to avoid overlapping with existing actors

### Fog of War (Complete)
- All units and buildings have vision radius (workers: 200px, soldiers: 250px, base: 350px, barracks: 250px, supply depot: 200px)
- Map areas outside player's vision are darkened with fog overlay
- Enemy units and buildings hidden in fog of war (not rendered)
- Ball provides shared vision to both players (300px radius)
- Minimap shows fog overlay reflecting visible/fogged areas
- Players cannot click on or select enemy units hidden in fog
- Attack effects only shown if either end is visible

### AI Opponent (Complete)
- "Play vs AI" button in lobby to start a single-player game
- AI manages its economy: assigns workers to gather resources
- AI builds supply depots when approaching supply cap
- AI builds barracks and trains soldiers
- AI trains workers up to a reasonable count
- AI sends soldiers to push the ball toward the player's goal
- AI runs server-side as part of the game loop

## What's Missing

### Polish & Balance
- No sound effects or music
- Limited visual feedback for some actions
- Balance tuning needed for unit stats and costs

### Development Tooling (Not Configured)
- No test framework
- No linter
- No build/bundle process
- No hot reload for development

## Summary

The project is now a fully playable RTS game with resource gathering, building construction, unit training, combat, and the unique ball-pushing win condition. Two players can connect, ready up, and play a complete match where the objective is to push the giant ball into the opponent's goal while managing an economy and army.
