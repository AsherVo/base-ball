namespace server.ECS.Messages;

public class GameOverMessage : Message
{
    public string? winnerId;
    public int winnerIndex;
    public string reason = "";
}
