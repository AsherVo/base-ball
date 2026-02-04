using server.ECS.Components.Core;
using server.ECS.Components.Avatar;
using server.ECS.Components.Movement;
using server.Setup;
using server.Util;

namespace server.ECS.Systems.Movement;

public class AvatarMovementSystem : WorldManipulator, ISystem
{
    private Filter _avatarFilter = null!;

    public void StartSystem(World world)
    {
        this.world = world;
        _avatarFilter = new FilterBuilder()
            .Include<Transform>()
            .Include<MoveDirection>()
            .Include<Speed>()
            .ToFilter();
        Start(_avatarFilter);
    }

    public void StopSystem(World world)
    {
        Stop(_avatarFilter);
    }

    public void TickSystem(World world)
    {
        var deltaTime = GameConstants.TICK_DELTA;

        foreach (var entity in _avatarFilter.Entities)
        {
            var transform = Get<Transform>(entity)!;
            var direction = Get<MoveDirection>(entity)!;
            var speed = Get<Speed>(entity)!;

            if (direction.directionX == 0 && direction.directionY == 0)
                continue;

            // Calculate movement
            var dx = direction.directionX * speed.value * deltaTime;
            var dy = direction.directionY * speed.value * deltaTime;

            // Normalize diagonal movement
            if (direction.directionX != 0 && direction.directionY != 0)
            {
                var factor = 1f / MathF.Sqrt(2f);
                dx *= factor;
                dy *= factor;
            }

            // Apply movement
            var newX = transform.x + dx;
            var newY = transform.y + dy;

            // Clamp to map bounds
            var clamped = MapBounds.ClampToPlayableArea(newX, newY, transform.radius);
            transform.x = clamped.x;
            transform.y = clamped.y;
        }
    }
}
