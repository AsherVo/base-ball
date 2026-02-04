using server.ECS.Components.Core;
using server.ECS.Components.Unit;
using server.ECS.Components.Movement;
using server.ECS.Components.Combat;
using server.ECS.Components.Building;
using server.Setup;

namespace server.ECS.Systems.Economy;

public class ConstructionSystem : WorldManipulator, ISystem
{
    private Filter _constructionFilter = null!;
    private Filter _builderFilter = null!;

    public void StartSystem(World world)
    {
        this.world = world;
        _constructionFilter = new FilterBuilder()
            .Include<Construction>()
            .Include<Transform>()
            .Include<Health>()
            .ToFilter();
        Start(_constructionFilter);

        _builderFilter = new FilterBuilder()
            .Include<Transform>()
            .Include<BuildTarget>()
            .Include<UnitState>()
            .ToFilter();
        Start(_builderFilter);
    }

    public void StopSystem(World world)
    {
        Stop(_constructionFilter);
        Stop(_builderFilter);
    }

    public void TickSystem(World world)
    {
        var deltaTime = GameConstants.TICK_DELTA;

        // Process workers building
        foreach (var entity in _builderFilter.Entities)
        {
            // Skip carried units
            if (Has<Carried>(entity))
                continue;

            var state = Get<UnitState>(entity)!;
            if (state.state != "building")
                continue;

            ProcessBuilder(entity, state, deltaTime);
        }

        // Also allow buildings under construction to progress automatically if workers are nearby
        // (handled by workers through ProcessBuilder)
    }

    private void ProcessBuilder(long entity, UnitState state, float deltaTime)
    {
        var buildingEntity = GetRelated<BuildTarget>(entity);

        if (buildingEntity == 0 || !Exists(buildingEntity))
        {
            Remove<BuildTarget>(entity);
            state.state = "idle";
            return;
        }

        var builderTransform = Get<Transform>(entity)!;
        var buildingTransform = Get<Transform>(buildingEntity)!;
        var construction = Get<Construction>(buildingEntity);

        if (construction == null)
        {
            // Building finished
            Remove<BuildTarget>(entity);
            state.state = "idle";
            return;
        }

        // Check if in range
        var dx = buildingTransform.x - builderTransform.x;
        var dy = buildingTransform.y - builderTransform.y;
        var distance = MathF.Sqrt(dx * dx + dy * dy);
        var buildRange = builderTransform.radius + buildingTransform.radius + 30f;

        if (distance > buildRange)
        {
            // Move toward building
            var moveTarget = GetOrAdd<MoveTarget>(entity);
            moveTarget.targetX = buildingTransform.x;
            moveTarget.targetY = buildingTransform.y;
            state.state = "moving";
            return;
        }

        // In range - build
        Remove<MoveTarget>(entity);
        state.state = "building";

        construction.progress += deltaTime;

        // Increase health proportionally
        var buildingHealth = Get<Health>(buildingEntity)!;
        var progressRatio = construction.progress / construction.maxTime;
        buildingHealth.health = progressRatio * buildingHealth.maxHealth;

        // Check if construction complete
        if (construction.progress >= construction.maxTime)
        {
            buildingHealth.health = buildingHealth.maxHealth;
            Remove<Construction>(buildingEntity);
            Remove<BuildTarget>(entity);
            state.state = "idle";
        }
    }
}
