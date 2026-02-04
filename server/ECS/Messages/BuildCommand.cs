namespace server.ECS.Messages;

public class BuildCommand : Message
{
    public string? playerId;
    public long workerId;
    public string buildingType = "";
    public float x;
    public float y;
}
