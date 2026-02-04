namespace server.ECS;

public interface ISystem
{
    void StartSystem ( World world );
    void StopSystem ( World world );
    void TickSystem ( World world );
}
