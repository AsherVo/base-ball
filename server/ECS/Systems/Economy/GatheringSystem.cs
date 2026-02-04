using server.ECS.Components.Core;
using server.ECS.Components.Unit;
using server.ECS.Components.Movement;
using server.ECS.Components.Resource;
using server.ECS.Messages;
using server.Setup;

namespace server.ECS.Systems.Economy;

public class GatheringSystem : WorldManipulator, ISystem
{
    private Filter _workerFilter = null!;
    private Filter _buildingFilter = null!;

    public void StartSystem(World world)
    {
        this.world = world;
        _workerFilter = new FilterBuilder()
            .Include<Transform>()
            .Include<UnitState>()
            .Include<CanGather>()
            .Include<CarryAmount>()
            .Include<Ownership>()
            .ToFilter();
        Start(_workerFilter);

        _buildingFilter = new FilterBuilder()
            .Include<Transform>()
            .Include<EntityType>()
            .Include<Ownership>()
            .ToFilter();
        Start(_buildingFilter);
    }

    public void StopSystem(World world)
    {
        Stop(_workerFilter);
        Stop(_buildingFilter);
    }

    public void TickSystem(World world)
    {
        var deltaTime = GameConstants.TICK_DELTA;

        foreach (var entity in _workerFilter.Entities)
        {
            // Skip carried units
            if (Has<Carried>(entity))
                continue;

            var state = Get<UnitState>(entity)!;
            var carryAmount = Get<CarryAmount>(entity)!;
            var transform = Get<Transform>(entity)!;
            var ownership = Get<Ownership>(entity)!;

            switch (state.state)
            {
                case "gathering":
                    ProcessGathering(entity, state, carryAmount, transform, deltaTime);
                    break;

                case "returning":
                    ProcessReturning(entity, state, carryAmount, transform, ownership);
                    break;
            }
        }
    }

    private void ProcessGathering(long entity, UnitState state, CarryAmount carryAmount, Transform transform, float deltaTime)
    {
        var targetEntity = GetRelated<GatherTarget>(entity);

        if (targetEntity == 0)
        {
            state.state = "idle";
            return;
        }

        var targetTransform = Get<Transform>(targetEntity);
        var resource = Get<ResourceAmount>(targetEntity);

        if (targetTransform == null || resource == null || resource.amount <= 0)
        {
            Remove<GatherTarget>(entity);
            Remove<GatherProgress>(entity);

            // If carrying resources, return to base
            if (carryAmount.amount > 0)
            {
                state.state = "returning";
            }
            else
            {
                state.state = "idle";
            }
            return;
        }

        // Check if in range
        var dx = targetTransform.x - transform.x;
        var dy = targetTransform.y - transform.y;
        var distance = MathF.Sqrt(dx * dx + dy * dy);
        var gatherRange = transform.radius + targetTransform.radius + 10f;

        if (distance > gatherRange)
        {
            // Move toward resource
            var moveTarget = GetOrAdd<MoveTarget>(entity);
            moveTarget.targetX = targetTransform.x;
            moveTarget.targetY = targetTransform.y;
            state.state = "moving";
            return;
        }

        // In range - gather
        Remove<MoveTarget>(entity);

        var progress = GetOrAdd<GatherProgress>(entity);
        progress.progress += deltaTime;

        // Gather rate: 1 second per gather action
        if (progress.progress >= 1f)
        {
            progress.progress = 0f;

            var gatherAmount = Math.Min(resource.gatherRate, resource.amount);
            resource.amount -= gatherAmount;
            carryAmount.amount += gatherAmount;

            // Workers can carry up to 20 minerals
            const int maxCarry = 20;
            if (carryAmount.amount >= maxCarry)
            {
                carryAmount.amount = maxCarry;
                state.state = "returning";
                Remove<GatherProgress>(entity);
            }
        }
    }

    private void ProcessReturning(long entity, UnitState state, CarryAmount carryAmount, Transform transform, Ownership ownership)
    {
        // Find nearest base to return resources
        var nearestBase = FindNearestBase(transform, ownership);

        if (nearestBase == 0)
        {
            state.state = "idle";
            return;
        }

        var baseTransform = Get<Transform>(nearestBase)!;

        // Check if in range of base
        var dx = baseTransform.x - transform.x;
        var dy = baseTransform.y - transform.y;
        var distance = MathF.Sqrt(dx * dx + dy * dy);
        var returnRange = transform.radius + baseTransform.radius + 10f;

        if (distance > returnRange)
        {
            // Move toward base
            var moveTarget = GetOrAdd<MoveTarget>(entity);
            moveTarget.targetX = baseTransform.x;
            moveTarget.targetY = baseTransform.y;
            state.state = "moving";
            return;
        }

        // In range - deposit resources
        Remove<MoveTarget>(entity);

        // Send message to add minerals to player
        Send(new ResourceDepositMessage
        {
            playerId = ownership.ownerId,
            amount = carryAmount.amount
        });

        carryAmount.amount = 0;

        // Return to gathering if still have a gather target
        var gatherTarget = GetRelated<GatherTarget>(entity);
        if (gatherTarget != 0 && Exists(gatherTarget))
        {
            state.state = "gathering";
        }
        else
        {
            state.state = "idle";
        }
    }

    private long FindNearestBase(Transform transform, Ownership ownership)
    {
        long nearest = 0;
        float nearestDist = float.MaxValue;

        foreach (var building in _buildingFilter.Entities)
        {
            var buildingType = Get<EntityType>(building);
            if (buildingType?.subtype != "base")
                continue;

            var buildingOwnership = Get<Ownership>(building);
            if (buildingOwnership?.playerIndex != ownership.playerIndex)
                continue;

            var buildingTransform = Get<Transform>(building)!;

            var dx = buildingTransform.x - transform.x;
            var dy = buildingTransform.y - transform.y;
            var dist = MathF.Sqrt(dx * dx + dy * dy);

            if (dist < nearestDist)
            {
                nearestDist = dist;
                nearest = building;
            }
        }

        return nearest;
    }
}
