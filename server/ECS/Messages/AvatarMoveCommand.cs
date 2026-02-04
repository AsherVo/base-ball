namespace server.ECS.Messages;

public class AvatarMoveCommand : Message
{
    public string? playerId;
    public int directionX;
    public int directionY;
}
