using System.Text;

namespace server.ECS;

public abstract class Message
{
    public static implicit operator bool( Message? message ) => message != null;

    public override string ToString()
    {
        var type = GetType();
        var sb = new StringBuilder();
        sb.Append( type.Name );
        sb.Append( " { " );

        var fields = type.GetFields();
        for ( int i = 0; i < fields.Length; i++ )
        {
            var field = fields[i];
            sb.Append( field.Name );
            sb.Append( " = " );
            sb.Append( field.GetValue( this ) );
            if ( i < fields.Length - 1 )
                sb.Append( ", " );
        }

        sb.Append( " }" );
        return sb.ToString();
    }
}
