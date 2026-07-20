using Microsoft.AspNetCore.Mvc;
using CloudApp.Data;
using CloudApp.Models;
using CloudApp.Services;
using Newtonsoft.Json;

namespace CloudApp.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TelemetryController : ControllerBase
    {
        private readonly CloudDbContext _context;
        private readonly IActiveMQService _activeMQService;
        private static readonly Random _random = new();

        public TelemetryController(CloudDbContext context, IActiveMQService activeMQService)
        {
            _context = context;
            _activeMQService = activeMQService;
        }

        // GET all telemetry
        [HttpGet]
        public IActionResult GetAll() =>
            Ok(_context.Telemetries.OrderByDescending(t => t.Timestamp).Take(50).ToList());

        // GET cloud-only telemetry
        [HttpGet("cloud")]
        public IActionResult GetCloud() =>
            Ok(_context.Telemetries.Where(t => t.Source == "Cloud")
               .OrderByDescending(t => t.Timestamp).Take(50).ToList());

        // GET edge-synced telemetry
        [HttpGet("edge")]
        public IActionResult GetEdge() =>
            Ok(_context.Telemetries.Where(t => t.Source == "Edge")
               .OrderByDescending(t => t.Timestamp).Take(50).ToList());

        // POST: Generate 10 sample telemetry records in SQL Server
        [HttpPost("generate")]
        public IActionResult Generate()
        {
            var list = Enumerable.Range(1, 10).Select(i => new Telemetry
            {
                DeviceId = $"CLOUD-DEVICE-{_random.Next(1, 5)}",
                Temperature = Math.Round(_random.NextDouble() * 40 + 20, 2),
                Humidity = Math.Round(_random.NextDouble() * 60 + 20, 2),
                Pressure = Math.Round(_random.NextDouble() * 50 + 1000, 2),
                Timestamp = DateTime.UtcNow.AddMinutes(-i),
                Source = "Cloud"
            }).ToList();

            _context.Telemetries.AddRange(list);
            _context.SaveChanges();

            return Ok(new { Message = "10 Cloud telemetry records generated", Count = 10 });
        }
    }
}
