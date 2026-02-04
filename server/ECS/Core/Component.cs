namespace server.ECS.Core;

/// <summary>
/// Base class for all components. Components are pure data containers
/// with no behavior.
/// </summary>
public abstract class Component
{
    /// <summary>
    /// The entity this component belongs to.
    /// Set by the World when the component is added.
    /// </summary>
    public int EntityId { get; internal set; }
}
