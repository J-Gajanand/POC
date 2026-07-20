using CloudApp.Models;

namespace CloudApp.Services
{
    /// <summary>
    /// Reusable, stateful producer of cloud-origin telemetry. Shared by the continuous
    /// <c>CloudSimulatorService</c> and the manual generate endpoint so logic is never
    /// duplicated and each device drifts smoothly between readings.
    /// </summary>
    public interface ITelemetryGenerator
    {
        IReadOnlyList<string> DeviceIds { get; }
        Telemetry Next(string deviceId);
    }
}
