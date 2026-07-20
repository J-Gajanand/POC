using EdgeApp.Models;
using EdgeApp.Simulation;
using Microsoft.Extensions.Options;

namespace EdgeApp.Services
{
    /// <summary>
    /// Stateful, thread-safe telemetry generator. Each device keeps its own live
    /// temperature/humidity/pressure, which evolve as a mean-reverting random walk
    /// with occasional anomaly spikes — producing believable industrial sensor trends
    /// rather than uniform random noise. Registered as a singleton so state persists
    /// across the whole app lifetime.
    /// </summary>
    public class TelemetryGenerator : ITelemetryGenerator
    {
        private sealed class Signals { public double Temp; public double Hum; public double Pres; }

        private readonly SimulationOptions _opt;
        private readonly Random _rng = new();
        private readonly object _lock = new();
        private readonly Dictionary<string, Signals> _state = new();
        private readonly List<string> _deviceIds = new();

        public TelemetryGenerator(IOptions<SimulationOptions> opt)
        {
            _opt = opt.Value;
            var count = Math.Max(1, _opt.DeviceCount);
            for (int i = 1; i <= count; i++)
            {
                var id = $"EDGE-DEVICE-{i}";
                _deviceIds.Add(id);
                // Per-device baseline offset so each line is distinguishable on the chart.
                var offset = (i - 1) * 3.0;
                _state[id] = new Signals
                {
                    Temp = _opt.Temperature.Baseline + offset + Jitter(2),
                    Hum = _opt.Humidity.Baseline + Jitter(3),
                    Pres = _opt.Pressure.Baseline + Jitter(2)
                };
            }
        }

        public IReadOnlyList<string> DeviceIds => _deviceIds;

        public Telemetry Next(string deviceId)
        {
            lock (_lock)
            {
                if (!_state.TryGetValue(deviceId, out var s))
                {
                    s = new Signals
                    {
                        Temp = _opt.Temperature.Baseline,
                        Hum = _opt.Humidity.Baseline,
                        Pres = _opt.Pressure.Baseline
                    };
                    _state[deviceId] = s;
                }

                s.Temp = Advance(s.Temp, _opt.Temperature);
                s.Hum = Advance(s.Hum, _opt.Humidity);
                s.Pres = Advance(s.Pres, _opt.Pressure);

                return new Telemetry
                {
                    DeviceId = deviceId,
                    Temperature = Math.Round(s.Temp, 2),
                    Humidity = Math.Round(s.Hum, 2),
                    Pressure = Math.Round(s.Pres, 2),
                    Timestamp = DateTime.UtcNow,
                    Source = "Edge",
                    SyncedToCloud = false
                };
            }
        }

        /// <summary>One mean-reverting random-walk step with an occasional anomaly spike.</summary>
        private double Advance(double current, SignalProfile p)
        {
            var next = current + p.Reversion * (p.Baseline - current); // pull toward baseline
            next += Gaussian() * p.Noise;                              // smooth natural variation
            if (_rng.NextDouble() < p.SpikeChance)                     // rare anomaly / recovery
            {
                var direction = _rng.NextDouble() < 0.5 ? -1 : 1;
                next += direction * p.SpikeMagnitude * (0.5 + _rng.NextDouble());
            }
            return Math.Clamp(next, p.Min, p.Max);
        }

        private double Jitter(double magnitude) => (_rng.NextDouble() * 2 - 1) * magnitude;

        // Box–Muller transform → standard normal sample.
        private double Gaussian()
        {
            var u1 = 1.0 - _rng.NextDouble();
            var u2 = 1.0 - _rng.NextDouble();
            return Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Sin(2.0 * Math.PI * u2);
        }
    }
}
