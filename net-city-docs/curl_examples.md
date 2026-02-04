# Curl Examples

Example curl commands for interacting with the Net City API.

All examples assume the API is running at `http://localhost:3000`.

## Authentication

Replace `nc_your_api_key_here` with your actual API key in all examples.

### Login

```bash
curl -X POST http://localhost:3000/login \
  -H "Authorization: Bearer nc_your_api_key_here"
```

### Logout

```bash
curl -X POST http://localhost:3000/logout \
  -H "Authorization: Bearer nc_your_api_key_here"
```

## Local Endpoints

Access endpoints on your own server (requires login).

### Check Status (Ping)

```bash
curl http://localhost:3000/net/status \
  -H "Authorization: Bearer nc_your_api_key_here"
```

### List Available Endpoints

```bash
curl http://localhost:3000/net/endpoints \
  -H "Authorization: Bearer nc_your_api_key_here"
```

### Get Your Location

```bash
curl http://localhost:3000/net/location \
  -H "Authorization: Bearer nc_your_api_key_here"
```

### List Active Connections

```bash
curl http://localhost:3000/net/connections \
  -H "Authorization: Bearer nc_your_api_key_here"
```

### Connect to a Remote Server

```bash
curl -X POST http://localhost:3000/net/connections \
  -H "Authorization: Bearer nc_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"address": "xx0-0000"}'
```

### Disconnect from a Specific Server

```bash
curl -X DELETE http://localhost:3000/net/connections/xx0-0000 \
  -H "Authorization: Bearer nc_your_api_key_here"
```

### Disconnect from All Servers

```bash
curl -X DELETE http://localhost:3000/net/connections \
  -H "Authorization: Bearer nc_your_api_key_here"
```

## Remote Endpoints

Access endpoints on other servers (requires active connection to target).

### Check Remote Server Status

```bash
curl http://localhost:3000/net/remote/xx0-0000/status \
  -H "Authorization: Bearer nc_your_api_key_here"
```

### List Remote Server Endpoints

```bash
curl http://localhost:3000/net/remote/xx0-0000/endpoints \
  -H "Authorization: Bearer nc_your_api_key_here"
```

### Get Remote Server Location

```bash
curl http://localhost:3000/net/remote/xx0-0000/location \
  -H "Authorization: Bearer nc_your_api_key_here"
```

## Subnet Endpoints

SubNet providers have additional endpoints.

### List All Servers in a Subnet

```bash
curl http://localhost:3000/net/remote/pl0-0000/clients \
  -H "Authorization: Bearer nc_your_api_key_here"
```

## Admin Endpoints

These endpoints do not require authentication.

### Create a New Player

```bash
curl -X POST http://localhost:3000/admin/players \
  -H "Content-Type: application/json" \
  -d '{"name": "NewPlayer"}'
```

Response includes the API key:
```json
{
  "id": 1,
  "name": "NewPlayer",
  "api_key": "nc_abc123..."
}
```

### List All Players

```bash
curl http://localhost:3000/admin/players
```

### Health Check

```bash
curl http://localhost:3000/health
```

### Get City Map Data (JSON)

```bash
curl http://localhost:3000/admin/map/data
```

### View City Map (HTML)

Open in browser: `http://localhost:3000/admin/map`

## Quick Start Workflow

1. Create a player account:
```bash
curl -X POST http://localhost:3000/admin/players \
  -H "Content-Type: application/json" \
  -d '{"name": "Hacker1"}'
```

2. Login with your API key (from step 1):
```bash
curl -X POST http://localhost:3000/login \
  -H "Authorization: Bearer nc_your_api_key_here"
```

3. Check your available endpoints:
```bash
curl http://localhost:3000/net/endpoints \
  -H "Authorization: Bearer nc_your_api_key_here"
```

4. Connect to a remote server:
```bash
curl -X POST http://localhost:3000/net/connections \
  -H "Authorization: Bearer nc_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"address": "pl0-0000"}'
```

5. Explore the remote server:
```bash
curl http://localhost:3000/net/remote/pl0-0000/endpoints \
  -H "Authorization: Bearer nc_your_api_key_here"
```

6. Logout when done:
```bash
curl -X POST http://localhost:3000/logout \
  -H "Authorization: Bearer nc_your_api_key_here"
```
