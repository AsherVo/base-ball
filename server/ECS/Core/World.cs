using server.ECS.Components;

namespace server.ECS;

public class World
{
    private static int _idAt;

    public int Id { get; }

    // In-memory entity storage
    private long _nextEntityId = 1;
    private readonly HashSet< long > _entities = new();

    // In-memory component storage
    private readonly Dictionary< long, Dictionary< Type, Component > > _components = new();

    // Runtime-only state ( not persisted )
    public readonly Dictionary< Type, List< ISystem > > Systems = new();
    public readonly List< ISystem > SystemOrder = new();
    public readonly Dictionary< Type, List< Message > > Messages = new();
    public readonly Dictionary< Type, List< Message > > OldMessages = new();
    public readonly Dictionary< Type, IService > Services = new();
    public readonly List< Filter > Filters = new();

    private readonly HashSet< long > _getSingleEntityCache = new();

    public World ()
    {
        Id = _idAt;
        _idAt++;

        Console.WriteLine( $"World {Id} created." );
    }

    #region Entities

    public long Create ()
    {
        var id = _nextEntityId++;
        _entities.Add( id );
        _components[id] = new Dictionary< Type, Component >();
        return id;
    }

    public long Create ( string name, params Component[] components )
    {
        var entity = Create();
        Add( entity, new Name { value = name } );

        foreach ( var component in components )
            Add( entity, component );

        return entity;
    }

    public long Create ( params Component[] components )
    {
        var entity = Create();

        foreach ( var component in components )
            Add( entity, component );

        return entity;
    }

    public void Destroy ( long entity )
    {
        if ( entity == 0 )
        {
            Console.WriteLine( "Warning: Got destroy request for null entity. Aborting." );
            return;
        }

        if ( !Exists( entity ) )
            return;

        _components.Remove( entity );

        foreach ( var filter in Filters )
        {
            if ( filter.Entities.Contains( entity ) )
            {
                filter.Entities.Remove( entity );
                filter.onRemove?.Invoke( entity, this );
            }
        }

        _entities.Remove( entity );
    }

    public bool Exists ( long entity )
        => _entities.Contains( entity );

    public string GetName ( long entity )
    {
        if ( entity == 0 )
            return "NULL";

        if ( !Exists( entity ) )
            return $"Non-Existent Entity-{entity}";

        var name = Get< Name >( entity );
        return name == null ? $"Unnamed Entity-{entity}" : $"{name.value}-{entity}";
    }

    public string GetBasicName ( long entity )
    {
        if ( entity == 0 )
            return "NULL";

        if ( !Exists( entity ) )
            return "Non-Existent Entity";

        var name = Get< Name >( entity );
        return name?.value ?? "Entity";
    }

    public long Find ( string name )
    {
        foreach ( var entityId in _entities )
        {
            var nameComponent = Get< Name >( entityId );
            if ( nameComponent != null && nameComponent.value == name )
                return entityId;
        }

        return 0;
    }

    #endregion

    #region Components

    public T Add< T > ( long entity ) where T : Component, new()
    {
        if ( Has< T >( entity ) )
            return Get< T >( entity )!;

        return Add( entity, new T() );
    }

    public Component Add ( long entity, Type type )
    {
        if ( Has( entity, type ) )
            return Get( entity, type )!;

        var component = ( Component )Activator.CreateInstance( type )!;
        return Add( entity, component );
    }

    public T Add< T > ( long entity, T component ) where T : Component
    {
        var type = component.GetType();

        if ( Has( entity, type ) )
            Remove( entity, type );

        _components[entity][type] = component;

        foreach ( var filter in Filters )
        {
            if ( filter.Include.Contains( type ) )
                UpdateFilterWithAdd( filter, entity );
            else if ( filter.Exclude.Contains( type ) )
                UpdateFilterWithRemove( filter, entity );

            if ( component is Relation )
            {
                if ( filter.Relates.Any( r => r.RelationType == type ) )
                    UpdateFilterWithAdd( filter, entity );
                else if ( filter.NotRelates.Any( r => r.RelationType == type ) )
                    UpdateFilterWithRemove( filter, entity );
            }
        }

        return component;
    }

