namespace server.ECS.Core;

/// <summary>
/// Interface for all systems. Systems contain game logic that operates
/// on entities with specific component combinations.
/// </summary>
public interface ISystem
{
    /// <summary>
    /// Execute this system for the current tick.
    /// </summary>
    /// <param name="world">The world to operate on.</param>
    /// <param name="deltaTime">Time elapsed since last tick in seconds.</param>
    void Execute(World world, float deltaTime);
}

/// <summary>
/// Base class for systems that provides common functionality.
/// </summary>
public abstract class SystemBase : ISystem
{
    /// <summary>
    /// The world this system operates on.
    /// Set during execution.
    /// </summary>
    protected World World { get; private set; } = null!;

    /// <summary>
    /// Time elapsed since last tick.
    /// </summary>
    protected float DeltaTime { get; private set; }

    /// <summary>
    /// Execute the system. Calls OnExecute after setting up context.
    /// </summary>
    public void Execute(World world, float deltaTime)
    {
        World = world;
        DeltaTime = deltaTime;
        OnExecute();
    }

    /// <summary>
    /// Override this to implement system logic.
    /// </summary>
    protected abstract void OnExecute();

    /// <summary>
    /// Helper to emit a message.
    /// </summary>
    protected void Emit<T>(T message) where T : Message
    {
        World.Messages.Emit(message);
    }

    /// <summary>
    /// Helper to get messages of a type.
    /// </summary>
    protected IEnumerable<T> GetMessages<T>() where T : Message
    {
        return World.Messages.Get<T>();
    }

    /// <summary>
    /// Helper to create a filter builder.
    /// </summary>
    protected FilterBuilder Filter()
    {
        return World.CreateFilter();
    }

    /// <summary>
    /// Helper to get a component from an entity.
    /// </summary>
    protected T? Get<T>(int entityId) where T : Component
    {
        return World.GetComponent<T>(entityId);
    }

    /// <summary>
    /// Helper to check if entity has a component.
    /// </summary>
    protected bool Has<T>(int entityId) where T : Component
    {
        return World.HasComponent<T>(entityId);
    }
}

/// <summary>
/// A system that can create/destroy entities and add/remove components.
/// Use this base class when you need to modify the world structure.
/// </summary>
public abstract class WorldManipulator : SystemBase
{
    private readonly List<int> _entitiesToDestroy = new();
    private readonly List<Action> _deferredActions = new();

    /// <summary>
    /// Execute the system with deferred destruction handling.
    /// </summary>
    protected override void OnExecute()
    {
        _entitiesToDestroy.Clear();
        _deferredActions.Clear();

        OnUpdate();

        // Apply deferred actions
        foreach (var action in _deferredActions)
        {
            action();
        }

        // Destroy marked entities
        foreach (var entityId in _entitiesToDestroy)
        {
            World.DestroyEntity(entityId);
        }
    }

    /// <summary>
    /// Override this to implement system logic.
    /// </summary>
    protected abstract void OnUpdate();

    /// <summary>
    /// Create a new entity.
    /// </summary>
    protected Entity CreateEntity()
    {
        return World.CreateEntity();
    }

    /// <summary>
    /// Mark an entity for destruction at end of system execution.
    /// </summary>
    protected void DestroyEntity(int entityId)
    {
        _entitiesToDestroy.Add(entityId);
    }

    /// <summary>
    /// Add a component to an entity.
    /// </summary>
    protected T AddComponent<T>(int entityId, T component) where T : Component
    {
        return World.AddComponent(entityId, component);
    }

    /// <summary>
    /// Remove a component from an entity.
    /// </summary>
    protected bool RemoveComponent<T>(int entityId) where T : Component
    {
        return World.RemoveComponent<T>(entityId);
    }

    /// <summary>
    /// Defer an action until after the main update loop.
    /// Useful for modifications that would invalidate iteration.
    /// </summary>
    protected void Defer(Action action)
    {
        _deferredActions.Add(action);
    }
}
