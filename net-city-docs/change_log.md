# Change Log

This file lists all the major changes and updates that we've made to the project over time.

## 2025-01-26: OnlineSystem Refactor

Renamed `PingSystem` to `OnlineSystem` and `Pingable` component to `Online`. Added helper methods for managing server online status.

### Renamed Files

| Old | New |
|-----|-----|
| `PingSystem.cs` | `OnlineSystem.cs` |
| `Pingable.cs` | `Online.cs` |

### New Helper Methods

| Method | Description |
|--------|-------------|
| `OnlineSystem.GoOnline(entity, startTime?)` | Adds `Online` and `Uptime` components to bring a server online |
| `OnlineSystem.GoOffline(entity)` | Removes `Online` and `Uptime` components, disconnects all connections |

### Changes

- **OnlineSystem**: Now provides `GoOnline` and `GoOffline` helpers instead of just the `/status` endpoint
- **PlayerSystem**: Login calls `GoOnline()`, logout calls `GoOffline()` for cleaner lifecycle management
- **SubNetSystem**: `CreateSubNetProvider()` now calls `GoOnline()` instead of adding `Pingable`
- **Setup**: Uses `OnlineSystem.GoOnline(entity, gameStartTime)` for initial server setup

### Component Changes

| Old | New | Description |
|-----|-----|-------------|
| `Pingable` | `Online` | Marker for server being online and able to respond to requests |

---

## 2025-12-27: Issue #10 - Server Connections

Added a connection system requiring players to connect to remote servers before running commands on them.

### New Components

| Component | Location | Description |
|-----------|----------|-------------|
| `CanConnect` | `ECS/Components/Servers/CanConnect.cs` | Enables connection capability with `maxConnections` limit (default: 3) |
| `ServerConnection` | `ECS/Components/Servers/ServerConnection.cs` | Relation representing active connection (source → target) |
| `WelcomeMessage` | `ECS/Components/Servers/WelcomeMessage.cs` | Optional message displayed when connecting to a server |

### New System

| System | Description |
|--------|-------------|
| `ConnectionSystem` | Manages server connections with connect/disconnect commands |

### New Commands

| Command | System | Description |
|---------|--------|-------------|
| `connect` | ConnectionSystem | Connect to a remote server. Body: `{"address": "xx-xxxx"}` |
| `disconnect` | ConnectionSystem | Disconnect from a server. Body: `{"address": "xx-xxxx"}` (optional if only one connection) |
| `disconnect_all` | ConnectionSystem | Disconnect from all servers |
| `list_connections` | ConnectionSystem | List all active connections with count and max |

### Access Control Changes

- **Local commands** (`/net/:command`): Always allowed for logged-in players
- **Remote commands** (`/net/remote/:address/:command`): Now require an active `ServerConnection` to the target server
- Returns 403 "Not connected" error if player tries to run remote command without connection

### PlayerSystem Changes

- Login now adds `CanConnect` component (with `maxConnections: 3`) to player entity
- Login response includes server `About` info and `WelcomeMessage` (bonus feature - as if connecting to own server)
- Logout now cleans up all active connections and reports `connections_closed` count

### API Layer Changes

- Added `POST /net/:command` endpoint to support commands requiring request bodies (connect, disconnect)

### Usage Examples

```bash
# Connect to a server
curl -X POST http://localhost:3000/net/connect \
  -H "Authorization: Bearer nc_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"address": "aa0-0000"}'

# List active connections
curl http://localhost:3000/net/list_connections \
  -H "Authorization: Bearer nc_your_api_key"

# Run command on connected remote server
curl http://localhost:3000/net/remote/aa0-0000/ping \
  -H "Authorization: Bearer nc_your_api_key"

# Disconnect
curl -X POST http://localhost:3000/net/disconnect \
  -H "Authorization: Bearer nc_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"address": "aa0-0000"}'
```

### Response Examples

**Connect response:**
```json
{
  "message": "Connected",
  "server": {
    "address": "aa0-0000",
    "name": "Main SubNet Provider",
    "details": "The subnet provider for player connections"
  },
  "welcome": "Welcome to the network!"
}
```

**List connections response:**
```json
{
  "count": 2,
  "max": 3,
  "connections": [
    { "address": "aa0-0000", "name": "Main SubNet Provider" },
    { "address": "p00-0000", "name": "Player SubNet" }
  ]
}
```

---

## 2025-12-27: Issue #9 - LookupSystem

Added a system for looking up entities by key from the `key_entities` database table.

### New System

| System | Description |
|--------|-------------|
| `LookupSystem` | Provides `GetKeyEntity(string key)` method to find entities by key |

### Database Table

The `key_entities` table (created in Setup) stores named references to important entities:

```sql
CREATE TABLE key_entities (
    key VARCHAR(255) PRIMARY KEY,
    entity_id BIGINT NOT NULL REFERENCES entities(id)
);
```

