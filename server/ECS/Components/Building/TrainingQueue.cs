namespace server.ECS.Components.Building;

public class TrainingItem
{
    public string unitType = "";
    public float progress = 0f;
    public float trainTime = 0f;
}

public class TrainingQueue : Component
{
    public List<TrainingItem> queue = new();
}
