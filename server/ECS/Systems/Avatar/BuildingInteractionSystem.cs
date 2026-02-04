using server.ECS.Components.Core;
using server.ECS.Components.Avatar;
using server.ECS.Components.Building;
using server.ECS.Messages;
using server.Setup;

namespace server.ECS.Systems.Avatar;

public class BuildingInteractionSystem : WorldManipulator, ISystem
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
        var commands = Read<BuildingInteractionCommand>();

        foreach (var cmd in commands)
        {
            ProcessInteraction(cmd);
        }
    }

    private void ProcessInteraction(BuildingInteractionCommand cmd)
    {
        if (!Exists(cmd.avatarEntity) || !Exists(cmd.buildingEntity))
            return;

        var avatarTransform = Get<Transform>(cmd.avatarEntity);
        var avatarOwnership = Get<Ownership>(cmd.avatarEntity);
        var interactionRange = Get<InteractionRange>(cmd.avatarEntity);

        var buildingTransform = Get<Transform>(cmd.buildingEntity);
        var buildingOwnership = Get<Ownership>(cmd.buildingEntity);
        var buildingType = Get<EntityType>(cmd.buildingEntity);

        if (avatarTransform == null || buildingTransform == null ||
            avatarOwnership == null || buildingOwnership == null ||
            interactionRange == null || buildingType == null)
            return;

        // Check ownership
        if (avatarOwnership.playerIndex != buildingOwnership.playerIndex)
            return;

        // Check range
        var dx = buildingTransform.x - avatarTransform.x;
        var dy = buildingTransform.y - avatarTransform.y;
        var distance = MathF.Sqrt(dx * dx + dy * dy);

        if (distance > interactionRange.range + avatarTransform.radius + buildingTransform.radius)
            return;

        // Check if building is under construction
        if (Has<Construction>(cmd.buildingEntity))
            return;

        // Process action
        switch (cmd.action)
        {
            case "train":
                ProcessTrain(cmd.buildingEntity, cmd.unitType);
                break;
        }
    }

    private void ProcessTrain(long buildingEntity, string? unitType)
    {
        if (string.IsNullOrEmpty(unitType))
            return;

        var trains = Get<Trains>(buildingEntity);
        if (trains == null || !trains.unitTypes.Contains(unitType))
            return;

        var unitDef = EntityDefinitions.GetUnit(unitType);
        if (unitDef == null)
            return;

        var ownership = Get<Ownership>(buildingEntity)!;

        // Request train (will be validated by PlayerStateSystem for cost/supply)
        Send(new TrainRequestMessage
        {
            buildingEntity = buildingEntity,
            unitType = unitType,
            cost = unitDef.cost,
            supply = unitDef.supply,
            trainTime = unitDef.trainTime,
            playerId = ownership.ownerId
        });
    }
}
