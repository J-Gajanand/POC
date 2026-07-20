namespace CloudApp.Services
{
    public interface IActiveMQService
    {
        void PublishMessage(string queueName, string message);
    }
}
