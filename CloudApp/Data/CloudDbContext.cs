using Microsoft.EntityFrameworkCore;
using CloudApp.Models;

namespace CloudApp.Data
{
    public class CloudDbContext : DbContext
    {
        public CloudDbContext(DbContextOptions<CloudDbContext> options) : base(options) { }

        public DbSet<Telemetry> Telemetries { get; set; }
    }
}
