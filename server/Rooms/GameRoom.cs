using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using server.AI;
using server.ECS;
using server.ECS.Components.Core;
using server.ECS.Messages;
using server.ECS.Systems.Command;
using server.ECS.Systems.Movement;
using server.ECS.Systems.Collision;
using server.ECS.Systems.Combat;
using server.ECS.Systems.Economy;
using server.ECS.Systems.Avatar;
using server.ECS.Systems.Win;
using server.Network;
using server.Network.Serialization;
using server.Setup;

namespace server.Rooms;

public class PlayerInfo
{
    public string ConnectionId { get; set; } = "";
    public string Name { get; set; } = "Player";
    public int PlayerIndex { get; set; }
    public bool IsReady { get; set; }
    public bool IsAI { get; set; }
    public string AIType { get; set; } = "normal";
}

public enum GameRoomState
{
    Waiting,
    Countdown,
    Playing,
    GameOver
}

public class GameRoom
{
    public string RoomId { get; }
    public GameRoomState State { get; private set; } = GameRoomState.Waiting;

    private readonly Dictionary<string, PlayerInfo> _players = new();
    private readonly Dictionary<string, PlayerState> _playerStates = new();
    private readonly Dictionary<string, AIPlayer> _aiPlayers = new();
    private readonly ConcurrentQueue<(string playerId, object command)> _commandQueue = new();

    private World? _world;
    private readonly IHubContext<GameHub> _hubContext;
    private CancellationTokenSource? _gameLoopCts;
    private Task? _gameLoopTask;

    private int _countdownValue;
    private DateTime _lastStateUpdate;
    private readonly object _lock = new();

    public int PlayerCount => _players.Count;
    public IEnumerable<PlayerInfo> Players => _players.Values;
    public bool IsFull => _players.Count >= GameConstants.MAX_PLAYERS_PER_ROOM;
    public bool HasAI => _players.Values.Any(p => p.IsAI);

    public GameRoom(string roomId, IHubContext<GameHub> hubContext)
    {
        RoomId = roomId;
        _hubContext = hubContext;
    }

    public async Task<bool> AddPlayer(string connectionId, string name, bool isAI = false, string aiType = "normal")
    {
        lock (_lock)
        {
            if (IsFull || State != GameRoomState.Waiting)
                return false;

            var playerIndex = _players.Count;
            _players[connectionId] = new PlayerInfo
            {
                ConnectionId = connectionId,
                Name = name,
                PlayerIndex = playerIndex,
                IsReady = isAI,  // AI is always ready
                IsAI = isAI,
                AIType = aiType
            };
        }

        // Add to SignalR group
        if (!isAI)
        {
            await _hubContext.Groups.AddToGroupAsync(connectionId, RoomId);
        }

        return true;
    }

    public async Task RemovePlayer(string connectionId)
    {
        bool wasPlaying;
        bool isActiveGame;
        lock (_lock)
        {
            if (!_players.TryGetValue(connectionId, out var player))
                return;

            isActiveGame = State == GameRoomState.Playing || State == GameRoomState.Countdown;
            wasPlaying = isActiveGame;

            // During active games, don't remove non-AI players - allow reconnection
            if (isActiveGame && !player.IsAI)
            {
                Console.WriteLine($"Player {player.Name} disconnected from active game in room {RoomId} - keeping slot for reconnection");
                return;
            }

            _players.Remove(connectionId);
        }

        await _hubContext.Groups.RemoveFromGroupAsync(connectionId, RoomId);

        // Notify other players
        await BroadcastToRoom("playerLeft", new { playerId = connectionId });

        // Cancel countdown or game if it was in progress (only if actually removed)
        if (wasPlaying)
        {
            await CancelCountdown();
            await StopGame();
        }
    }

