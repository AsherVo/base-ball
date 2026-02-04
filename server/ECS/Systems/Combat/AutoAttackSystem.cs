using server.ECS.Components.Core;
using server.ECS.Components.Combat;
using server.ECS.Components.Unit;
using server.Setup;

namespace server.ECS.Systems.Combat;

public class AutoAttackSystem : WorldManipulator, ISystem
{
    private Filter _combatantFilter = null!;
    private Filter _potentialTargetFilter = null!;

    public void StartSystem(World world)
    {
        this.world = world;

        // Units/buildings that can attack
        _combatantFilter = new FilterBuilder()
            .Include<Transform>()
            .Include<Attack>()
            .Include<Ownership>()
            .Exclude<AttackTarget>()
            .ToFilter();
        Start(_combatantFilter);

        // Potential targets
        _potentialTargetFilter = new FilterBuilder()
            .Include<Transform>()
            .Include<Health>()
            .Include<Ownership>()
            .ToFilter();
        Start(_potentialTargetFilter);
    }

    public void StopSystem(World world)
    {
        Stop(_combatantFilter);
        Stop(_potentialTargetFilter);
    }

    public void TickSystem(World world)
    {
        foreach (var entity in _combatantFilter.Entities)
        {
            // Skip if already has a target
            if (Has<AttackTarget>(entity))
                continue;

            // Only auto-attack if idle or if AutoAttackOnly
            if (TryGet<UnitState>(entity, out var state) && state != null)
            {
                if (!Has<AutoAttackOnly>(entity) && state.state != "idle")
                    continue;
            }

            // Skip carried units
            if (Has<Carried>(entity))
                continue;

            var ownership = Get<Ownership>(entity)!;
            var transform = Get<Transform>(entity)!;
            var attack = Get<Attack>(entity)!;

            // Don't auto-attack if attack damage is 0
            if (attack.damage <= 0)
                continue;

            // Find nearest enemy in range
            var nearestEnemy = FindNearestEnemy(entity, transform, ownership, attack.range);

            if (nearestEnemy != 0)
            {
                // Set attack target
                SetRelation<AttackTarget>(entity, nearestEnemy);

                if (state != null)
                    state.state = "attacking";
            }
        }
    }

    private long FindNearestEnemy(long entity, Transform myTransform, Ownership myOwnership, float attackRange)
    {
        long nearest = 0;
        float nearestDist = float.MaxValue;

        // Expand search range beyond attack range to find targets
        var searchRange = attackRange + 100f;

        foreach (var target in _potentialTargetFilter.Entities)
        {
            if (target == entity)
                continue;

            var targetOwnership = Get<Ownership>(target);
            if (targetOwnership == null)
                continue;

            // Skip friendly units
            if (targetOwnership.playerIndex == myOwnership.playerIndex)
                continue;

            var targetTransform = Get<Transform>(target)!;

            var dx = targetTransform.x - myTransform.x;
            var dy = targetTransform.y - myTransform.y;
            var dist = MathF.Sqrt(dx * dx + dy * dy);

            if (dist < nearestDist && dist <= searchRange + myTransform.radius + targetTransform.radius)
            {
                nearestDist = dist;
                nearest = target;
            }
        }

        return nearest;
    }
}
