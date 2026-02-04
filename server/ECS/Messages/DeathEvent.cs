namespace server.ECS.Messages;

public class DeathEvent : Message
{
    public long entityId;
    public string? killerId;  // Owner ID of the killer, if any
}
