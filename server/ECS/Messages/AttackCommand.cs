namespace server.ECS.Messages;

public class AttackCommand : Message
{
    public string? playerId;
    public List<long> actorIds = new();
    public long targetId;
}