    /// <summary>
    /// Rejoin an active game after page navigation/reconnection.
    /// Returns the gameStart data or null if rejoin failed.
    /// </summary>
    public async Task<object?> RejoinPlayer(string newConnectionId, string playerName)
    {
        PlayerInfo? player = null;
        string? oldConnectionId = null;

        lock (_lock)
        {
            if (State != GameRoomState.Playing && State != GameRoomState.Countdown)
                return null;

            // Find player by name
            foreach (var kvp in _players)
            {
                if (kvp.Value.Name == playerName && !kvp.Value.IsAI)
                {
                    player = kvp.Value;
                    oldConnectionId = kvp.Key;
                    break;
                }
            }

            if (player == null || oldConnectionId == null)
            {
                Console.WriteLine($"RejoinPlayer failed: Player {playerName} not found in room {RoomId}");
                return null;
            }

            // Update the connection ID
            _players.Remove(oldConnectionId);
            player.ConnectionId = newConnectionId;
            _players[newConnectionId] = player;

            // Update player state key as well (re-key without modifying PlayerId)
            if (_playerStates.TryGetValue(oldConnectionId, out var playerState))
            {
                _playerStates.Remove(oldConnectionId);
                _playerStates[newConnectionId] = playerState;
            }

            // Update all entity ownership from old connection ID to new connection ID
            if (_world != null)
            {
                foreach (var (entity, ownership) in _world.GetAll<Ownership>())
                {
                    if (ownership.ownerId == oldConnectionId)
                    {
                        ownership.ownerId = newConnectionId;
                    }
                }
            }
        }

        // Add to SignalR group
        await _hubContext.Groups.AddToGroupAsync(newConnectionId, RoomId);

        // Return gameStart data
        var worldData = SerializeWorldState();
        var state = _playerStates.GetValueOrDefault(newConnectionId);

        return new
        {
            world = worldData,
            playerId = newConnectionId,
            playerIndex = player.PlayerIndex,
            playerState = state?.ToJson(),
            players = _players.Values.Select(p => new
            {
                id = p.ConnectionId,
                name = p.Name,
                playerIndex = p.PlayerIndex
            }).ToList()
        };
    }

    public async Task SetPlayerReady(string connectionId)
    {
        lock (_lock)
        {
            if (!_players.TryGetValue(connectionId, out var player))
                return;

            player.IsReady = !player.IsReady;
        }

        // Broadcast ready state update - client expects { players: [{ id, ready }, ...] }
        var playersReadyState = _players.Values.Select(p => new
        {
            id = p.ConnectionId,
            name = p.Name,
            ready = p.IsReady
        }).ToList();
        await BroadcastToRoom("readyUpdate", new { players = playersReadyState });

        // Check if all players are ready
        await CheckStartConditions();
    }

    private async Task CheckStartConditions()
    {
        bool shouldStart;
        lock (_lock)
        {
            shouldStart = IsFull &&
                          _players.Values.All(p => p.IsReady) &&
                          State == GameRoomState.Waiting;

            if (shouldStart)
                State = GameRoomState.Countdown;
        }

        if (shouldStart)
        {
            await StartCountdown();
        }
    }

    private async Task StartCountdown()
    {
        _countdownValue = GameConstants.COUNTDOWN_SECONDS;

        while (_countdownValue > 0)
        {
            await BroadcastToRoom("countdown", new { count = _countdownValue });
            await Task.Delay(1000);
            _countdownValue--;

            // Check if we should cancel
            lock (_lock)
            {
                if (State != GameRoomState.Countdown)
                    return;
            }
        }

        await StartGame();
    }

    private async Task CancelCountdown()
    {
        lock (_lock)
        {
            if (State != GameRoomState.Countdown)
                return;
            State = GameRoomState.Waiting;
        }

        await BroadcastToRoom("countdownCanceled", new { });
    }

