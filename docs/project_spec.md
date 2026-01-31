# Project Specification

## Overview

Base Ball is a browser-based RTS multiplayer game designed for real-time two-player matches. Players connect through a web browser, find opponents through a lobby system, and compete in synchronized gameplay.

## Core Features

### Matchmaking System

Players have three ways to find opponents:

1. **Create Room** - Host creates a private room and shares the 6-character room code with a friend
2. **Join Room** - Enter a room code to join an existing game
3. **Quick Match** - Automatic matchmaking that pairs players from a waiting queue

### Game Flow

1. Player enters their name on the lobby page
2. Player selects a matchmaking option
3. Once two players are in a room, both see a "Start Game" button
4. Clicking start redirects to the game page where the match takes place

### Technical Requirements

- Two players per match (enforced by MAX_PLAYERS_PER_ROOM constant)
- 60 FPS target frame rate (TICK_RATE constant)
- Real-time synchronization between players via WebSockets
- No account system - players set a display name per session