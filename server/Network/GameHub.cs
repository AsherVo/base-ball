using Microsoft.AspNetCore.SignalR;
using server.Rooms;
using server.Rooms.Matchmaking;

namespace server.Network;

/// <summary>
/// SignalR hub for game communication.
/// Handles lobby, matchmaking, and in-game commands.
/// </summary>
public class GameHub : Hub
{
    private readonly RoomManager _roomManager;
    private readonly MatchmakingService _matchmaking;

    public GameHub(RoomManager roomManager, MatchmakingService matchmaking)
    {
        _roomManager = roomManager;
        _matchmaking = matchmaking;
    }

    public override async Task OnConnectedAsync()
    {
        await base.OnConnectedAsync();
        Console.WriteLine($"Client connected: {Context.ConnectionId}");
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        Console.WriteLine($"Client disconnected: {Context.ConnectionId}");

        // Clean up matchmaking queue
        _matchmaking.HandleDisconnect(Context.ConnectionId);

        // Clean up room
        await _roomManager.HandleDisconnect(Context.ConnectionId);

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Set the player's display name.
    /// </summary>
    public Task SetName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            name = "Player";

        // Sanitize and limit name length
        name = name.Trim();
        if (name.Length > 20)
            name = name[..20];

        _roomManager.SetPlayerName(Context.ConnectionId, name);
        return Task.CompletedTask;
    }

    /// <summary>
    /// Create a new game room.
    /// </summary>
    public async Task CreateRoom()
    {
        var room = await _roomManager.CreateRoom(Context.ConnectionId);
        if (room == null)
        {
            await Clients.Caller.SendAsync("error", new { message = "Failed to create room. You may already be in a room." });
            return;
        }

        var roomInfo = room.GetRoomInfo();
        // Add the player's own ID to the response
        roomInfo["playerId"] = Context.ConnectionId;
        Console.WriteLine($"Room created: {System.Text.Json.JsonSerializer.Serialize(roomInfo)}");
        await Clients.Caller.SendAsync("roomCreated", roomInfo);
        // Also send roomJoined so client enters the room view
        await Clients.Caller.SendAsync("roomJoined", roomInfo);
    }

    /// <summary>
    /// Create a room with an AI opponent for single player.
    /// </summary>
    public async Task CreateRoomWithAI(object options)
    {
        var aiType = "normal";

        // Parse AI type from options if provided
        if (options is System.Text.Json.JsonElement jsonElement)
        {
            if (jsonElement.TryGetProperty("aiType", out var aiTypeProp))
            {
                aiType = aiTypeProp.GetString() ?? "normal";
            }
        }

        var room = await _roomManager.CreateRoomWithAI(Context.ConnectionId, aiType);
        if (room == null)
        {
            await Clients.Caller.SendAsync("error", new { message = "Failed to create room with AI." });
            return;
        }

        await Clients.Caller.SendAsync("roomCreated", room.GetRoomInfo());
        // Also send roomJoined so client enters the room view
        await Clients.Caller.SendAsync("roomJoined", room.GetRoomInfo());

        // AI is already added and ready, so notify match ready with players list
        await Clients.Caller.SendAsync("matchReady", room.GetRoomInfo());
    }

    /// <summary>
    /// Join an existing room by ID.
    /// </summary>
    public async Task JoinRoom(string roomId)
    {
        if (string.IsNullOrWhiteSpace(roomId))
        {
            await Clients.Caller.SendAsync("error", new { message = "Invalid room ID." });
            return;
        }

        roomId = roomId.Trim().ToUpperInvariant();
        var room = await _roomManager.JoinRoom(Context.ConnectionId, roomId);

        if (room == null)
        {
            await Clients.Caller.SendAsync("error", new { message = "Room not found or is full." });
            return;
        }

        // Notify the joining player
        var roomInfo = room.GetRoomInfo();
        roomInfo["playerId"] = Context.ConnectionId;
        await Clients.Caller.SendAsync("roomJoined", roomInfo);

        // Notify other players in the room - client expects { player: { id, name, ... } }
        var joiningPlayer = room.Players.First(p => p.ConnectionId == Context.ConnectionId);
        await Clients.OthersInGroup(roomId).SendAsync("playerJoined", new
        {
            player = new
            {
                id = joiningPlayer.ConnectionId,
                name = joiningPlayer.Name,
                playerIndex = joiningPlayer.PlayerIndex,
                isReady = joiningPlayer.IsReady
            }
        });

        // If room is now full, notify match ready with full room info (client needs players list)
        if (room.IsFull)
        {
            await Clients.Group(roomId).SendAsync("matchReady", room.GetRoomInfo());
        }
    }

    /// <summary>
    /// Leave the current room.
    /// </summary>
    public async Task LeaveRoom()
    {
        // Also leave matchmaking queue
        _matchmaking.LeaveQueue(Context.ConnectionId);

        await _roomManager.LeaveRoom(Context.ConnectionId);
    }

    /// <summary>
    /// Enter the quick match queue for automatic pairing.
    /// </summary>
    public async Task QuickMatch()
    {
        var success = await _matchmaking.JoinQueue(Context.ConnectionId);
        if (!success)
        {
            await Clients.Caller.SendAsync("error", new { message = "Already in queue or in a room." });
        }
    }

    /// <summary>
    /// Toggle the player's ready state.
    /// </summary>
    public async Task PlayerReady()
    {
        var room = _roomManager.GetPlayerRoom(Context.ConnectionId);
        if (room == null)
        {
            await Clients.Caller.SendAsync("error", new { message = "Not in a room." });
            return;
        }

        await room.SetPlayerReady(Context.ConnectionId);
    }

    /// <summary>
    /// Send a player command during the game.
    /// </summary>
    public Task PlayerCommand(object command)
    {
        var room = _roomManager.GetPlayerRoom(Context.ConnectionId);
        room?.QueueCommand(Context.ConnectionId, command);
        return Task.CompletedTask;
    }

    /// <summary>
    /// Rejoin an active game after page navigation/reconnection.
    /// </summary>
    public async Task RejoinGame(string roomId, string playerName)
    {
        if (string.IsNullOrWhiteSpace(roomId))
        {
            await Clients.Caller.SendAsync("error", new { message = "Invalid room ID." });
            return;
        }

        roomId = roomId.Trim().ToUpperInvariant();
        var result = await _roomManager.RejoinGame(Context.ConnectionId, roomId, playerName);

        if (result == null)
        {
            await Clients.Caller.SendAsync("error", new { message = "Could not rejoin game. Room not found or game not active." });
            return;
        }

        // Send gameStart event with current state
        await Clients.Caller.SendAsync("gameStart", result);
        Console.WriteLine($"Player {playerName} rejoined room {roomId} with new connection {Context.ConnectionId}");
    }
}
