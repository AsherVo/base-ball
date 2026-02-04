using server.ECS.Components.Core;
using server.ECS.Components.Movement;
using server.Setup;
using server.Util;

namespace server.ECS.Systems.Movement;

public class PhysicsSystem : WorldManipulator, ISystem
{
    private Filter _physicsFilter = null!;

    public void StartSystem(World world)
    {
        this.world = world;
        _physicsFilter = new FilterBuilder()
            .Include<Transform>()
            .Include<Velocity>()
            .Include<Friction>()
            .ToFilter();
        Start(_physicsFilter);
    }

    public void StopSystem(World world)
    {
        Stop(_physicsFilter);
    }

    public void TickSystem(World world)
    {
        var deltaTime = GameConstants.TICK_DELTA;

        foreach (var entity in _physicsFilter.Entities)
        {
            var transform = Get<Transform>(entity)!;
            var velocity = Get<Velocity>(entity)!;
            var friction = Get<Friction>(entity)!;

            // Apply velocity
            transform.x += velocity.x * deltaTime;
            transform.y += velocity.y * deltaTime;

            // Apply friction
            velocity.x *= friction.coefficient;
            velocity.y *= friction.coefficient;

            // Stop very slow movement
            var speed = MathF.Sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
            if (speed < GameConstants.BALL_MIN_VELOCITY)
            {
                velocity.x = 0;
                velocity.y = 0;
            }

            // Clamp to map bounds and bounce off walls
            var clamped = MapBounds.ClampToPlayableArea(transform.x, transform.y, transform.radius);

            // Check if position was clamped (hit a wall)
            if (clamped.x != transform.x || clamped.y != transform.y)
            {
                // Reflect velocity based on collision normal
                if (clamped.normalX != 0 || clamped.normalY != 0)
                {
                    // Calculate reflection: v' = v - 2(v·n)n
                    var dotProduct = velocity.x * clamped.normalX + velocity.y * clamped.normalY;
                    if (dotProduct < 0) // Only reflect if moving into the wall
                    {
                        velocity.x -= 2 * dotProduct * clamped.normalX;
                        velocity.y -= 2 * dotProduct * clamped.normalY;

                        // Apply energy loss on bounce
                        velocity.x *= 0.8f;
                        velocity.y *= 0.8f;
                    }
                }

                transform.x = clamped.x;
                transform.y = clamped.y;
            }
        }
    }
}