    private async Task StartGame()
    {
        lock (_lock)
        {
            State = GameRoomState.Playing;
        }

        // Create world and initialize systems
        _world = new World();
        InitializeSystems();

        // Initialize player states
        foreach (var player in _players.Values)
        {
            _playerStates[player.ConnectionId] = new PlayerState(player.ConnectionId, player.PlayerIndex);
        }

        // Generate map using MapGenerator
        MapGenerator.Generate(_world, _players.Values);

        // Create AI players for AI-controlled players
        foreach (var player in _players.Values)
        {
            if (player.IsAI)
            {
                var playerState = _playerStates[player.ConnectionId];
                _aiPlayers[player.ConnectionId] = new AIPlayer(
                    player.ConnectionId,
                    player.PlayerIndex,
                    _world,
                    playerState,
                    player.AIType
                );
            }
        }

        // Send gameStart to all players
        var worldData = SerializeWorldState();
        foreach (var player in _players.Values)
        {
            if (!player.IsAI)
            {
                var playerState = _playerStates[player.ConnectionId];
                await _hubContext.Clients.Client(player.ConnectionId).SendAsync("gameStart", new
                {
                    world = worldData,
                    playerId = player.ConnectionId,
                    playerIndex = player.PlayerIndex,
                    playerState = playerState.ToJson(),
                    players = _players.Values.Select(p => new
                    {
                        id = p.ConnectionId,
                        name = p.Name,
                        playerIndex = p.PlayerIndex
                    }).ToList()
                });
            }
        }

        // Start game loop
        _gameLoopCts = new CancellationTokenSource();
        _gameLoopTask = RunGameLoop(_gameLoopCts.Token);
    }

    private void InitializeSystems()
    {
        if (_world == null) return;

        // Register systems in execution order
        _world.Start(new CommandProcessingSystem());
        _world.Start(new AvatarMovementSystem());
        _world.Start(new UnitMovementSystem());
        _world.Start(new PhysicsSystem());
        _world.Start(new CollisionDetectionSystem());
        _world.Start(new CollisionResolutionSystem());
        _world.Start(new BallCollisionSystem());
        _world.Start(new AttackSystem());
        _world.Start(new AutoAttackSystem());
        _world.Start(new GatheringSystem());
        _world.Start(new ConstructionSystem());
        _world.Start(new TrainingSystem());
        _world.Start(new PickupDropSystem());
        _world.Start(new BuildingInteractionSystem());
        _world.Start(new DeathSystem());
        _world.Start(new GoalCheckSystem());
    }

    private async Task RunGameLoop(CancellationToken cancellationToken)
    {
        var tickInterval = TimeSpan.FromSeconds(1.0 / GameConstants.TICK_RATE);
        var stateInterval = TimeSpan.FromSeconds(1.0 / GameConstants.STATE_BROADCAST_RATE);
        _lastStateUpdate = DateTime.UtcNow;

        while (!cancellationToken.IsCancellationRequested)
        {
            var tickStart = DateTime.UtcNow;

            try
            {
                // Process queued commands
                ProcessCommands();

                // Tick AI players
                foreach (var aiPlayer in _aiPlayers.Values)
                {
                    aiPlayer.Tick(GameConstants.TICK_DELTA);
                }

                // Tick the world
                _world?.Tick();

                // Process game events
                await ProcessGameEvents();

                // Broadcast state if enough time has passed
                if ((DateTime.UtcNow - _lastStateUpdate) >= stateInterval)
                {
                    await BroadcastGameState();
                    _lastStateUpdate = DateTime.UtcNow;
                }

                // Check for game over
                if (await CheckGameOver())
                    break;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Game loop error: {ex.Message}");
            }

            // Wait for next tick
            var elapsed = DateTime.UtcNow - tickStart;
            var waitTime = tickInterval - elapsed;
            if (waitTime > TimeSpan.Zero)
            {
                await Task.Delay(waitTime, cancellationToken);
            }
        }
    }

    private void ProcessCommands()
    {
        if (_world == null) return;

        while (_commandQueue.TryDequeue(out var item))
        {
            var (playerId, command) = item;
            ProcessCommand(playerId, command);
        }
    }

