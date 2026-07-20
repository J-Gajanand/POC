import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

export interface Telemetry {
  id: number;
  deviceId: string;
  temperature: number;
  humidity: number;
  pressure: number;
  timestamp: string;
  source: string;
}

@Injectable({
  providedIn: 'root'
})
export class TelemetryService {
  private cloudApiUrl = 'http://localhost:5126/api/telemetry';

  constructor(private http: HttpClient) { }

  getAllTelemetry(): Observable<Telemetry[]> {
    return this.http.get<Telemetry[]>(this.cloudApiUrl);
  }

  getCloudTelemetry(): Observable<Telemetry[]> {
    return this.http.get<Telemetry[]>(`${this.cloudApiUrl}/cloud`);
  }

  getEdgeTelemetry(): Observable<Telemetry[]> {
    return this.http.get<Telemetry[]>(`${this.cloudApiUrl}/edge`);
  }

  generateTelemetry(): Observable<any> {
    return this.http.post(`${this.cloudApiUrl}/generate`, {});
  }

  getAutoRefreshTelemetry(): Observable<Telemetry[]> {
    return interval(3000).pipe(
      switchMap(() => this.getAllTelemetry())
    );
  }
}
