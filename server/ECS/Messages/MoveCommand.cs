namespace server.ECS.Messages;

public class MoveCommand : Message
{
    public string? playerId;
    public List<long> actorIds = new();
    public float targetX;
    public float targetY;
}
