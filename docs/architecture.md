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

`shared/constants.js` contains values used by both client and server. It uses a UMD-style export pattern to work in both Node.js (CommonJS) and browser (global variable) environments.

## Data Flow

Session data (room ID, player info) passes between lobby and game pages via browser sessionStorage. The game page reconnects to the server and rejoins the room using this stored data.

## Socket Events

Client to server: `setName`, `createRoom`, `joinRoom`, `quickMatch`, `leaveRoom`

Server to client: `roomCreated`, `roomJoined`, `playerJoined`, `playerLeft`, `matchReady`, `waitingForMatch`, `error`