    public void Remove< T > ( long entity ) where T : Component
        => Remove( entity, typeof( T ) );

    public void Remove ( long entity, Type type )
    {
        if ( !Has( entity, type ) )
            return;

        var component = Get( entity, type );
        _components[entity].Remove( type );

        foreach ( var filter in Filters )
        {
            if ( filter.Include.Contains( type ) )
                UpdateFilterWithRemove( filter, entity );
            else if ( filter.Exclude.Contains( type ) )
                UpdateFilterWithAdd( filter, entity );

            if ( component is Relation )
            {
                if ( filter.Relates.Any( r => r.RelationType == type ) )
                    UpdateFilterWithRemove( filter, entity );
                else if ( filter.NotRelates.Any( r => r.RelationType == type ) )
                    UpdateFilterWithAdd( filter, entity );
            }
        }
    }

    public bool Has< T > ( long entity ) where T : Component
        => Has( entity, typeof( T ) );

    public bool Has ( long entity, Type type )
    {
        if ( entity == 0 )
            return false;

        if ( !Exists( entity ) )
        {
            Console.WriteLine( $"Warning: Trying to find component ( {type} ) from entity that does not exist ( {entity} ) ( World {Id} )." );
            return false;
        }

        return _components[entity].ContainsKey( type );
    }

    public T? Get< T > ( long entity ) where T : Component
        => ( T? )Get( entity, typeof( T ) );

    public Component? Get( long entity, Type type )
    {
        if ( !Exists( entity ) )
        {
            Console.WriteLine( $"Warning: Trying to get component ( {type} ) from entity that does not exist ( {entity} ) ( World {Id} )." );
            return null;
        }

        return _components[entity].TryGetValue( type, out var component ) ? component : null;
    }

    public bool TryGet< T > ( long entity, out T? component ) where T : Component
    {
        component = null;

        if ( !Exists( entity ) )
        {
            Console.WriteLine( $"Warning: Trying to get component ( {typeof( T )} ) from entity that does not exist ( {entity} ) ( World {Id} )." );
            return false;
        }

        if ( !Has< T >( entity ) )
            return false;

        component = Get< T >( entity );
        return true;
    }

    public T GetOrAdd< T >( long entity ) where T : Component, new()
    {
        if ( !Has< T >( entity ) )
            return Add< T >( entity );
        return Get< T >( entity )!;
    }

    public Component GetOrAdd ( long entity, Type type )
    {
        if ( !Has( entity, type ) )
            return Add( entity, type );
        return Get( entity, type )!;
    }

    public List< Component > GetComponents ( long entity )
    {
        if ( !_components.TryGetValue( entity, out var entityComponents ) )
            return new List< Component >();
        return entityComponents.Values.ToList();
    }

    public IEnumerable< ( long entityId, T component ) > GetAll< T > () where T : Component
    {
        foreach ( var entityId in _entities )
        {
            if ( _components[entityId].TryGetValue( typeof( T ), out var component ) )
                yield return ( entityId, ( T )component );
        }
    }

    #endregion

    #region Systems

    public void Start ( ISystem system )
    {
        var type = system.GetType();
        if ( !Systems.ContainsKey( type ) )
            Systems[type] = new();

        Systems[type].Add( system );
        SystemOrder.Add( system );
        system.StartSystem( this );

        Console.WriteLine( $"Started { system }" );
    }

    public void Stop ( ISystem system )
    {
        var type = system.GetType();
        SystemOrder.Remove( system );
        Systems[type].Remove( system );

        if ( Systems[type].Count == 0 )
            Systems.Remove( type );

        system.StopSystem( this );
    }

    public T Get< T > () where T : ISystem
    {
        var type = typeof( T );
        return ( T )Systems[type][0];
    }

    public T GetService< T > () where T : IService
    {
        var type = typeof( T );
        return ( T )Services[type];
    }

    #endregion

    #region Services

    public void Start< T > ( IService service ) where T : IService
    {
        var type = typeof( T );
        if ( !type.IsInterface )
            throw new InvalidOperationException( "Type parameter for Starting services must be an interface." );

        if ( Services.ContainsKey( type ) )
        {
            Console.WriteLine( $"Warning: Started a new service of the same type {type.Name}. Stopping old service." );
            Stop< T >();
        }

        Services[type] = service;
        service.Start( this );
    }

