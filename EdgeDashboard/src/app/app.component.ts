import { Component, OnInit, OnDestroy, AfterViewInit, ViewChildren, QueryList, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  HeaderComponent,
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  TitleComponent,
  ArcGenericTableComponent,
  ArcTableColumnComponent,
  LoadingIndicatorComponent,
  NotificationComponent
} from '@abb/arcadia-angular-v2';
import { TelemetryService, Telemetry } from './services/telemetry.service';
import { MetricValueComponent } from './shared/metric-value.component';
import { DASHBOARD_CONFIG, parseUtc, timeLabel } from './dashboard.config';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    BaseChartDirective,
    MetricValueComponent,
    HeaderComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    TitleComponent,
    ArcGenericTableComponent,
    ArcTableColumnComponent,
    LoadingIndicatorComponent
  ]
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  title = 'Edge Telemetry';
  subtitle = 'Continuous Local Store & Cloud Sync';
  readonly cfg = DASHBOARD_CONFIG;

  /** Persistent chart directives — created once, never recreated. */
  @ViewChildren(BaseChartDirective) private chartDirectives?: QueryList<BaseChartDirective>;

  // ---- Reactive state for cards / table / ops (signals) ----
  telemetry = signal<Telemetry[]>([]);
  localData = computed(() => this.telemetry().filter(t => t.source === 'Edge'));
  cloudData = computed(() => this.telemetry().filter(t => t.source === 'Cloud'));

  loading = signal(true);
  error = signal<string | null>(null);
  lastUpdated = signal<Date | null>(null);

  busyRequest = signal(false);
  busyGenerate = signal(false);

  syncedCount = computed(() => this.localData().filter(t => t.syncedToCloud).length);
  pendingCount = computed(() => this.localData().filter(t => !t.syncedToCloud).length);
  hasData = computed(() => this.telemetry().length > 0);
  devicesOnline = computed(() => {
    const cutoff = Date.now() - this.cfg.deviceOnlineWindowMs;
    return new Set(this.telemetry().filter(t => parseUtc(t.timestamp) >= cutoff).map(t => t.deviceId)).size;
  });
  recentMessages = computed(() => {
    const cutoff = Date.now() - this.cfg.recentWindowMs;
    return this.telemetry().filter(t => parseUtc(t.timestamp) >= cutoff).length;
  });
  syncRate = computed(() => {
    const total = this.localData().length;
    return total ? Math.round((this.syncedCount() / total) * 100) : 0;
  });

  // ---- Chart OPTIONS (static) ----
  temperatureOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 650, easing: 'easeOutCubic' },
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, padding: 16 } }, tooltip: { enabled: true } },
    scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }, y: { grid: { color: 'rgba(0,0,0,0.06)' } } }
  };
  syncStatusOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true, maintainAspectRatio: false, cutout: '65%',
    animation: { duration: 650, easing: 'easeOutCubic' },
    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 16 } }, tooltip: { enabled: true } }
  };

  // ---- Chart DATA (STABLE objects, created once, mutated in place) ----
  temperatureData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      { label: 'Local Edge °C', data: [], borderColor: '#3b6fe0', backgroundColor: 'rgba(59,111,224,0.10)', tension: 0.35, fill: true, pointRadius: 0, borderWidth: 2, spanGaps: true },
      { label: 'Synced Cloud °C', data: [], borderColor: '#E30613', backgroundColor: 'rgba(227,6,19,0.08)', tension: 0.35, fill: true, pointRadius: 0, borderWidth: 2, spanGaps: true }
    ]
  };
  syncStatusData: ChartConfiguration<'doughnut'>['data'] = {
    labels: ['Synced', 'Pending'],
    datasets: [{ data: [0, 0], backgroundColor: ['#16a34a', '#f59e0b'], borderWidth: 0 }]
  };

  private lastMaxId = 0;
  private lastSeenId = 0;
  private viewReady = false;
  private timer: any = null;
  private wasError = false;

  constructor(private telemetryService: TelemetryService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.poll();
    this.timer = setInterval(() => this.poll(), this.cfg.refreshIntervalMs);
  }
  ngAfterViewInit(): void { this.viewReady = true; this.refreshCharts(); }
  ngOnDestroy(): void { if (this.timer) { clearInterval(this.timer); } }

  private poll(): void {
    this.telemetryService.getAllTelemetry().subscribe({
      next: (data) => {
        const list = data ?? [];
        const maxId = list.reduce((m, t) => Math.max(m, t.id), 0);
        this.lastMaxId = Math.max(this.lastMaxId, maxId);
        this.telemetry.set(list);
        this.error.set(null);
        this.wasError = false;
        this.loading.set(false);
        this.lastUpdated.set(new Date());

        this.updateRollingLine(list);
        this.updateDonut();
        this.refreshCharts();
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Cannot reach Edge API at http://localhost:5001. Confirm EdgeApp is running.');
        if (!this.wasError) {
          this.notify('Cannot reach Edge API at http://localhost:5001.', 'error');
          this.wasError = true;
        }
      }
    });
  }

  /** Rolling historian buffer: append new samples, drop the oldest — never rebuild. */
  private updateRollingLine(list: Telemetry[]): void {
    const labels = this.temperatureData.labels as string[];
    const local = this.temperatureData.datasets[0].data as (number | null)[];
    const cloud = this.temperatureData.datasets[1].data as (number | null)[];

    const push = (t: Telemetry) => {
      labels.push(timeLabel(t.timestamp));
      local.push(t.source === 'Edge' ? t.temperature : null);
      cloud.push(t.source === 'Cloud' ? t.temperature : null);
    };

    if (this.lastSeenId === 0) {
      const seed = [...list].sort((a, b) => parseUtc(a.timestamp) - parseUtc(b.timestamp)).slice(-this.cfg.chartHistoryPoints);
      labels.length = 0; local.length = 0; cloud.length = 0;
      seed.forEach(push);
    } else {
      const fresh = list.filter(t => t.id > this.lastSeenId).sort((a, b) => parseUtc(a.timestamp) - parseUtc(b.timestamp));
      fresh.forEach(push);
    }

    const overflow = labels.length - this.cfg.chartHistoryPoints;
    if (overflow > 0) { labels.splice(0, overflow); local.splice(0, overflow); cloud.splice(0, overflow); }

    this.lastSeenId = Math.max(this.lastSeenId, list.reduce((m, t) => Math.max(m, t.id), 0));
  }

  /** Donut: update the synced/pending counts in place — the arc animates, chart isn't rebuilt. */
  private updateDonut(): void {
    const d = this.syncStatusData.datasets[0].data as number[];
    d[0] = this.syncedCount();
    d[1] = this.pendingCount();
  }

  private refreshCharts(): void {
    if (!this.viewReady || !this.chartDirectives) { return; }
    this.chartDirectives.forEach(dir => dir.chart?.update());
  }

  requestCloud(): void {
    this.busyRequest.set(true);
    this.telemetryService.requestFromCloud().subscribe({
      next: () => { this.notify('Request sent to Cloud — data will sync into SQLite shortly.', 'primary'); this.busyRequest.set(false); setTimeout(() => this.poll(), 1200); },
      error: () => { this.notify('Failed to reach Edge API.', 'error'); this.busyRequest.set(false); }
    });
  }
  generateEdgeData(): void {
    this.busyGenerate.set(true);
    this.telemetryService.generateTelemetry().subscribe({
      next: () => { this.notify('Manual reading generated and published to Cloud.', 'success'); this.busyGenerate.set(false); setTimeout(() => this.poll(), 1200); },
      error: () => { this.notify('Failed to reach Edge API.', 'error'); this.busyGenerate.set(false); }
    });
  }

  /** Arcadia toast — replaces the old inline action/error banners. */
  private notify(primaryText: string, state: 'success' | 'primary' | 'error' | 'warn' | 'neutral'): void {
    this.snackBar.openFromComponent(NotificationComponent, {
      data: { variant: 'floating', state, primaryText },
      duration: 4000,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}
