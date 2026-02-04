using server.ECS;
using server.ECS.Components.Core;
using server.ECS.Components.Combat;
using server.ECS.Components.Movement;
using server.ECS.Components.Unit;
using server.ECS.Components.Building;
using server.ECS.Components.Avatar;
using server.ECS.Components.Resource;
using server.ECS.Messages;
using server.Rooms;
using server.Setup;

namespace server.AI;

/// <summary>
/// AI player that makes decisions and sends commands like a human player.
/// Runs as part of the game loop.
/// </summary>
public class AIPlayer
{
    private readonly string _playerId;
    private readonly int _playerIndex;
    private readonly World _world;
    private readonly PlayerState _playerState;
    private readonly string _aiType;

    // AI tuning parameters
    private const int MAX_WORKERS = 8;
    private const int SUPPLY_BUFFER = 3;  // Build depot when supply within this of max
    private const float DECISION_INTERVAL = 0.5f;  // Seconds between major decisions

    private float _decisionTimer = 0f;
    private int _enemyPlayerIndex;

    public AIPlayer(string playerId, int playerIndex, World world, PlayerState playerState, string aiType = "normal")
    {
        _playerId = playerId;
        _playerIndex = playerIndex;
        _world = world;
        _playerState = playerState;
        _aiType = aiType;
        _enemyPlayerIndex = playerIndex == 0 ? 1 : 0;
    }

    /// <summary>
    /// Called every tick to let AI make decisions.
    /// </summary>
    public void Tick(float deltaTime)
    {
        // Empty AI does nothing
        if (_aiType == "empty")
            return;

        _decisionTimer += deltaTime;

        // Always control avatar (push ball toward enemy goal)
        ControlAvatar();

        // Make strategic decisions periodically
        if (_decisionTimer >= DECISION_INTERVAL)
        {
            _decisionTimer = 0f;
            MakeStrategicDecisions();
        }
    }

    private void ControlAvatar()
    {
        var avatar = FindAvatar();
        if (avatar == 0)
            return;

        var avatarTransform = _world.Get<Transform>(avatar);
        if (avatarTransform == null)
            return;

        var ball = FindBall();
        if (ball == 0)
            return;

        var ballTransform = _world.Get<Transform>(ball);
        if (ballTransform == null)
            return;

        // Calculate direction to push ball toward enemy goal
        var enemyGoalX = _playerIndex == 0 ? GameConstants.WORLD_PIXEL_WIDTH : 0f;
        var goalDirection = _playerIndex == 0 ? 1 : -1;

        // If ball is behind us, go around it
        var isBallBehindUs = (_playerIndex == 0 && ballTransform.x < avatarTransform.x - 50) ||
                            (_playerIndex == 1 && ballTransform.x > avatarTransform.x + 50);

        int dirX = 0;
        int dirY = 0;

        if (isBallBehindUs)
        {
            // Move toward ball first
            dirX = ballTransform.x > avatarTransform.x ? 1 : -1;
            dirY = ballTransform.y > avatarTransform.y ? 1 : (ballTransform.y < avatarTransform.y ? -1 : 0);
        }
        else
        {
            // Position ourselves to push ball toward enemy goal
            var dx = ballTransform.x - avatarTransform.x;
            var dy = ballTransform.y - avatarTransform.y;
            var dist = MathF.Sqrt(dx * dx + dy * dy);

            if (dist > 80)
            {
                // Move toward ball
                dirX = dx > 0 ? 1 : -1;
                dirY = dy > 20 ? 1 : (dy < -20 ? -1 : 0);
            }
            else
            {
                // We're near ball, push it toward goal
                dirX = goalDirection;
                dirY = 0;

                // Adjust Y to keep ball centered
                var centerY = GameConstants.WORLD_PIXEL_HEIGHT / 2f;
                if (ballTransform.y < centerY - 100)
                    dirY = 1;
                else if (ballTransform.y > centerY + 100)
                    dirY = -1;
            }
        }

        _world.Send(new AvatarMoveCommand
        {
            playerId = _playerId,
            directionX = dirX,
            directionY = dirY
        });
    }

