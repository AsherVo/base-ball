namespace server.ECS.Messages;

public class AttackEvent : Message
{
    public long attackerId;
    public long targetId;
    public float damage;
}
