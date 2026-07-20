import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { TelemetryService, Telemetry } from './services/telemetry.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
  imports: [CommonModule, HttpClientModule, BaseChartDirective]
})
export class AppComponent implements OnInit, OnDestroy {
  title = '🌐 Edge Dashboard';
  
  telemetry: Telemetry[] = [];
  localData: Telemetry[] = [];
  cloudData: Telemetry[] = [];
  
  private subscription: Subscription | null = null;

  temperatureChartConfig: ChartConfiguration<'line'> = {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: '🌐 Local Edge Data',
          data: [],
          borderColor: '#6764f6',
          backgroundColor: 'rgba(103, 100, 246, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: '☁️ Synced Cloud Data',
          data: [],
          borderColor: '#FF000F',
          backgroundColor: 'rgba(255, 0, 15, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'top'
        },
        title: {
          display: true,
          text: '📈 Temperature Comparison'
        }
      }
    }
  };

  syncStatusChartConfig: ChartConfiguration<'doughnut'> = {
    type: 'doughnut',
    data: {
      labels: ['✅ Synced', '⏳ Pending'],
      datasets: [
        {
          data: [0, 0],
          backgroundColor: ['#FF000F', '#FFE6E6']
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        },
        title: {
          display: true,
          text: '🔄 Sync Status'
        }
      }
    }
  };

  constructor(private telemetryService: TelemetryService) {}

  ngOnInit() {
    this.loadInitialData();
    this.startAutoRefresh();
  }

  loadInitialData() {
    this.telemetryService.getAllTelemetry().subscribe(
      (data) => {
        this.telemetry = data;
        this.updateData();
      },
      (error) => console.error('Error loading data:', error)
    );
  }

  startAutoRefresh() {
    this.subscription = this.telemetryService.getAutoRefreshTelemetry().subscribe(
      (data) => {
        this.telemetry = data;
        this.updateData();
      }
    );
  }

  updateData() {
    this.localData = this.telemetry.filter(t => t.source === 'Edge');
    this.cloudData = this.telemetry.filter(t => t.source === 'Cloud');
    this.updateCharts();
  }

  updateCharts() {
    const labels = this.telemetry
      .slice(0, 10)
      .map(t => new Date(t.timestamp).toLocaleTimeString());

    // Temperature Chart
    this.temperatureChartConfig.data.labels = labels;
    (this.temperatureChartConfig.data.datasets[0].data as any) = this.localData
      .slice(0, 10)
      .map(t => t.temperature);
    (this.temperatureChartConfig.data.datasets[1].data as any) = this.cloudData
      .slice(0, 10)
      .map(t => t.temperature);

    // Sync Status Chart
    const synced = this.localData.filter(t => t.syncedToCloud).length;
    const pending = this.localData.filter(t => !t.syncedToCloud).length;
    (this.syncStatusChartConfig.data.datasets[0].data as any) = [synced, pending];
  }

  requestCloud() {
    this.telemetryService.requestFromCloud().subscribe(
      () => {
        alert('✅ Request sent to Cloud');
        setTimeout(() => this.loadInitialData(), 2000);
      },
      (error) => console.error('Error:', error)
    );
  }

  generateEdgeData() {
    this.telemetryService.generateTelemetry().subscribe(
      () => {
        alert('✅ Edge telemetry generated and sent to Cloud');
        setTimeout(() => this.loadInitialData(), 2000);
      },
      (error) => console.error('Error:', error)
    );
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
