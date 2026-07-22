import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideTranslateService } from '@ngx-translate/core';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    // This is a zoneless Angular 22 app (no zone.js). Without this scheduler,
    // change detection runs only once at bootstrap and the view never updates
    // after async poll results — install the zoneless CD scheduler so signal
    // writes drive re-render.
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),
    // Registers every Chart.js v4 controller, element, scale and plugin.
    // ng2-charts@10 does NOT auto-register — without this Chart.js throws
    // "line"/"bar" is not a registered controller.
    provideCharts(withDefaultRegisterables()),
    // Required by Arcadia's Material-based components (notification/snackbar, menus, overlays).
    provideAnimationsAsync(),
    // Required by @abb/arcadia-angular-v2 peer dependency @ngx-translate/core, consumed internally by Arcadia components.
    provideTranslateService()
  ]
}).catch(err => console.error(err));
