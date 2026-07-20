using CloudApp.Models;
using CloudApp.Simulation;
using Microsoft.Extensions.Options;

namespace CloudApp.Services
{
    /// <summary>
    /// Thread-safe, stateful generator of cloud-origin telemetry. Each device evolves as
    /// a mean-reverting random walk with occasional anomaly spikes, giving realistic
    /// trends. Singleton so state persists for the app lifetime.
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
                var id = $"CLOUD-DEVICE-{i}";
                _deviceIds.Add(id);
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
                    Source = "Cloud"
                };
            }
        }

        private double Advance(double current, SignalProfile p)
        {
            var next = current + p.Reversion * (p.Baseline - current);
            next += Gaussian() * p.Noise;
            if (_rng.NextDouble() < p.SpikeChance)
            {
                var direction = _rng.NextDouble() < 0.5 ? -1 : 1;
                next += direction * p.SpikeMagnitude * (0.5 + _rng.NextDouble());
            }
            return Math.Clamp(next, p.Min, p.Max);
        }

        private double Jitter(double magnitude) => (_rng.NextDouble() * 2 - 1) * magnitude;

        private double Gaussian()
        {
            var u1 = 1.0 - _rng.NextDouble();
            var u2 = 1.0 - _rng.NextDouble();
            return Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Sin(2.0 * Math.PI * u2);
        }
    }
}
