using server.ECS.Components.Core;
using server.ECS.Components.Combat;
using server.ECS.Components.Unit;
using server.ECS.Components.Movement;
using server.ECS.Messages;
using server.Setup;

namespace server.ECS.Systems.Combat;

public class AttackSystem : WorldManipulator, ISystem
{
    private Filter _attackerFilter = null!;

    public void StartSystem(World world)
    {
        this.world = world;
        _attackerFilter = new FilterBuilder()
            .Include<Transform>()
            .Include<Attack>()
            .Include<AttackTarget>()
            .ToFilter();
        Start(_attackerFilter);
    }

    public void StopSystem(World world)
    {
        Stop(_attackerFilter);
    }

    public void TickSystem(World world)
    {
        var deltaTime = GameConstants.TICK_DELTA;

        foreach (var entity in _attackerFilter.Entities)
        {
            var targetRelation = Get<AttackTarget>(entity)!;
            var targetEntity = targetRelation.relation;

            // Check if target still exists
            if (!Exists(targetEntity))
            {
                Remove<AttackTarget>(entity);
                ResetToIdle(entity);
                continue;
            }

            var attackerTransform = Get<Transform>(entity)!;
            var targetTransform = Get<Transform>(targetEntity);

            if (targetTransform == null)
            {
                Remove<AttackTarget>(entity);
                ResetToIdle(entity);
                continue;
            }

            var attack = Get<Attack>(entity)!;

            // Calculate distance to target
            var dx = targetTransform.x - attackerTransform.x;
            var dy = targetTransform.y - attackerTransform.y;
            var distance = MathF.Sqrt(dx * dx + dy * dy);
            var attackRange = attack.range + attackerTransform.radius + targetTransform.radius;

            // If out of range, move toward target
            if (distance > attackRange)
            {
                // Set move target if unit can move
                if (Has<UnitState>(entity) && !Has<AutoAttackOnly>(entity))
                {
                    var state = Get<UnitState>(entity)!;
                    state.state = "attacking";

                    var moveTarget = GetOrAdd<MoveTarget>(entity);
                    moveTarget.targetX = targetTransform.x;
                    moveTarget.targetY = targetTransform.y;
                }
                continue;
            }

            // In range - handle attack cooldown
            var cooldown = GetOrAdd<AttackCooldown>(entity);

            if (cooldown.remaining > 0)
            {
                cooldown.remaining -= deltaTime;
                continue;
            }

            // Attack!
            cooldown.remaining = 1f / attack.speed;

            // Deal damage
            var targetHealth = Get<Health>(targetEntity);
            if (targetHealth != null)
            {
                targetHealth.health -= attack.damage;

                // Send attack event for visual feedback
                Send(new AttackEvent
                {
                    attackerId = entity,
                    targetId = targetEntity,
                    damage = attack.damage
                });

                // Check for death
                if (targetHealth.health <= 0)
                {
                    var attackerOwnership = Get<Ownership>(entity);
                    Send(new DeathEvent
                    {
                        entityId = targetEntity,
                        killerId = attackerOwnership?.ownerId
                    });

                    Remove<AttackTarget>(entity);
                    ResetToIdle(entity);
                }
            }
        }
    }

    private void ResetToIdle(long entity)
    {
        if (TryGet<UnitState>(entity, out var state) && state != null)
            state.state = "idle";

        Remove<MoveTarget>(entity);
    }
}
