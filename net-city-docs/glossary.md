# Glossary

Project-specific terminology and concepts.

## Game World Terms

### Server

In this game, a **server** is not a physical computer but a fictional network node within the city. Almost anything can be a server: City Hall, a bank, a factory, a vehicle, or a player's personal rig. Servers are identified by their **NetAddress** and can respond to **endpoints**.

Technically, a server is any entity with a `NetAddress` component.

### Rig

A **rig** is the player's personal server/computer in the game fiction. When a player logs in, their entity becomes a server on the network with its own NetAddress. The rig is the player's entry point into the city's network.

### NetAddress

A **NetAddress** is an 8-character fictional network address in the format `XXX-XXXX` (e.g., `aa0-0000`, `p4w-k8bc`). The first two characters identify the subnet, followed by a random character, a dash, and four more random characters.

- Subnet provider addresses use the reserved format `[identifier]0-0000`
- Player addresses are assigned from the player subnet (typically `p0` prefix)

### SubNet

A **subnet** is a logical grouping of servers sharing a common address prefix. Each subnet has a **SubNetProvider** that manages address assignment. Examples:
- `aa` - Main city subnet
- `p0` - Player subnet

### Connection

A **connection** is an active link between a player's server and a remote server. Players must establish connections before they can access endpoints on remote servers. Connections are tracked as separate entities with `ServerConnection` components.

- Players have a maximum number of simultaneous connections (default: 3)
- Connections are automatically cleaned up on logout
- Local endpoints (on the player's own rig) don't require connections

### Endpoint

An **endpoint** is a resource that can be accessed on a server. Endpoints are the primary way players interact with the game world. Different servers expose different endpoints based on their capabilities (components). The HTTP method determines the action:

- GET: Retrieve information
- POST: Create or execute an action
- DELETE: Remove a resource

Examples:
| Endpoint | Method | Description |
|----------|--------|-------------|
| `status` | GET | Basic connectivity check |
| `connections` | POST | Establish connection to a server |
| `connections` | GET | List active connections |
| `connections` | DELETE | Disconnect from a server |
| `clients` | GET | List servers in a subnet |
| `endpoints` | GET | List available endpoints on a server |
| `location` | GET | Get GPS coordinates |
| `uptime` | GET | Get server uptime |
| `time` | GET | Get current game time |
| `help` | GET | Get help about endpoints and connections |

### Local vs Remote

- **Local**: Refers to the player's own rig. Accessed via `/net/:endpoint`. Always available without needing a connection.
- **Remote**: Any other server on the network. Accessed via `/net/remote/:address/:endpoint`. Requires an active connection.

---

## Technical Terms (ECS)

### Entity

An **entity** is a unique identifier (a `long` integer) that represents something in the game world. Entities have no data themselves; all their properties come from attached components. An entity ID of `0` means "no entity" or "invalid."

Examples of entities: a player, a vehicle, a district, a road segment, a connection.

### Component

A **component** is a data container attached to an entity. Components define what an entity "is" or "has." An entity's behavior emerges from the combination of its components.

| Component | Makes an entity... |
|-----------|-------------------|
| `NetAddress` | ...addressable on the network |
| `Online` | ...online and able to respond to requests |
| `CanConnect` | ...able to establish connections |
| `Uptime` | ...able to report how long it's been running |
| `GameClock` | ...the source of game time |
| `Vehicle` | ...a vehicle |
| `Player` | ...linked to a player account |

### Relation

A **relation** is a special type of component that links one entity to another. The target entity ID is stored in the inherited `relation` field. Relations can have additional data fields.

Examples:
| Relation | Links... |
|----------|----------|
| `InDistrict` | Entity → District |
| `InSubNet` | Server → SubNetProvider |
| `ServerConnection` | Connection entity → Source server (with `target` field for destination) |

### System

A **system** contains logic that operates on entities with specific components. Systems run every simulation tick and can respond to API requests.

Examples: `OnlineSystem`, `ConnectionSystem`, `PlayerSystem`

### Filter

A **filter** tracks entities that match a specific pattern of components. Filters automatically update when components are added or removed, and can trigger callbacks.

```csharp
// Filter for all online servers
new FilterBuilder()
    .Include< NetAddress >()
    .Include< Online >()
    .ToFilter();
```

---

## API Terms

### API Key

A unique authentication token assigned to each player account. Format: `nc_` prefix followed by 64 hexadecimal characters. Required for all `/net` endpoints.

### Request/Response Cycle

1. Player sends HTTP request to API layer
2. API layer writes to `api_requests` table
3. Simulation reads request, processes it, writes to `api_responses` table
4. API layer polls for response, returns to player

This database-mediated approach decouples the API layer from the simulation.

---

## Address Formats

| Type | Format | Example |
|------|--------|---------|
| NetAddress | `XXX-XXXX` | `aa0-0000` |
| Local address | `__local__` | (player's own rig) |
| Player address | `__player__` | (special: login/logout) |
