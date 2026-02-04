using server.ECS.Components.Core;
using server.ECS.Components.Building;
using server.ECS.Messages;
using server.Setup;

namespace server.ECS.Systems.Economy;

public class TrainingSystem : WorldManipulator, ISystem
{
    private Filter _trainerFilter = null!;

    public void StartSystem(World world)
    {
        this.world = world;
        _trainerFilter = new FilterBuilder()
            .Include<TrainingQueue>()
            .Include<Transform>()
            .Include<Ownership>()
            .Exclude<Construction>()  // Can't train while under construction
            .ToFilter();
        Start(_trainerFilter);
    }

    public void StopSystem(World world)
    {
        Stop(_trainerFilter);
    }

    public void TickSystem(World world)
    {
        var deltaTime = GameConstants.TICK_DELTA;

        foreach (var entity in _trainerFilter.Entities)
        {
            var queue = Get<TrainingQueue>(entity)!;

            if (queue.queue.Count == 0)
                continue;

            var currentTraining = queue.queue[0];
            currentTraining.progress += deltaTime;

            if (currentTraining.progress >= currentTraining.trainTime)
            {
                // Training complete
                var transform = Get<Transform>(entity)!;
                var ownership = Get<Ownership>(entity)!;
                var rallyPoint = Get<RallyPoint>(entity);

                // Calculate spawn position
                var spawnX = transform.x + (rallyPoint?.offsetX ?? 50f);
                var spawnY = transform.y + (rallyPoint?.offsetY ?? 0f);

                // Send message to spawn unit
                Send(new UnitTrainedMessage
                {
                    unitType = currentTraining.unitType,
                    x = spawnX,
                    y = spawnY,
                    ownerId = ownership.ownerId,
                    playerIndex = ownership.playerIndex
                });

                queue.queue.RemoveAt(0);
            }
        }
    }
}
