namespace server.Setup;

public class UnitDef
{
    public string type = "unit";
    public string subtype = "";
    public float health = 100;
    public float speed = 100;
    public float attack = 0;
    public float attackRange = 50;
    public float attackSpeed = 1;
    public int cost = 0;
    public float trainTime = 0;
    public int supply = 1;
    public float radius = 16;
    public float visionRadius = 200;
    public bool canGather = false;
    public bool canBuild = false;
}

public class BuildingDef
{
    public string type = "building";
    public string subtype = "";
    public float health = 100;
    public int cost = 0;
    public float buildTime = 0;
    public List<string> trains = new();
    public int suppliesProvided = 0;
    public float radius = 40;
    public float visionRadius = 250;
}

public class ResourceDef
{
    public string type = "resource";
    public string subtype = "";
    public int amount = 1500;
    public int gatherRate = 10;
    public float radius = 40;
}

public class SpecialDef
{
    public string type = "";
    public string subtype = "";
    public float health = 0;
    public float speed = 0;
    public float radius = 20;
    public float visionRadius = 200;
    public float pickupRange = 0;
    public float interactionRange = 0;
}

public static class EntityDefinitions
{
    public static readonly Dictionary<string, UnitDef> Units = new()
    {
        ["worker"] = new UnitDef
        {
            subtype = "worker",
            health = 50,
            speed = 100,
            attack = 5,
            attackRange = 30,
            attackSpeed = 1,
            cost = 50,
            trainTime = 8,
            supply = 1,
            radius = 16,
            visionRadius = 200,
            canGather = true,
            canBuild = true
        },
        ["soldier"] = new UnitDef
        {
            subtype = "soldier",
            health = 80,
            speed = 100,
            attack = 15,
            attackRange = 50,
            attackSpeed = 1.2f,
            cost = 100,
            trainTime = 10,
            supply = 2,
            radius = 20,
            visionRadius = 250
        }
    };

    public static readonly Dictionary<string, BuildingDef> Buildings = new()
    {
        ["base"] = new BuildingDef
        {
            subtype = "base",
            health = 1000,
            cost = 0,
            buildTime = 0,
            trains = new List<string> { "worker" },
            suppliesProvided = 10,
            radius = 50,
            visionRadius = 350
        },
        ["barracks"] = new BuildingDef
        {
            subtype = "barracks",
            health = 400,
            cost = 150,
            buildTime = 15,
            trains = new List<string> { "soldier" },
            suppliesProvided = 0,
            radius = 40,
            visionRadius = 250
        },
        ["supplyDepot"] = new BuildingDef
        {
            subtype = "supplyDepot",
            health = 200,
            cost = 100,
            buildTime = 10,
            trains = new List<string>(),
            suppliesProvided = 8,
            radius = 30,
            visionRadius = 200
        }
    };

    public static readonly Dictionary<string, ResourceDef> Resources = new()
    {
        ["minerals"] = new ResourceDef
        {
            subtype = "minerals",
            amount = 1500,
            gatherRate = 10,
            radius = 40
        }
    };

    public static readonly Dictionary<string, SpecialDef> Special = new()
    {
        ["ball"] = new SpecialDef
        {
            type = "ball",
            subtype = "ball",
            radius = 120,
            visionRadius = 300
        },
        ["avatar"] = new SpecialDef
        {
            type = "avatar",
            subtype = "avatar",
            health = 200,
            speed = 150,
            radius = 20,
            visionRadius = 400,
            pickupRange = 50,
            interactionRange = 100
        }
    };

    public static UnitDef? GetUnit(string subtype)
        => Units.TryGetValue(subtype, out var def) ? def : null;

    public static BuildingDef? GetBuilding(string subtype)
        => Buildings.TryGetValue(subtype, out var def) ? def : null;

    public static ResourceDef? GetResource(string subtype)
        => Resources.TryGetValue(subtype, out var def) ? def : null;

    public static SpecialDef? GetSpecial(string subtype)
        => Special.TryGetValue(subtype, out var def) ? def : null;
}