    private void ProcessCommand(string playerId, object command)
    {
        if (_world == null) return;

        // Parse command and send appropriate message to world
        if (command is System.Text.Json.JsonElement jsonElement)
        {
            var type = jsonElement.GetProperty("type").GetString();

            switch (type)
            {
                case "AVATAR_MOVE":
                    var dirX = jsonElement.GetProperty("directionX").GetInt32();
                    var dirY = jsonElement.GetProperty("directionY").GetInt32();
                    _world.Send(new AvatarMoveCommand
                    {
                        playerId = playerId,
                        directionX = dirX,
                        directionY = dirY
                    });
                    break;

                case "MOVE":
                    var actorIds = jsonElement.GetProperty("actorIds").EnumerateArray()
                        .Select(a => a.GetInt64()).ToList();
                    var targetX = jsonElement.GetProperty("targetX").GetSingle();
                    var targetY = jsonElement.GetProperty("targetY").GetSingle();
                    _world.Send(new MoveCommand
                    {
                        playerId = playerId,
                        actorIds = actorIds,
                        targetX = targetX,
                        targetY = targetY
                    });
                    break;

                case "ATTACK":
                    var attackActorIds = jsonElement.GetProperty("actorIds").EnumerateArray()
                        .Select(a => a.GetInt64()).ToList();
                    var attackTargetId = jsonElement.GetProperty("targetId").GetInt64();
                    _world.Send(new AttackCommand
                    {
                        playerId = playerId,
                        actorIds = attackActorIds,
                        targetId = attackTargetId
                    });
                    break;

                case "GATHER":
                    var workerIds = jsonElement.GetProperty("workerIds").EnumerateArray()
                        .Select(a => a.GetInt64()).ToList();
                    var resourceId = jsonElement.GetProperty("resourceId").GetInt64();
                    _world.Send(new GatherCommand
                    {
                        playerId = playerId,
                        workerIds = workerIds,
                        resourceId = resourceId
                    });
                    break;

                case "BUILD":
                    var buildWorkerId = jsonElement.GetProperty("workerId").GetInt64();
                    var buildingType = jsonElement.GetProperty("buildingType").GetString() ?? "";
                    var buildX = jsonElement.GetProperty("x").GetSingle();
                    var buildY = jsonElement.GetProperty("y").GetSingle();
                    _world.Send(new BuildCommand
                    {
                        playerId = playerId,
                        workerId = buildWorkerId,
                        buildingType = buildingType,
                        x = buildX,
                        y = buildY
                    });
                    break;

                case "TRAIN":
                    var buildingId = jsonElement.GetProperty("buildingId").GetInt64();
                    var unitType = jsonElement.GetProperty("unitType").GetString() ?? "";
                    var unitDef = EntityDefinitions.GetUnit(unitType);
                    if (unitDef != null)
                    {
                        _world.Send(new TrainRequestMessage
                        {
                            buildingEntity = buildingId,
                            unitType = unitType,
                            trainTime = unitDef.trainTime
                        });
                    }
                    break;

                case "PICKUP_UNIT":
                    _world.Send(new PickupCommand { playerId = playerId });
                    break;

                case "DROP_UNIT":
                    _world.Send(new DropCommand { playerId = playerId });
                    break;

                case "INTERACT_BUILDING":
                    var interactBuildingIdVal = jsonElement.GetProperty("buildingId").GetInt64();
                    var actionVal = jsonElement.GetProperty("action").GetString() ?? "";
                    var actionDataProp = jsonElement.TryGetProperty("actionData", out var actionData);
                    _world.Send(new BuildingInteractionCommand
                    {
                        playerId = playerId,
                        buildingId = interactBuildingIdVal,
                        action = actionVal,
                        unitType = actionDataProp && actionData.TryGetProperty("unitType", out var unitTypeProp)
                            ? unitTypeProp.GetString() : null
                    });
                    break;
            }
        }
    }

