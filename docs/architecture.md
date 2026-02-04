# Architecture

## Tech Stack

| Layer | Technology |
|-------|------------|
| Server Runtime | .NET 10 / ASP.NET Core |
| Real-time Communication | SignalR |
| Architecture | Entity Component System (ECS) |
| Frontend | Vanilla JavaScript (ES6+) |
| Rendering | HTML5 Canvas 2D API |
| Styling | Custom CSS |

## Server (C# ECS)

ASP.NET Core serves static files from `/public` and `/shared` directories. SignalR handles all real-time game communication over WebSockets.

### Directory Structure

```
server/
├── Program.cs              # ASP.NET Core setup, static files, SignalR hub
├── ECS/
│   ├── Core/               # ECS framework
│   │   ├── Entity.cs       # Entity ID wrapper struct
│   │   ├── Component.cs    # Base class for data components
│   │   ├── Relation.cs     # Base class for entity references
│   │   ├── World.cs        # In-memory entity/component storage
│   │   ├── Filter.cs       # Entity query system
│   │   ├── System.cs       # ISystem, SystemBase, WorldManipulator
│   │   ├── Message.cs      # Cross-system event messaging
│   │   └── SystemRunner.cs # System execution orchestrator
│   ├── Components/         # Data-only component classes (pending)
│   ├── Systems/            # Game logic systems (pending)
│   └── Messages/           # Event message types (pending)
├── Network/
│   └── GameHub.cs          # SignalR hub (placeholder)
├── Rooms/                  # Room management (pending)
├── AI/                     # AI opponent (pending)
└── Setup/                  # Map generation, entity factory (pending)
```

### ECS Architecture

The server uses an Entity Component System pattern:

- **Entities**: Integer IDs stored in a HashSet
- **Components**: Data-only classes stored in Dictionary<int, Dictionary<Type, Component>>
- **Systems**: Logic classes that query entities by component and update state
- **Messages**: Events emitted by systems for cross-system communication

### State Management

Each game room has an isolated World instance containing:
- All entities (units, buildings, resources, ball, avatars)
- Component storage indexed by entity ID and component type
- Message queue for the current tick

### Game Loop

The SystemRunner executes systems in order at 60 ticks per second:

1. **CommandProcessingSystem** - Dequeue and execute player commands
2. **Movement Systems** - Avatar WASD, unit pathfinding, ball physics
3. **Collision Systems** - Detection and resolution
4. **Combat Systems** - Attack, auto-attack, death handling
5. **Economy Systems** - Gathering, construction, training
6. **Avatar Systems** - Pickup/drop, building interaction
7. **Win System** - Goal check

## Client

The frontend uses a layered architecture:

```
UI (HTML/CSS)
    ↓
Application Logic (lobby.js, game.js)
    ↓
Network Abstraction (NetworkClient class in network.js)
    ↓
SignalR Client
```

The NetworkClient class wraps SignalR to provide a clean API for game-specific operations like `createRoom()`, `joinRoom()`, `sendCommand()`. Game logic in `lobby.js` and `game.js` is unchanged from the Node.js version.

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

// Special
ball:   { radius: 120, visionRadius: 300 }  // Provides vision to both players
avatar: { health: 200, speed: 150, radius: 20, visionRadius: 400, pickupRange: 50, interactionRange: 100 }
```

### Avatar Control System

The game uses an avatar-based control scheme instead of traditional RTS selection:

- Each player controls a diamond-shaped avatar entity
- WASD/arrows move the avatar directly (server tracks movement direction)
- Camera automatically follows the avatar with smooth interpolation
- Units are picked up (E key) and carried by the avatar
- Dropped units become stationary and auto-attack only
- Building interaction is proximity-based (walk near building to see train UI)

Actor properties for avatar system:
- `carriedUnitId` - ID of unit being carried (on avatar)
- `isCarried` - Flag for units being carried
- `autoAttackOnly` - Flag for placed units (attack but don't move)

## Data Flow

### Session Flow
Session data (room ID, player info) passes between lobby and game pages via browser sessionStorage. The game page reconnects to the server and rejoins the room using this stored data.

### Command Flow
```
User Input (game.js)
    → Commands.avatarMove(dirX, dirY) or Commands.pickupUnit() etc.
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

### Avatar Command Types
| Command | Purpose |
|---------|---------|
| `AVATAR_MOVE` | Set avatar movement direction (-1/0/1 for x and y) |
| `PICKUP_UNIT` | Pick up nearest unit within pickup range |
| `DROP_UNIT` | Drop carried unit at avatar's position |
| `INTERACT_BUILDING` | Interact with nearby building (e.g., train unit) |

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
- Avatar spawns 100px toward center from each base
- 2 mineral patches near each base, 2 in contested center
- Ball spawns at exact center
- Goals span the middle vertical section of each edge
