using server.ECS.Components.Core;
using server.ECS.Components.Unit;
using server.ECS.Messages;
using server.Setup;

namespace server.ECS.Systems.Collision;

public class CollisionDetectionSystem : WorldManipulator, ISystem
{
    private Filter _collidableFilter = null!;
    private readonly List<long> _entityList = new();

    // Spatial hash for performance
    private readonly Dictionary<int, List<long>> _spatialHash = new();
    private const int CellSize = 128;

    public void StartSystem(World world)
    {
        this.world = world;
        _collidableFilter = new FilterBuilder()
            .Include<Transform>()
            .ToFilter();
        Start(_collidableFilter);
    }

    public void StopSystem(World world)
    {
        Stop(_collidableFilter);
    }

    public void TickSystem(World world)
    {
        // Build spatial hash
        _spatialHash.Clear();
        _entityList.Clear();

        foreach (var entity in _collidableFilter.Entities)
        {
            // Skip carried units
            if (Has<Carried>(entity))
                continue;

            _entityList.Add(entity);

            var transform = Get<Transform>(entity)!;
            var cells = GetCells(transform.x, transform.y, transform.radius);

            foreach (var cell in cells)
            {
                if (!_spatialHash.ContainsKey(cell))
                    _spatialHash[cell] = new List<long>();
                _spatialHash[cell].Add(entity);
            }
        }

        // Check for collisions using spatial hash
        var checkedPairs = new HashSet<(long, long)>();

        foreach (var entity in _entityList)
        {
            var transformA = Get<Transform>(entity)!;
            var cells = GetCells(transformA.x, transformA.y, transformA.radius);

            foreach (var cell in cells)
            {
                if (!_spatialHash.TryGetValue(cell, out var cellEntities))
                    continue;

                foreach (var other in cellEntities)
                {
                    if (entity >= other)
                        continue;

                    // Skip if already checked
                    var pair = (entity, other);
                    if (checkedPairs.Contains(pair))
                        continue;
                    checkedPairs.Add(pair);

                    var transformB = Get<Transform>(other)!;

                    // Check circle-circle collision
                    var dx = transformB.x - transformA.x;
                    var dy = transformB.y - transformA.y;
                    var distSquared = dx * dx + dy * dy;
                    var minDist = transformA.radius + transformB.radius;

                    if (distSquared < minDist * minDist)
                    {
                        Send(new CollisionMessage
                        {
                            entityA = entity,
                            entityB = other,
                            overlapDistance = minDist - MathF.Sqrt(distSquared)
                        });
                    }
                }
            }
        }
    }

    private List<int> GetCells(float x, float y, float radius)
    {
        var cells = new List<int>();
        var minX = (int)MathF.Floor((x - radius) / CellSize);
        var maxX = (int)MathF.Floor((x + radius) / CellSize);
        var minY = (int)MathF.Floor((y - radius) / CellSize);
        var maxY = (int)MathF.Floor((y + radius) / CellSize);

        for (var cy = minY; cy <= maxY; cy++)
        {
            for (var cx = minX; cx <= maxX; cx++)
            {
                cells.Add(cy * 10000 + cx);
            }
        }

        return cells;
    }
}
