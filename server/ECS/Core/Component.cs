using System.Reflection;

namespace server.ECS;

public abstract class Component
{
    public static Component Create( string typeName )
    {
        var type = Type.GetType( $"server.ECS.Components.{ typeName }" )
            ?? throw new InvalidOperationException( $"No component of type '{typeName}' found." );

        if ( !typeof( Component ).IsAssignableFrom( type ) )
            throw new InvalidOperationException( $"Type '{ typeName }' is not a Component." );

        return ( Component )Activator.CreateInstance( type )!;
    }

    public void ApplyParameters( Dictionary< object, object > parameters )
    {
        var fields = GetType().GetFields( BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance );

        foreach ( var field in fields )
        {
            if ( parameters.TryGetValue( field.Name, out var value ) && value != null )
            {
                var convertedValue = Convert.ChangeType( value, field.FieldType );
                field.SetValue( this, convertedValue );
            }
        }
    }

    public Component Clone()
    {
        var type = GetType();
        var clone = ( Component )Activator.CreateInstance( type )!;

        foreach ( var field in type.GetFields( BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance ) )
        {
            var fieldValue = field.GetValue( this );
            field.SetValue( clone, fieldValue );
        }

        return clone;
    }
}
