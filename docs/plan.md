# Base Ball: Node.js to C# ECS Migration Plan

## Overview

Migrate the Base Ball game server from Node.js/Express/Socket.io to C# with an ECS architecture, adopting patterns from Net City but with in-memory storage instead of PostgreSQL.

### Decisions
- **WebSocket Library**: SignalR
- **Client Compatibility**: Minimal change - swap Socket.io for SignalR client in `public/js/network.js` only; game logic unchanged
- **Location**: Replace `server/` directory (delete Node.js code)
- **Protocol**: JSON structures must remain identical so game.js parsing works unchanged

## Current State

- **Server**: Node.js + Express + Socket.io (server/)
- **Game Loop**: 60Hz tick rate in `server/game/GameLoop.js` (1,209 lines)
- **Entities**: Monolithic `Actor` class with 60+ properties (`shared/actor.js`)
- **State**: In-memory Maps (rooms, players, waitingQueue)
- **Client**: Canvas-based JS client (`public/js/game.js`) - UNCHANGED

## Target Architecture

### ECS Framework (Net City Pattern, In-Memory)

The `server/` directory will be replaced with a C# ASP.NET Core project:

```
server/   (C# project, replaces Node.js)
├── ECS/
│   ├── Core/                    # Entity, Component, World, Filter, System, Message
│   ├── Components/              # Data-only classes
│   │   ├── Core/                # Transform, Ownership, EntityType, Sprite
│   │   ├── Combat/              # Health, Attack, AttackCooldown, AttackTarget
│   │   ├── Movement/            # Speed, MoveTarget, Velocity, Friction
│   │   ├── Unit/                # UnitState, GatherTarget, CarryAmount, BuildTarget
│   │   ├── Building/            # Construction, TrainingQueue, RallyPoint
│   │   ├── Avatar/              # CarriedUnit, MoveDirection
│   │   └── Vision/              # VisionRadius
│   ├── Systems/                 # Game logic
│   │   ├── Movement/            # AvatarMovement, UnitMovement, Physics
│   │   ├── Collision/           # Detection, Resolution, BallCollision
│   │   ├── Combat/              # Attack, AutoAttack, Death
│   │   ├── Economy/             # Gathering, Construction, Training
│   │   ├── Avatar/              # PickupDrop, BuildingInteraction
│   │   └── Win/                 # GoalCheck
│   └── Messages/                # AttackEvent, DeathEvent, GameOver
├── Network/
│   ├── GameHub.cs               # SignalR hub (Socket.io equivalent)
│   └── Serialization/           # WorldSerializer for client compatibility
├── Rooms/
│   ├── GameRoom.cs              # Isolated World per match
│   ├── RoomManager.cs           # Room lifecycle
│   └── Matchmaking/             # Quick match queue
├── AI/
│   └── AIPlayer.cs              # Computer opponent
└── Setup/
    ├── MapGenerator.cs          # Initial world setup
    └── EntityFactory.cs         # Spawn configured entities
```

### Key Differences from Net City

| Aspect | Net City | Base Ball |
|--------|----------|-----------|
| Storage | PostgreSQL | In-memory Dictionary |
| Tick Rate | 1 second | 16.67ms (60Hz) |
| Communication | HTTP polling | WebSocket (SignalR) |
| Concurrency | Single world | Separate World per room |
| Physics | None | Ball velocity/friction/bounce |

## Components (Extracted from Actor)

### Core
- **Transform**: x, y, radius
- **Ownership**: ownerId, playerIndex
- **EntityType**: type ("unit", "building", etc.), subtype ("worker", "soldier", etc.)
- **Sprite**: visual identifier string

### Combat
- **Health**: health, maxHealth
- **Attack**: damage, range, speed
- **AttackCooldown**: remaining timer
- **AttackTarget**: Relation to target entity

### Movement
- **Speed**: base speed value
- **MoveTarget**: targetX, targetY
- **Velocity**: x, y (for ball physics)
- **Friction**: coefficient (0.95)

### Unit-Specific
- **UnitState**: "idle", "moving", "attacking", "gathering", "building", "returning"
- **GatherTarget**: Relation to resource
- **GatherProgress**: progress timer
- **CarryAmount**: resources carried
- **BuildTarget**: Relation to building
- **Carried**: marker component
- **AutoAttackOnly**: marker for placed units

### Building-Specific
- **Construction**: progress, maxTime
- **TrainingQueue**: list of {unitType, progress, trainTime}
- **RallyPoint**: offsetX, offsetY

### Avatar-Specific
- **CarriedUnit**: Relation to carried entity
- **MoveDirection**: directionX (-1/0/1), directionY (-1/0/1)

## Systems (Execution Order)

1. **CommandProcessingSystem** - Dequeue and execute player commands
2. **AvatarMovementSystem** - WASD input to position
3. **UnitMovementSystem** - Pathfinding to targets
4. **PhysicsSystem** - Ball velocity/friction
5. **CollisionDetectionSystem** - Find overlapping pairs
6. **CollisionResolutionSystem** - Push entities apart
7. **BallCollisionSystem** - Bounces off walls/entities
8. **AttackSystem** - Deal damage
9. **AutoAttackSystem** - Idle units find targets
10. **GatheringSystem** - Workers collect resources
11. **ConstructionSystem** - Building progress
12. **TrainingSystem** - Unit spawning
13. **PickupDropSystem** - Avatar carries units
14. **DeathSystem** - Remove dead entities
15. **GoalCheckSystem** - Win condition

