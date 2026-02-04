# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Base Ball is a browser-based RTS multiplayer game designed for real-time two-player matches. Players will build bases, recruit units, and try to move a giant ball into the oponent's goal.

## Commands

- **Start server:** `dotnet run --project server` (runs on port 3000)

No test framework or linting currently configured.

## Architecture

Browser-based multiplayer game using ASP.NET Core and SignalR for real-time communication.

### Structure

```
server/           # C# ASP.NET Core backend
  Program.cs      # Server entry point, /api/config endpoint
  Setup/          # GameConstants.cs, EntityDefinitions.cs (source of truth)
  Hubs/           # SignalR hubs for real-time communication
  Rooms/          # Game room and matchmaking logic
public/           # Frontend (served as static files)
  js/config.js    # Fetches game constants from /api/config
  js/ui-constants.js # Client-only UI constants (camera, colors)
  js/network.js   # SignalR client wrapper (NetworkClient class)
  js/lobby.js     # Lobby UI logic
  js/game.js      # Game client (canvas-based)
```

### Key Patterns

- **Configuration:** Game constants defined in C# (`GameConstants.cs`, `EntityDefinitions.cs`), served via `/api/config`, fetched by client at startup
- **State management:** In-memory dictionaries on server for rooms, players, matchmaking queue
- **Matchmaking:** Three modes - create room, join by ID, quick match (auto-pairing queue)
- **Client-server flow:** Lobby page handles matchmaking, then redirects to game page with session data in sessionStorage

### Git
You can read from git, but never commit or make changes to the git state.

### Github
This project is `AsherVo/base-ball` in Github

### Key Documentation
- [Project Spec](docs/project_spec.md) - Full requirements, API specs, technical details
- [Architecture](docs/architecture.md) - Codebase layout, system design and data flow
- [Project Status](docs/project_status.md) - Current progress

Update files in the docs folder after major milestones and major additions to the codebase

### Save Tokens
Read the architecture doc before exploring the database.