using EdgeApp.Data;
using EdgeApp.Simulation;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;

namespace EdgeApp.Services
{
    /// <summary>
    /// Continuous industrial telemetry simulator. Runs for the life of the process and,
    /// on a configurable cadence, advances one device at a time, persists the reading to
    /// SQLite, and publishes it to ActiveMQ (EdgeToCloud.Telemetry) — i.e. it drives the
    /// exact same production pipeline the manual button used, with no human interaction.
    ///
    ///   DeviceSimulatorService → SQLite → ActiveMQ → CloudApp consumer → SQL Server
    ///                                                      → CloudAcknowledgement → SQLite (synced)
    /// </summary>
    public class DeviceSimulatorService : BackgroundService
    {
        private readonly ILogger<DeviceSimulatorService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IActiveMQService _mq;
        private readonly ITelemetryGenerator _generator;
        private readonly SimulationOptions _opt;
        private readonly Random _rng = new();

        public DeviceSimulatorService(
            ILogger<DeviceSimulatorService> logger,
            IServiceScopeFactory scopeFactory,
            IActiveMQService mq,
            ITelemetryGenerator generator,
            IOptions<SimulationOptions> opt)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
            _mq = mq;
            _generator = generator;
            _opt = opt.Value;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_opt.Enabled)
            {
                _logger.LogInformation("🏭 Device simulator is disabled (Simulation:Enabled=false).");
                return;
            }

            // Let the host finish starting (consumers connect to the broker first).
            try { await Task.Delay(2500, stoppingToken); } catch (OperationCanceledException) { return; }

            var ids = _generator.DeviceIds;
            _logger.LogInformation(
                "🏭 Device simulator started: {Count} devices, every {Min}-{Max} ms.",
                ids.Count, _opt.MinIntervalMs, _opt.MaxIntervalMs);

            var index = 0;
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var deviceId = ids[index % ids.Count];
                    index++;

                    var telemetry = _generator.Next(deviceId);

                    // 1) Persist locally in SQLite (Edge store of record).
                    using (var scope = _scopeFactory.CreateScope())
                    {
                        var db = scope.ServiceProvider.GetRequiredService<EdgeDbContext>();
                        db.Telemetries.Add(telemetry);
                        await db.SaveChangesAsync(stoppingToken);
                    }

                    // 2) Publish to the broker — Cloud stores it in SQL Server and ACKs back,
                    //    which the Edge consumer uses to flip SyncedToCloud (pending → synced).
                    _mq.PublishMessage("EdgeToCloud.Telemetry", JsonConvert.SerializeObject(telemetry));
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError("Simulator tick failed: {Message}", ex.Message);
                }

                var delay = _rng.Next(_opt.MinIntervalMs, _opt.MaxIntervalMs + 1);
                try { await Task.Delay(delay, stoppingToken); } catch (OperationCanceledException) { break; }
            }

            _logger.LogInformation("🏭 Device simulator stopped.");
        }
    }
}
