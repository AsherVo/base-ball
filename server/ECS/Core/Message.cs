namespace server.ECS.Core;

/// <summary>
/// Base class for all messages (events) that systems can emit and consume.
/// Messages are used for cross-system communication.
/// </summary>
public abstract class Message
{
    /// <summary>
    /// The tick number when this message was created.
    /// </summary>
    public long Tick { get; internal set; }
}

/// <summary>
/// A queue of messages for the current game tick.
/// Messages are cleared at the end of each tick.
/// </summary>
public class MessageQueue
{
    private readonly List<Message> _messages = new();
    private readonly Dictionary<Type, List<Message>> _messagesByType = new();
    private long _currentTick;

    /// <summary>
    /// Current tick number.
    /// </summary>
    public long CurrentTick => _currentTick;

    /// <summary>
    /// Emit a message to the queue.
    /// </summary>
    public void Emit<T>(T message) where T : Message
    {
        message.Tick = _currentTick;
        _messages.Add(message);

        var type = typeof(T);
        if (!_messagesByType.TryGetValue(type, out var list))
        {
            list = new List<Message>();
            _messagesByType[type] = list;
        }
        list.Add(message);
    }

    /// <summary>
    /// Get all messages of a specific type from the current tick.
    /// </summary>
    public IEnumerable<T> Get<T>() where T : Message
    {
        if (_messagesByType.TryGetValue(typeof(T), out var list))
            return list.Cast<T>();
        return Enumerable.Empty<T>();
    }

    /// <summary>
    /// Get all messages from the current tick.
    /// </summary>
    public IReadOnlyList<Message> GetAll() => _messages;

    /// <summary>
    /// Check if there are any messages of a specific type.
    /// </summary>
    public bool Has<T>() where T : Message
    {
        return _messagesByType.TryGetValue(typeof(T), out var list) && list.Count > 0;
    }

    /// <summary>
    /// Advance to the next tick and clear all messages.
    /// </summary>
    public void NextTick()
    {
        _currentTick++;
        Clear();
    }

    /// <summary>
    /// Clear all messages without advancing the tick.
    /// </summary>
    public void Clear()
    {
        _messages.Clear();
        _messagesByType.Clear();
    }
}
