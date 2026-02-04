using Microsoft.AspNetCore.SignalR;

namespace server.Network;

/// <summary>
/// SignalR hub for game communication.
/// Placeholder - full implementation in Phase 8.
/// </summary>
public class GameHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        await base.OnConnectedAsync();
        Console.WriteLine($"Client connected: {Context.ConnectionId}");
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await base.OnDisconnectedAsync(exception);
        Console.WriteLine($"Client disconnected: {Context.ConnectionId}");
    }

    // Placeholder methods matching Socket.io event names
    public async Task SetName(string name)
    {
        // TODO: Implement in Phase 8
        await Task.CompletedTask;
    }

    public async Task CreateRoom()
    {
        // TODO: Implement in Phase 8
        await Task.CompletedTask;
    }

    public async Task CreateRoomWithAI(object options)
    {
        // TODO: Implement in Phase 8
        await Task.CompletedTask;
    }

    public async Task JoinRoom(string roomId)
    {
        // TODO: Implement in Phase 8
        await Task.CompletedTask;
    }

    public async Task LeaveRoom()
    {
        // TODO: Implement in Phase 8
        await Task.CompletedTask;
    }

    public async Task QuickMatch()
    {
        // TODO: Implement in Phase 8
        await Task.CompletedTask;
    }

    public async Task PlayerReady()
    {
        // TODO: Implement in Phase 8
        await Task.CompletedTask;
    }

    public async Task PlayerCommand(object command)
    {
        // TODO: Implement in Phase 8
        await Task.CompletedTask;
    }
}
