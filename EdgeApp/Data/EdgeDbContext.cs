using Microsoft.EntityFrameworkCore;
using EdgeApp.Models;

namespace EdgeApp.Data
{
    public class EdgeDbContext : DbContext
    {
        public EdgeDbContext(DbContextOptions<EdgeDbContext> options) : base(options) { }

        public DbSet<Telemetry> Telemetries { get; set; }
    }
}
