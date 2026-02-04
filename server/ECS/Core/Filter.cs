using System.Text;

namespace server.ECS;

public struct RelationFilter
{
    public Type RelationType;
    public long[] ToEntities;

    public override string ToString ()
    {
        var sb = new StringBuilder ();
        sb.Append( RelationType.ToString() );
        sb.Append( "->" );
        foreach ( var ent in ToEntities )
        {
            sb.Append( ent.ToString() );
            sb.Append( '/' );
        }
        return sb.ToString();
    }
}

public class Filter
{
    public Action< long, World >? onAdd;
    public Action< long, World >? onRemove;

    public readonly Type[] Include;
    public readonly Type[] Exclude;
    public readonly RelationFilter[] Relates;
    public readonly RelationFilter[] NotRelates;

    public HashSet<long> Entities = new();
    public bool IsBeingModified;

    public Filter( Type[] include, Type[] exclude, RelationFilter[] relates, RelationFilter[] notRelates )
    {
        Include = include;
        Exclude = exclude;
        Relates = relates;
        NotRelates = notRelates;
    }

    public bool Matches( long entity, World world )
    {
        foreach ( var includeType in Include )
        {
            if ( !world.Has( entity, includeType ) )
                return false;
        }

        foreach ( var excludeType in Exclude )
        {
            if ( world.Has( entity, excludeType ) )
                return false;
        }

        foreach ( var relation in Relates )
        {
            foreach ( var relatedEntity in relation.ToEntities )
            {
                if ( !world.Exists( relatedEntity ) || !world.HasRelation( entity, relatedEntity, relation.RelationType ) )
                    return false;
            }
        }

        foreach ( var relation in NotRelates )
        {
            foreach ( var relatedEntity in relation.ToEntities )
            {
                if ( world.Exists( relatedEntity ) && world.HasRelation( entity, relatedEntity, relation.RelationType ) )
                    return false;
            }
        }

        return true;
    }

    public List< long > GetListCopy() => Entities.ToList();

    public override string ToString()
    {
        var sb = new StringBuilder();
        sb.Append( "Filter (" );

        if ( Include.Length > 0 )
        {
            sb.Append( "[Includes: " );
            foreach ( var inc in Include )
            {
                sb.Append( inc.ToString() );
                sb.Append( ',' );
            }
            sb.Append( ']' );
        }

        if ( Exclude.Length > 0 )
        {
            sb.Append( "[Excludes: " );
            foreach ( var exc in Exclude )
            {
                sb.Append( exc.ToString() );
                sb.Append( ',' );
            }
            sb.Append( ']' );
        }

        if ( Relates.Length > 0 )
        {
            sb.Append( "[Relates: " );
            foreach ( var rel in Relates )
            {
                sb.Append( rel.ToString() );
                sb.Append( ',' );
            }
            sb.Append( ']' );
        }

        if ( NotRelates.Length > 0 )
        {
            sb.Append( "[NotRelates: " );
            foreach ( var rel in NotRelates )
            {
                sb.Append( rel.ToString() );
                sb.Append( ',' );
            }
            sb.Append( ']' );
        }

        sb.Append( ')' );
        return sb.ToString();
    }
}
