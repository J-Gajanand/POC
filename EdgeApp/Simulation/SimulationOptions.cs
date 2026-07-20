namespace EdgeApp.Simulation
{
    /// <summary>
    /// Drift profile for a single sensor signal. Values evolve as a mean-reverting
    /// random walk (Ornstein-Uhlenbeck style) so trends look like real sensors:
    /// they wander around a baseline, occasionally spike, then recover.
    /// </summary>
    public class SignalProfile
    {
        public double Baseline { get; set; }
        public double Min { get; set; }
        public double Max { get; set; }
        /// <summary>Std-dev of the per-step Gaussian noise (small = smooth).</summary>
        public double Noise { get; set; }
        /// <summary>0..1 pull back toward the baseline each step (mean reversion).</summary>
        public double Reversion { get; set; }
        /// <summary>0..1 probability of an anomaly spike on a given step.</summary>
        public double SpikeChance { get; set; }
        /// <summary>Magnitude of an anomaly spike when it occurs.</summary>
        public double SpikeMagnitude { get; set; }
    }

    /// <summary>
    /// Bound from the "Simulation" section of appsettings.json — everything here is
    /// tunable without touching code (interval, device count, per-signal behaviour).
    /// </summary>
    public class SimulationOptions
    {
        public bool Enabled { get; set; } = true;
        public int DeviceCount { get; set; } = 4;
        public int MinIntervalMs { get; set; } = 1000;
        public int MaxIntervalMs { get; set; } = 3000;

        public SignalProfile Temperature { get; set; } = new()
        { Baseline = 55, Min = 20, Max = 95, Noise = 0.8, Reversion = 0.05, SpikeChance = 0.02, SpikeMagnitude = 12 };

        public SignalProfile Humidity { get; set; } = new()
        { Baseline = 50, Min = 15, Max = 90, Noise = 0.6, Reversion = 0.04, SpikeChance = 0.01, SpikeMagnitude = 8 };

        public SignalProfile Pressure { get; set; } = new()
        { Baseline = 1013, Min = 985, Max = 1045, Noise = 0.4, Reversion = 0.05, SpikeChance = 0.01, SpikeMagnitude = 6 };
    }
}
