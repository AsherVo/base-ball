namespace server.ECS.Core;

/// <summary>
/// Orchestrates the execution of systems in order.
/// </summary>
public class SystemRunner
{
    private readonly List<ISystem> _systems = new();

    /// <summary>
    /// Add a system to the runner.
    /// Systems are executed in the order they are added.
    /// </summary>
    public SystemRunner Add(ISystem system)
    {
        _systems.Add(system);
        return this;
    }

    /// <summary>
    /// Add a system to the runner.
    /// </summary>
    public SystemRunner Add<T>() where T : ISystem, new()
    {
        _systems.Add(new T());
        return this;
    }

    /// <summary>
    /// Execute all systems in order.
    /// </summary>
    public void Execute(World world, float deltaTime)
    {
        foreach (var system in _systems)
        {
            system.Execute(world, deltaTime);
        }
    }

    /// <summary>
    /// Execute all systems and advance the message queue to next tick.
    /// </summary>
    public void Tick(World world, float deltaTime)
    {
        Execute(world, deltaTime);
        world.Messages.NextTick();
    }

    /// <summary>
    /// Get all registered systems.
    /// </summary>
    public IReadOnlyList<ISystem> Systems => _systems;
}
