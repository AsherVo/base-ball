using server.ECS.Components.Core;
using server.ECS.Messages;
using server.Setup;

namespace server.ECS.Systems.Win;

public class GoalCheckSystem : WorldManipulator, ISystem
{
    private Filter _ballFilter = null!;

    // Goal positions
    private readonly float _leftGoalX = GameConstants.GOAL_WIDTH;
    private readonly float _rightGoalX = GameConstants.WORLD_PIXEL_WIDTH - GameConstants.GOAL_WIDTH;
    private readonly float _goalTop = (GameConstants.WORLD_PIXEL_HEIGHT - GameConstants.GOAL_HEIGHT) / 2f;
    private readonly float _goalBottom;

    public GoalCheckSystem()
    {
        _goalBottom = _goalTop + GameConstants.GOAL_HEIGHT;
    }

    public void StartSystem(World world)
    {
        this.world = world;
        _ballFilter = new FilterBuilder()
            .Include<Transform>()
            .Include<EntityType>()
            .ToFilter();
        Start(_ballFilter);
    }

    public void StopSystem(World world)
    {
        Stop(_ballFilter);
    }

    public void TickSystem(World world)
    {
        foreach (var entity in _ballFilter.Entities)
        {
            var entityType = Get<EntityType>(entity)!;
            if (entityType.type != "ball")
                continue;

            var transform = Get<Transform>(entity)!;
            var ballX = transform.x;
            var ballY = transform.y;

            // Check if ball is in goal area
            if (ballY >= _goalTop && ballY <= _goalBottom)
            {
                // Check left goal (player 0 defends, player 1 scores)
                if (ballX <= _leftGoalX)
                {
                    // Player 1 (index 1) scores!
                    Send(new GameOverMessage
                    {
                        winnerIndex = 1,
                        reason = "Ball entered left goal"
                    });
                    return;
                }

                // Check right goal (player 1 defends, player 0 scores)
                if (ballX >= _rightGoalX)
                {
                    // Player 0 (index 0) scores!
                    Send(new GameOverMessage
                    {
                        winnerIndex = 0,
                        reason = "Ball entered right goal"
                    });
                    return;
                }
            }
        }
    }
}
