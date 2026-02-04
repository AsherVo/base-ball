namespace server.ECS.Messages;

public class CollisionMessage : Message
{
    public long entityA;
    public long entityB;
    public float overlapDistance;
}
