namespace EdgeApp.Services
{
    public interface IActiveMQService
    {
        void PublishMessage(string queueName, string message);
    }
}
