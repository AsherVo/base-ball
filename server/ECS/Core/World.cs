namespace server.ECS.Core;

/// <summary>
/// The World is the central container for all entities and their components.
/// Uses in-memory Dictionary storage for fast entity/component lookup.
/// </summary>
public class World
{
    private int _nextEntityId = 1;
    private readonly HashSet<int> _entities = new();
    private readonly Dictionary<int, Dictionary<Type, Component>> _components = new();
    private readonly Dictionary<Type, HashSet<int>> _componentIndex = new();
    private readonly MessageQueue _messageQueue = new();

    /// <summary>
    /// The next entity ID that will be assigned.
    /// </summary>
    public int NextEntityId => _nextEntityId;

    /// <summary>
    /// All active entity IDs.
    /// </summary>
    public IReadOnlyCollection<int> Entities => _entities;

    /// <summary>
    /// The message queue for this world.
    /// </summary>
    public MessageQueue Messages => _messageQueue;

    /// <summary>
    /// Creates a new entity and returns its ID.
    /// </summary>
    public Entity CreateEntity()
    {
        var id = _nextEntityId++;
        _entities.Add(id);
        _components[id] = new Dictionary<Type, Component>();
        return new Entity(id);
    }

    /// <summary>
    /// Creates an entity with a specific ID (for deserialization).
    /// Updates NextEntityId if necessary.
    /// </summary>
    public Entity CreateEntityWithId(int id)
    {
        if (_entities.Contains(id))
            throw new InvalidOperationException($"Entity {id} already exists");

        _entities.Add(id);
        _components[id] = new Dictionary<Type, Component>();

        if (id >= _nextEntityId)
            _nextEntityId = id + 1;

        return new Entity(id);
    }

    /// <summary>
    /// Removes an entity and all its components.
    /// </summary>
    public bool DestroyEntity(int entityId)
    {
        if (!_entities.Contains(entityId))
            return false;

        // Remove from component indices
        if (_components.TryGetValue(entityId, out var entityComponents))
        {
            foreach (var type in entityComponents.Keys)
            {
                if (_componentIndex.TryGetValue(type, out var index))
                    index.Remove(entityId);
            }
            _components.Remove(entityId);
        }

        _entities.Remove(entityId);
        return true;
    }

    /// <summary>
    /// Check if an entity exists.
    /// </summary>
    public bool HasEntity(int entityId)
    {
        return _entities.Contains(entityId);
    }

    /// <summary>
    /// Adds a component to an entity.
    /// </summary>
    public T AddComponent<T>(int entityId, T component) where T : Component
    {
        if (!_entities.Contains(entityId))
            throw new InvalidOperationException($"Entity {entityId} does not exist");

        var type = typeof(T);
        component.EntityId = entityId;
        _components[entityId][type] = component;

        // Update component index
        if (!_componentIndex.TryGetValue(type, out var index))
        {
            index = new HashSet<int>();
            _componentIndex[type] = index;
        }
        index.Add(entityId);

        return component;
    }

    /// <summary>
    /// Removes a component from an entity.
    /// </summary>
    public bool RemoveComponent<T>(int entityId) where T : Component
    {
        if (!_components.TryGetValue(entityId, out var entityComponents))
            return false;

        var type = typeof(T);
        if (!entityComponents.Remove(type))
            return false;

        if (_componentIndex.TryGetValue(type, out var index))
            index.Remove(entityId);

        return true;
    }

    /// <summary>
    /// Gets a component from an entity.
    /// </summary>
    public T? GetComponent<T>(int entityId) where T : Component
    {
        if (!_components.TryGetValue(entityId, out var entityComponents))
            return null;

        if (entityComponents.TryGetValue(typeof(T), out var component))
            return (T)component;

        return null;
    }

    /// <summary>
    /// Checks if an entity has a component.
    /// </summary>
    public bool HasComponent<T>(int entityId) where T : Component
    {
        if (!_components.TryGetValue(entityId, out var entityComponents))
            return false;

        return entityComponents.ContainsKey(typeof(T));
    }

    /// <summary>
    /// Gets all entities that have the specified component type.
    /// </summary>
    public IEnumerable<int> GetEntitiesWithComponent<T>() where T : Component
    {
        if (_componentIndex.TryGetValue(typeof(T), out var index))
            return index;

        return Enumerable.Empty<int>();
    }

    /// <summary>
    /// Gets all entities that have all specified component types.
    /// </summary>
    public IEnumerable<int> GetEntitiesWithComponents(params Type[] componentTypes)
    {
        if (componentTypes.Length == 0)
            return _entities;

        // Start with the smallest set for efficiency
        HashSet<int>? smallest = null;
        foreach (var type in componentTypes)
        {
            if (!_componentIndex.TryGetValue(type, out var index))
                return Enumerable.Empty<int>();

            if (smallest == null || index.Count < smallest.Count)
                smallest = index;
        }

        if (smallest == null)
            return Enumerable.Empty<int>();

        // Filter to entities that have all components
        return smallest.Where(entityId =>
            componentTypes.All(type =>
                _components.TryGetValue(entityId, out var components) &&
                components.ContainsKey(type)));
    }

    /// <summary>
    /// Creates a filter builder for querying entities.
    /// </summary>
    public FilterBuilder CreateFilter()
    {
        return new FilterBuilder(this);
    }

    /// <summary>
    /// Gets all components of a specific type.
    /// </summary>
    public IEnumerable<T> GetAllComponents<T>() where T : Component
    {
        if (!_componentIndex.TryGetValue(typeof(T), out var index))
            yield break;

        foreach (var entityId in index)
        {
            if (_components.TryGetValue(entityId, out var entityComponents) &&
                entityComponents.TryGetValue(typeof(T), out var component))
            {
                yield return (T)component;
            }
        }
    }

    /// <summary>
    /// Clears all entities and components from the world.
    /// </summary>
    public void Clear()
    {
        _entities.Clear();
        _components.Clear();
        _componentIndex.Clear();
        _messageQueue.Clear();
        _nextEntityId = 1;
    }
}
