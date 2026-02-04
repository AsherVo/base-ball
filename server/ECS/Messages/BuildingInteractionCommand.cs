namespace server.ECS.Messages;

public class BuildingInteractionCommand : Message
{
    public long avatarEntity;
    public long buildingEntity;
    public string action = "";  // "train"
    public string? unitType;
}
