namespace server.ECS.Components.Building;

// List of unit types this building can train
public class Trains : Component
{
    public List<string> unitTypes = new();
}
