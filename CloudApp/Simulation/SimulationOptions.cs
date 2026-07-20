namespace CloudApp.Simulation
{
    /// <summary>Mean-reverting random-walk profile for one cloud sensor signal.</summary>
    public class SignalProfile
    {
        public double Baseline { get; set; }
        public double Min { get; set; }
        public double Max { get; set; }
        public double Noise { get; set; }
        public double Reversion { get; set; }
        public double SpikeChance { get; set; }
        public double SpikeMagnitude { get; set; }
    }

    /// <summary>
    /// Bound from the "Simulation" section of appsettings.json. Drives continuous
    /// cloud-origin telemetry generation so the Cloud series stays live independently
    /// of the Edge stream. Fully configurable without code changes.
    /// </summary>
    public class SimulationOptions
    {
        public bool Enabled { get; set; } = true;
        public int DeviceCount { get; set; } = 4;
        public int MinIntervalMs { get; set; } = 1500;
        public int MaxIntervalMs { get; set; } = 3500;

        public SignalProfile Temperature { get; set; } = new()
        { Baseline = 48, Min = 18, Max = 90, Noise = 0.7, Reversion = 0.05, SpikeChance = 0.015, SpikeMagnitude = 10 };

        public SignalProfile Humidity { get; set; } = new()
        { Baseline = 45, Min = 15, Max = 85, Noise = 0.5, Reversion = 0.04, SpikeChance = 0.01, SpikeMagnitude = 7 };

        public SignalProfile Pressure { get; set; } = new()
        { Baseline = 1015, Min = 985, Max = 1045, Noise = 0.4, Reversion = 0.05, SpikeChance = 0.01, SpikeMagnitude = 6 };
    }
}
