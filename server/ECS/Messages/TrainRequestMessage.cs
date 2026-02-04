namespace server.ECS.Messages;

public class TrainRequestMessage : Message
{
    public long buildingEntity;
    public string unitType = "";
    public int cost;
    public int supply;
    public float trainTime;
    public string? playerId;
}
