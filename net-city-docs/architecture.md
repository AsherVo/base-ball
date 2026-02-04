# Project Architecture

System design and data flow

## Three-Layer Architecture

The system is deliberately split into three layers, each with a clear responsibility:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Player (HTTP Requests)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 TypeScript API Layer (Hono)                     │
│        Thin HTTP interface - no gameplay logic                  │
│                                                                 │
│   Routes:                                                       │
│     POST /login                          →  Login (requires key)│
│     POST /logout                         →  Logout (requires key│
│     GET  /net/:endpoint                  →  Read local endpoint │
│     POST /net/:endpoint                  →  Create via endpoint │
│     DELETE /net/:endpoint                →  Delete via endpoint │
│     DELETE /net/:endpoint/:param         →  Delete with param   │
│     GET  /net/remote/:address/:endpoint  →  Read remote endpoint│
│     GET  /health                         →  Health check        │
│     GET  /admin/map                      →  City visualizer     │
│     GET  /admin/map/data                 →  City data (JSON)    │
│     POST /admin/players                  →  Create new player   │
│     GET  /admin/players                  →  List all players    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │  Writes api_requests
                              │  Polls api_responses
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                           │
│              Single source of truth for all state               │
│                                                                 │
│   Tables:                                                       │
│     entities            - Entity IDs and existence flags        │
│     component_*         - JSONB component data per type         │
│     players             - Player accounts with API keys         │
│     api_requests        - Incoming player requests              │
│     api_responses       - Outgoing responses to players         │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │  Reads requests
                              │  Writes responses
                              │  Full entity/component CRUD
                              │
┌─────────────────────────────────────────────────────────────────┐
│                  C# ECS Simulation Layer                        │
│         Headless simulation engine - no HTTP knowledge          │
│                                                                 │
│   Components:                                                   │
│     World          - Central ECS engine                         │
│     Systems        - Per-tick logic (Endpoints, Ping, etc.)     │
│     Services       - Long-running services (API polling)        │
│     Filters        - Entity query system                        │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow: Request Lifecycle

1. **Player sends HTTP request** to API layer
   ```
   GET /net/remote/20-1-1/status
   ```

2. **API layer creates database record** in `api_requests`
   ```sql
   INSERT INTO api_requests (net_address, endpoint, method, body)
   VALUES ('20-1-1', 'status', 'GET', NULL)
   ```

3. **API layer polls** `api_responses` for matching `request_id`

4. **Simulation tick occurs**:
   - `IApiService.GetPendingRequests()` fetches unprocessed requests
   - `EndpointSystem.ProcessRequest()` routes to appropriate `IServerSystem`
   - `NetAddressSystem.Get()` resolves address `20-1-1` to entity ID
   - `OnlineSystem.HandleRequest()` processes the status endpoint
   - Response written via `IApiService.WriteResponse()`

5. **API layer receives response**, returns to player
   ```json
   {"message": "pong"}
   ```

## ECS Architecture

### Core Classes

| Class | Purpose |
|-------|---------|
| `World` | Central container for entities, components, systems, services, filters, messages |
| `Component` | Base class for all components (data containers) |
| `Message` | Base class for inter-system communication |
| `Relation` | Base class for entity-to-entity relationships |
| `Filter` | Query system for matching entities by component patterns |
| `FilterBuilder` | Fluent API for constructing filters |
| `WorldManipulator` | Base class providing helper methods for systems/services |
| `ISystem` | Interface for tick-based systems |
| `IService` | Interface for long-running services |

### System Lifecycle

```csharp
public interface ISystem
{
    void StartSystem( World world );   // Called once on registration
    void StopSystem( World world );    // Called once on removal
    void TickSystem( World world );    // Called every simulation tick
}
```

### Filter System

Filters track entities matching component patterns:

```csharp
myFilter = new FilterBuilder()
    .Include< NetAddress >()
    .Include< Online >()
    .Exclude< Disabled >()
    .ToFilter();

myFilter.onAdd = ( entityId ) => { /* entity now matches */ };
myFilter.onRemove = ( entityId ) => { /* entity no longer matches */ };
```

### Message Queue

Messages enable cross-system communication with tick isolation:

- `World.Send< T >( message )` - Queue message for current tick
- `World.Read< T >()` - Read messages from current tick
- `World.ReadOld< T >()` - Read messages from previous tick

Messages are cleared at the start of each tick, preventing feedback loops.

## Database Schema

### Entity Storage

```sql
CREATE TABLE entities (
    id BIGINT PRIMARY KEY,
    exists BOOLEAN DEFAULT TRUE
);
```

### Component Storage

Components are stored in auto-created tables using JSONB:

```sql
-- Table created dynamically when component type first used
CREATE TABLE component_netaddress (
    entity_id BIGINT PRIMARY KEY,
    data JSONB NOT NULL
);
```

### Player Storage

```sql
CREATE TABLE players (
    id BIGSERIAL PRIMARY KEY,
    api_key VARCHAR(68) UNIQUE NOT NULL,  -- "nc_" prefix + 64 hex chars
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Each player also has an ECS entity with a `Player` component linking to their `players.id`.

### Key Entity Lookup

```sql
CREATE TABLE key_entities (
    key VARCHAR(255) PRIMARY KEY,
    entity_id BIGINT NOT NULL REFERENCES entities(id)
);
```

Used to store references to important entities by name (e.g., `PLAYER_SUBNET`). Populated during setup, queried by `LookupSystem`.

### API Communication

```sql
CREATE TABLE api_requests (
    id SERIAL PRIMARY KEY,
    net_address TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    body TEXT,
    player_id BIGINT,              -- Links to players.id (nullable for admin ops)
    processed BOOLEAN DEFAULT FALSE,
    success BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE api_responses (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES api_requests(id),
    status_code INTEGER NOT NULL,
    body TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Server Endpoint System

### Endpoint Routing

The `EndpointSystem` acts as a central dispatcher:

1. Receives request with `net_address`, `endpoint`, and `method`
2. Uses `NetAddressSystem.Get()` to resolve address to entity
3. Iterates registered `IServerSystem` implementations
4. Each system reports what endpoints it handles for that entity
5. Matching system's `HandleRequest()` is invoked

### IServerSystem Interface

```csharp
public interface IServerSystem
{
    string[] GetEndpoints( long entity );  // Endpoints available for entity
    bool HandleRequest( ApiRequest request, long entity, IApiService api );
}
```

### Built-in Endpoints

| Endpoint | Method | System | Description |
|----------|--------|--------|-------------|
| `status` | GET | OnlineSystem | Returns server status and uptime |
| `endpoints` | GET | EndpointSystem | Lists available endpoints for server |
| `clients` | GET | SubNetSystem | Lists all servers in a subnet (SubNetProvider only) |
| `location` | GET | GPSSystem | Returns GPS coordinates |
| `uptime` | GET | TimeSystem | Returns server uptime (requires `Uptime` component) |
| `time` | GET | RigSystem | Returns current game time (logged-in players only) |
| `help` | GET | RigSystem | Returns help text about endpoints and connections (logged-in players only) |
| `login` | POST | PlayerSystem | Logs in player, assigns NetAddress if needed |
| `logout` | POST | PlayerSystem | Logs out player |
| `create_player` | POST | PlayerSystem | Creates player entity (used by admin API) |
| `connections` | GET | ConnectionSystem | Lists all active connections |
| `connections` | POST | ConnectionSystem | Connects to a remote server (requires `CanConnect`) |
| `connections` | DELETE | ConnectionSystem | Disconnects from a server (address in body or all) |

### LookupSystem

The `LookupSystem` provides entity lookup by key from the `key_entities` database table:

```csharp
// Get entity by key (returns 0 if not found)
var entity = Get< LookupSystem >().GetKeyEntity( "PLAYER_SUBNET" );
```

Used by other systems (e.g., `PlayerSystem`) to find important entities without scanning components.

### TimeSystem

The `TimeSystem` manages game time. Each simulation tick advances the game clock by one second. The game starts on January 1st, 2111 at 00:00:00 PST (Pacific Standard Time).

**Key Entity**: `GAME_CLOCK` - The entity with the `GameClock` component storing current time.

**Components**:
- `GameClock`: Stores `currentTime` as a Unix timestamp
- `Uptime`: Stores `startTime` - when a server came online

**Endpoint**: `uptime` (GET) - Returns server uptime for entities with the `Uptime` component:
```json
{
  "uptime": "2d 5h 30m 15s",
  "uptimeSeconds": 192615,
  "startTime": "2111-01-01 00:00:00"
}
```

### Player System

The `PlayerSystem` handles player management via the special `__player__` address:

1. **Login** (POST): Adds `LoggedIn`, `CanConnect`, `Online`, `Uptime` components, creates `About` and `NetAddress` if missing. Returns server info (About/WelcomeMessage) as if connecting to own server.
2. **Logout** (POST): Removes `LoggedIn` component, cleans up all active connections
3. **Create Player** (POST): Creates entity with `Player` and `Name` components

All `/net/:endpoint` and `/net/remote/:address/:endpoint` requests require:
- Valid API key in `Authorization: Bearer <key>` header
- Player must be logged in (have `LoggedIn` component)

### Connection System

The `ConnectionSystem` manages server-to-server connections. Players must connect to remote servers before accessing endpoints on them.

**Components**:
- `CanConnect`: Enables connection capability with `maxConnections` limit (default: 3)
- `ServerConnection`: Relation entity representing an active connection (source -> target)
- `WelcomeMessage`: Optional message displayed when connecting to a server

**Endpoint** (available on entities with `CanConnect`):
The `connections` endpoint supports multiple HTTP methods:
- `GET /net/connections`: Lists all active connections with count, max, and server details
- `POST /net/connections`: Establishes connection to target address. Body: `{"address": "xx-xxxx"}`
- `DELETE /net/connections`: Closes all active connections
- `DELETE /net/connections/:address`: Closes connection to specific address

**Access Control**:
- Local endpoints (`/net/:endpoint`) always allowed
- Remote endpoints (`/net/remote/:address/:endpoint`) require active `ServerConnection` to target

## Subnet System

### NetAddress Format

Net addresses are 8-character strings: `XXX-XXXX`
- Position 0-1: Subnet identifier (e.g., "aa")
- Position 2: Random character (0-9, a-z)
- Position 3: Dash
- Position 4-7: 4 random characters (0-9, a-z)

Example: `aaw-k8bc`, `9s5-xyz1`

### SubNetProvider

Subnet providers programmatically create and manage NetAddresses for servers:

```csharp
// Create a subnet provider (address will be "aa0-0000")
var subNet = subNetSystem.CreateSubNetProvider( "aa", "Main SubNet" );

// Assign a random address to a server (e.g., "aaw-k8bc")
subNetSystem.AssignAddress( subNet, serverEntity );
```

The `InSubNet` relation links servers to their subnet provider.

## World Components (Transportation Layer)

The city's physical structure is modeled using components in `ECS/Components/World/`:

### Spatial Hierarchy

```
District
    └── contains (via InDistrict relation)
        ├── Junctions (points in space)
        ├── Roads (logical groupings)
        │   └── RoadSegments (Relation to Road, connects two Junctions)
        └── Lots (locations for buildings/vehicles)
```

Note: `RoadSegment` extends `Relation` - its inherited `relation` field points to the parent `Road`.

### Location Component

The `Location` component allows entities to exist somewhere in the city:

```csharp
public class Location : Component
{
    // Option A: On a road segment
    public long? roadSegment;  // entity ID
    public float? position;    // 0.0 (start) to 1.0 (end)

    // Option B: At a lot
    public long? lot;          // entity ID
}
```

Used by: `Vehicle`, `Lot` (for road access point)

## Directory Structure

```
net-city/
├── simulation/
│   └── src/
│       ├── NetCity.Simulation/
│       │   ├── ECS/
│       │   │   ├── Components/     # Name, NetAddress, Online
│       │   │   ├── Systems/        # Command, Ping, NetAddress, Request
│       │   │   ├── Services/       # IApiService, PostgresApiStore
│       │   │   └── [Core files]    # World, Component, Filter, etc.
│       │   └── Database/           # Postgres stores
│       ├── NetCity.Runner/         # Main simulation executable
│       └── NetCity.Setup/          # Database setup utility
├── api/
│   └── src/
│       ├── index.ts                # Hono HTTP server (entry point)
│       ├── db.ts                   # Shared database pool
│       ├── routes/
│       │   └── admin/
│       │       ├── map.ts          # City visualizer endpoint
│       │       ├── mapData.ts      # City data JSON endpoint
│       │       └── players.ts      # Player management endpoints
│       └── types/
│           └── map.ts              # TypeScript interfaces
├── database/
│   └── migrations/                 # SQL schema files
└── docker-compose.yml              # PostgreSQL container
```

## Configuration

### Database Connection

```
Host=localhost;Port=5433;Database=netcity;Username=netcity;Password=netcity
```

### Docker Compose

PostgreSQL 16 runs in a container:
- External port: 5433
- Internal port: 5432
- Persistent volume: `postgres_data`
