using server.ECS.Components.Core;
using server.ECS.Components.Movement;
using server.ECS.Messages;

namespace server.ECS.Systems.Collision;

public class CollisionResolutionSystem : WorldManipulator, ISystem
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
        var collisions = Read<CollisionMessage>();

        foreach (var collision in collisions)
        {
            ResolveCollision(collision.entityA, collision.entityB);
        }
    }

    private void ResolveCollision(long entityA, long entityB)
    {
        if (!Exists(entityA) || !Exists(entityB))
            return;

        var transformA = Get<Transform>(entityA);
        var transformB = Get<Transform>(entityB);

        if (transformA == null || transformB == null)
            return;

        var typeA = Get<EntityType>(entityA);
        var typeB = Get<EntityType>(entityB);

        // Calculate separation
        var dx = transformB.x - transformA.x;
        var dy = transformB.y - transformA.y;
        var distance = MathF.Sqrt(dx * dx + dy * dy);

        if (distance < 0.001f)
        {
            // Entities are at same position, push apart randomly
            dx = 1;
            dy = 0;
            distance = 1;
        }

        var overlap = (transformA.radius + transformB.radius) - distance;
        if (overlap <= 0)
            return;

        var nx = dx / distance;
        var ny = dy / distance;

        // Determine push factors based on entity types
        var massA = GetMass(typeA);
        var massB = GetMass(typeB);
        var totalMass = massA + massB;

        if (totalMass < 0.001f)
            totalMass = 2f;

        var pushA = (massB / totalMass) * overlap;
        var pushB = (massA / totalMass) * overlap;

        // Apply separation
        if (massA < float.MaxValue)
        {
            transformA.x -= nx * pushA;
            transformA.y -= ny * pushA;
        }

        if (massB < float.MaxValue)
        {
            transformB.x += nx * pushB;
            transformB.y += ny * pushB;
        }
    }

    private float GetMass(EntityType? entityType)
    {
        if (entityType == null)
            return 1f;

        return entityType.type switch
        {
            "building" => float.MaxValue, // Buildings don't move
            "resource" => float.MaxValue, // Resources don't move
            "ball" => 2f,                 // Ball is heavy but movable
            "avatar" => 1f,
            "unit" => 1f,
            _ => 1f
        };
    }
}
