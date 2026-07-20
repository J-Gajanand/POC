using EdgeApp.Data;
using EdgeApp.Services;
using EdgeApp.Simulation;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// SQLite
builder.Services.AddDbContext<EdgeDbContext>(opt =>
    opt.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// ActiveMQ
builder.Services.AddSingleton<IActiveMQService, ActiveMQService>();
builder.Services.AddHostedService<EdgeMessageConsumerService>();

// Continuous industrial telemetry simulator (backend-driven, no UI interaction).
builder.Services.Configure<SimulationOptions>(builder.Configuration.GetSection("Simulation"));
builder.Services.AddSingleton<ITelemetryGenerator, TelemetryGenerator>();
builder.Services.AddHostedService<DeviceSimulatorService>();

// CORS
builder.Services.AddCors(opt => opt.AddPolicy("AllowAngular", p =>
    p.WithOrigins("http://localhost:4200", "http://localhost:4201")
     .AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<EdgeDbContext>();
    db.Database.EnsureCreated();
}

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors("AllowAngular");
app.UseAuthorization();
app.MapControllers();

// Run Edge on port 5001
app.Urls.Add("http://localhost:5001");
app.Run();
