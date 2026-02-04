namespace server.ECS.Messages;

public class GatherCommand : Message
{
    public string? playerId;
    public List<long> workerIds = new();
    public long resourceId;
}
