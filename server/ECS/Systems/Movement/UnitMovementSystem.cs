using server.ECS.Components.Core;
using server.ECS.Components.Movement;
using server.ECS.Components.Unit;
using server.ECS.Components.Combat;
using server.Setup;
using server.Util;

namespace server.ECS.Systems.Movement;

public class UnitMovementSystem : WorldManipulator, ISystem
{
    private Filter _unitFilter = null!;

    public void StartSystem(World world)
    {
        this.world = world;
        _unitFilter = new FilterBuilder()
            .Include<Transform>()
            .Include<Speed>()
            .Include<UnitState>()
            .Include<EntityType>()
            .ToFilter();
        Start(_unitFilter);
    }

    public void StopSystem(World world)
    {
        Stop(_unitFilter);
    }

    public void TickSystem(World world)
    {
        var deltaTime = GameConstants.TICK_DELTA;

        foreach (var entity in _unitFilter.Entities)
        {
            var entityType = Get<EntityType>(entity)!;
            if (entityType.type != "unit")
                continue;

            // Skip carried units
            if (Has<Carried>(entity))
                continue;

            // Skip auto-attack-only units (they don't move)
            if (Has<AutoAttackOnly>(entity))
                continue;

            var state = Get<UnitState>(entity)!;

            // Only process moving units
            if (state.state != "moving" && state.state != "attacking")
                continue;

            // Need a move target to move
            if (!Has<MoveTarget>(entity))
            {
                if (state.state == "moving")
                    state.state = "idle";
                continue;
            }

            var transform = Get<Transform>(entity)!;
            var speed = Get<Speed>(entity)!;
            var target = Get<MoveTarget>(entity)!;

            // Calculate direction to target
            var dx = target.targetX - transform.x;
            var dy = target.targetY - transform.y;
            var distance = MathF.Sqrt(dx * dx + dy * dy);

            // Check if we've reached the target
            var arrivalDistance = state.state == "attacking" ? GetAttackRange(entity) : 5f;
            if (distance <= arrivalDistance)
            {
                if (state.state == "moving")
                {
                    state.state = "idle";
                    Remove<MoveTarget>(entity);
                }
                continue;
            }

            // Normalize and apply movement
            var moveDistance = speed.value * deltaTime;
            if (moveDistance > distance)
                moveDistance = distance;

            var normalX = dx / distance;
            var normalY = dy / distance;
            var newX = transform.x + normalX * moveDistance;
            var newY = transform.y + normalY * moveDistance;

            // Clamp to map bounds
            var clamped = MapBounds.ClampToPlayableArea(newX, newY, transform.radius);
            transform.x = clamped.x;
            transform.y = clamped.y;
        }
    }

    private float GetAttackRange(long entity)
    {
        if (TryGet<Attack>(entity, out var attack) && attack != null)
            return attack.range;
        return 5f;
    }
}
