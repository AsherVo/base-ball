namespace server.ECS.Components.Unit;

public class UnitState : Component
{
    public string state = "idle";  // "idle", "moving", "attacking", "gathering", "building", "returning"
}
