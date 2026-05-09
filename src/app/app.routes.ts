import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { setupGuard } from './core/guards/setup.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [authGuard, setupGuard],
  },
  {
    path: 'entries',
    loadComponent: () =>
      import('./features/entries-list/entries-list.component').then(
        (m) => m.EntriesListComponent,
      ),
    canActivate: [authGuard, setupGuard],
  },
  {
    path: 'sync',
    loadComponent: () =>
      import('./features/sync-review/sync-review.component').then((m) => m.SyncReviewComponent),
    canActivate: [authGuard, setupGuard],
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
    canActivate: [authGuard, setupGuard],
  },
  {
    path: 'setup',
    loadComponent: () =>
      import('./features/setup/setup.component').then((m) => m.SetupComponent),
    canActivate: [authGuard],
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('./features/auth/auth.component').then((m) => m.AuthComponent),
  },
  { path: '**', redirectTo: 'auth' },
];
// Note: entry-form has NO route — it opens as MatBottomSheet via FAB only
