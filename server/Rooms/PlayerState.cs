using server.Setup;

namespace server.Rooms;

/// <summary>
/// Tracks player resources and supply during a game.
/// </summary>
public class PlayerState
{
    public string PlayerId { get; }
    public int PlayerIndex { get; }  // 0 or 1
    public int Minerals { get; private set; }
    public int Supply { get; private set; }
    public int MaxSupply { get; private set; }

    public PlayerState(string playerId, int playerIndex)
    {
        PlayerId = playerId;
        PlayerIndex = playerIndex;
        Minerals = GameConstants.STARTING_MINERALS;
        Supply = GameConstants.STARTING_SUPPLY;
        MaxSupply = GameConstants.STARTING_MAX_SUPPLY;
    }

    public bool CanAfford(int cost)
    {
        return Minerals >= cost;
    }

    public bool CanSupport(int supplyCost)
    {
        return Supply + supplyCost <= MaxSupply;
    }

    public bool Spend(int amount)
    {
        if (!CanAfford(amount))
            return false;
        Minerals -= amount;
        return true;
    }

    public void AddMinerals(int amount)
    {
        Minerals += amount;
    }

    public void UseSupply(int amount)
    {
        Supply += amount;
    }

    public void FreeSupply(int amount)
    {
        Supply = Math.Max(0, Supply - amount);
    }

    public void AddMaxSupply(int amount)
    {
        MaxSupply += amount;
    }

    public Dictionary<string, object> ToJson()
    {
        return new Dictionary<string, object>
        {
            ["playerId"] = PlayerId,
            ["playerIndex"] = PlayerIndex,
            ["minerals"] = Minerals,
            ["supply"] = Supply,
            ["maxSupply"] = MaxSupply
        };
    }
}
