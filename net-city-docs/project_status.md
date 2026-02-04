# Project Status

Current progress

## Important note

At this early stage of development, we will be clearing the database almost every run, so there is no need to create migration files. Update the `Setup` C# project instead.

## Completed Features

### Core ECS Framework

| Feature | Status | Notes |
|---------|--------|-------|
| Entity creation/destruction | Done | Via `PostgresEntityStore` |
| Component CRUD | Done | JSONB storage with auto-table creation |
| System lifecycle | Done | `StartSystem`, `StopSystem`, `TickSystem` |
| Service lifecycle | Done | `Start`, `Stop` |
| Filter system | Done | Include/Exclude/Relations with callbacks |
| Message queue | Done | Current/old tick isolation |
| WorldManipulator base class | Done | Helper methods for systems |
| Relations | Done | Entity-to-entity relationships |

### Database Integration

| Feature | Status | Notes |
|---------|--------|-------|
| PostgreSQL connection | Done | Via Npgsql |
| Entity storage | Done | `entities` table |
| Component storage | Done | Dynamic `component_*` tables |
| API request/response tables | Done | Database-mediated communication |
| Key entity lookup table | Done | `key_entities` for named entity references |
| Migrations | Done | 2 migration files |
| Docker setup | Done | PostgreSQL 16 container |

### Server Command System

| Feature | Status | Notes |
|---------|--------|-------|
| CommandSystem dispatcher | Done | Routes requests to IServerSystem handlers |
| IServerSystem interface | Done | `GetCommands`, `HandleRequest` |
| NetAddressSystem | Done | Address-to-entity lookup |
| LookupSystem | Done | Key-to-entity lookup via `key_entities` table |
| RequestSystem | Done | Cleanup for unprocessed requests |
| SubNetSystem | Done | Subnet providers and address generation |
| ConnectionSystem | Done | Server connections with connect/disconnect commands |
| TimeSystem | Done | Game clock management and `/uptime` endpoint |

### Implemented Endpoints

| Endpoint | System | Status |
|---------|--------|--------|
| `status` | OnlineSystem | Done |
| `endpoints` | EndpointSystem | Done |
| `clients` | SubNetSystem | Done |
| `login` | PlayerSystem | Done |
| `logout` | PlayerSystem | Done |
| `create_player` | PlayerSystem | Done |
| `connections` | ConnectionSystem | Done |
| `location` | GPSSystem | Done |
| `uptime` | TimeSystem | Done |

### Components

| Component | Purpose | Status |
|-----------|---------|--------|
| `Name` | Entity name identifier | Done |
| `NetAddress` | In-fiction network address | Done |
| `Online` | Marker for server being online | Done |
| `About` | Player-visible name and details | Done |
| `District` | Marker for district entities | Done |
| `InDistrict` | Relation linking entity to district | Done |
| `Junction` | Point in space where roads connect (x,y,z) | Done |
| `Road` | Marker for road entities | Done |
| `RoadSegment` | Relation connecting two junctions, points to parent Road | Done |
| `Lot` | Location where buildings/vehicles exist (x,y,z) | Done |
| `Location` | Position on road segment or at lot | Done |
| `Vehicle` | Marker for vehicle entities | Done |
| `Player` | Links entity to player account (playerId) | Done |
| `LoggedIn` | Marker for currently logged-in players | Done |
| `SubNetProvider` | Subnet identifier for address generation | Done |
| `InSubNet` | Relation linking server to subnet provider | Done |
| `CanConnect` | Allows server to establish connections (maxConnections) | Done |
| `ServerConnection` | Relation representing active connection (source -> target) | Done |
| `WelcomeMessage` | Message displayed when connecting to server | Done |
| `GameClock` | Stores current game time (Unix timestamp) | Done |
| `Uptime` | Stores server start time for uptime tracking | Done |

### API Layer

