using server.Setup;

namespace server.Util;

public struct ClampResult
{
    public float x;
    public float y;
    public string? hitCorner;
    public float normalX;
    public float normalY;
}

public static class MapBounds
{
    private static readonly float Sqrt2 = MathF.Sqrt(2f);
    private static readonly float Sqrt1_2 = MathF.Sqrt(0.5f);

    public static bool IsInsidePlayableArea(float x, float y)
    {
        return IsInsidePlayableArea(x, y,
            GameConstants.WORLD_PIXEL_WIDTH,
            GameConstants.WORLD_PIXEL_HEIGHT,
            GameConstants.CORNER_CUT_SIZE);
    }

    public static bool IsInsidePlayableArea(float x, float y, int worldWidth, int worldHeight, int cornerCut)
    {
        // Check rectangular bounds first
        if (x < 0 || x > worldWidth || y < 0 || y > worldHeight)
            return false;

        // Check diagonal corners
        // Top-left: x + y must be >= cornerCut
        if (x + y < cornerCut) return false;
        // Top-right: (worldWidth - x) + y must be >= cornerCut
        if ((worldWidth - x) + y < cornerCut) return false;
        // Bottom-left: x + (worldHeight - y) must be >= cornerCut
        if (x + (worldHeight - y) < cornerCut) return false;
        // Bottom-right: (worldWidth - x) + (worldHeight - y) must be >= cornerCut
        if ((worldWidth - x) + (worldHeight - y) < cornerCut) return false;

        return true;
    }

    public static ClampResult ClampToPlayableArea(float x, float y, float radius)
    {
        return ClampToPlayableArea(x, y, radius,
            GameConstants.WORLD_PIXEL_WIDTH,
            GameConstants.WORLD_PIXEL_HEIGHT,
            GameConstants.CORNER_CUT_SIZE);
    }

    public static ClampResult ClampToPlayableArea(float x, float y, float radius, int worldWidth, int worldHeight, int cornerCut)
    {
        var clampedX = x;
        var clampedY = y;
        string? hitCorner = null;
        float normalX = 0;
        float normalY = 0;

        // Clamp to rectangular bounds first
        if (clampedX < radius)
        {
            clampedX = radius;
            normalX = 1;
        }
        else if (clampedX > worldWidth - radius)
        {
            clampedX = worldWidth - radius;
            normalX = -1;
        }

        if (clampedY < radius)
        {
            clampedY = radius;
            normalY = 1;
        }
        else if (clampedY > worldHeight - radius)
        {
            clampedY = worldHeight - radius;
            normalY = -1;
        }

        // Adjust corner cut for radius (entity needs to stay cornerCut + radius from corner)
        var effectiveCut = cornerCut + radius * Sqrt2;

        // Check and clamp diagonal corners
        // Top-left corner: x + y >= effectiveCut
        var topLeftDist = clampedX + clampedY;
        if (topLeftDist < effectiveCut)
        {
            var adjustment = (effectiveCut - topLeftDist) / 2;
            clampedX += adjustment;
            clampedY += adjustment;
            hitCorner = "top-left";
            normalX = Sqrt1_2;
            normalY = Sqrt1_2;
        }

        // Top-right corner: (worldWidth - x) + y >= effectiveCut
        var topRightDist = (worldWidth - clampedX) + clampedY;
        if (topRightDist < effectiveCut)
        {
            var adjustment = (effectiveCut - topRightDist) / 2;
            clampedX -= adjustment;
            clampedY += adjustment;
            hitCorner = "top-right";
            normalX = -Sqrt1_2;
            normalY = Sqrt1_2;
        }

        // Bottom-left corner: x + (worldHeight - y) >= effectiveCut
        var bottomLeftDist = clampedX + (worldHeight - clampedY);
        if (bottomLeftDist < effectiveCut)
        {
            var adjustment = (effectiveCut - bottomLeftDist) / 2;
            clampedX += adjustment;
            clampedY -= adjustment;
            hitCorner = "bottom-left";
            normalX = Sqrt1_2;
            normalY = -Sqrt1_2;
        }

        // Bottom-right corner: (worldWidth - x) + (worldHeight - y) >= effectiveCut
        var bottomRightDist = (worldWidth - clampedX) + (worldHeight - clampedY);
        if (bottomRightDist < effectiveCut)
        {
            var adjustment = (effectiveCut - bottomRightDist) / 2;
            clampedX -= adjustment;
            clampedY -= adjustment;
            hitCorner = "bottom-right";
            normalX = -Sqrt1_2;
            normalY = -Sqrt1_2;
        }

        return new ClampResult
        {
            x = clampedX,
            y = clampedY,
            hitCorner = hitCorner,
            normalX = normalX,
            normalY = normalY
        };
    }

    public static string? GetViolatedCorner(float x, float y, float radius)
    {
        return GetViolatedCorner(x, y, radius,
            GameConstants.WORLD_PIXEL_WIDTH,
            GameConstants.WORLD_PIXEL_HEIGHT,
            GameConstants.CORNER_CUT_SIZE);
    }

    public static string? GetViolatedCorner(float x, float y, float radius, int worldWidth, int worldHeight, int cornerCut)
    {
        var effectiveCut = cornerCut + radius * Sqrt2;

        if (x + y < effectiveCut) return "top-left";
        if ((worldWidth - x) + y < effectiveCut) return "top-right";
        if (x + (worldHeight - y) < effectiveCut) return "bottom-left";
        if ((worldWidth - x) + (worldHeight - y) < effectiveCut) return "bottom-right";

        return null;
    }
}
