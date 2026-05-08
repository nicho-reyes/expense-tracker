import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'entries', loadComponent: () => import('./features/entries-list/entries-list.component').then(m => m.EntriesListComponent) },
  { path: 'sync', loadComponent: () => import('./features/sync-review/sync-review.component').then(m => m.SyncReviewComponent) },
  { path: 'settings', loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent) },
  { path: 'auth', loadComponent: () => import('./features/auth/auth.component').then(m => m.AuthComponent) },
  { path: '**', redirectTo: '' },
];
// Note: entry-form has NO route — it opens as MatBottomSheet via FAB only
