using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using server.Network;

namespace server.Rooms;

/// <summary>
/// Manages game room lifecycle - creation, joining, leaving, and cleanup.
/// </summary>
public class RoomManager
{
    private readonly ConcurrentDictionary<string, GameRoom> _rooms = new();
    private readonly ConcurrentDictionary<string, string> _playerRooms = new();  // connectionId -> roomId
    private readonly ConcurrentDictionary<string, string> _playerNames = new();  // connectionId -> name
    private readonly IHubContext<GameHub> _hubContext;

    public RoomManager(IHubContext<GameHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public void SetPlayerName(string connectionId, string name)
    {
        _playerNames[connectionId] = name;
    }

    public string GetPlayerName(string connectionId)
    {
        return _playerNames.TryGetValue(connectionId, out var name) ? name : "Player";
    }

    public async Task<GameRoom?> CreateRoom(string creatorConnectionId)
    {
        // Check if player is already in a room
        if (_playerRooms.ContainsKey(creatorConnectionId))
            return null;

        var roomId = GenerateRoomId();
        var room = new GameRoom(roomId, _hubContext);

        if (!_rooms.TryAdd(roomId, room))
            return null;

        var playerName = GetPlayerName(creatorConnectionId);
        if (await room.AddPlayer(creatorConnectionId, playerName))
        {
            _playerRooms[creatorConnectionId] = roomId;
            Console.WriteLine($"Room {roomId} created by {playerName} ({creatorConnectionId})");
            return room;
        }

        _rooms.TryRemove(roomId, out _);
        return null;
    }

    public async Task<GameRoom?> CreateRoomWithAI(string creatorConnectionId, string aiType = "normal")
    {
        var room = await CreateRoom(creatorConnectionId);
        if (room == null)
            return null;

        // Add AI player
        var aiConnectionId = $"AI-{Guid.NewGuid():N}";
        await room.AddPlayer(aiConnectionId, "AI Opponent", isAI: true, aiType: aiType);

        return room;
    }

    public async Task<GameRoom?> JoinRoom(string connectionId, string roomId)
    {
        // Check if player is already in a room
        if (_playerRooms.ContainsKey(connectionId))
        {
            Console.WriteLine($"JoinRoom failed: Player {connectionId} already in room {_playerRooms[connectionId]}");
            return null;
        }

        if (!_rooms.TryGetValue(roomId, out var room))
        {
            Console.WriteLine($"JoinRoom failed: Room {roomId} not found. Available rooms: {string.Join(", ", _rooms.Keys)}");
            return null;
        }

        if (room.IsFull)
        {
            Console.WriteLine($"JoinRoom failed: Room {roomId} is full ({room.PlayerCount} players)");
            return null;
        }

        var playerName = GetPlayerName(connectionId);
        if (await room.AddPlayer(connectionId, playerName))
        {
            _playerRooms[connectionId] = roomId;
            return room;
        }

        return null;
    }

    public async Task LeaveRoom(string connectionId)
    {
        if (!_playerRooms.TryRemove(connectionId, out var roomId))
            return;

        if (!_rooms.TryGetValue(roomId, out var room))
            return;

        await room.RemovePlayer(connectionId);

        // Don't clean up rooms with active games - allow reconnection
        if (room.State == GameRoomState.Playing || room.State == GameRoomState.Countdown)
        {
            Console.WriteLine($"Room {roomId} kept alive for reconnection (state: {room.State})");
            return;
        }

        // Clean up empty rooms (only in Waiting state)
        if (room.PlayerCount == 0 || (room.PlayerCount == 1 && room.HasAI))
        {
            if (_rooms.TryRemove(roomId, out var removedRoom))
            {
                await removedRoom.Dispose();
            }
        }
    }

    public GameRoom? GetRoom(string roomId)
    {
        return _rooms.TryGetValue(roomId, out var room) ? room : null;
    }

    public GameRoom? GetPlayerRoom(string connectionId)
    {
        if (!_playerRooms.TryGetValue(connectionId, out var roomId))
            return null;
        return GetRoom(roomId);
    }

    public string? GetPlayerRoomId(string connectionId)
    {
        return _playerRooms.TryGetValue(connectionId, out var roomId) ? roomId : null;
    }

    /// <summary>
    /// Rejoin an active game after page navigation/reconnection.
    /// </summary>
    public async Task<object?> RejoinGame(string newConnectionId, string roomId, string playerName)
    {
        if (!_rooms.TryGetValue(roomId, out var room))
        {
            Console.WriteLine($"RejoinGame failed: Room {roomId} not found");
            return null;
        }

        if (room.State != GameRoomState.Playing && room.State != GameRoomState.Countdown)
        {
            Console.WriteLine($"RejoinGame failed: Room {roomId} not in active state ({room.State})");
            return null;
        }

        // Try to rejoin the room with the new connection ID
        var result = await room.RejoinPlayer(newConnectionId, playerName);
        if (result != null)
        {
            _playerRooms[newConnectionId] = roomId;
            _playerNames[newConnectionId] = playerName;
        }

        return result;
    }

    public async Task HandleDisconnect(string connectionId)
    {
        _playerNames.TryRemove(connectionId, out _);
        await LeaveRoom(connectionId);
    }

    private static string GenerateRoomId()
    {
        // Generate a 6-character room code
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = Random.Shared;
        var result = new char[6];
        for (int i = 0; i < result.Length; i++)
        {
            result[i] = chars[random.Next(chars.Length)];
        }
        return new string(result);
    }
}
