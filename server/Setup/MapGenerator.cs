using server.ECS;
using server.Rooms;

namespace server.Setup;

/// <summary>
/// Generates the initial map layout for a game match.
/// Creates symmetrical map with bases, workers, mineral patches, ball, and avatars.
/// </summary>
public static class MapGenerator
{
    /// <summary>
    /// Generate the map for a match.
    /// </summary>
    /// <param name="world">The ECS World to populate</param>
    /// <param name="players">List of PlayerInfo for each player</param>
    public static void Generate(World world, IEnumerable<PlayerInfo> players)
    {
        var playerList = players.ToList();

        // Create ball at center
        CreateBall(world);

        // Create entities for each player
        foreach (var player in playerList)
        {
            CreatePlayerEntities(world, player);
        }

        // Create center mineral patches (contested resources)
        CreateCenterMinerals(world);
    }

    private static void CreateBall(World world)
    {
        var centerX = GameConstants.WORLD_PIXEL_WIDTH / 2f;
        var centerY = GameConstants.WORLD_PIXEL_HEIGHT / 2f;

        EntityFactory.CreateBall(world, centerX, centerY);
    }

    private static void CreatePlayerEntities(World world, PlayerInfo player)
    {
        var isLeftSide = player.PlayerIndex == 0;

        // Base position: 200px from edge
        var baseX = isLeftSide ? 200f : GameConstants.WORLD_PIXEL_WIDTH - 200f;
        var baseY = GameConstants.WORLD_PIXEL_HEIGHT / 2f;

        // Create base
        EntityFactory.CreateBuilding(world, "base", baseX, baseY, player.ConnectionId, player.PlayerIndex);

        // Create avatar (100px toward center from base)
        var avatarX = isLeftSide ? baseX + 100f : baseX - 100f;
        EntityFactory.CreateAvatar(world, avatarX, baseY, player.ConnectionId, player.PlayerIndex);

        // Create starting workers (4 workers around base)
        CreateStartingWorkers(world, baseX, baseY, player);

        // Create mineral patches near base (2 patches)
        CreateBaseMinerals(world, baseX, baseY, isLeftSide);
    }

    private static void CreateStartingWorkers(World world, float baseX, float baseY, PlayerInfo player)
    {
        var workerCount = GameConstants.STARTING_WORKERS;
        var spawnRadius = 80f;

        for (int i = 0; i < workerCount; i++)
        {
            var angle = (2 * Math.PI / workerCount) * i + Math.PI / 4; // Offset to avoid overlapping with base
            var workerX = baseX + (float)Math.Cos(angle) * spawnRadius;
            var workerY = baseY + (float)Math.Sin(angle) * spawnRadius;

            EntityFactory.CreateUnit(world, "worker", workerX, workerY, player.ConnectionId, player.PlayerIndex);
        }
    }

    private static void CreateBaseMinerals(World world, float baseX, float baseY, bool isLeftSide)
    {
        // Minerals are placed further from the base, toward the center
        var mineralOffset = isLeftSide ? 250f : -250f;
        var mineralX = baseX + mineralOffset;

        // Two mineral patches, one above and one below
        EntityFactory.CreateResource(world, "minerals", mineralX, baseY - 150f);
        EntityFactory.CreateResource(world, "minerals", mineralX, baseY + 150f);
    }

    private static void CreateCenterMinerals(World world)
    {
        var centerX = GameConstants.WORLD_PIXEL_WIDTH / 2f;
        var centerY = GameConstants.WORLD_PIXEL_HEIGHT / 2f;

        // Center minerals are placed diagonally from the center
        // Top-left and bottom-right of center (to be equidistant from both players)
        EntityFactory.CreateResource(world, "minerals", centerX - 300f, centerY - 400f);
        EntityFactory.CreateResource(world, "minerals", centerX + 300f, centerY + 400f);
    }
}
