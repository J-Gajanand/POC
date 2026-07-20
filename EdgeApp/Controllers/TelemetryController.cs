using Microsoft.AspNetCore.Mvc;
using EdgeApp.Data;
using EdgeApp.Models;
using EdgeApp.Services;
using Newtonsoft.Json;

namespace EdgeApp.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TelemetryController : ControllerBase
    {
        private readonly EdgeDbContext _context;
        private readonly IActiveMQService _activeMQService;
        private static readonly Random _random = new();

        public TelemetryController(EdgeDbContext context, IActiveMQService activeMQService)
        {
            _context = context;
            _activeMQService = activeMQService;
        }

        // GET all local telemetry from SQLite
        [HttpGet]
        public IActionResult GetAll() =>
            Ok(_context.Telemetries.OrderByDescending(t => t.Timestamp).Take(50).ToList());

        // POST: Request data from Cloud via ActiveMQ
        [HttpPost("request")]
        public IActionResult RequestFromCloud()
        {
            var request = new
            {
                RequestId = Guid.NewGuid(),
                DeviceId = "EDGE-001",
                Timestamp = DateTime.UtcNow
            };
            _activeMQService.PublishMessage("EdgeToCloud.Request", JsonConvert.SerializeObject(request));
            return Ok(new { Message = "📤 Request sent to Cloud" });
        }

        // POST: Generate Edge telemetry and publish to Cloud
        [HttpPost("generate")]
        public IActionResult GenerateAndPublish()
        {
            var telemetry = new Telemetry
            {
                DeviceId = $"EDGE-DEVICE-{_random.Next(1, 5)}",
                Temperature = Math.Round(_random.NextDouble() * 40 + 20, 2),
                Humidity = Math.Round(_random.NextDouble() * 60 + 20, 2),
                Pressure = Math.Round(_random.NextDouble() * 50 + 1000, 2),
                Timestamp = DateTime.UtcNow,
                Source = "Edge",
                SyncedToCloud = false
            };

            _context.Telemetries.Add(telemetry);
            _context.SaveChanges();

            _activeMQService.PublishMessage("EdgeToCloud.Telemetry", JsonConvert.SerializeObject(telemetry));

            return Ok(new { Message = "📤 Edge telemetry generated and sent to Cloud", Data = telemetry });
        }
    }
}
