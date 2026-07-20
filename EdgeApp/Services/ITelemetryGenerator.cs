using EdgeApp.Models;

namespace EdgeApp.Services
{
    /// <summary>
    /// Single source of truth for producing telemetry. Used by both the continuous
    /// <c>DeviceSimulatorService</c> and the manual controller endpoint so generation
    /// logic is never duplicated. Holds per-device state so successive readings drift
    /// smoothly instead of jumping randomly.
    /// </summary>
    public interface ITelemetryGenerator
    {
        IReadOnlyList<string> DeviceIds { get; }

        /// <summary>Advance the given device's state one step and return the new reading.</summary>
        Telemetry Next(string deviceId);
    }
}