## Networking

### SignalR Hub (replacing Socket.io)

The JS client uses Socket.io which will be replaced with SignalR's JS client in `public/js/network.js`. Game logic in `game.js` and `lobby.js` remains unchanged.

**Client-side change** (NetworkClient class in `public/js/network.js`):
```js
// Before: this.socket = io();
// After:  this.connection = new signalR.HubConnectionBuilder().withUrl("/game").build();

// Event pattern change:
// Before: this.socket.on('gameState', callback);
// After:  this.connection.on('gameState', callback);

// Emit pattern change:
// Before: this.socket.emit('playerCommand', data);
// After:  this.connection.invoke('PlayerCommand', data);
```

The NetworkClient class abstracts these details, so `game.js` and `lobby.js` call the same methods.

**Server events** (same names as current Socket.io events):
- `SetName`, `CreateRoom`, `CreateRoomWithAI`, `JoinRoom`, `QuickMatch`, `PlayerReady`
- `PlayerCommand` - queued for next tick
- `LeaveRoom`, disconnect handling

**Client events** (broadcast from server):
- `roomCreated`, `roomJoined`, `playerJoined`, `playerLeft`
- `readyUpdate`, `countdown`, `matchReady`
- `gameStart`, `gameState`, `attackEvent`, `actorDeath`, `gameOver`

### Protocol Compatibility (CRITICAL)

WorldSerializer **must** produce identical JSON to current server. The JS client parses these structures directly:

**Actor JSON** (from `shared/actor.js` toJSON):
```json
{
  "id": 1, "x": 200, "y": 960, "radius": 50,
  "sprite": "base", "type": "building", "subtype": "base",
  "ownerId": "socket-id-123", "health": 1000, "maxHealth": 1000,
  "state": "complete", "visionRadius": 350,
  "constructionProgress": null, "maxConstructionTime": null,
  "trainingQueue": []
}
```

**World JSON** (from `shared/world.js` toJSON):
```json
{
  "width": 100, "height": 60,
  "actors": [...],
  "nextActorId": 25,
  "players": [["socket-id-1", 0], ["socket-id-2", 1]]
}
```

**PlayerState JSON**:
```json
{ "minerals": 100, "supply": 4, "maxSupply": 10 }
```

## Implementation Phases

### Phase 0: Project Setup
- Delete `server/` directory (Node.js code)
- Create new C# ASP.NET Core project in `server/`
- Add SignalR NuGet package
- Configure static file serving for `public/` and `shared/`
- Update `public/js/network.js` to use SignalR client
- Add SignalR JS client to `public/`

### Phase 1: Core ECS Framework
- Entity, Component, Relation base classes
- World (in-memory Dictionary storage)
- Filter, FilterBuilder for entity queries
- ISystem interface, WorldManipulator base
- Message queue system

### Phase 2: All Components
- Define all component classes
- EntityFactory for spawning
- EntityDefinitions (port from JS)

### Phase 3: Movement & Physics Systems
- AvatarMovementSystem
- UnitMovementSystem
- PhysicsSystem
- MapBounds utility

### Phase 4: Collision Systems
- CollisionDetectionSystem (with spatial hash for performance)
- CollisionResolutionSystem
- BallCollisionSystem

### Phase 5: Combat Systems
- AttackSystem
- AutoAttackSystem
- DeathSystem

### Phase 6: Economy Systems
- GatheringSystem
- ConstructionSystem
- TrainingSystem

### Phase 7: Avatar & Win Systems
- PickupDropSystem
- BuildingInteractionSystem
- GoalCheckSystem

### Phase 8: Networking
- SignalR GameHub
- WorldSerializer
- Client message handlers

### Phase 9: Room Management
- GameRoom (isolated World per match)
- RoomManager
- MatchmakingService
- Reconnection logic

### Phase 10: AI & Map Generation
- AIPlayer (port decision logic)
- MapGenerator

### Phase 11: Integration Testing
- Connect JS client to C# server
- Verify all mechanics
- Performance testing

## Critical Files to Port/Modify

| Source (JS) | Target (C#) | Purpose |
|-------------|-------------|---------|
| `server/game/GameLoop.js` | Systems/* | 1,209 lines of game logic |
| `shared/actor.js` | Components/* | Decompose into 20+ components |
| `shared/world.js` | ECS/Core/World.cs | In-memory entity storage |
| `server/handlers/socketHandlers.js` | Rooms/*, Network/* | Room management |
| `server/game/MapGenerator.js` | Setup/MapGenerator.cs | Initial world setup |
| `server/game/AIPlayer.js` | AI/AIPlayer.cs | Computer opponent |
| `shared/entityDefs.js` | Setup/EntityDefinitions.cs | Unit/building stats |
| `shared/mapBounds.js` | Util/MapBounds.cs | Octagonal boundary |

| Client File | Change |
|-------------|--------|
| `public/js/network.js` | Replace Socket.io with SignalR client |
| `public/index.html` | Add SignalR JS client script |
| `public/game.html` | Add SignalR JS client script |

## Verification

1. **Unit Tests**: ECS framework operations (create entity, add/remove components, filters)
2. **Integration Tests**: Full game tick with all systems
3. **Manual Testing**: Connect existing JS client, play full match
4. **Performance**: Profile 60Hz tick with 100+ entities per room, multiple concurrent rooms
