using CloudApp.Data;
using CloudApp.Services;
using CloudApp.Simulation;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// SQL Server
builder.Services.AddDbContext<CloudDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// ActiveMQ
builder.Services.AddSingleton<IActiveMQService, ActiveMQService>();
builder.Services.AddHostedService<CloudMessageConsumerService>();

// Continuous cloud-origin telemetry simulator (keeps the Cloud series live).
builder.Services.Configure<SimulationOptions>(builder.Configuration.GetSection("Simulation"));
builder.Services.AddSingleton<ITelemetryGenerator, TelemetryGenerator>();
builder.Services.AddHostedService<CloudSimulatorService>();

// CORS for Angular
builder.Services.AddCors(opt => opt.AddPolicy("AllowAngular", p =>
    p.WithOrigins("http://localhost:4200", "http://localhost:4201")
     .AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

// Auto-create DB tables
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CloudDbContext>();
    db.Database.EnsureCreated();
}

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors("AllowAngular");
app.UseAuthorization();
app.MapControllers();
app.Run();
