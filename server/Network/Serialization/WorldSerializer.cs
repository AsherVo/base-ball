using System.Text.Json;
using System.Text.Json.Serialization;
using server.ECS;
using server.ECS.Components.Core;
using server.ECS.Components.Combat;
using server.ECS.Components.Movement;
using server.ECS.Components.Unit;
using server.ECS.Components.Building;
using server.ECS.Components.Avatar;
using server.ECS.Components.Vision;
using server.ECS.Components.Resource;
using server.Setup;

namespace server.Network.Serialization;

/// <summary>
/// Serializes ECS World state to JSON matching the JS client protocol.
/// The output must be identical to shared/actor.js toJSON() and shared/world.js toJSON().
/// </summary>
public static class WorldSerializer
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    /// <summary>
    /// Serialize actor (entity) to JSON matching shared/actor.js toJSON()
    /// </summary>
    public static Dictionary<string, object?> SerializeActor(World world, long entity)
    {
        var transform = world.Get<Transform>(entity);
        var entityType = world.Get<EntityType>(entity);
        var sprite = world.Get<Sprite>(entity);
        var ownership = world.Get<Ownership>(entity);
        var health = world.Get<Health>(entity);
        var vision = world.Get<VisionRadius>(entity);

        if (transform == null || entityType == null)
            return new Dictionary<string, object?>();

        // Get state - buildings have special state handling
        string state = "idle";
        if (entityType.type == "building")
        {
            var construction = world.Get<Construction>(entity);
            state = construction != null ? "constructing" : "complete";
        }
        else
        {
            var unitState = world.Get<UnitState>(entity);
            state = unitState?.state ?? "idle";
        }

        var data = new Dictionary<string, object?>
        {
            ["id"] = entity,
            ["x"] = transform.x,
            ["y"] = transform.y,
            ["sprite"] = sprite?.identifier ?? entityType.subtype,
            ["type"] = entityType.type,
            ["subtype"] = entityType.subtype,
            ["ownerId"] = ownership?.ownerId,
            ["health"] = health?.health ?? 100,
            ["maxHealth"] = health?.maxHealth ?? 100,
            ["state"] = state,
            ["radius"] = transform.radius,
            ["visionRadius"] = vision?.radius ?? 200
        };

        // Type-specific fields
        switch (entityType.type)
        {
            case "unit":
                SerializeUnit(world, entity, data);
                break;
            case "avatar":
                SerializeAvatar(world, entity, data);
                break;
            case "building":
                SerializeBuilding(world, entity, data);
                break;
            case "resource":
                SerializeResource(world, entity, data);
                break;
            case "ball":
                SerializeBall(world, entity, data);
                break;
        }

        return data;
    }

    private static void SerializeUnit(World world, long entity, Dictionary<string, object?> data)
    {
        var attack = world.Get<Attack>(entity);
        var speed = world.Get<Speed>(entity);
        var moveTarget = world.Get<MoveTarget>(entity);
        var carryAmount = world.Get<CarryAmount>(entity);
        var isCarried = world.Has<Carried>(entity);
        var autoAttackOnly = world.Has<AutoAttackOnly>(entity);

        data["attack"] = attack?.damage ?? 0;
        data["speed"] = speed?.value ?? 100;
        data["targetX"] = moveTarget?.targetX;
        data["targetY"] = moveTarget?.targetY;
        data["carryAmount"] = carryAmount?.amount ?? 0;
        data["isCarried"] = isCarried;
        data["autoAttackOnly"] = autoAttackOnly;
    }

    private static void SerializeAvatar(World world, long entity, Dictionary<string, object?> data)
    {
        var speed = world.Get<Speed>(entity);
        var carriedUnitRelation = world.Get<CarriedUnit>(entity);

        data["speed"] = speed?.value ?? 150;
        data["carriedUnitId"] = carriedUnitRelation?.relation;
    }

    private static void SerializeBuilding(World world, long entity, Dictionary<string, object?> data)
    {
        var construction = world.Get<Construction>(entity);
        var trainingQueue = world.Get<TrainingQueue>(entity);

        if (construction != null)
        {
            data["constructionProgress"] = construction.progress;
            data["maxConstructionTime"] = construction.maxTime;
        }

        if (trainingQueue != null && trainingQueue.queue.Count > 0)
        {
            data["trainingQueue"] = trainingQueue.queue.Select(t => new Dictionary<string, object>
            {
                ["unitType"] = t.unitType,
                ["progress"] = t.progress,
                ["trainTime"] = t.trainTime
            }).ToList();
        }
    }

    private static void SerializeResource(World world, long entity, Dictionary<string, object?> data)
    {
        var resourceAmount = world.Get<ResourceAmount>(entity);
        data["amount"] = resourceAmount?.amount ?? 0;
    }

    private static void SerializeBall(World world, long entity, Dictionary<string, object?> data)
    {
        var velocity = world.Get<Velocity>(entity);
        data["velocityX"] = velocity?.x ?? 0;
        data["velocityY"] = velocity?.y ?? 0;
    }

    /// <summary>
    /// Serialize world to JSON matching shared/world.js toJSON()
    /// </summary>
    public static Dictionary<string, object> SerializeWorld(World world, Dictionary<string, int> players)
    {
        var entities = world.GetEntities();
        var actors = new List<Dictionary<string, object?>>();

        foreach (var entity in entities)
        {
            // Only serialize entities that have Transform and EntityType (actual game actors)
            if (!world.Has<Transform>(entity) || !world.Has<EntityType>(entity))
                continue;

            actors.Add(SerializeActor(world, entity));
        }

        // Players as array of [playerId, playerIndex] pairs
        var playersList = players.Select(kvp => new object[] { kvp.Key, kvp.Value }).ToList();

        return new Dictionary<string, object>
        {
            ["width"] = GameConstants.MAP_WIDTH,
            ["height"] = GameConstants.MAP_HEIGHT,
            ["actors"] = actors,
            ["nextActorId"] = entities.Count > 0 ? entities.Max() + 1 : 1,
            ["players"] = playersList
        };
    }

    /// <summary>
    /// Serialize to JSON string
    /// </summary>
    public static string ToJson<T>(T data)
    {
        return JsonSerializer.Serialize(data, JsonOptions);
    }
}
