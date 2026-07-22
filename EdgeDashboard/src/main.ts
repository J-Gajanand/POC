import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideTranslateService } from '@ngx-translate/core';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    // Zoneless Angular 22 (no zone.js). Required so signal writes from the
    // polling loop actually re-render the view.
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),
    // ng2-charts@10 does NOT auto-register Chart.js v4 controllers/elements.
    provideCharts(withDefaultRegisterables()),
    // Required by Arcadia's Material-based components (notification/snackbar, menus, overlays).
    provideAnimationsAsync(),
    // Required by @abb/arcadia-angular-v2 peer dependency @ngx-translate/core, consumed internally by Arcadia components.
    provideTranslateService()
  ]
}).catch(err => console.error(err));
