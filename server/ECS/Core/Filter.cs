namespace server.ECS.Core;

/// <summary>
/// A filter for querying entities based on their components.
/// Filters are immutable once built.
/// </summary>
public class Filter
{
    private readonly World _world;
    private readonly Type[] _includeTypes;
    private readonly Type[] _excludeTypes;

    internal Filter(World world, Type[] includeTypes, Type[] excludeTypes)
    {
        _world = world;
        _includeTypes = includeTypes;
        _excludeTypes = excludeTypes;
    }

    /// <summary>
    /// Get all entity IDs matching this filter.
    /// </summary>
    public IEnumerable<int> GetEntities()
    {
        // If no include types, start with all entities
        IEnumerable<int> candidates = _includeTypes.Length > 0
            ? _world.GetEntitiesWithComponents(_includeTypes)
            : _world.Entities;

        // Apply exclusions
        if (_excludeTypes.Length > 0)
        {
            candidates = candidates.Where(entityId =>
                !_excludeTypes.Any(type => _world.HasComponent(entityId, type)));
        }

        return candidates;
    }

    /// <summary>
    /// Get the count of matching entities.
    /// </summary>
    public int Count() => GetEntities().Count();

    /// <summary>
    /// Check if any entity matches this filter.
    /// </summary>
    public bool Any() => GetEntities().Any();

    /// <summary>
    /// Get the first matching entity, or Entity.None if none match.
    /// </summary>
    public Entity First()
    {
        var id = GetEntities().FirstOrDefault(-1);
        return id >= 0 ? new Entity(id) : Entity.None;
    }
}

/// <summary>
/// Extension methods to support HasComponent with Type parameter.
/// </summary>
public static class WorldFilterExtensions
{
    public static bool HasComponent(this World world, int entityId, Type componentType)
    {
        // Use reflection to call the generic method
        var method = typeof(World).GetMethod(nameof(World.HasComponent))!
            .MakeGenericMethod(componentType);
        return (bool)method.Invoke(world, new object[] { entityId })!;
    }
}

/// <summary>
/// Builder for creating entity filters.
/// </summary>
public class FilterBuilder
{
    private readonly World _world;
    private readonly List<Type> _includeTypes = new();
    private readonly List<Type> _excludeTypes = new();

    internal FilterBuilder(World world)
    {
        _world = world;
    }

    /// <summary>
    /// Include entities that have this component type.
    /// </summary>
    public FilterBuilder With<T>() where T : Component
    {
        _includeTypes.Add(typeof(T));
        return this;
    }

    /// <summary>
    /// Include entities that have this component type (non-generic version).
    /// </summary>
    public FilterBuilder With(Type componentType)
    {
        _includeTypes.Add(componentType);
        return this;
    }

    /// <summary>
    /// Exclude entities that have this component type.
    /// </summary>
    public FilterBuilder Without<T>() where T : Component
    {
        _excludeTypes.Add(typeof(T));
        return this;
    }

    /// <summary>
    /// Exclude entities that have this component type (non-generic version).
    /// </summary>
    public FilterBuilder Without(Type componentType)
    {
        _excludeTypes.Add(componentType);
        return this;
    }

    /// <summary>
    /// Build the filter.
    /// </summary>
    public Filter Build()
    {
        return new Filter(_world, _includeTypes.ToArray(), _excludeTypes.ToArray());
    }

    /// <summary>
    /// Build and immediately get entities (convenience method).
    /// </summary>
    public IEnumerable<int> GetEntities()
    {
        return Build().GetEntities();
    }
}
