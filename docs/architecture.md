# Architecture

## Tech Stack

| Layer | Technology |
|-------|------------|
| Server Runtime | Node.js |
| Web Framework | Express 4.x |
| Real-time Communication | Socket.io 4.x |
| Frontend | Vanilla JavaScript (ES6+) |
| Rendering | HTML5 Canvas 2D API |
| Styling | Custom CSS |

## Server

Express serves static files from `/public` and `/shared` directories. Socket.io handles all real-time game communication over WebSockets.

### Directory Structure

```
server/
  index.js              # Express + Socket.io server setup
  handlers/
    socketHandlers.js   # Socket event handlers, room management, game start
  game/
    GameLoop.js         # Server-side game simulation (60 ticks/sec)
    MapGenerator.js     # Initial map generation with symmetric placement
    AIPlayer.js         # AI opponent logic (economy, building, combat)
```

### State Management

State is managed in-memory using several data structures:

- `rooms` Map - Active game rooms with player lists, world state, game loop
- `players` Map - Connected players and their current room
- `waitingQueue` Array - Players waiting for quick match
- `playerStates` Map (per room) - Player resources and supply tracking

Room IDs are randomly generated 6-character uppercase alphanumeric strings.

### Game Loop

The `GameLoop` class runs at 60 ticks per second per active game room:

1. **Process Commands**: Dequeue and execute player commands (MOVE, ATTACK, BUILD, etc.)
2. **Update Simulation**: Move units, process combat, gather resources, construct buildings
3. **Broadcast State**: Send world state to clients every 3 ticks (~20 updates/sec)

Commands are validated server-side (ownership checks, resource costs, range checks).

## Client

The frontend uses a layered architecture:

```
UI (HTML/CSS)
    ↓
Application Logic (lobby.js, game.js)
    ↓
Network Abstraction (NetworkClient class in network.js)
    ↓
Socket.io Client
```

The NetworkClient class wraps Socket.io to provide a clean API for game-specific operations like `createRoom()`, `joinRoom()`, `sendCommand()`.

### Game Client Responsibilities

- Render world state received from server
- Handle user input (selection, camera, commands)
- Send commands to server (not execute locally)
- Display UI (resources, unit info, build menu, game over)
- Calculate and render fog of war based on player's unit vision

## Shared Code

The `shared/` directory contains code used by both client and server. All files use a UMD-style export pattern to work in both Node.js (CommonJS) and browser (global variable) environments.

### Files

| File | Purpose |
|------|---------|
| `constants.js` | Game configuration (tick rate, map size, balance values) |
| `actor.js` | Actor class with all entity properties (health, attack, speed, etc.) |
| `world.js` | World class managing map, actors, and queries |
| `commands.js` | Command type definitions and factory functions |
| `entityDefs.js` | Stats for all units, buildings, and resources |
| `playerState.js` | Player resource and supply tracking |

### World System

The World class represents the physical state of a game match:
- 100x60 tile map (3200x1920 pixels)
- Manages actors (units, buildings, resources, ball)
- Player ownership tracking
- Query methods (getPlayerBase, getBall, getActorsByOwner, etc.)
- Serialization methods (`toJSON`/`fromJSON`) for network transmission

### Entity Definitions

```javascript
// Units
worker:   { health: 50, speed: 120, attack: 5, cost: 50, trainTime: 8, visionRadius: 200 }
soldier:  { health: 100, speed: 100, attack: 15, cost: 100, trainTime: 10, visionRadius: 250 }

// Buildings
base:        { health: 1000, trains: ['worker'], suppliesProvided: 10, visionRadius: 350 }
barracks:    { health: 400, cost: 150, buildTime: 15, trains: ['soldier'], visionRadius: 250 }
supplyDepot: { health: 200, cost: 100, buildTime: 10, suppliesProvided: 8, visionRadius: 200 }

// Resources
minerals: { amount: 1500, gatherRate: 10 }

// Ball (provides vision to both players)
ball: { radius: 120, visionRadius: 300 }
```

## Data Flow

### Session Flow
Session data (room ID, player info) passes between lobby and game pages via browser sessionStorage. The game page reconnects to the server and rejoins the room using this stored data.

### Command Flow
```
User Input (game.js)
    → Commands.move(unitIds, x, y)
    → network.sendCommand(command)
    → Socket.io → Server
    → GameLoop.queueCommand(playerId, command)
    → GameLoop.executeCommand() on next tick
    → World state updated
    → Broadcast to all clients
    → Client receives gameState
    → World.fromJSON(data.world)
    → Render updated state
```

## Socket Events

### Client → Server

| Event | Purpose |
|-------|---------|
| `setName` | Set player display name |
| `createRoom` | Create a new game room |
| `joinRoom` | Join existing room by ID |
| `quickMatch` | Enter matchmaking queue |
| `leaveRoom` | Leave current room |
| `playerReady` | Toggle ready state |
| `playerCommand` | Send game command (MOVE, ATTACK, BUILD, etc.) |

### Server → Client

| Event | Purpose |
|-------|---------|
| `roomCreated` | Room creation confirmed |
| `roomJoined` | Successfully joined room |
| `playerJoined` | Another player joined |
| `playerLeft` | Player left room |
| `matchReady` | Both players present, can ready up |
| `waitingForMatch` | Added to matchmaking queue |
| `readyUpdate` | Player ready states changed |
| `countdown` | Countdown tick (3, 2, 1) |
| `countdownCanceled` | Countdown stopped |
| `gameStart` | Game started with initial world state |
| `gameState` | Periodic world state update |
| `attackEvent` | Visual feedback for attacks |
| `actorDeath` | Actor removed from world |
| `gameOver` | Game ended with winner |
| `error` | Error message |

## Game Start Flow

1. When 2 players are in a room, `matchReady` is emitted
2. Each player clicks "Ready" which sends `playerReady` to toggle their ready state
3. Server broadcasts `readyUpdate` with all players' ready states
4. When both players are ready, server starts a 3-second countdown, emitting `countdown` each second
5. If a player leaves or the countdown is canceled, `countdownCanceled` is emitted
6. After countdown completes:
   - Server generates map via `MapGenerator.generate(playerIds)`
   - Creates `GameLoop` and starts it
   - Emits `gameStart` to each client with world state and player info
7. Game loop runs, broadcasting `gameState` 20 times per second
8. When ball enters a goal, `gameOver` is emitted with winner ID

## Map Layout

```
     +----------------------------------------------------+
    /  [GOAL]   [Base]  [Workers]  [Minerals]   [Minerals] \
   /   (Blue)      (P1)                          (center)   \
  |                                                          |
  |                          [BALL]                          |
  |                                                          |
   \  [Minerals]       [Minerals]  [Workers]  [Base]  [GOAL]/
    \  (center)                                  (P2)  (Red)/
     +----------------------------------------------------+
```

- Map is 100x60 tiles (3200x1920 pixels)
- Octagonal shape with diagonal corner cut-offs (300px from each corner)
- Bases placed 200px from left/right edges
- 4 workers spawn around each base
- 2 mineral patches near each base, 2 in contested center
- Ball spawns at exact center
- Goals span the middle vertical section of each edge