    public void Stop< T > () where T : IService
    {
        var type = typeof( T );
        Services[type].Stop( this );
        Services.Remove( type );
    }

    #endregion

    #region Relations

    public T SetRelation< T > ( long fromEntity, long toEntity ) where T : Relation, new()
        => SetRelation( fromEntity, toEntity, new T() );

    public T SetRelation< T > ( long fromEntity, long toEntity, T relation ) where T : Relation, new()
    {
        if ( HasRelation< T >( fromEntity, toEntity ) )
            return GetRelation< T >( fromEntity, toEntity )!;

        T component;
        if ( Has< T >( fromEntity ) )
        {
            component = Get< T >( fromEntity )!;
            component.relation = toEntity;
            _components[fromEntity][typeof( T )] = component;
        }
        else
        {
            relation.relation = toEntity;
            component = Add( fromEntity, relation );
        }

        foreach ( var filter in Filters )
        {
            if ( filter.Relates.Any( r => r.RelationType == typeof( T ) ) )
                UpdateFilterWithAdd( filter, fromEntity );
            else if ( filter.NotRelates.Any( r => r.RelationType == typeof( T ) ) )
                UpdateFilterWithRemove( filter, fromEntity );
        }

        return component;
    }

    public void RemoveRelation< T > ( long fromEntity, long toEntity ) where T : Relation
    {
        var relation = GetRelation< T >( fromEntity, toEntity );
        if ( relation == null )
            return;

        Remove< T >( fromEntity );

        foreach ( var filter in Filters )
        {
            if ( filter.Relates.Any( r => r.RelationType == typeof( T ) ) )
                UpdateFilterWithRemove( filter, fromEntity );
            else if ( filter.NotRelates.Any( r => r.RelationType == typeof( T ) ) )
                UpdateFilterWithAdd( filter, fromEntity );
        }
    }

    public bool HasRelation< T > ( long fromEntity, long toEntity ) where T : Relation
    {
        if ( TryGet< T >( fromEntity, out var relation ) && relation != null )
            return relation.relation == toEntity;
        return false;
    }

    public bool HasRelation ( long fromEntity, long toEntity, Type type )
    {
        if ( Get( fromEntity, type ) is Relation relation )
            return relation.relation == toEntity;
        return false;
    }

    public T? GetRelation< T > ( long fromEntity, long toEntity ) where T : Relation
    {
        var relation = Get< T >( fromEntity );
        if ( relation != null && relation.relation != toEntity )
            relation = null;
        return relation;
    }

    public List< long > GetEntities< T > ( long entity ) where T : Relation
        => GetRelations< T >( entity ).Keys.ToList();

    public Dictionary< long, T > GetRelations< T > ( long entity ) where T : Relation
    {
        var results = new Dictionary< long, T >();

        foreach ( var ( entityId, component ) in GetAll< T >() )
        {
            if ( !Exists( entityId ) )
                continue;

            if ( component.relation == entity )
                results[entityId] = component;
        }

        return results;
    }

    public long GetRelated< T > ( long fromEntity ) where T : Relation
    {
        if ( !Has< T >( fromEntity ) )
            return 0;

        var relation = Get< T >( fromEntity );
        if ( relation == null || !Exists( relation.relation ) )
            return 0;

        return relation.relation;
    }

    #endregion

    #region Messages

    public T Send< T > () where T : Message, new()
        => Send( new T() );

    public T Send< T > ( T message ) where T : Message
    {
        var type = message.GetType();
        if ( !Messages.ContainsKey( type ) )
            Messages[type] = new List< Message >();

        Messages[type].Add( message );
        return message;
    }

    public List< T > Read< T > () where T : Message
        => Read( typeof( T ) ).Cast< T >().ToList();

    public List< Message > Read ( Type messageType )
    {
        if ( !Messages.ContainsKey( messageType ) )
            return new List< Message >();
        return Messages[messageType];
    }

    public List< T > ReadOld< T > () where T : Message
        => ReadOld( typeof( T ) ).Cast< T >().ToList();

