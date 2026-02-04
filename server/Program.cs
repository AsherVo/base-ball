using Microsoft.Extensions.FileProviders;
using server.Network;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();

var app = builder.Build();

// Serve static files from public/ directory
var publicPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "public");
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(Path.GetFullPath(publicPath)),
    RequestPath = ""
});

// Serve shared/ directory at /shared path
var sharedPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "shared");
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(Path.GetFullPath(sharedPath)),
    RequestPath = "/shared"
});

// Map SignalR hub
app.MapHub<GameHub>("/game");

// Serve index.html as default
app.MapFallbackToFile("index.html", new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(Path.GetFullPath(publicPath))
});

app.Run();