    private void MakeStrategicDecisions()
    {
        // Priority order:
        // 1. Build supply depot if needed
        // 2. Train workers if we need more
        // 3. Build barracks if we don't have one
        // 4. Train soldiers
        // 5. Assign idle workers to gather

        var workers = GetUnits("worker");
        var soldiers = GetUnits("soldier");
        var workerCount = workers.Count;
        var soldierCount = soldiers.Count;

        var baseBuilding = FindBase();
        var barracks = FindBuilding("barracks");
        var supplyDepot = FindBuilding("supplyDepot");

        // Check if we're near supply cap
        var nearSupplyCap = _playerState.Supply >= _playerState.MaxSupply - SUPPLY_BUFFER;

        // 1. Build supply depot if needed and we have a worker
        if (nearSupplyCap && workerCount > 0)
        {
            var buildingSupplyDepot = FindBuildingUnderConstruction("supplyDepot");
            if (buildingSupplyDepot == 0)
            {
                var depotDef = EntityDefinitions.GetBuilding("supplyDepot")!;
                if (_playerState.CanAfford(depotDef.cost))
                {
                    var idleWorker = FindIdleWorker(workers);
                    if (idleWorker != 0)
                    {
                        var buildPos = GetBuildPosition();
                        _world.Send(new BuildCommand
                        {
                            playerId = _playerId,
                            workerId = idleWorker,
                            buildingType = "supplyDepot",
                            x = buildPos.x,
                            y = buildPos.y
                        });
                        return;
                    }
                }
            }
        }

        // 2. Train workers if we need more
        if (workerCount < MAX_WORKERS && baseBuilding != 0)
        {
            var workerDef = EntityDefinitions.GetUnit("worker")!;
            if (_playerState.CanAfford(workerDef.cost) && _playerState.CanSupport(workerDef.supply))
            {
                var queue = _world.Get<TrainingQueue>(baseBuilding);
                if (queue != null && queue.queue.Count == 0)
                {
                    _world.Send(new TrainRequestMessage
                    {
                        buildingEntity = baseBuilding,
                        unitType = "worker",
                        cost = workerDef.cost,
                        supply = workerDef.supply,
                        trainTime = workerDef.trainTime,
                        playerId = _playerId
                    });
                    return;
                }
            }
        }

        // 3. Build barracks if we don't have one
        if (barracks == 0 && workerCount > 0)
        {
            var buildingBarracks = FindBuildingUnderConstruction("barracks");
            if (buildingBarracks == 0)
            {
                var barracksDef = EntityDefinitions.GetBuilding("barracks")!;
                if (_playerState.CanAfford(barracksDef.cost))
                {
                    var idleWorker = FindIdleWorker(workers);
                    if (idleWorker != 0)
                    {
                        var buildPos = GetBuildPosition();
                        _world.Send(new BuildCommand
                        {
                            playerId = _playerId,
                            workerId = idleWorker,
                            buildingType = "barracks",
                            x = buildPos.x,
                            y = buildPos.y
                        });
                        return;
                    }
                }
            }
        }

        // 4. Train soldiers
        if (barracks != 0)
        {
            var soldierDef = EntityDefinitions.GetUnit("soldier")!;
            if (_playerState.CanAfford(soldierDef.cost) && _playerState.CanSupport(soldierDef.supply))
            {
                var queue = _world.Get<TrainingQueue>(barracks);
                if (queue != null && queue.queue.Count < 2) // Allow small queue
                {
                    _world.Send(new TrainRequestMessage
                    {
                        buildingEntity = barracks,
                        unitType = "soldier",
                        cost = soldierDef.cost,
                        supply = soldierDef.supply,
                        trainTime = soldierDef.trainTime,
                        playerId = _playerId
                    });
                }
            }
        }

        // 5. Assign idle workers to gather
        AssignIdleWorkersToGather(workers);

        // 6. Send soldiers toward ball
        SendSoldiersTowardBall(soldiers);
    }

    private void AssignIdleWorkersToGather(List<long> workers)
    {
        var minerals = FindMineralPatches();
        if (minerals.Count == 0)
            return;

        foreach (var worker in workers)
        {
            var state = _world.Get<UnitState>(worker);
            if (state == null || state.state != "idle")
                continue;

            // Skip workers that are being carried
            if (_world.Has<Carried>(worker))
                continue;

            // Skip auto-attack only workers (dropped by avatar)
            if (_world.Has<AutoAttackOnly>(worker))
                continue;

            // Find nearest mineral patch
            var workerTransform = _world.Get<Transform>(worker);
            if (workerTransform == null)
                continue;

            var nearestMineral = FindNearestMineral(workerTransform.x, workerTransform.y, minerals);
            if (nearestMineral != 0)
            {
                _world.Send(new GatherCommand
                {
                    playerId = _playerId,
                    workerIds = new List<long> { worker },
                    resourceId = nearestMineral
                });
            }
        }
    }

