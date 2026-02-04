using server.ECS.Components.Core;
using server.ECS.Components.Avatar;
using server.ECS.Components.Unit;
using server.ECS.Components.Movement;
using server.ECS.Components.Combat;
using server.ECS.Messages;

namespace server.ECS.Systems.Avatar;

public class PickupDropSystem : WorldManipulator, ISystem
{
    public void StartSystem(World world)
    {
        this.world = world;
    }

    public void StopSystem(World world)
    {
    }

    public void TickSystem(World world)
    {
        // Process pickup commands
        var pickupCommands = Read<PickupCommand>();
        foreach (var cmd in pickupCommands)
        {
            ProcessPickup(cmd.avatarEntity);
        }

        // Process drop commands
        var dropCommands = Read<DropCommand>();
        foreach (var cmd in dropCommands)
        {
            ProcessDrop(cmd.avatarEntity);
        }
    }

    private void ProcessPickup(long avatarEntity)
    {
        if (!Exists(avatarEntity))
            return;

        // Check if already carrying a unit
        if (Has<CarriedUnit>(avatarEntity))
            return;

        var avatarTransform = Get<Transform>(avatarEntity);
        var avatarOwnership = Get<Ownership>(avatarEntity);
        var pickupRange = Get<PickupRange>(avatarEntity);

        if (avatarTransform == null || avatarOwnership == null || pickupRange == null)
            return;

        // Find nearest unit in range that belongs to the same player
        var nearestUnit = FindNearestPickupableUnit(avatarTransform, avatarOwnership, pickupRange.range);

        if (nearestUnit == 0)
            return;

        // Pick up the unit
        SetRelation<CarriedUnit>(avatarEntity, nearestUnit);
        Add<Carried>(nearestUnit);

        // Clear unit's movement and attack targets
        Remove<MoveTarget>(nearestUnit);
        Remove<AttackTarget>(nearestUnit);

        if (TryGet<UnitState>(nearestUnit, out var state) && state != null)
            state.state = "idle";
    }

    private void ProcessDrop(long avatarEntity)
    {
        if (!Exists(avatarEntity))
            return;

        var carriedRelation = Get<CarriedUnit>(avatarEntity);
        if (carriedRelation == null)
            return;

        var carriedUnit = carriedRelation.relation;
        if (!Exists(carriedUnit))
        {
            Remove<CarriedUnit>(avatarEntity);
            return;
        }

        var avatarTransform = Get<Transform>(avatarEntity);
        var unitTransform = Get<Transform>(carriedUnit);

        if (avatarTransform == null || unitTransform == null)
            return;

        // Place unit at avatar's position
        unitTransform.x = avatarTransform.x;
        unitTransform.y = avatarTransform.y;

        // Mark unit as auto-attack only (dropped units don't move)
        Add<AutoAttackOnly>(carriedUnit);

        // Remove carried state
        Remove<Carried>(carriedUnit);
        Remove<CarriedUnit>(avatarEntity);

        if (TryGet<UnitState>(carriedUnit, out var state) && state != null)
            state.state = "idle";
    }

    private long FindNearestPickupableUnit(Transform avatarTransform, Ownership avatarOwnership, float range)
    {
        long nearest = 0;
        float nearestDist = float.MaxValue;

        var entities = world.GetEntities();
        foreach (var entity in entities)
        {
            var entityType = Get<EntityType>(entity);
            if (entityType?.type != "unit")
                continue;

            // Skip already carried units
            if (Has<Carried>(entity))
                continue;

            var unitOwnership = Get<Ownership>(entity);
            if (unitOwnership?.playerIndex != avatarOwnership.playerIndex)
                continue;

            var unitTransform = Get<Transform>(entity);
            if (unitTransform == null)
                continue;

            var dx = unitTransform.x - avatarTransform.x;
            var dy = unitTransform.y - avatarTransform.y;
            var dist = MathF.Sqrt(dx * dx + dy * dy);

            if (dist <= range + avatarTransform.radius + unitTransform.radius && dist < nearestDist)
            {
                nearestDist = dist;
                nearest = entity;
            }
        }

        return nearest;
    }
}
