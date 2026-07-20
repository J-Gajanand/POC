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
        private readonly ITelemetryGenerator _generator;
        private static readonly Random _random = new();

        public TelemetryController(EdgeDbContext context, IActiveMQService activeMQService, ITelemetryGenerator generator)
        {
            _context = context;
            _activeMQService = activeMQService;
            _generator = generator;
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

        // POST: Generate one Edge reading on demand and publish to Cloud.
        // Reuses the same stateful generator the continuous simulator uses, so a manual
        // reading continues the device's realistic trend instead of jumping randomly.
        [HttpPost("generate")]
        public IActionResult GenerateAndPublish()
        {
            var deviceId = _generator.DeviceIds[_random.Next(_generator.DeviceIds.Count)];
            var telemetry = _generator.Next(deviceId);

            _context.Telemetries.Add(telemetry);
            _context.SaveChanges();

            _activeMQService.PublishMessage("EdgeToCloud.Telemetry", JsonConvert.SerializeObject(telemetry));

            return Ok(new { Message = "📤 Edge telemetry generated and sent to Cloud", Data = telemetry });
        }
    }
}