    private void SendSoldiersTowardBall(List<long> soldiers)
    {
        var ball = FindBall();
        if (ball == 0)
            return;

        var ballTransform = _world.Get<Transform>(ball);
        if (ballTransform == null)
            return;

        foreach (var soldier in soldiers)
        {
            var state = _world.Get<UnitState>(soldier);
            if (state == null)
                continue;

            // Only move idle soldiers
            if (state.state != "idle")
                continue;

            // Skip soldiers that are being carried or auto-attack only
            if (_world.Has<Carried>(soldier) || _world.Has<AutoAttackOnly>(soldier))
                continue;

            // Move toward ball
            _world.Send(new MoveCommand
            {
                playerId = _playerId,
                actorIds = new List<long> { soldier },
                targetX = ballTransform.x,
                targetY = ballTransform.y
            });
        }
    }

    #region Helper Methods

    private long FindAvatar()
    {
        foreach (var (entity, entityType) in _world.GetAll<EntityType>())
        {
            if (entityType.type != "avatar")
                continue;

            var ownership = _world.Get<Ownership>(entity);
            if (ownership?.ownerId == _playerId)
                return entity;
        }
        return 0;
    }

    private long FindBall()
    {
        foreach (var (entity, entityType) in _world.GetAll<EntityType>())
        {
            if (entityType.type == "ball")
                return entity;
        }
        return 0;
    }

    private long FindBase()
    {
        return FindBuilding("base");
    }

    private long FindBuilding(string subtype)
    {
        foreach (var (entity, entityType) in _world.GetAll<EntityType>())
        {
            if (entityType.type != "building" || entityType.subtype != subtype)
                continue;

            var ownership = _world.Get<Ownership>(entity);
            if (ownership?.ownerId != _playerId)
                continue;

            // Check if complete (no Construction component)
            if (_world.Has<Construction>(entity))
                continue;

            return entity;
        }
        return 0;
    }

    private long FindBuildingUnderConstruction(string subtype)
    {
        foreach (var (entity, entityType) in _world.GetAll<EntityType>())
        {
            if (entityType.type != "building" || entityType.subtype != subtype)
                continue;

            var ownership = _world.Get<Ownership>(entity);
            if (ownership?.ownerId != _playerId)
                continue;

            if (_world.Has<Construction>(entity))
                return entity;
        }
        return 0;
    }

    private List<long> GetUnits(string subtype)
    {
        var units = new List<long>();
        foreach (var (entity, entityType) in _world.GetAll<EntityType>())
        {
            if (entityType.type != "unit" || entityType.subtype != subtype)
                continue;

            var ownership = _world.Get<Ownership>(entity);
            if (ownership?.ownerId == _playerId)
                units.Add(entity);
        }
        return units;
    }

    private long FindIdleWorker(List<long> workers)
    {
        foreach (var worker in workers)
        {
            var state = _world.Get<UnitState>(worker);
            if (state?.state == "idle" && !_world.Has<Carried>(worker) && !_world.Has<AutoAttackOnly>(worker))
                return worker;
        }
        return 0;
    }

    private List<long> FindMineralPatches()
    {
        var minerals = new List<long>();
        foreach (var (entity, entityType) in _world.GetAll<EntityType>())
        {
            if (entityType.type == "resource" && entityType.subtype == "minerals")
            {
                var amount = _world.Get<ResourceAmount>(entity);
                if (amount != null && amount.amount > 0)
                    minerals.Add(entity);
            }
        }
        return minerals;
    }

    private long FindNearestMineral(float x, float y, List<long> minerals)
    {
        long nearest = 0;
        var nearestDist = float.MaxValue;

        foreach (var mineral in minerals)
        {
            var transform = _world.Get<Transform>(mineral);
            if (transform == null)
                continue;

            var dx = transform.x - x;
            var dy = transform.y - y;
            var dist = MathF.Sqrt(dx * dx + dy * dy);

            if (dist < nearestDist)
            {
                nearestDist = dist;
                nearest = mineral;
            }
        }

        return nearest;
    }

    private (float x, float y) GetBuildPosition()
    {
        var baseEntity = FindBase();
        if (baseEntity == 0)
            return (GameConstants.WORLD_PIXEL_WIDTH / 2f, GameConstants.WORLD_PIXEL_HEIGHT / 2f);

        var baseTransform = _world.Get<Transform>(baseEntity);
        if (baseTransform == null)
            return (GameConstants.WORLD_PIXEL_WIDTH / 2f, GameConstants.WORLD_PIXEL_HEIGHT / 2f);

        // Build in a position near the base but toward center
        var offset = _playerIndex == 0 ? 150f : -150f;
        var buildX = baseTransform.x + offset;

        // Alternate Y position based on existing buildings
        var yOffset = (Random.Shared.Next(2) == 0 ? -1 : 1) * (100 + Random.Shared.Next(100));
        var buildY = baseTransform.y + yOffset;

        // Clamp to map bounds
        buildY = Math.Clamp(buildY, 100, GameConstants.WORLD_PIXEL_HEIGHT - 100);

        return (buildX, buildY);
    }

    #endregion
}
