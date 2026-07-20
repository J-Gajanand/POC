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
  title = '☁️ Cloud Dashboard';
  
  allTelemetry: Telemetry[] = [];
  cloudTelemetry: Telemetry[] = [];
  edgeTelemetry: Telemetry[] = [];
  
  private subscription: Subscription | null = null;

  temperatureChartConfig: ChartConfiguration<'line'> = {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: '☁️ Cloud Temperature',
          data: [],
          borderColor: '#FF000F',
          backgroundColor: 'rgba(255, 0, 15, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: '🌐 Edge Temperature',
          data: [],
          borderColor: '#6764f6',
          backgroundColor: 'rgba(103, 100, 246, 0.1)',
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

  humidityChartConfig: ChartConfiguration<'bar'> = {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: '☁️ Cloud Humidity',
          data: [],
          backgroundColor: '#FF000F'
        },
        {
          label: '🌐 Edge Humidity',
          data: [],
          backgroundColor: '#6764f6'
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
          text: '💧 Humidity Comparison'
        }
      }
    }
  };

  pressureChartConfig: ChartConfiguration<'bar'> = {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: '☁️ Cloud Pressure',
          data: [],
          backgroundColor: '#ff957e'
        },
        {
          label: '🌐 Edge Pressure',
          data: [],
          backgroundColor: '#93a1ff'
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
          text: '🔋 Pressure Comparison'
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
        this.allTelemetry = data;
        this.cloudTelemetry = data.filter(t => t.source === 'Cloud');
        this.edgeTelemetry = data.filter(t => t.source === 'Edge');
        this.updateCharts();
      },
      (error) => console.error('Error loading data:', error)
    );
  }

  startAutoRefresh() {
    this.subscription = this.telemetryService.getAutoRefreshTelemetry().subscribe(
      (data) => {
        this.allTelemetry = data;
        this.cloudTelemetry = data.filter(t => t.source === 'Cloud');
        this.edgeTelemetry = data.filter(t => t.source === 'Edge');
        this.updateCharts();
      }
    );
  }

  updateCharts() {
    const labels = this.allTelemetry
      .slice(0, 10)
      .map(t => new Date(t.timestamp).toLocaleTimeString());

    // Update Temperature Chart
    this.temperatureChartConfig.data.labels = labels;
    (this.temperatureChartConfig.data.datasets[0].data as any) = this.cloudTelemetry
      .slice(0, 10)
      .map(t => t.temperature);
    (this.temperatureChartConfig.data.datasets[1].data as any) = this.edgeTelemetry
      .slice(0, 10)
      .map(t => t.temperature);

    // Update Humidity Chart
    this.humidityChartConfig.data.labels = labels;
    (this.humidityChartConfig.data.datasets[0].data as any) = this.cloudTelemetry
      .slice(0, 10)
      .map(t => t.humidity);
    (this.humidityChartConfig.data.datasets[1].data as any) = this.edgeTelemetry
      .slice(0, 10)
      .map(t => t.humidity);

    // Update Pressure Chart
    this.pressureChartConfig.data.labels = labels;
    (this.pressureChartConfig.data.datasets[0].data as any) = this.cloudTelemetry
      .slice(0, 10)
      .map(t => t.pressure);
    (this.pressureChartConfig.data.datasets[1].data as any) = this.edgeTelemetry
      .slice(0, 10)
      .map(t => t.pressure);
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