### Usage

```csharp
// In any system, get an entity by its registered key
var playerSubnet = Get< LookupSystem >().GetKeyEntity( "PLAYER_SUBNET" );
```

### Changes

- Created `LookupSystem` in `ECS/Systems/LookupSystem.cs`
- Refactored `PlayerSystem.GetPlayerSubNetProvider()` to use `LookupSystem` instead of scanning SubNetProvider components
- Registered `LookupSystem` in `NetCity.Runner` (must be started before systems that depend on it)

---

## 2025-12-27: Issue #4 - SubNet Provider System

Added programmatic NetAddress generation through subnet providers.

### New Components

| Component | Location | Description |
|-----------|----------|-------------|
| `SubNetProvider` | `ECS/Components/Servers/SubNetProvider.cs` | Stores 2-char subnet identifier |
| `InSubNet` | `ECS/Components/Servers/SubNetProvider.cs` | Relation linking server to its subnet provider |

### New System

| System | Description |
|--------|-------------|
| `SubNetSystem` | Creates subnet providers and assigns random unique addresses |

### NetAddress Format

Addresses are 8 characters: `XXX-XXXX`
- Positions 0-1: Subnet identifier (e.g., "aa")
- Position 2: Random char (0-9, a-z)
- Position 3: Dash
- Positions 4-7: 4 random chars (0-9, a-z)

Subnet provider addresses use reserved format: `[identifier]0-0000` (e.g., `aa0-0000`)

### New Command

| Command | System | Description |
|---------|--------|-------------|
| `list_clients` | SubNetSystem | Lists all servers in the subnet with their addresses |

### Usage

```csharp
var subNetSystem = world.Get<SubNetSystem>();

// Create provider with address "aa0-0000"
var provider = subNetSystem.CreateSubNetProvider( "aa", "Main SubNet" );

// Assign random address like "aaw-k8bc" to a server
subNetSystem.AssignAddress( provider, serverEntity );
```

### Setup Changes

`NetCity.Setup` now creates a "Main SubNet Provider" (identifier "aa") and uses `SubNetSystem.AssignAddress()` instead of manual address assignment.

---

## 2025-12-27: Player System

Added the foundation for multiplayer support with player accounts and API keys.

### Database

- Added `players` table with `id`, `api_key`, `name`, `created_at`
- API keys use format: `nc_` prefix + 64 hex characters (cryptographically random)

### New Component

| Component | Location | Description |
|-----------|----------|-------------|
| `Player` | `ECS/Components/Player.cs` | Links entity to player account via `playerId` field |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/add_player` | POST | Create new player (body: `{"name": "..."}`) |
| `/admin/players` | GET | List all players (without API keys) |

### Player Creation Flow

When `POST /admin/add_player` is called:
1. Generate cryptographically random API key
2. Create `players` table row
3. Create `entities` table row (new entity)
4. Create `Player` component linking entity → player
5. Create `Name` component with player's name
6. Return player info including API key (shown only once)

---

## 2025-12-27: Issue #1 - Transportation Layer

Added the fundamental transportation layer components for the city simulation.

### New Components

Created in `ECS/Components/World/`:

| Component | Description |
|-----------|-------------|
| `About` | Player-visible `name` and `details` strings |
| `District` | Marker component for district entities |
| `InDistrict` | Relation linking entities to their district |
| `Junction` | Point in space (`x`, `y`, `z`) where roads connect |
| `Road` | Marker component for road entities |
| `RoadSegment` | Relation to parent Road, connects two junctions (`startJunction`, `endJunction`) |
| `Lot` | Physical location (`x`, `y`, `z`) for buildings/vehicles |
| `Location` | Either a position on a road segment OR a lot reference |
| `Vehicle` | Marker component for vehicle entities |

### Location Component Design

The `Location` component uses a union-style design:
- **On road**: `roadSegment` (entity ID) + `position` (0.0 to 1.0 along segment)
- **At lot**: `lot` (entity ID)

Static factory methods: `Location.OnRoad(segmentId, position)` and `Location.AtLot(lotId)`

### MVP Test Data

`NetCity.Setup` now creates District Alpha with:
- 5 junctions (center intersection + 4 endpoints)
- Road A (east-west): 2 segments
- Road B (north-south): 2 segments
- 4 lots at each road endpoint
- 1 test vehicle in the west lot

```
        North Lot
            |
       Junction North
            |
Junction West -- Junction Center -- Junction East
West Lot        |                    East Lot
           Junction South
                |
           South Lot
```

### Code Standards Update

Established camelCase convention for all component fields:
- `relation` (not `RelationId`)
- `startJunction` / `endJunction` (not `StartJunctionId` / `EndJunctionId`)
- `x`, `y`, `z` (not `X`, `Y`, `Z`)

Entity ID fields drop the "Id" suffix since the `long` type is sufficient.