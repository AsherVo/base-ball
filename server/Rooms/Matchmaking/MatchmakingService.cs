using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using server.Network;

namespace server.Rooms.Matchmaking;

/// <summary>
/// Handles quick match queue with automatic pairing.
/// </summary>
public class MatchmakingService
{
    private readonly ConcurrentQueue<string> _waitingQueue = new();
    private readonly ConcurrentDictionary<string, bool> _inQueue = new();
    private readonly RoomManager _roomManager;
    private readonly IHubContext<GameHub> _hubContext;
    private readonly object _matchLock = new();

    public MatchmakingService(RoomManager roomManager, IHubContext<GameHub> hubContext)
    {
        _roomManager = roomManager;
        _hubContext = hubContext;
    }

    public async Task<bool> JoinQueue(string connectionId)
    {
        // Check if already in queue or in a room
        if (_inQueue.ContainsKey(connectionId))
            return false;

        if (_roomManager.GetPlayerRoomId(connectionId) != null)
            return false;

        // Add to queue
        _inQueue[connectionId] = true;
        _waitingQueue.Enqueue(connectionId);

        // Notify player they're waiting
        await _hubContext.Clients.Client(connectionId).SendAsync("waitingForMatch", new { });

        // Try to match
        await TryMatch();

        return true;
    }

    public void LeaveQueue(string connectionId)
    {
        _inQueue.TryRemove(connectionId, out _);
        // Note: We don't remove from the actual queue - we'll skip them during matching
    }

    private async Task TryMatch()
    {
        lock (_matchLock)
        {
            // Need at least 2 players
            if (_waitingQueue.Count < 2)
                return;
        }

        // Get two valid players from queue
        string? player1 = null;
        string? player2 = null;

        while (_waitingQueue.TryDequeue(out var connectionId))
        {
            // Skip players who left the queue
            if (!_inQueue.ContainsKey(connectionId))
                continue;

            if (player1 == null)
            {
                player1 = connectionId;
            }
            else
            {
                player2 = connectionId;
                break;
            }
        }

        if (player1 == null || player2 == null)
        {
            // Put player1 back if we couldn't find a second player
            if (player1 != null)
            {
                _waitingQueue.Enqueue(player1);
            }
            return;
        }

        // Remove both from inQueue tracking
        _inQueue.TryRemove(player1, out _);
        _inQueue.TryRemove(player2, out _);

        // Create match
        _ = Task.Run(async () => await CreateMatch(player1, player2));
    }

    private async Task CreateMatch(string player1, string player2)
    {
        try
        {
            // Create room with first player
            var room = await _roomManager.CreateRoom(player1);
            if (room == null)
            {
                // Failed to create room - notify players and re-queue
                await _hubContext.Clients.Client(player1).SendAsync("error", new { message = "Failed to create match" });
                await _hubContext.Clients.Client(player2).SendAsync("error", new { message = "Failed to create match" });
                return;
            }

            // Notify first player
            await _hubContext.Clients.Client(player1).SendAsync("roomJoined", room.GetRoomInfo());

            // Add second player
            var joinedRoom = await _roomManager.JoinRoom(player2, room.RoomId);
            if (joinedRoom == null)
            {
                await _hubContext.Clients.Client(player2).SendAsync("error", new { message = "Failed to join match" });
                return;
            }

            // Notify second player
            await _hubContext.Clients.Client(player2).SendAsync("roomJoined", joinedRoom.GetRoomInfo());

            // Notify first player about second player joining
            await _hubContext.Clients.Client(player1).SendAsync("playerJoined", new
            {
                playerId = player2,
                name = _roomManager.GetPlayerName(player2)
            });

            // Notify both that match is ready
            await _hubContext.Clients.Clients(player1, player2).SendAsync("matchReady", new
            {
                roomId = room.RoomId
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error creating match: {ex.Message}");
        }
    }

    public void HandleDisconnect(string connectionId)
    {
        LeaveQueue(connectionId);
    }
}
