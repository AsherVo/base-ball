using server.ECS.Components.Core;
using server.ECS.Components.Avatar;
using server.ECS.Components.Unit;
using server.ECS.Components.Movement;
using server.ECS.Components.Combat;
using server.ECS.Components.Building;
using server.ECS.Messages;
using server.Setup;

namespace server.ECS.Systems.Command;

public class CommandProcessingSystem : WorldManipulator, ISystem
{
    private Filter _avatarFilter = null!;

    public void StartSystem(World world)
    {
        this.world = world;
        _avatarFilter = new FilterBuilder()
            .Include<Transform>()
            .Include<MoveDirection>()
            .Include<Ownership>()
            .ToFilter();
        Start(_avatarFilter);
    }

    public void StopSystem(World world)
    {
        Stop(_avatarFilter);
    }

    public void TickSystem(World world)
    {
        // Process avatar move commands
        var avatarMoveCommands = Read<AvatarMoveCommand>();
        foreach (var cmd in avatarMoveCommands)
        {
            ProcessAvatarMove(cmd);
        }

        // Process move commands for units
        var moveCommands = Read<MoveCommand>();
        foreach (var cmd in moveCommands)
        {
            ProcessMove(cmd);
        }

        // Process attack commands
        var attackCommands = Read<AttackCommand>();
        foreach (var cmd in attackCommands)
        {
            ProcessAttack(cmd);
        }

        // Process gather commands
        var gatherCommands = Read<GatherCommand>();
        foreach (var cmd in gatherCommands)
        {
            ProcessGather(cmd);
        }

        // Process build commands
        var buildCommands = Read<BuildCommand>();
        foreach (var cmd in buildCommands)
        {
            ProcessBuild(cmd);
        }

        // Process train requests
        var trainRequests = Read<TrainRequestMessage>();
        foreach (var req in trainRequests)
        {
            ProcessTrainRequest(req);
        }
    }

    private void ProcessAvatarMove(AvatarMoveCommand cmd)
    {
        foreach (var avatarEntity in _avatarFilter.Entities)
        {
            var ownership = Get<Ownership>(avatarEntity)!;
            if (ownership.ownerId != cmd.playerId)
                continue;

            var direction = Get<MoveDirection>(avatarEntity)!;
            direction.directionX = cmd.directionX;
            direction.directionY = cmd.directionY;
            break;
        }
    }

    private void ProcessMove(MoveCommand cmd)
    {
        foreach (var actorId in cmd.actorIds)
        {
            if (!Exists(actorId))
                continue;

            // Verify ownership
            var ownership = Get<Ownership>(actorId);
            if (ownership?.ownerId != cmd.playerId)
                continue;

            // Only units can move
            var entityType = Get<EntityType>(actorId);
            if (entityType?.type != "unit")
                continue;

            // Can't move carried units
            if (Has<Carried>(actorId))
                continue;

            // Can't move auto-attack-only units
            if (Has<AutoAttackOnly>(actorId))
                continue;

            // Set move target
            var moveTarget = GetOrAdd<MoveTarget>(actorId);
            moveTarget.targetX = cmd.targetX;
            moveTarget.targetY = cmd.targetY;

            // Clear attack target
            Remove<AttackTarget>(actorId);

            // Update state
            if (TryGet<UnitState>(actorId, out var state) && state != null)
                state.state = "moving";
        }
    }

    private void ProcessAttack(AttackCommand cmd)
    {
        if (!Exists(cmd.targetId))
            return;

        foreach (var actorId in cmd.actorIds)
        {
            if (!Exists(actorId))
                continue;

            // Verify ownership
            var ownership = Get<Ownership>(actorId);
            if (ownership?.ownerId != cmd.playerId)
                continue;

            // Only combat-capable entities can attack
            if (!Has<Attack>(actorId))
                continue;

            // Can't attack while carried
            if (Has<Carried>(actorId))
                continue;

            // Set attack target
            SetRelation<AttackTarget>(actorId, cmd.targetId);

            // Update state
            if (TryGet<UnitState>(actorId, out var state) && state != null)
                state.state = "attacking";
        }
    }

    private void ProcessGather(GatherCommand cmd)
    {
        if (!Exists(cmd.resourceId))
            return;

        foreach (var workerId in cmd.workerIds)
        {
            if (!Exists(workerId))
                continue;

            // Verify ownership
            var ownership = Get<Ownership>(workerId);
            if (ownership?.ownerId != cmd.playerId)
                continue;

            // Only workers can gather
            if (!Has<CanGather>(workerId))
                continue;

            // Can't gather while carried
            if (Has<Carried>(workerId))
                continue;

            // Set gather target
            SetRelation<GatherTarget>(workerId, cmd.resourceId);

            // Update state
            if (TryGet<UnitState>(workerId, out var state) && state != null)
                state.state = "gathering";
        }
    }

    private void ProcessBuild(BuildCommand cmd)
    {
        if (!Exists(cmd.workerId))
            return;

        // Verify ownership
        var ownership = Get<Ownership>(cmd.workerId);
        if (ownership == null || ownership.ownerId != cmd.playerId)
            return;

        // Only builders can build
        if (!Has<CanBuild>(cmd.workerId))
            return;

        var buildingDef = EntityDefinitions.GetBuilding(cmd.buildingType);
        if (buildingDef == null)
            return;

        // Create building (construction progress handled by ConstructionSystem)
        var buildingEntity = EntityFactory.CreateBuilding(
            world,
            cmd.buildingType,
            cmd.x,
            cmd.y,
            cmd.playerId,
            ownership.playerIndex,
            constructing: true
        );

        // Assign worker to build
        SetRelation<BuildTarget>(cmd.workerId, buildingEntity);

        if (TryGet<UnitState>(cmd.workerId, out var state) && state != null)
            state.state = "building";
    }

    private void ProcessTrainRequest(TrainRequestMessage req)
    {
        if (!Exists(req.buildingEntity))
            return;

        var queue = Get<TrainingQueue>(req.buildingEntity);
        if (queue == null)
            return;

        // Add to training queue
        queue.queue.Add(new TrainingItem
        {
            unitType = req.unitType,
            progress = 0,
            trainTime = req.trainTime
        });
    }
}
