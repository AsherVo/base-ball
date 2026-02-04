namespace server.ECS.Core;

/// <summary>
/// Represents an entity in the ECS world.
/// Entities are just IDs; this struct provides a typed wrapper for convenience.
/// </summary>
public readonly struct Entity : IEquatable<Entity>
{
    /// <summary>
    /// The unique identifier for this entity.
    /// </summary>
    public int Id { get; }

    /// <summary>
    /// A null/invalid entity constant.
    /// </summary>
    public static readonly Entity None = new(-1);

    public Entity(int id)
    {
        Id = id;
    }

    public bool IsValid => Id >= 0;

    public bool Equals(Entity other) => Id == other.Id;

    public override bool Equals(object? obj) => obj is Entity other && Equals(other);

    public override int GetHashCode() => Id;

    public override string ToString() => $"Entity({Id})";

    public static bool operator ==(Entity left, Entity right) => left.Equals(right);

    public static bool operator !=(Entity left, Entity right) => !left.Equals(right);

    public static implicit operator int(Entity entity) => entity.Id;

    public static explicit operator Entity(int id) => new(id);
}
