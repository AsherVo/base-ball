namespace server.Setup;

public static class GameConstants
{
    // Tick rate
    public const int TICK_RATE = 60;
    public const float TICK_DELTA = 1f / TICK_RATE;

    // Map dimensions
    public const int MAP_WIDTH = 100;   // Tiles
    public const int MAP_HEIGHT = 60;   // Tiles
    public const int TILE_WIDTH = 32;
    public const int TILE_HEIGHT = 32;
    public const int WORLD_PIXEL_WIDTH = MAP_WIDTH * TILE_WIDTH;   // 3200
    public const int WORLD_PIXEL_HEIGHT = MAP_HEIGHT * TILE_HEIGHT; // 1920

    // Map boundaries
    public const int CORNER_CUT_SIZE = 300;

    // Goals
    public const int GOAL_WIDTH = 50;
    public const int GOAL_HEIGHT = 400;

    // Ball physics
    public const float BALL_FRICTION = 0.95f;
    public const float BALL_KICK_FORCE = 200f;
    public const float BALL_MIN_VELOCITY = 5f;

    // Starting resources
    public const int STARTING_MINERALS = 100;
}
