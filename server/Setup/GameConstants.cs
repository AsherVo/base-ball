namespace server.Setup;

public static class GameConstants
{
    // Tick rate
    public const int TICK_RATE = 60;
    public const int STATE_BROADCAST_RATE = 20;  // State updates per second
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
    public const int GOAL_WIDTH = 100;
    public const int GOAL_HEIGHT = 200;

    // Ball physics
    public const float BALL_FRICTION = 0.95f;
    public const float BALL_KICK_FORCE = 200f;
    public const float BALL_MIN_VELOCITY = 5f;
    public const float BALL_PUSH_FORCE = 300f;
    public const int BALL_RADIUS = 30;

    // Starting resources
    public const int STARTING_MINERALS = 100;
    public const int STARTING_WORKERS = 4;
    public const int STARTING_SUPPLY = 4;
    public const int STARTING_MAX_SUPPLY = 10;

    // Room settings
    public const int MAX_PLAYERS_PER_ROOM = 2;

    // Countdown
    public const int COUNTDOWN_SECONDS = 3;

    // Game balance - Ranges
    public const int GATHER_RANGE = 40;
    public const int BUILD_RANGE = 60;
    public const int PUSH_RANGE = 80;

    // Fog of war settings
    public const int FOG_TILE_SIZE = 32;
    public const int DEFAULT_VISION_RADIUS = 200;
}
