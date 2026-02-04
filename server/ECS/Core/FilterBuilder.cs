namespace server.ECS;

public class FilterBuilder
{
    private readonly List< Type > _includes = new();
    private readonly List< Type > _excludes = new();
    private readonly List< RelationFilter > _relates = new();
    private readonly List< RelationFilter > _notRelates = new();

    public FilterBuilder Include< T > () where T : Component
    {
        _includes.Add( typeof( T ) );
        return this;
    }

    public FilterBuilder Include ( Type type )
    {
        _includes.Add( type );
        return this;
    }

    public FilterBuilder Exclude< T > () where T : Component
    {
        _excludes.Add( typeof( T ) );
        return this;
    }

    public FilterBuilder Exclude ( Type type )
    {
        _excludes.Add( type );
        return this;
    }

    public FilterBuilder Related< T > ( params long[] entities ) where T : Relation
    {
        _relates.Add( new RelationFilter { RelationType = typeof( T ), ToEntities = entities } );
        return this;
    }

    public FilterBuilder NotRelated< T > ( params long[] entities ) where T : Relation
    {
        _notRelates.Add( new RelationFilter { RelationType = typeof( T ), ToEntities = entities } );
        return this;
    }

    public bool Matches ( long entity, World world )
    {
        foreach ( var includeType in _includes )
        {
            if ( !world.Has( entity, includeType ) )
                return false;
        }

        foreach ( var excludeType in _excludes )
        {
            if ( world.Has( entity, excludeType ) )
                return false;
        }

        foreach ( var relation in _relates )
        {
            foreach ( var relatedEntity in relation.ToEntities )
            {
                if ( !world.Exists( relatedEntity ) || !world.HasRelation( entity, relatedEntity, relation.RelationType ) )
                    return false;
            }
        }

        foreach ( var relation in _notRelates )
        {
            foreach ( var relatedEntity in relation.ToEntities )
            {
                if ( world.Exists( relatedEntity ) && world.HasRelation( entity, relatedEntity, relation.RelationType ) )
                    return false;
            }
        }

        return true;
    }

    public Filter ToFilter() => new (
        include: _includes.ToArray(),
        exclude: _excludes.ToArray(),
        relates: _relates.ToArray(),
        notRelates: _notRelates.ToArray()
    );
}
