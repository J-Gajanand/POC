import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    // Zoneless Angular 22 (no zone.js). Required so signal writes from the
    // polling loop actually re-render the view.
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),
    // ng2-charts@10 does NOT auto-register Chart.js v4 controllers/elements.
    provideCharts(withDefaultRegisterables())
  ]
}).catch(err => console.error(err));
