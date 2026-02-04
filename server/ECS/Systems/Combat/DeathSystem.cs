using server.ECS.Components.Core;
using server.ECS.Components.Combat;
using server.ECS.Components.Avatar;
using server.ECS.Messages;

namespace server.ECS.Systems.Combat;

public class DeathSystem : WorldManipulator, ISystem
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
        var deaths = Read<DeathEvent>();

        foreach (var death in deaths)
        {
            if (!Exists(death.entityId))
                continue;

            // If entity is being carried, drop it first
            var carriers = GetRelations<CarriedUnit>(death.entityId);
            foreach (var (carrierId, _) in carriers)
            {
                Remove<CarriedUnit>(carrierId);
            }

            // Clear any attack targets pointing to this entity
            var attackers = GetRelations<AttackTarget>(death.entityId);
            foreach (var (attackerId, _) in attackers)
            {
                Remove<AttackTarget>(attackerId);
            }

            // Destroy the entity
            Destroy(death.entityId);
        }
    }
}
