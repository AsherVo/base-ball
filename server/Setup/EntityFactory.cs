using server.ECS;
using server.ECS.Components.Core;
using server.ECS.Components.Combat;
using server.ECS.Components.Movement;
using server.ECS.Components.Unit;
using server.ECS.Components.Building;
using server.ECS.Components.Avatar;
using server.ECS.Components.Vision;
using server.ECS.Components.Resource;

namespace server.Setup;

public static class EntityFactory
{
    public static long CreateUnit(World world, string subtype, float x, float y, string? ownerId, int playerIndex)
    {
        var def = EntityDefinitions.GetUnit(subtype);
        if (def == null)
            throw new ArgumentException($"Unknown unit type: {subtype}");

        var entity = world.Create(subtype);

        world.Add(entity, new Transform { x = x, y = y, radius = def.radius });
        world.Add(entity, new EntityType { type = "unit", subtype = subtype });
        world.Add(entity, new Sprite { identifier = subtype });
        world.Add(entity, new Ownership { ownerId = ownerId, playerIndex = playerIndex });
        world.Add(entity, new Health { health = def.health, maxHealth = def.health });
        world.Add(entity, new Attack { damage = def.attack, range = def.attackRange, speed = def.attackSpeed });
        world.Add(entity, new Speed { value = def.speed });
        world.Add(entity, new UnitState { state = "idle" });
        world.Add(entity, new VisionRadius { radius = def.visionRadius });

        if (def.canGather)
        {
            world.Add<CanGather>(entity);
            world.Add(entity, new CarryAmount { amount = 0 });
        }

        if (def.canBuild)
            world.Add<CanBuild>(entity);

        return entity;
    }

    public static long CreateBuilding(World world, string subtype, float x, float y, string? ownerId, int playerIndex, bool constructing = false)
    {
        var def = EntityDefinitions.GetBuilding(subtype);
        if (def == null)
            throw new ArgumentException($"Unknown building type: {subtype}");

        var entity = world.Create(subtype);

        world.Add(entity, new Transform { x = x, y = y, radius = def.radius });
        world.Add(entity, new EntityType { type = "building", subtype = subtype });
        world.Add(entity, new Sprite { identifier = subtype });
        world.Add(entity, new Ownership { ownerId = ownerId, playerIndex = playerIndex });
        world.Add(entity, new Health { health = constructing ? def.health * 0.1f : def.health, maxHealth = def.health });
        world.Add(entity, new VisionRadius { radius = def.visionRadius });
        world.Add(entity, new RallyPoint { offsetX = 50, offsetY = 0 });

        if (def.trains.Count > 0)
        {
            world.Add(entity, new Trains { unitTypes = new List<string>(def.trains) });
            world.Add(entity, new TrainingQueue { queue = new List<TrainingItem>() });
        }

        if (def.suppliesProvided > 0)
            world.Add(entity, new SuppliesProvided { amount = def.suppliesProvided });

        if (constructing)
            world.Add(entity, new Construction { progress = 0, maxTime = def.buildTime });

        return entity;
    }

    public static long CreateResource(World world, string subtype, float x, float y)
    {
        var def = EntityDefinitions.GetResource(subtype);
        if (def == null)
            throw new ArgumentException($"Unknown resource type: {subtype}");

        var entity = world.Create(subtype);

        world.Add(entity, new Transform { x = x, y = y, radius = def.radius });
        world.Add(entity, new EntityType { type = "resource", subtype = subtype });
        world.Add(entity, new Sprite { identifier = subtype });
        world.Add(entity, new ResourceAmount { amount = def.amount, gatherRate = def.gatherRate });

        return entity;
    }

    public static long CreateBall(World world, float x, float y)
    {
        var def = EntityDefinitions.GetSpecial("ball")!;
        var entity = world.Create("ball");

        world.Add(entity, new Transform { x = x, y = y, radius = def.radius });
        world.Add(entity, new EntityType { type = "ball", subtype = "ball" });
        world.Add(entity, new Sprite { identifier = "ball" });
        world.Add(entity, new Velocity { x = 0, y = 0 });
        world.Add(entity, new Friction { coefficient = GameConstants.BALL_FRICTION });
        world.Add(entity, new VisionRadius { radius = def.visionRadius });

        return entity;
    }

    public static long CreateAvatar(World world, float x, float y, string? ownerId, int playerIndex)
    {
        var def = EntityDefinitions.GetSpecial("avatar")!;
        var entity = world.Create("avatar");

        world.Add(entity, new Transform { x = x, y = y, radius = def.radius });
        world.Add(entity, new EntityType { type = "avatar", subtype = "avatar" });
        world.Add(entity, new Sprite { identifier = "avatar" });
        world.Add(entity, new Ownership { ownerId = ownerId, playerIndex = playerIndex });
        world.Add(entity, new Health { health = def.health, maxHealth = def.health });
        world.Add(entity, new Speed { value = def.speed });
        world.Add(entity, new MoveDirection { directionX = 0, directionY = 0 });
        world.Add(entity, new PickupRange { range = def.pickupRange });
        world.Add(entity, new InteractionRange { range = def.interactionRange });
        world.Add(entity, new VisionRadius { radius = def.visionRadius });

        return entity;
    }
}
