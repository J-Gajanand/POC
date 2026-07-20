using CloudApp.Data;
using CloudApp.Simulation;
using Microsoft.Extensions.Options;

namespace CloudApp.Services
{
    /// <summary>
    /// Continuously generates cloud-origin telemetry directly into SQL Server, so the
    /// "Cloud" series on the dashboard stays live alongside the Edge stream that arrives
    /// over ActiveMQ. Runs for the life of the process with no user interaction.
    /// </summary>
    public class CloudSimulatorService : BackgroundService
    {
        private readonly ILogger<CloudSimulatorService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ITelemetryGenerator _generator;
        private readonly SimulationOptions _opt;
        private readonly Random _rng = new();

        public CloudSimulatorService(
            ILogger<CloudSimulatorService> logger,
            IServiceScopeFactory scopeFactory,
            ITelemetryGenerator generator,
            IOptions<SimulationOptions> opt)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
            _generator = generator;
            _opt = opt.Value;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_opt.Enabled)
            {
                _logger.LogInformation("☁️ Cloud simulator is disabled (Simulation:Enabled=false).");
                return;
            }

            try { await Task.Delay(2500, stoppingToken); } catch (OperationCanceledException) { return; }

            var ids = _generator.DeviceIds;
            _logger.LogInformation(
                "☁️ Cloud simulator started: {Count} devices, every {Min}-{Max} ms.",
                ids.Count, _opt.MinIntervalMs, _opt.MaxIntervalMs);

            var index = 0;
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var deviceId = ids[index % ids.Count];
                    index++;

                    var telemetry = _generator.Next(deviceId);

                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<CloudDbContext>();
                    db.Telemetries.Add(telemetry);
                    await db.SaveChangesAsync(stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError("Cloud simulator tick failed: {Message}", ex.Message);
                }

                var delay = _rng.Next(_opt.MinIntervalMs, _opt.MaxIntervalMs + 1);
                try { await Task.Delay(delay, stoppingToken); } catch (OperationCanceledException) { break; }
            }

            _logger.LogInformation("☁️ Cloud simulator stopped.");
        }
    }
}
