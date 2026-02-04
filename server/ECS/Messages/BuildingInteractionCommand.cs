namespace server.ECS.Messages;

public class BuildingInteractionCommand : Message
{
    public string? playerId;
    public long buildingId;
    public string action = "";  // "train"
    public string? unitType;
}
