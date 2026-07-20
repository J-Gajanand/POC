using Apache.NMS;
using Apache.NMS.ActiveMQ;
using CloudApp.Data;
using CloudApp.Models;
using Newtonsoft.Json;

namespace CloudApp.Services
{
    public class CloudMessageConsumerService : BackgroundService
    {
        private readonly ILogger<CloudMessageConsumerService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IActiveMQService _activeMQService;
        private readonly IConfiguration _configuration;

        public CloudMessageConsumerService(
            ILogger<CloudMessageConsumerService> logger,
            IServiceScopeFactory scopeFactory,
            IActiveMQService activeMQService,
            IConfiguration configuration)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
            _activeMQService = activeMQService;
            _configuration = configuration;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var brokerUri = _configuration["ActiveMQ:BrokerUri"] ?? "activemq:tcp://localhost:61616";
            var factory = new ConnectionFactory(brokerUri);

            using var connection = factory.CreateConnection();
            connection.Start();

            using var session = connection.CreateSession(AcknowledgementMode.AutoAcknowledge);

            // 🟢 Listen: EdgeToCloud.Request → Send back telemetry
            var requestQueue = session.GetQueue("EdgeToCloud.Request");
            var requestConsumer = session.CreateConsumer(requestQueue);
            requestConsumer.Listener += OnRequestReceived;

            // 🟢 Listen: EdgeToCloud.Telemetry → Store in SQL Server
            var telemetryQueue = session.GetQueue("EdgeToCloud.Telemetry");
            var telemetryConsumer = session.CreateConsumer(telemetryQueue);
            telemetryConsumer.Listener += OnEdgeTelemetryReceived;

            _logger.LogInformation("✅ Cloud consumers started on both queues.");

            await Task.Delay(Timeout.Infinite, stoppingToken);
        }

        // Cloud receives request → fetches SQL Server → publishes response
        private void OnRequestReceived(IMessage message)
        {
            if (message is not ITextMessage textMessage) return;

            _logger.LogInformation($"📥 Edge Request: {textMessage.Text}");

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<CloudDbContext>();

            var data = db.Telemetries
                         .Where(t => t.Source == "Cloud")
                         .OrderByDescending(t => t.Timestamp)
                         .Take(20)
                         .ToList();

            var response = JsonConvert.SerializeObject(data);
            _activeMQService.PublishMessage("CloudToEdge.Response", response);
            _logger.LogInformation("📤 Response sent to CloudToEdge.Response");
        }

        // Cloud receives Edge telemetry → stores in SQL Server → sends ACK
        private void OnEdgeTelemetryReceived(IMessage message)
        {
            if (message is not ITextMessage textMessage) return;

            _logger.LogInformation($"📥 Edge Telemetry: {textMessage.Text}");

            try
            {
                var telemetry = JsonConvert.DeserializeObject<Telemetry>(textMessage.Text);
                if (telemetry == null) return;

                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<CloudDbContext>();

                telemetry.Id = 0;
                telemetry.Source = "Edge";
                db.Telemetries.Add(telemetry);
                db.SaveChanges();

                _logger.LogInformation("✅ Edge telemetry saved to SQL Server");

                // Send Acknowledgement
                var ack = JsonConvert.SerializeObject(new
                {
                    Status = "Received",
                    DeviceId = telemetry.DeviceId,
                    Timestamp = DateTime.UtcNow
                });
                _activeMQService.PublishMessage("CloudAcknowledgement", ack);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error saving edge telemetry: {ex.Message}");
            }
        }
    }
}
