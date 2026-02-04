namespace server.ECS.Messages;

public class UnitTrainedMessage : Message
{
    public string unitType = "";
    public float x;
    public float y;
    public string? ownerId;
    public int playerIndex;
}
