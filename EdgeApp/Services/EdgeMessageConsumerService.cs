using Apache.NMS;
using Apache.NMS.ActiveMQ;
using EdgeApp.Data;
using EdgeApp.Models;
using Newtonsoft.Json;

namespace EdgeApp.Services
{
    public class EdgeMessageConsumerService : BackgroundService
    {
        private readonly ILogger<EdgeMessageConsumerService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IConfiguration _configuration;

        public EdgeMessageConsumerService(
            ILogger<EdgeMessageConsumerService> logger,
            IServiceScopeFactory scopeFactory,
            IConfiguration configuration)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
            _configuration = configuration;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var brokerUri = _configuration["ActiveMQ:BrokerUri"] ?? "activemq:tcp://localhost:61616";
            var factory = new ConnectionFactory(brokerUri);

            using var connection = factory.CreateConnection();
            connection.Start();
            using var session = connection.CreateSession(AcknowledgementMode.AutoAcknowledge);

            // 🟢 Listen: CloudToEdge.Response → Store in SQLite
            var responseQueue = session.GetQueue("CloudToEdge.Response");
            var responseConsumer = session.CreateConsumer(responseQueue);
            responseConsumer.Listener += OnCloudResponseReceived;

            // 🟢 Listen: CloudAcknowledgement → Mark telemetry as synced
            var ackQueue = session.GetQueue("CloudAcknowledgement");
            var ackConsumer = session.CreateConsumer(ackQueue);
            ackConsumer.Listener += OnAcknowledgementReceived;

            _logger.LogInformation("✅ Edge consumers started.");

            await Task.Delay(Timeout.Infinite, stoppingToken);
        }

        // Store cloud data in SQLite
        private void OnCloudResponseReceived(IMessage message)
        {
            if (message is not ITextMessage textMessage) return;

            _logger.LogInformation("📥 Cloud response received");

            try
            {
                var list = JsonConvert.DeserializeObject<List<Telemetry>>(textMessage.Text);
                if (list == null) return;

                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<EdgeDbContext>();

                foreach (var item in list)
                {
                    item.Id = 0;
                    item.Source = "Cloud";
                    db.Telemetries.Add(item);
                }
                db.SaveChanges();
                _logger.LogInformation($"✅ {list.Count} Cloud records stored in SQLite");
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error storing cloud data: {ex.Message}");
            }
        }

        // Mark latest edge telemetry as synced
        private void OnAcknowledgementReceived(IMessage message)
        {
            if (message is not ITextMessage textMessage) return;

            _logger.LogInformation($"📥 ACK received: {textMessage.Text}");

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<EdgeDbContext>();

            var unsynced = db.Telemetries
                .Where(t => t.Source == "Edge" && !t.SyncedToCloud)
                .OrderByDescending(t => t.Timestamp)
                .FirstOrDefault();

            if (unsynced != null)
            {
                unsynced.SyncedToCloud = true;
                db.SaveChanges();
                _logger.LogInformation("✅ Telemetry marked as synced");
            }
        }
    }
}
