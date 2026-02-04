# Project Spec

## Game Premise

Net City is an online, persistent game where the **primary player interface is an API**. Players do not control avatars directly; instead, they interact with a simulated cyberpunk city by sending HTTP requests to in-fiction servers that exist inside the world.

### Core Concept

- Every "endpoint" is a server inside the city
- Servers have fictional network addresses (e.g., `pl0-dfd3`)
- City Hall, banks, cars, factories—all are servers
- API responses are diegetic: the data is "what the server knows"
- The city runs continuously, whether or not players are interacting

### Player Actions

Players:
- Query city infrastructure (roads, districts, markets, banks, vehicles)
- Access endpoints on agents and machines (cars, couriers, factories)
- Move goods between districts to exploit price differences
- Accumulate money and influence through logistics, trade, and control

## Design Philosophy

### Data-Driven Over Object-Driven

The simulation is structured as an ECS where behavior emerges from component composition rather than class hierarchies.

### Persistence Over In-Memory Cleverness

PostgreSQL is the single source of truth. The simulation can restart without losing state.

### ECS Systems Define Capabilities

Server endpoints are derived from entity components, not hardcoded routes:
- Entity with `Vehicle` component → `travel`, `location` endpoints
- Entity with `Bank` component → `balance`, `transfer` endpoints

### APIs Are Fictionally Real

The HTTP API is not a meta-interface—it's a diegetic part of the game world. Players are hackers/operators interacting with city infrastructure.

### Complexity Emerges From Interaction

Simple systems combine to create emergent behavior. The game is not UI-driven.

## Servers as Gameplay Objects

A key design idea: **servers are gameplay objects**.

| Server Type | Example Endpoints |
|-------------|-------------------|
| City Hall | `districts`, `roads`, `lots` |
| Car | `location`, `travel` |
| Bank | `balance`, `transfer` |
| Factory | `production`, `status` |

Every server exposes:
- An `endpoints` endpoint listing available endpoints
- Endpoint availability based on its components
- Responses as in-world data

## Planned Features

### City Infrastructure

- **Districts**: Named areas of the city with distinct characteristics
- **Roads**: Connections between districts with travel times
- **Lots**: Specific locations within districts (buildable/ownable)

### Vehicles

- **Cars**: Player-controllable transport
- **Movement**: Pathfinding along road network
- **Travel Time**: Based on road distance/traffic

### Economy

- **Markets**: Buy/sell goods at district-specific prices
- **Supply/Demand**: Prices fluctuate based on consumption
- **Goods**: Physical items that must be transported
- **Arbitrage**: Profit from price differences between districts

### Banking

- **Accounts**: Player balances stored on bank servers
- **Transfers**: Move money between accounts
- **Transaction History**: Auditable records

### Manufacturing

- **Factories**: Convert input goods to output goods
- **Production Time**: Jobs run over multiple ticks
- **Recipes**: Defined input/output ratios

### Agents (Future)

- **NPCs**: Autonomous actors with goals
- **Couriers**: Deliver goods on behalf of players
- **Traders**: Compete with players in markets

### Access Control (Future)

- **API Keys**: Player authentication
- **Server Permissions**: Public vs private servers
- **Ownership**: Players can own/control entities

## Technical Requirements

### Performance

- Simulation tick: ~1 second
- API response timeout: 5 seconds
- Database should handle concurrent queries efficiently

### Persistence

- All game state in PostgreSQL
- Hot restart without state loss
- Component data stored as JSONB for flexibility

### Scalability

- API and simulation are separate processes
- Database-mediated communication enables distribution
- Component tables created dynamically

## Aesthetic Guidelines

### Cyberpunk Flavor

- Network addresses are random, but easy to type (`bd3-4f51`)
- Servers have names that fit the fiction
- Responses should incorperate worldbuilding when possible

### Minimal UI

- The terminal/API IS the interface
- No graphical client required
- Data presentation is raw/authentic
