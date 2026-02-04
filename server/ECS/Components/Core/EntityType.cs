namespace server.ECS.Components.Core;

public class EntityType : Component
{
    public string type = "unit";     // "unit", "building", "resource", "ball", "avatar"
    public string? subtype;          // "worker", "soldier", "base", "barracks", "minerals", etc.
}