    public List< Message > ReadOld ( Type messageType )
    {
        if ( !OldMessages.ContainsKey( messageType ) )
            return new List< Message >();
        return OldMessages[messageType];
    }

    public T? ReadSingle< T > () where T : Message
    {
        var results = Read< T >();
        return results.Count == 0 ? null : results[0];
    }

    public T? ReadSingleOld< T > () where T : Message
    {
        var results = ReadOld< T >();
        return results.Count == 0 ? null : results[0];
    }

    public Message? ReadSingle ( Type type )
    {
        var results = Read( type );
        return results.Count == 0 ? null : results[0];
    }

    public Message? ReadSingleOld ( Type type )
    {
        var results = ReadOld( type );
        return results.Count == 0 ? null : results[0];
    }

    public void Destroy ( Message message )
    {
        var type = message.GetType();
        if ( !Messages.ContainsKey( type ) )
            return;

        if ( Messages[type].Contains( message ) )
            Messages[type].Remove( message );
    }

    #endregion

    #region Filters

    public void Start ( Filter filter )
    {
        if ( filter.IsBeingModified )
            throw new InvalidOperationException( "Filter is being recursively modified! This is not allowed." );

        filter.IsBeingModified = true;

        Filters.Add( filter );

        filter.Entities = new HashSet< long >(
            _entities.Where( entity => filter.Matches( entity, this ) )
         );

        foreach ( var entity in filter.Entities )
            filter.onAdd?.Invoke( entity, this );

        filter.IsBeingModified = false;
    }

    public void Stop ( Filter filter )
    {
        if ( filter.IsBeingModified )
            throw new InvalidOperationException( "Filter is being recursively modified! This is not allowed." );

        filter.IsBeingModified = true;

        foreach ( var entity in filter.Entities )
            filter.onRemove?.Invoke( entity, this );

        filter.Entities.Clear();
        Filters.Remove( filter );

        filter.IsBeingModified = false;
    }

    public void GetEntitiesNonAlloc ( FilterBuilder filterBuilder, HashSet< long > results )
    {
        foreach ( var entity in _entities )
        {
            if ( filterBuilder.Matches( entity, this ) )
                results.Add( entity );
        }
    }

    public void GetEntitiesNonAlloc ( FilterBuilder filterBuilder, List< long > results )
    {
        foreach ( var entity in _entities )
        {
            if ( filterBuilder.Matches( entity, this ) )
                results.Add( entity );
        }
    }

    public long GetSingleEntity ( FilterBuilder filterBuilder )
    {
        _getSingleEntityCache.Clear();
        GetEntitiesNonAlloc( filterBuilder, _getSingleEntityCache );

        return _getSingleEntityCache.FirstOrDefault();
    }

    public void Tick ()
    {
        // Tick Systems
        var systemListCopy = SystemOrder.ToArray();
        foreach ( var system in systemListCopy )
            system.TickSystem( this );

        // Move messages to old messages
        OldMessages.Clear();
        foreach ( var kvp in Messages )
            OldMessages.Add( kvp.Key, kvp.Value );

        // Clear messages
        Messages.Clear();
    }

    private void UpdateFilterWithAdd ( Filter filter, long addedEntity )
    {
        if ( filter.Entities.Contains( addedEntity ) )
            return;

        if ( !filter.Matches( addedEntity, this ) )
            return;

        if ( filter.IsBeingModified )
            throw new InvalidOperationException( "Filter is being recursively modified! This is not allowed." );

        filter.IsBeingModified = true;

        filter.Entities.Add( addedEntity );
        filter.onAdd?.Invoke( addedEntity, this );

        filter.IsBeingModified = false;
    }

    private void UpdateFilterWithRemove ( Filter filter, long removedEntity )
    {
        if ( !filter.Entities.Contains( removedEntity ) )
            return;

        if ( filter.Matches( removedEntity, this ) )
            return;

        if ( filter.IsBeingModified )
            throw new InvalidOperationException( "Filter is being recursively modified! This is not allowed." );

        filter.IsBeingModified = true;

        filter.Entities.Remove( removedEntity );
        filter.onRemove?.Invoke( removedEntity, this );

        filter.IsBeingModified = false;
    }

    public List< long > GetEntities ()
        => _entities.ToList();

    #endregion
}
