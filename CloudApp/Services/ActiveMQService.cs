using Apache.NMS;
using Apache.NMS.ActiveMQ;

namespace CloudApp.Services
{
    public class ActiveMQService : IActiveMQService
    {
        private readonly IConnectionFactory _connectionFactory;
        private readonly ILogger<ActiveMQService> _logger;

        public ActiveMQService(IConfiguration configuration, ILogger<ActiveMQService> logger)
        {
            var brokerUri = configuration["ActiveMQ:BrokerUri"] ?? "activemq:tcp://localhost:61616";
            _connectionFactory = new ConnectionFactory(brokerUri);
            _logger = logger;
        }

        public void PublishMessage(string queueName, string message)
        {
            try
            {
                using var connection = _connectionFactory.CreateConnection();
                connection.Start();
                using var session = connection.CreateSession(AcknowledgementMode.AutoAcknowledge);
                var destination = session.GetQueue(queueName);
                using var producer = session.CreateProducer(destination);
                var textMessage = session.CreateTextMessage(message);
                producer.Send(textMessage);
                _logger.LogInformation($"Published to {queueName}: {message}");
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error publishing to {queueName}: {ex.Message}");
            }
        }
    }
}
