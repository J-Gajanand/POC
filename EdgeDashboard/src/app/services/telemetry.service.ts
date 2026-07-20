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
  syncedToCloud: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TelemetryService {
  private edgeApiUrl = 'http://localhost:5001/api/telemetry';

  constructor(private http: HttpClient) { }

  getAllTelemetry(): Observable<Telemetry[]> {
    return this.http.get<Telemetry[]>(this.edgeApiUrl);
  }

  requestFromCloud(): Observable<any> {
    return this.http.post(`${this.edgeApiUrl}/request`, {});
  }

  generateTelemetry(): Observable<any> {
    return this.http.post(`${this.edgeApiUrl}/generate`, {});
  }

  getAutoRefreshTelemetry(): Observable<Telemetry[]> {
    return interval(3000).pipe(
      switchMap(() => this.getAllTelemetry())
    );
  }
}
