namespace server.ECS.Core;

/// <summary>
/// Base class for relation components that reference other entities.
/// Relations are components that establish a typed link to another entity.
/// </summary>
public abstract class Relation : Component
{
    /// <summary>
    /// The target entity ID this relation points to.
    /// </summary>
    public int TargetId { get; set; }

    /// <summary>
    /// Check if the relation is still valid (target exists in world).
    /// </summary>
    public bool IsValid(World world)
    {
        return world.HasEntity(TargetId);
    }
}
