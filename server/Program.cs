using System.Text.Json;
using Microsoft.Extensions.FileProviders;
using server.Network;
using server.Rooms;
using server.Rooms.Matchmaking;
using server.Setup;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR()
    .AddJsonProtocol(options =>
    {
        options.PayloadSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });
builder.Services.AddSingleton<RoomManager>();
builder.Services.AddSingleton<MatchmakingService>();

// Configure JSON for minimal APIs to preserve property names (SCREAMING_SNAKE_CASE for constants)
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = null;
});

var app = builder.Build();

// Serve static files from public/ directory
var publicPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "public");
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(Path.GetFullPath(publicPath)),
    RequestPath = ""
});

// API endpoint for game configuration (game logic only, not UI)
app.MapGet("/api/config", () => new
{
    constants = new
    {
        TICK_RATE = GameConstants.TICK_RATE,
        STATE_BROADCAST_RATE = GameConstants.STATE_BROADCAST_RATE,
        MAX_PLAYERS_PER_ROOM = GameConstants.MAX_PLAYERS_PER_ROOM,
        MAP_WIDTH = GameConstants.MAP_WIDTH,
        MAP_HEIGHT = GameConstants.MAP_HEIGHT,
        TILE_WIDTH = GameConstants.TILE_WIDTH,
        TILE_HEIGHT = GameConstants.TILE_HEIGHT,
        STARTING_MINERALS = GameConstants.STARTING_MINERALS,
        STARTING_WORKERS = GameConstants.STARTING_WORKERS,
        STARTING_SUPPLY = GameConstants.STARTING_SUPPLY,
        STARTING_MAX_SUPPLY = GameConstants.STARTING_MAX_SUPPLY,
        GATHER_RANGE = GameConstants.GATHER_RANGE,
        BUILD_RANGE = GameConstants.BUILD_RANGE,
        PUSH_RANGE = GameConstants.PUSH_RANGE,
        GOAL_WIDTH = GameConstants.GOAL_WIDTH,
        GOAL_HEIGHT = GameConstants.GOAL_HEIGHT,
        CORNER_CUT_SIZE = GameConstants.CORNER_CUT_SIZE,
        BALL_RADIUS = GameConstants.BALL_RADIUS,
        BALL_FRICTION = GameConstants.BALL_FRICTION,
        BALL_PUSH_FORCE = GameConstants.BALL_PUSH_FORCE,
        FOG_TILE_SIZE = GameConstants.FOG_TILE_SIZE,
        DEFAULT_VISION_RADIUS = GameConstants.DEFAULT_VISION_RADIUS
    },
    entityDefs = new
    {
        units = EntityDefinitions.Units,
        buildings = EntityDefinitions.Buildings,
        resources = EntityDefinitions.Resources,
        special = EntityDefinitions.Special
    }
});

// Map SignalR hub
app.MapHub<GameHub>("/game");

// Serve index.html as default
app.MapFallbackToFile("index.html", new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(Path.GetFullPath(publicPath))
});

app.Run();
