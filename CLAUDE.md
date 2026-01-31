# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Base Ball is a browser-based RTS multiplayer game designed for real-time two-player matches. Players will build bases, recruit units, and try to move a giant ball into the oponent's goal.

## Commands

- **Start server:** `npm start` (runs on port 3000)

No test framework, linting, or build tools are currently configured.

## Architecture

Browser-based multiplayer game using Express and Socket.io for real-time communication.

### Structure

```
server/           # Node.js backend
  index.js        # Express + Socket.io server setup
  handlers/       # Socket event handlers (room management, matchmaking)
public/           # Frontend (served as static files)
  js/network.js   # Socket.io client wrapper (NetworkClient class)
  js/lobby.js     # Lobby UI logic
  js/game.js      # Game client (canvas-based, stub implementation)
shared/           # Code shared between client and server
  constants.js    # TICK_RATE, MAX_PLAYERS_PER_ROOM, DEFAULT_PORT
```

### Key Patterns

- **State management:** In-memory Maps on server (`rooms`, `players`, `waitingQueue`)
- **Matchmaking:** Three modes - create room, join by ID, quick match (auto-pairing queue)
- **Client-server flow:** Lobby page handles matchmaking, then redirects to game page with session data in sessionStorage
- **Shared code:** `shared/constants.js` uses UMD pattern for Node.js and browser compatibility

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