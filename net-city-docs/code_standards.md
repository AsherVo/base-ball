# Code Standards

Standards to follow when writing new code

## Whitespace

This project uses a specific whitespace style. **Follow these rules exactly.**

**Whitespace Inside Brackets**

Always add a space after opening and before closing brackets:

```csharp
// Parentheses
void DoSomething ( int value )
apiStore.WriteResponse( new ApiResponse( request.Id, 200, json ) );

// Generics
Dictionary< string, long > lookup = new();
Has< Online >( entity )
new FilterBuilder().Include< NetAddress >()

// String interpolation
$"Server not found at address: { request.NetAddress }"
```

**No space between identifier and bracket:**

```csharp
// Correct
DoSomething( value );
new Dictionary< string, long >();
Get< CommandSystem >().Register( this );

// Wrong
DoSomething ( value );   // space before (
new Dictionary < string, long >();  // space before <
```

**File-scoped namespaces:**

```csharp
namespace NetCity.ECS.Systems;  // Yes

namespace NetCity.ECS.Systems    // No
{
}
```

**Allman-style braces:**

```csharp
if ( condition )
{
    DoThing();
}
```

---

## 9. ECS Patterns

**Systems**

* Implement `ISystem` interface: `StartSystem`, `StopSystem`, `TickSystem`
* Extend `WorldManipulator` to access ECS helper methods (`Has<T>`, `Get<T>`, `Add<T>`, etc.)
* Store filters as class fields, create in `StartSystem`, release in `StopSystem`

```csharp
public class ExampleSystem : WorldManipulator, ISystem
{
    Filter myFilter = null!;

    public void StartSystem ( World world )
    {
        World = world;

        myFilter = new FilterBuilder()
            .Include< SomeComponent >()
            .ToFilter();

        myFilter.onAdd = OnEntityAdded;
        myFilter.onRemove = OnEntityRemoved;

        Start( myFilter );
    }

    public void StopSystem ( World world )
    {
        Stop( myFilter );
    }

    public void TickSystem ( World world )
    {
        // Per-tick logic here
    }
}
```

**Components**

* Extend the base `Component` class
* Use public fields for data (not properties)
* **Field names must be camelCase** (starting with lowercase)
* Entity ID fields should NOT have an "Id" suffix (the `long` type is sufficient)
* Marker components can be empty classes

```csharp
namespace NetCity.ECS.Components.World;

public class RoadSegment : Component
{
    public long startJunction;  // camelCase, no "Id" suffix
    public long endJunction;
}

public class Position : Component
{
    public float x;  // lowercase
    public float y;
    public float z;
}

// Marker component (tag)
public class Vehicle : Component
{
}
```

**Relations**

* Extend the base `Relation` class
* The target entity is stored in the `relation` field (inherited from `Relation`)
* Relations can have additional fields beyond the inherited `relation`

```csharp
// Simple relation (marker only)
public class InDistrict : Relation
{
    // Inherits: public long relation;
}

// Relation with additional data
public class RoadSegment : Relation
{
    // Inherits: public long relation; (points to parent Road)
    public long startJunction;
    public long endJunction;
}

// Usage:
world.Add( entity, new InDistrict { relation = districtId } );
world.Add( segment, new RoadSegment { relation = roadId, startJunction = j1, endJunction = j2 } );
```

**Filters**

* Use `FilterBuilder` with fluent API: `.Include<T>()`, `.Exclude<T>()`, `.Related<T>()`
* Call `ToFilter()` to create the filter
* Attach `onAdd` / `onRemove` callbacks before calling `Start( filter )`
* Filters track matching entities automatically

**Entity IDs**

* Entity IDs are `long` values
* A value of `0` means "no entity" or "invalid"

**Entity Creation**

* **Always create entities through the simulation's `World.Create()`** - never via direct SQL inserts
* Filters only auto-update when components are added/removed through the World's methods
* If entities are created via direct SQL (bypassing the World), filters won't track them until the simulation restarts
* The admin API routes that create entities should send requests to the simulation rather than inserting directly into the database

```csharp
// Correct: Entity created through World - filters will track it
var entity = world.Create( "Player Name" );
world.Add( entity, new Player { playerId = 123 } );

// Wrong: Direct SQL insert - filters won't see this entity
await db.Query( "INSERT INTO entities..." );
await db.Query( "INSERT INTO component_player..." );
```