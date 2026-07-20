import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
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
export class AppComponent implements OnInit, OnDestroy {
  title = 'Edge Telemetry';
  subtitle = 'Continuous Local Store & Cloud Sync';
  readonly cfg = DASHBOARD_CONFIG;

  // ---- Reactive state (signals — zoneless app) ----
  telemetry = signal<Telemetry[]>([]);
  localData = computed(() => this.telemetry().filter(t => t.source === 'Edge'));
  cloudData = computed(() => this.telemetry().filter(t => t.source === 'Cloud'));

  loading = signal(true);
  error = signal<string | null>(null);
  lastUpdated = signal<Date | null>(null);

  actionMessage = signal<string | null>(null);
  actionKind = signal<'success' | 'info'>('success');
  busyRequest = signal(false);
  busyGenerate = signal(false);
  newIds = signal<Set<number>>(new Set());

  syncedCount = computed(() => this.localData().filter(t => t.syncedToCloud).length);
  pendingCount = computed(() => this.localData().filter(t => !t.syncedToCloud).length);
  hasData = computed(() => this.telemetry().length > 0);

  // ---- Operational metrics ----
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

  private lastMaxId = 0;
  private timer: any = null;

  // ---- Chart options ----
  temperatureOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, padding: 16 } }, tooltip: { enabled: true } },
    scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }, y: { grid: { color: 'rgba(0,0,0,0.06)' } } }
  };
  syncStatusOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true, maintainAspectRatio: false, cutout: '65%', animation: { duration: 300 },
    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 16 } }, tooltip: { enabled: true } }
  };

  temperatureData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });
  syncStatusData = signal<ChartConfiguration<'doughnut'>['data']>({ labels: ['Synced', 'Pending'], datasets: [] });

  constructor(private telemetryService: TelemetryService) {}

  ngOnInit(): void {
    this.poll();
    this.timer = setInterval(() => this.poll(), this.cfg.refreshIntervalMs);
  }
  ngOnDestroy(): void { if (this.timer) { clearInterval(this.timer); } }

  trackByRow = (_: number, item: Telemetry) => item.id;
  isNew = (id: number) => this.newIds().has(id);

  private poll(): void {
    this.telemetryService.getAllTelemetry().subscribe({
      next: (data) => {
        const list = data ?? [];
        const maxId = list.reduce((m, t) => Math.max(m, t.id), 0);
        if (this.lastMaxId > 0) {
          this.newIds.set(new Set(list.filter(t => t.id > this.lastMaxId).map(t => t.id)));
        }
        this.lastMaxId = Math.max(this.lastMaxId, maxId);

        this.telemetry.set(list);
        this.updateCharts(list);
        this.error.set(null);
        this.loading.set(false);
        this.lastUpdated.set(new Date());
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Cannot reach Edge API at http://localhost:5001. Confirm EdgeApp is running.');
      }
    });
  }

  private updateCharts(list: Telemetry[]): void {
    const window = [...list].sort((a, b) => parseUtc(a.timestamp) - parseUtc(b.timestamp)).slice(-this.cfg.chartHistoryPoints);
    const labels = window.map(t => timeLabel(t.timestamp));
    this.temperatureData.set({
      labels,
      datasets: [
        { label: 'Local Edge °C', data: window.map(t => t.source === 'Edge' ? t.temperature : null), borderColor: '#3b6fe0', backgroundColor: 'rgba(59,111,224,0.10)', tension: 0.35, fill: true, pointRadius: 0, borderWidth: 2, spanGaps: true },
        { label: 'Synced Cloud °C', data: window.map(t => t.source === 'Cloud' ? t.temperature : null), borderColor: '#E30613', backgroundColor: 'rgba(227,6,19,0.08)', tension: 0.35, fill: true, pointRadius: 0, borderWidth: 2, spanGaps: true }
      ]
    });

    this.syncStatusData.set({
      labels: ['Synced', 'Pending'],
      datasets: [{ data: [this.syncedCount(), this.pendingCount()], backgroundColor: ['#16a34a', '#f59e0b'], borderWidth: 0 }]
    });
  }

  requestCloud(): void {
    this.busyRequest.set(true);
    this.telemetryService.requestFromCloud().subscribe({
      next: () => { this.flash('Request sent to Cloud — data will sync into SQLite shortly.', 'info'); this.busyRequest.set(false); setTimeout(() => this.poll(), 1200); },
      error: () => { this.flash('Failed to reach Edge API.', 'info'); this.busyRequest.set(false); }
    });
  }

  generateEdgeData(): void {
    this.busyGenerate.set(true);
    this.telemetryService.generateTelemetry().subscribe({
      next: () => { this.flash('Manual reading generated and published to Cloud.', 'success'); this.busyGenerate.set(false); setTimeout(() => this.poll(), 1200); },
      error: () => { this.flash('Failed to reach Edge API.', 'info'); this.busyGenerate.set(false); }
    });
  }

  private flash(msg: string, kind: 'success' | 'info'): void {
    this.actionMessage.set(msg);
    this.actionKind.set(kind);
    setTimeout(() => this.actionMessage.set(null), 4000);
  }
}
