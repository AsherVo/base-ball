namespace server.ECS;

public class WorldManipulator
{
    public World world { get; protected set; } = null!;

    #region Entities

    protected long Create ()
        => world.Create();

    protected long Create ( string name, params Component[] components )
        => world.Create( name, components );

    protected long Create ( params Component[] components )
        => world.Create( components );

    protected void Destroy ( long entity )
        => world.Destroy( entity );

    protected bool Exists ( long entity )
        => world.Exists( entity );

    protected string GetName ( long entity )
        => world.GetName( entity );

    protected string GetBasicName ( long entity )
        => world.GetBasicName( entity );

    #endregion

    #region Components

    protected T Add< T > ( long entity ) where T : Component, new()
        => world.Add< T >( entity );

    protected Component Add ( long entity, Type type )
        => world.Add( entity, type );

    protected T Add< T > ( long entity, T component ) where T : Component
        => world.Add( entity, component );

    protected void Remove< T > ( long entity ) where T : Component
        => world.Remove< T >( entity );

    protected void Remove ( long entity, Type type )
        => world.Remove( entity, type );

    protected bool Has< T > ( long entity ) where T : Component
        => world.Has< T >( entity );

    protected bool Has ( long entity, Type type )
        => world.Has( entity, type );

    protected T? Get< T > ( long entity ) where T : Component
        => world.Get< T >( entity );

    protected bool TryGet< T > ( long entity, out T? component ) where T : Component
        => world.TryGet( entity, out component );

    protected Component? Get ( long entity, Type type )
        => world.Get( entity, type );

    protected T GetOrAdd< T > ( long entity ) where T : Component, new()
        => world.GetOrAdd< T >( entity );

    protected Component GetOrAdd ( long entity, Type type )
        => world.GetOrAdd( entity, type );

    #endregion

    #region Relations

    protected T SetRelation< T > ( long fromEntity, long toEntity ) where T : Relation, new()
        => world.SetRelation< T >( fromEntity, toEntity );

    protected T SetRelation< T > ( long fromEntity, long toEntity, T relation ) where T : Relation, new()
        => world.SetRelation( fromEntity, toEntity, relation );

    protected void RemoveRelation< T > ( long fromEntity, long toEntity ) where T : Relation
        => world.RemoveRelation< T >( fromEntity, toEntity );

    protected bool HasRelation< T > ( long fromEntity, long toEntity ) where T : Relation
        => world.HasRelation< T >( fromEntity, toEntity );

    protected bool HasRelation ( long fromEntity, long toEntity, Type type )
        => world.HasRelation( fromEntity, toEntity, type );

    protected T? GetRelation< T > ( long fromEntity, long toEntity ) where T : Relation
        => world.GetRelation< T >( fromEntity, toEntity );

    protected List<long> GetEntities< T > ( long entity ) where T : Relation
        => world.GetEntities< T >( entity );

    protected Dictionary<long, T> GetRelations< T > ( long entity ) where T : Relation
        => world.GetRelations< T >( entity );

    protected long GetRelated< T > ( long fromEntity ) where T : Relation
        => world.GetRelated< T >( fromEntity );

    #endregion

    #region Systems

    protected void Start ( ISystem system )
        => world.Start( system );

    protected void Stop ( ISystem system )
        => world.Stop( system );

    protected T Get< T > () where T : ISystem
        => world.Get< T >();

    protected T GetService< T > () where T : IService
        => world.GetService< T >();

    #endregion

    #region Messages

    protected T Send< T > () where T : Message, new()
        => world.Send< T >();

    protected T Send< T > ( T message ) where T : Message
        => world.Send( message );

    protected List< T > Read< T > () where T : Message
        => world.Read< T >();

    protected List<Message> Read ( Type messageType )
        => world.Read( messageType );

    protected List< T > ReadOld< T > () where T : Message
        => world.ReadOld< T >();

    protected List<Message> ReadOld ( Type messageType )
        => world.ReadOld( messageType );

    protected T? ReadSingle< T > () where T : Message
        => world.ReadSingle< T >();

    protected Message? ReadSingle ( Type type )
        => world.ReadSingle( type );

    protected T? ReadSingleOld< T > () where T : Message
        => world.ReadSingleOld< T >();

    protected Message? ReadSingleOld ( Type type )
        => world.ReadSingleOld( type );

    protected void Destroy ( Message message )
        => world.Destroy( message );

    #endregion

    #region Filters

    protected void Start ( Filter filter )
        => world.Start( filter );

    protected void Stop ( Filter filter )
        => world.Stop( filter );

    protected void GetEntitiesNonAlloc ( FilterBuilder filterBuilder, HashSet<long> results )
        => world.GetEntitiesNonAlloc( filterBuilder, results );

    protected void GetEntitiesNonAlloc ( FilterBuilder filterBuilder, List<long> results )
        => world.GetEntitiesNonAlloc( filterBuilder, results );

    protected long GetSingleEntity ( FilterBuilder filterBuilder )
        => world.GetSingleEntity( filterBuilder );

    #endregion
}
