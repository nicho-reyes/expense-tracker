import {
  APP_INITIALIZER,
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  isDevMode,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';
import { CategoriesService } from './core/services/categories.service';
import { ConfigService } from './core/services/config.service';
import { EntriesService } from './core/services/entries.service';
import { SyncQueueService } from './core/services/sync-queue.service';
import { HydrationService } from './core/services/hydration.service';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    provideCharts(withDefaultRegisterables()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: (config: ConfigService, auth: AuthService, categories: CategoriesService, entries: EntriesService, syncQueue: SyncQueueService, hydration: HydrationService) =>
        () => config.load().then(() => auth.init()).then(() => categories.init()).then(() => entries.init()).then(() => syncQueue.init()).then(() => hydration.init()),
      deps: [ConfigService, AuthService, CategoriesService, EntriesService, SyncQueueService, HydrationService],
      multi: true,
    },
  ],
};