    private async Task ProcessGameEvents()
    {
        if (_world == null) return;

        // Process resource deposits
        var deposits = _world.Read<ResourceDepositMessage>();
        foreach (var deposit in deposits)
        {
            if (deposit.playerId != null && _playerStates.TryGetValue(deposit.playerId, out var playerState))
            {
                playerState.AddMinerals(deposit.amount);
            }
        }

        // Process attack events - send to clients
        var attacks = _world.Read<AttackEvent>();
        foreach (var attack in attacks)
        {
            await BroadcastToRoom("attackEvent", new
            {
                attackerId = attack.attackerId,
                targetId = attack.targetId,
                damage = attack.damage
            });
        }

        // Process death events
        var deaths = _world.Read<DeathEvent>();
        foreach (var death in deaths)
        {
            await BroadcastToRoom("actorDeath", new
            {
                actorId = death.entityId
            });
        }

        // Process unit trained events - update supply
        var trained = _world.Read<UnitTrainedMessage>();
        foreach (var unit in trained)
        {
            if (unit.ownerId != null && _playerStates.TryGetValue(unit.ownerId, out var playerState))
            {
                var unitDef = EntityDefinitions.GetUnit(unit.unitType);
                if (unitDef != null)
                {
                    playerState.UseSupply(unitDef.supply);
                }
            }
        }
    }

    private async Task<bool> CheckGameOver()
    {
        if (_world == null) return false;

        var gameOverMsg = _world.ReadSingle<GameOverMessage>();
        if (gameOverMsg != null)
        {
            lock (_lock)
            {
                State = GameRoomState.GameOver;
            }

            await BroadcastToRoom("gameOver", new
            {
                winnerId = gameOverMsg.winnerId,
                winnerIndex = gameOverMsg.winnerIndex,
                reason = gameOverMsg.reason
            });

            return true;
        }

        return false;
    }

    private async Task BroadcastGameState()
    {
        var worldData = SerializeWorldState();

        foreach (var player in _players.Values)
        {
            if (player.IsAI) continue;

            var playerState = _playerStates.GetValueOrDefault(player.ConnectionId);

            await _hubContext.Clients.Client(player.ConnectionId).SendAsync("gameState", new
            {
                world = worldData,
                playerState = playerState?.ToJson()
            });
        }
    }

    private Dictionary<string, object> SerializeWorldState()
    {
        if (_world == null)
            return new Dictionary<string, object>();

        var players = _players.ToDictionary(
            kvp => kvp.Key,
            kvp => kvp.Value.PlayerIndex
        );

        return WorldSerializer.SerializeWorld(_world, players);
    }

    public void QueueCommand(string playerId, object command)
    {
        if (State == GameRoomState.Playing)
        {
            _commandQueue.Enqueue((playerId, command));
        }
    }

    private async Task StopGame()
    {
        _gameLoopCts?.Cancel();
        if (_gameLoopTask != null)
        {
            try
            {
                await _gameLoopTask;
            }
            catch (OperationCanceledException)
            {
                // Expected
            }
        }
        _gameLoopCts?.Dispose();
        _gameLoopCts = null;
        _gameLoopTask = null;
    }

    private async Task BroadcastToRoom(string eventName, object data)
    {
        await _hubContext.Clients.Group(RoomId).SendAsync(eventName, data);
    }

    public async Task Dispose()
    {
        await StopGame();

        // Remove all players from the group
        foreach (var player in _players.Values)
        {
            if (!player.IsAI)
            {
                await _hubContext.Groups.RemoveFromGroupAsync(player.ConnectionId, RoomId);
            }
        }
    }

    public Dictionary<string, object> GetRoomInfo()
    {
        return new Dictionary<string, object>
        {
            ["roomId"] = RoomId,
            ["playerCount"] = PlayerCount,
            ["players"] = _players.Values.Select(p => new
            {
                id = p.ConnectionId,
                name = p.Name,
                playerIndex = p.PlayerIndex,
                isReady = p.IsReady
            }).ToList(),
            ["state"] = State.ToString()
        };
    }
}