| Feature | Status | Notes |
|---------|--------|-------|
| Hono HTTP server | Done | TypeScript |
| `GET /net/:command` | Done | Local player server endpoint |
| `POST /net/:command` | Done | Local command with request body |
| `GET /net/remote/:address/:command` | Done | Remote server command endpoint |
| `GET /health` | Done | Health check |
| Request polling | Done | 5s timeout, 100ms interval |
| `GET /admin/map` | Done | City visualizer (Canvas-based) |
| `GET /admin/map/data` | Done | JSON data for visualizer |
| Modular route structure | Done | Routes in `routes/admin/` directory |
| `POST /admin/add_player` | Done | Create player with API key + entity |
| `GET /admin/players` | Done | List all players |
| `POST /login` | Done | Login player with API key |
| `POST /logout` | Done | Logout player |
| API key authentication | Done | Required for `/net` endpoints |

### Tooling

| Tool | Status | Notes |
|------|--------|-------|
| NetCity.Runner | Done | Main simulation loop (1 tick/sec) |
| NetCity.Setup | Done | Database reset + example entity |

## In Progress

Nothing currently in active development.

## Not Started

### City Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| Districts | Done | Named city areas with `District` + `About` components |
| Roads | Done | `Road` + `RoadSegment` + `Junction` components |
| Lots | Done | `Lot` + `Location` components |
| City Hall server | Not Started | Infrastructure queries |

### Vehicles

| Feature | Status | Notes |
|---------|--------|-------|
| Vehicle component | Done | Marker component with `Location` |
| Car entities | Done | MVP test vehicle in setup |
| Movement system | Not Started | Pathfinding along roads |
| Travel time calculation | Not Started | |

### Economy

| Feature | Status | Notes |
|---------|--------|-------|
| Market component | Not Started | |
| Price system | Not Started | Supply/demand |
| Goods/inventory | Not Started | |
| Trade commands | Not Started | |

### Banking

| Feature | Status | Notes |
|---------|--------|-------|
| Bank component | Not Started | |
| Account balances | Not Started | |
| Transfer command | Not Started | |
| Transaction history | Not Started | |

### Manufacturing

| Feature | Status | Notes |
|---------|--------|-------|
| Factory component | Not Started | |
| Production jobs | Not Started | Multi-tick processing |
| Recipe system | Not Started | Input/output definitions |

### Access Control

| Feature | Status | Notes |
|---------|--------|-------|
| Player accounts | Done | `players` table with API keys |
| Player entities | Done | `Player` component links to account |
| API key generation | Done | `nc_` prefix + 64 hex chars |
| API key authentication | Done | Validates keys on requests |
| Login/logout system | Done | `PlayerSystem` with `LoggedIn` component |
| Server permissions | Not Started | Public vs private |
| Entity ownership | Not Started | |

### Agents

| Feature | Status | Notes |
|---------|--------|-------|
| NPC behavior | Not Started | |
| Courier agents | Not Started | |
| Autonomous traders | Not Started | |

## Known Issues

None currently tracked.

## Recent Changes

See [change_log.md](change_log.md) for detailed history.

Summary of recent commits:
- **Issue #10**: Added server connection system - players must connect to remote servers before running commands. New components: `CanConnect`, `ServerConnection`, `WelcomeMessage`. New commands: `connect`, `disconnect`, `disconnect_all`. Login response now includes server About/WelcomeMessage info.
- **Issue #8**: Added `/net/:command` for local player server access and `/net/remote/:address/:command` for remote server access
- **Issue #9**: Added `LookupSystem` for key-to-entity lookup via `key_entities` table, refactored `PlayerSystem` to use it
- **Issue #6**: Added player login system with API key authentication, `POST /login` and `POST /logout` endpoints, `LoggedIn` component, and `PlayerSystem`
- **Issue #4**: Added SubNetProvider system for programmatic NetAddress generation with `list_clients` command
- **Player System**: Added player accounts with API key generation, `Player` component, and admin endpoints
- **Issue #3**: Added city map visualizer at `/admin/map` with Canvas rendering, mouseover tooltips, and 1-second auto-refresh
- Restructured API layer with modular route files (`routes/admin/`)
- **Issue #1**: Added transportation layer components (Districts, Roads, RoadSegments, Junctions, Lots, Vehicles, Location)
- Created MVP test data: District Alpha with crossing roads and a vehicle
- Established camelCase field naming convention for components
- Broke apart server system into several systems (CommandSystem, OnlineSystem, etc.)
- Added success parameter to API requests
- Converted API Store to Service pattern
- Established C# code style conventions
