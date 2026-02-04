namespace server.ECS.Components.Core;

public class Ownership : Component
{
    public string? ownerId;  // Player socket ID
    public int playerIndex;  // 0 or 1
}
