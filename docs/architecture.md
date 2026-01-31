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

State is managed in-memory using three data structures:
- `rooms` Map - Active game rooms with player lists
- `players` Map - Connected players and their current room
- `waitingQueue` Array - Players waiting for quick match

Room IDs are randomly generated 6-character uppercase alphanumeric strings.

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

The NetworkClient class wraps Socket.io to provide a clean API for game-specific operations like `createRoom()`, `joinRoom()`, and `quickMatch()`.

## Shared Code

The `shared/` directory contains code used by both client and server. All files use a UMD-style export pattern to work in both Node.js (CommonJS) and browser (global variable) environments.

- `shared/constants.js` - Game configuration (tick rate, map dimensions, tile sizes)
- `shared/actor.js` - Actor class representing physical entities with position and sprite
- `shared/world.js` - World class managing the map and all actors

### World System

The World class represents the physical state of a game match:
- Contains a 100x100 tile map (configurable via constants)
- Manages a collection of actors (entities with position and sprite)
- Provides serialization methods (`toJSON`/`fromJSON`) for network transmission

When a match starts, the server creates a World instance with a single test actor and broadcasts it to both clients via the `gameStart` event.

## Data Flow

Session data (room ID, player info) passes between lobby and game pages via browser sessionStorage. The game page reconnects to the server and rejoins the room using this stored data.

## Socket Events

Client to server: `setName`, `createRoom`, `joinRoom`, `quickMatch`, `leaveRoom`, `playerReady`

Server to client: `roomCreated`, `roomJoined`, `playerJoined`, `playerLeft`, `matchReady`, `waitingForMatch`, `readyUpdate`, `countdown`, `countdownCanceled`, `gameStart`, `error`

### Game Start Flow

1. When 2 players are in a room, `matchReady` is emitted
2. Each player clicks "Ready" which sends `playerReady` to toggle their ready state
3. Server broadcasts `readyUpdate` with all players' ready states
4. When both players are ready, server starts a 3-second countdown, emitting `countdown` each second
5. If a player leaves or the countdown is canceled, `countdownCanceled` is emitted
6. After countdown completes, `gameStart` is emitted with the world state and both clients navigate to game page
