using server.ECS.Components.Core;
using server.ECS.Components.Movement;
using server.ECS.Messages;
using server.Setup;

namespace server.ECS.Systems.Collision;

public class BallCollisionSystem : WorldManipulator, ISystem
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
            // Check if one entity is the ball
            var ballEntity = GetBallEntity(collision.entityA, collision.entityB);
            if (ballEntity == 0)
                continue;

            var otherEntity = ballEntity == collision.entityA ? collision.entityB : collision.entityA;

            ApplyBallKick(ballEntity, otherEntity);
        }
    }

    private long GetBallEntity(long entityA, long entityB)
    {
        var typeA = Get<EntityType>(entityA);
        var typeB = Get<EntityType>(entityB);

        if (typeA?.type == "ball")
            return entityA;
        if (typeB?.type == "ball")
            return entityB;

        return 0;
    }

    private void ApplyBallKick(long ballEntity, long kickerEntity)
    {
        var ballTransform = Get<Transform>(ballEntity);
        var kickerTransform = Get<Transform>(kickerEntity);
        var velocity = Get<Velocity>(ballEntity);

        if (ballTransform == null || kickerTransform == null || velocity == null)
            return;

        var kickerType = Get<EntityType>(kickerEntity);

        // Calculate kick direction (from kicker to ball)
        var dx = ballTransform.x - kickerTransform.x;
        var dy = ballTransform.y - kickerTransform.y;
        var distance = MathF.Sqrt(dx * dx + dy * dy);

        if (distance < 0.001f)
        {
            dx = 1;
            dy = 0;
            distance = 1;
        }

        var nx = dx / distance;
        var ny = dy / distance;

        // Calculate kick force based on entity type
        float kickForce = GameConstants.BALL_KICK_FORCE;

        if (kickerType?.type == "avatar")
        {
            // Avatars kick harder when moving
            var direction = Get<ECS.Components.Avatar.MoveDirection>(kickerEntity);
            if (direction != null && (direction.directionX != 0 || direction.directionY != 0))
            {
                kickForce *= 1.5f;

                // Add avatar's movement direction to kick
                var speed = Get<Speed>(kickerEntity);
                if (speed != null)
                {
                    var moveX = direction.directionX;
                    var moveY = direction.directionY;
                    var moveMag = MathF.Sqrt(moveX * moveX + moveY * moveY);
                    if (moveMag > 0)
                    {
                        nx = (nx + moveX / moveMag) / 2f;
                        ny = (ny + moveY / moveMag) / 2f;
                        var newMag = MathF.Sqrt(nx * nx + ny * ny);
                        if (newMag > 0)
                        {
                            nx /= newMag;
                            ny /= newMag;
                        }
                    }
                }
            }
        }
        else if (kickerType?.type == "unit")
        {
            // Units kick with less force
            kickForce *= 0.7f;
        }
        else if (kickerType?.type == "building")
        {
            // Buildings just bounce the ball off
            kickForce *= 0.5f;
        }

        // Apply kick to ball velocity
        velocity.x += nx * kickForce;
        velocity.y += ny * kickForce;

        // Cap max velocity
        var speed_val = MathF.Sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        const float maxSpeed = 800f;
        if (speed_val > maxSpeed)
        {
            velocity.x = velocity.x / speed_val * maxSpeed;
            velocity.y = velocity.y / speed_val * maxSpeed;
        }
    }
}
