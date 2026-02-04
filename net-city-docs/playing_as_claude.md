# Playing as Claude

Instructions for Claude to play Net City and test new features.

## Your Credentials

After running the setup routine, you have a player account:

- **Name**: Claude
- **API Key**: `nc_claude_1KQ5FA495HIVZID7BA90TV5PP22YKKQI0ZW1CTOWK53ZJM44EIXP12U`

## Base URL

All API requests go to: `http://localhost:3000`

## How to Play

Use the Bash tool with `curl` to make HTTP requests to the game API. Always include your API key in the Authorization header.

### Step 1: Login

Before you can do anything, you must login:

```bash
curl -X POST http://localhost:3000/login \
  -H "Authorization: Bearer nc_claude_1KQ5FA495HIVZID7BA90TV5PP22YKKQI0ZW1CTOWK53ZJM44EIXP12U"
```

On success, you'll receive your network address (something like `p0x-xxxx`) and info about your rig.

### Step 2: Explore Your Rig

Once logged in, you can access your local server endpoints:

```bash
# List available endpoints on your rig
curl http://localhost:3000/net/endpoints \
  -H "Authorization: Bearer nc_claude_1KQ5FA495HIVZID7BA90TV5PP22YKKQI0ZW1CTOWK53ZJM44EIXP12U"

# Check your status (ping yourself)
curl http://localhost:3000/net/status \
  -H "Authorization: Bearer nc_claude_1KQ5FA495HIVZID7BA90TV5PP22YKKQI0ZW1CTOWK53ZJM44EIXP12U"

# View your active connections
curl http://localhost:3000/net/connections \
  -H "Authorization: Bearer nc_claude_1KQ5FA495HIVZID7BA90TV5PP22YKKQI0ZW1CTOWK53ZJM44EIXP12U"
```

### Step 3: Connect to Remote Servers

To access other servers in the city, you must first establish a connection:

```bash
# Connect to a server (replace xx0-0000 with actual address)
curl -X POST http://localhost:3000/net/connections \
  -H "Authorization: Bearer nc_claude_1KQ5FA495HIVZID7BA90TV5PP22YKKQI0ZW1CTOWK53ZJM44EIXP12U" \
  -H "Content-Type: application/json" \
  -d '{"address": "xx0-0000"}'
```

You can have up to 3 active connections at a time.

### Step 4: Explore Remote Servers

Once connected, access endpoints on remote servers:

```bash
# Check remote server status
curl http://localhost:3000/net/remote/xx0-0000/status \
  -H "Authorization: Bearer nc_claude_1KQ5FA495HIVZID7BA90TV5PP22YKKQI0ZW1CTOWK53ZJM44EIXP12U"

# List remote server endpoints
curl http://localhost:3000/net/remote/xx0-0000/endpoints \
  -H "Authorization: Bearer nc_claude_1KQ5FA495HIVZID7BA90TV5PP22YKKQI0ZW1CTOWK53ZJM44EIXP12U"

# Get remote server location (if it has GPS)
curl http://localhost:3000/net/remote/xx0-0000/location \
  -H "Authorization: Bearer nc_claude_1KQ5FA495HIVZID7BA90TV5PP22YKKQI0ZW1CTOWK53ZJM44EIXP12U"
```

### Step 5: Disconnect and Logout

```bash
# Disconnect from a specific server
curl -X DELETE http://localhost:3000/net/connections/xx0-0000 \
  -H "Authorization: Bearer nc_claude_1KQ5FA495HIVZID7BA90TV5PP22YKKQI0ZW1CTOWK53ZJM44EIXP12U"

# Disconnect from all servers
curl -X DELETE http://localhost:3000/net/connections \
  -H "Authorization: Bearer nc_claude_1KQ5FA495HIVZID7BA90TV5PP22YKKQI0ZW1CTOWK53ZJM44EIXP12U"

# Logout (also closes all connections)
curl -X POST http://localhost:3000/logout \
  -H "Authorization: Bearer nc_claude_1KQ5FA495HIVZID7BA90TV5PP22YKKQI0ZW1CTOWK53ZJM44EIXP12U"
```

## Known Servers

After setup, these servers exist in the city:

| Address | Type | Description |
|---------|------|-------------|
| `aa0-0000` | SubNet Provider | Main SubNet Provider |
| `p00-0000` | SubNet Provider | Player SubNet Provider |
| `aa*-****` | Server | Example Server (exact address assigned at setup) |
| `aa*-****` | Vehicle | Vehicle Alpha - has GPS |

To discover server addresses, connect to a subnet provider and list its clients:

```bash
# Connect to main subnet
curl -X POST http://localhost:3000/net/connections \
  -H "Authorization: Bearer nc_claude_1KQ5FA495HIVZID7BA90TV5PP22YKKQI0ZW1CTOWK53ZJM44EIXP12U" \
  -H "Content-Type: application/json" \
  -d '{"address": "aa0-0000"}'

# List all servers in main subnet
curl http://localhost:3000/net/remote/aa0-0000/clients \
  -H "Authorization: Bearer nc_claude_1KQ5FA495HIVZID7BA90TV5PP22YKKQI0ZW1CTOWK53ZJM44EIXP12U"
```

## Admin Endpoints (No Auth Required)

These endpoints don't require login:

```bash
# Health check
curl http://localhost:3000/health

# List all players
curl http://localhost:3000/admin/players

# Get city map data (JSON)
curl http://localhost:3000/admin/map/data
```

The city map visualizer is available at `http://localhost:3000/admin/map` (browser only).

## Testing New Features

When testing a new feature:

1. **Login first** - Most features require authentication
2. **Check endpoints** - Use `/net/endpoints` to see what's available
3. **Explore the world** - Connect to subnet providers to discover servers
4. **Test the feature** - Exercise the new functionality
5. **Verify state** - Check that changes persist correctly
6. **Logout when done** - Clean up your session

## Common Errors

| Error | Meaning |
|-------|---------|
| `401 Unauthorized` | Missing or invalid API key |
| `400 Not logged in` | Need to login first |
| `403 Not connected` | Need to connect to remote server first |
| `404 Not found` | Server address doesn't exist |
| `504 Timeout` | Simulation server not running |

## Quick Reference

```bash
# Set your API key as a variable for convenience
export CLAUDE_KEY="nc_claude_1KQ5FA495HIVZID7BA90TV5PP22YKKQI0ZW1CTOWK53ZJM44EIXP12U"

# Then use it in requests
curl -X POST http://localhost:3000/login -H "Authorization: Bearer $CLAUDE_KEY"
curl http://localhost:3000/net/endpoints -H "Authorization: Bearer $CLAUDE_KEY"
```
