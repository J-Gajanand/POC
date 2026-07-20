import { Component, OnInit, OnDestroy, AfterViewInit, ViewChildren, QueryList, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { TelemetryService, Telemetry } from './services/telemetry.service';
import { MetricValueComponent } from './shared/metric-value.component';
import { DASHBOARD_CONFIG, parseUtc, timeLabel } from './dashboard.config';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
  imports: [CommonModule, BaseChartDirective, MetricValueComponent]
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  title = 'Cloud Telemetry';
  subtitle = 'Continuous Cloud ↔ Edge Operations Monitor';
  readonly cfg = DASHBOARD_CONFIG;

  /** Persistent chart directives — created once, never recreated. */
  @ViewChildren(BaseChartDirective) private chartDirectives?: QueryList<BaseChartDirective>;

  // ---- Reactive state for cards / table / ops (signals) ----
  allTelemetry = signal<Telemetry[]>([]);
  cloudTelemetry = computed(() => this.allTelemetry().filter(t => t.source === 'Cloud'));
  edgeTelemetry = computed(() => this.allTelemetry().filter(t => t.source === 'Edge'));

  loading = signal(true);
  error = signal<string | null>(null);
  lastUpdated = signal<Date | null>(null);
  newIds = signal<Set<number>>(new Set());
  totalTrend = signal<'up' | 'flat'>('flat');

  hasData = computed(() => this.allTelemetry().length > 0);
  avgTemperature = computed(() => {
    const arr = this.allTelemetry();
    if (!arr.length) { return 0; }
    return arr.reduce((a, t) => a + (t.temperature || 0), 0) / arr.length;
  });
  devicesOnline = computed(() => {
    const cutoff = Date.now() - this.cfg.deviceOnlineWindowMs;
    return new Set(this.allTelemetry().filter(t => parseUtc(t.timestamp) >= cutoff).map(t => t.deviceId)).size;
  });
  recentMessages = computed(() => {
    const cutoff = Date.now() - this.cfg.recentWindowMs;
    return this.allTelemetry().filter(t => parseUtc(t.timestamp) >= cutoff).length;
  });
  edgeSyncedShare = computed(() => {
    const total = this.allTelemetry().length;
    return total ? Math.round((this.edgeTelemetry().length / total) * 100) : 0;
  });

  // ---- Chart OPTIONS (static) ----
  temperatureOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 650, easing: 'easeOutCubic' },   // smooth transition, not a from-scratch redraw
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, padding: 16 } }, tooltip: { enabled: true } },
    scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }, y: { grid: { color: 'rgba(0,0,0,0.06)' } } }
  };
  barOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 650, easing: 'easeOutCubic' },
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.06)' } } }
  };

  // ---- Chart DATA (STABLE objects, created once, mutated in place) ----
  temperatureData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      { label: 'Cloud °C', data: [], borderColor: '#E30613', backgroundColor: 'rgba(227,6,19,0.10)', tension: 0.35, fill: true, pointRadius: 0, borderWidth: 2, spanGaps: true },
      { label: 'Edge °C', data: [], borderColor: '#3b6fe0', backgroundColor: 'rgba(59,111,224,0.08)', tension: 0.35, fill: true, pointRadius: 0, borderWidth: 2, spanGaps: true }
    ]
  };
  humidityData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [{ label: 'Humidity %', data: [], backgroundColor: [], borderRadius: 4 }] };
  pressureData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [{ label: 'Pressure hPa', data: [], backgroundColor: [], borderRadius: 4 }] };

  private lastMaxId = 0;      // for new-row highlight
  private lastSeenId = 0;     // for rolling-buffer append
  private viewReady = false;
  private timer: any = null;

  constructor(private telemetryService: TelemetryService) {}

  ngOnInit(): void {
    this.poll();
    this.timer = setInterval(() => this.poll(), this.cfg.refreshIntervalMs);
  }
  ngAfterViewInit(): void { this.viewReady = true; this.refreshCharts(); }
  ngOnDestroy(): void { if (this.timer) { clearInterval(this.timer); } }

  trackByRow = (_: number, item: Telemetry) => item.id;
  isNew = (id: number) => this.newIds().has(id);

  private poll(): void {
    this.telemetryService.getAllTelemetry().subscribe({
      next: (data) => {
        const list = data ?? [];

        // Card / table / ops state (signals → text + rows update, layout stays put).
        const maxId = list.reduce((m, t) => Math.max(m, t.id), 0);
        if (this.lastMaxId > 0) { this.newIds.set(new Set(list.filter(t => t.id > this.lastMaxId).map(t => t.id))); }
        this.totalTrend.set(list.length > this.allTelemetry().length ? 'up' : 'flat');
        this.lastMaxId = Math.max(this.lastMaxId, maxId);
        this.allTelemetry.set(list);
        this.error.set(null);
        this.loading.set(false);
        this.lastUpdated.set(new Date());

        // Charts: mutate persistent data objects in place, then chart.update().
        this.updateRollingLine(list);
        this.updateDeviceBars(list);
        this.refreshCharts();
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Cannot reach Cloud API at http://localhost:5126. Confirm CloudApp is running.');
      }
    });
  }

  /** Rolling historian buffer: append new samples on the right, drop the oldest — never rebuild. */
  private updateRollingLine(list: Telemetry[]): void {
    const labels = this.temperatureData.labels as string[];
    const cloud = this.temperatureData.datasets[0].data as (number | null)[];
    const edge = this.temperatureData.datasets[1].data as (number | null)[];

    const push = (t: Telemetry) => {
      labels.push(timeLabel(t.timestamp));
      cloud.push(t.source === 'Cloud' ? t.temperature : null);
      edge.push(t.source === 'Edge' ? t.temperature : null);
    };

    if (this.lastSeenId === 0) {
      // First load: seed the window from the latest N samples.
      const seed = [...list].sort((a, b) => parseUtc(a.timestamp) - parseUtc(b.timestamp)).slice(-this.cfg.chartHistoryPoints);
      labels.length = 0; cloud.length = 0; edge.length = 0;
      seed.forEach(push);
    } else {
      // Subsequent cycles: append only genuinely new samples (id-based, no duplicates).
      const fresh = list.filter(t => t.id > this.lastSeenId).sort((a, b) => parseUtc(a.timestamp) - parseUtc(b.timestamp));
      fresh.forEach(push);
    }

    // Trim to the rolling window from the left.
    const overflow = labels.length - this.cfg.chartHistoryPoints;
    if (overflow > 0) { labels.splice(0, overflow); cloud.splice(0, overflow); edge.splice(0, overflow); }

    this.lastSeenId = Math.max(this.lastSeenId, list.reduce((m, t) => Math.max(m, t.id), 0));
  }

  /** Bar charts: keep axis/labels/colors, change bar heights only. */
  private updateDeviceBars(list: Telemetry[]): void {
    const latest = this.latestPerDevice(list);
    const labels = latest.map(t => t.deviceId.replace(/^(CLOUD|EDGE)-DEVICE-/, m => m.startsWith('CLOUD') ? 'C' : 'E'));
    const colors = latest.map(t => t.source === 'Cloud' ? '#E30613' : '#3b6fe0');
    this.replaceInPlace(this.humidityData.labels as string[], labels);
    this.replaceInPlace(this.humidityData.datasets[0].data as number[], latest.map(t => t.humidity));
    this.replaceInPlace(this.humidityData.datasets[0].backgroundColor as string[], colors);
    this.replaceInPlace(this.pressureData.labels as string[], labels);
    this.replaceInPlace(this.pressureData.datasets[0].data as number[], latest.map(t => t.pressure));
    this.replaceInPlace(this.pressureData.datasets[0].backgroundColor as string[], colors);
  }

  /** Update every persistent chart instance in place — no destroy, no re-create. */
  private refreshCharts(): void {
    if (!this.viewReady || !this.chartDirectives) { return; }
    this.chartDirectives.forEach(d => d.chart?.update());
  }

  private latestPerDevice(list: Telemetry[]): Telemetry[] {
    const map = new Map<string, Telemetry>();
    for (const t of [...list].sort((a, b) => parseUtc(a.timestamp) - parseUtc(b.timestamp))) { map.set(t.deviceId, t); }
    return [...map.values()].sort((a, b) => a.deviceId.localeCompare(b.deviceId));
  }

  private replaceInPlace<T>(target: T[], next: T[]): void {
    target.length = 0;
    for (const v of next) { target.push(v); }
  }
}
