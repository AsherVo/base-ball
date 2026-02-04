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

ASP.NET Core serves static files from `/public` and exposes `/api/config` for game constants and entity definitions. SignalR handles all real-time game communication over WebSockets.

### Directory Structure

```
server/
├── Program.cs              # ASP.NET Core setup, static files, SignalR hub
├── ECS/
│   ├── Core/               # ECS framework (matches Net City pattern)
│   │   ├── Component.cs    # Base class with Create(), ApplyParameters(), Clone()
│   │   ├── Relation.cs     # Base class for entity references (has relation field)
│   │   ├── Message.cs      # Base class with implicit bool, auto ToString()
│   │   ├── World.cs        # In-memory entity/component storage, systems, filters
│   │   ├── Filter.cs       # Entity query with onAdd/onRemove callbacks
│   │   ├── FilterBuilder.cs # Fluent API with Include/Exclude/Related/NotRelated
│   │   ├── ISystem.cs      # StartSystem, StopSystem, TickSystem interface
│   │   ├── IService.cs     # Start, Stop interface for services
│   │   └── WorldManipulator.cs # Base class wrapping World for systems
│   ├── Components/
│   │   ├── Core/           # Transform, Ownership, EntityType, Sprite
│   │   ├── Combat/         # Health, Attack, AttackCooldown, AttackTarget
│   │   ├── Movement/       # Speed, MoveTarget, Velocity, Friction
│   │   ├── Unit/           # UnitState, GatherTarget, Carried, AutoAttackOnly, etc.
│   │   ├── Building/       # Construction, TrainingQueue, RallyPoint, Trains
│   │   ├── Avatar/         # CarriedUnit, MoveDirection, PickupRange
│   │   ├── Vision/         # VisionRadius
│   │   ├── Resource/       # ResourceAmount
│   │   └── Name.cs         # Entity naming component
│   ├── Systems/
│   │   ├── Command/        # CommandProcessingSystem
│   │   ├── Movement/       # AvatarMovementSystem, UnitMovementSystem, PhysicsSystem
│   │   ├── Collision/      # CollisionDetectionSystem, CollisionResolutionSystem, BallCollisionSystem
│   │   ├── Combat/         # AttackSystem, AutoAttackSystem, DeathSystem
│   │   ├── Economy/        # GatheringSystem, ConstructionSystem, TrainingSystem
│   │   ├── Avatar/         # PickupDropSystem, BuildingInteractionSystem
│   │   └── Win/            # GoalCheckSystem
│   └── Messages/           # Command and event message types
├── Network/
│   ├── GameHub.cs          # SignalR hub for lobby and game events
│   └── Serialization/
│       └── WorldSerializer.cs  # ECS to JSON conversion for client protocol
├── Rooms/
│   ├── GameRoom.cs         # Isolated World per match, game loop, commands
│   ├── PlayerState.cs      # Player resource/supply tracking
│   ├── RoomManager.cs      # Room lifecycle management
│   └── Matchmaking/
│       └── MatchmakingService.cs  # Quick match queue
├── AI/
│   └── AIPlayer.cs         # Server-side AI decision making
├── Setup/
│   ├── GameConstants.cs    # Tick rate, map dimensions, physics
│   ├── EntityDefinitions.cs # Unit, building, resource stats
│   ├── EntityFactory.cs    # Entity creation with components
│   └── MapGenerator.cs     # Initial world setup with bases, workers, resources
└── Util/
    └── MapBounds.cs        # Octagonal map boundary utilities
```

### ECS Architecture (Net City Pattern)

The server uses an Entity Component System pattern matching Net City's architecture:

- **Entities**: Long IDs stored in HashSet, 0 represents null/invalid
- **Components**: Data-only classes with `Create()` factory, `ApplyParameters()`, `Clone()`
- **Relations**: Components that link entities via `relation` field pointing to target entity
- **Systems**: Implement `ISystem` with `StartSystem()`, `StopSystem()`, `TickSystem()`
- **WorldManipulator**: Base class for systems providing protected access to World methods
- **Messages**: Events with implicit bool operator, auto-generated `ToString()`
- **Filters**: Query entities by Include/Exclude components and Related/NotRelated relations
- **Services**: Injectable services registered by interface type

### State Management

Each game room has an isolated World instance containing:
- All entities (units, buildings, resources, ball, avatars)
- Component storage indexed by entity ID and component type
- Message queue for the current tick

### Game Loop

The World.Tick() executes systems in order at 60 ticks per second (16.67ms per tick):

1. **CommandProcessingSystem** - Route player commands to game state changes
2. **AvatarMovementSystem** - WASD input to avatar position
3. **UnitMovementSystem** - Pathfinding toward move targets
4. **PhysicsSystem** - Ball velocity/friction with wall bouncing
5. **CollisionDetectionSystem** - Spatial hash collision detection
6. **CollisionResolutionSystem** - Push overlapping entities apart
7. **BallCollisionSystem** - Apply kick forces on ball collisions
8. **AttackSystem** - Deal damage to targets in range
9. **AutoAttackSystem** - Idle units find nearby enemies
10. **GatheringSystem** - Workers collect and return resources
11. **ConstructionSystem** - Building progress with assigned workers
12. **TrainingSystem** - Unit spawning from building queues
13. **PickupDropSystem** - Avatar picks up/drops units
14. **BuildingInteractionSystem** - Proximity-based building commands
15. **DeathSystem** - Remove dead entities, clear references
16. **GoalCheckSystem** - Win condition detection

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

## Configuration

Game constants and entity definitions are defined server-side and served to the client via API.

### Server-Side (Source of Truth)

| File | Purpose |
|------|---------|
| `Setup/GameConstants.cs` | Game configuration (tick rate, map size, physics, balance values) |
| `Setup/EntityDefinitions.cs` | Stats for all units, buildings, resources, and special entities |

### API Endpoint

`GET /api/config` returns JSON with:
- `constants` - Game logic constants (map dimensions, tick rate, ranges, etc.)
- `entityDefs` - Unit, building, resource, and special entity definitions

### Client-Side

| File | Purpose |
|------|---------|
| `js/config.js` | Fetches `/api/config` and sets `window.CONSTANTS` and `window.EntityDefs` |
| `js/ui-constants.js` | Client-only UI constants (camera, minimap, colors) - not shared with server |
| `js/actor.js` | Actor class with all entity properties (health, attack, speed, etc.) |
| `js/world.js` | World class managing map, actors, and queries (client-side representation) |
| `js/commands.js` | Command type definitions and factory functions |
| `js/playerState.js` | Player resource and supply tracking |

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
