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
        private readonly ITelemetryGenerator _generator;

        public TelemetryController(CloudDbContext context, IActiveMQService activeMQService, ITelemetryGenerator generator)
        {
            _context = context;
            _activeMQService = activeMQService;
            _generator = generator;
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

        // POST: Generate a batch of cloud telemetry on demand (one reading per device),
        // reusing the same stateful generator the continuous simulator uses.
        [HttpPost("generate")]
        public IActionResult Generate()
        {
            var list = _generator.DeviceIds.Select(id => _generator.Next(id)).ToList();

            _context.Telemetries.AddRange(list);
            _context.SaveChanges();

            return Ok(new { Message = $"{list.Count} Cloud telemetry records generated", Count = list.Count });
        }
    }
}
