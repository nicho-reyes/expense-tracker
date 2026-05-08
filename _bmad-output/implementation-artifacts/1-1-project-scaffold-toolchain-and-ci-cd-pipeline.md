# Story 1.1: Project scaffold, toolchain, and CI/CD pipeline

Status: done

## Story

As Nick,
I want the project initialized with all required dependencies, toolchain configuration, and a working CI/CD pipeline,
So that I have a deployable app shell as the verified starting point for all subsequent stories.

## Acceptance Criteria

1. `ng new expense-dashboard --style=scss --routing=true --strict=true --ssr=false` runs without errors; `ng serve` starts and the default app shell renders at `/`
2. Angular Material, PWA, Tailwind CSS, ng2-charts, idb, Zod, and Playwright are installed; all package imports resolve; `ng build --configuration=production` produces a clean build
3. `tailwind.config.js` has `preflight: false` and `important: '#app'` set; no style conflicts between Tailwind and Angular Material
4. `AppError` discriminated union is defined with variants: `SCHEMA_VALIDATION`, `SHEETS_API`, `AUTH_EXPIRED`, `AUTH_REVOKED`, `AUTH_DENIED`, `NETWORK`, `SYNC_FAILED`, `IDB_ERROR`, `SCHEMA_MISMATCH`
5. `SyncQueueService` interface contract is defined with `SyncQueueItem` type, `QueueState` enum, and all method signatures; E2 and E3 implement against this interface without modification
6. `SyncQueueItem` includes all required fields (see Dev Notes for full spec)
7. IDB opens with four object stores: `entries`, `syncQueue`, `categories`, `appMeta`
8. GitHub Actions `deploy.yml` runs: checkout → Node 22 → `npm ci` → `ng build --configuration=production` → deploy `dist/expense-dashboard/browser/` → exits status 0
9. `manifest.webmanifest` has `display: standalone`, theme color, 192×192 and 512×512 icon entries

## Tasks / Subtasks

- [x] Run scaffold and install all dependencies (AC: 1, 2)
  - [x] `ng new expense-dashboard --style=scss --routing=true --strict=true --ssr=false`
  - [x] `ng add @angular/material` (choose Custom theme, Yes typography, Include animations)
  - [x] `ng add @angular/pwa`
  - [x] `npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init`
  - [x] `npm install ng2-charts chart.js`
  - [x] `npm install idb`
  - [x] `npm install zod`
  - [x] `npm install -D @playwright/test && npx playwright install`
- [x] Configure Tailwind (AC: 3)
  - [x] Set `content: ['./src/**/*.{html,ts}']`
  - [x] Set `corePlugins: { preflight: false }` and `important: '#app'`
  - [x] Set `darkMode: 'class'`
  - [x] Add `@tailwind base; @tailwind components; @tailwind utilities;` to `src/styles.scss`
- [x] Create complete project directory structure (AC: 1)
  - [x] Create all directories per structure in Dev Notes
  - [x] Create placeholder/stub files for every file listed in the architecture tree
- [x] Define core models (AC: 4, 5, 6)
  - [x] `src/app/core/models/entry.model.ts` — `LocalEntry`, `SyncQueueItem`, `QueueState`
  - [x] `src/app/core/models/error.model.ts` — `AppError` discriminated union (all 9 variants)
  - [x] `src/app/core/models/category.model.ts` — `Category` interface
  - [x] `src/app/core/models/sheets.model.ts` — Sheets API response types + Zod header schemas
- [x] Define `SyncQueueService` interface (AC: 5)
  - [x] Create `src/app/core/services/sync-queue.service.ts` with typed interface/abstract class
  - [x] Stub implementation that satisfies the interface (E2 fills INSERT, E3 fills full state machine)
- [x] Set up `IdbService` with 4-store schema (AC: 7)
  - [x] `src/app/core/services/idb.service.ts` — open DB, define all stores with correct indexes
- [x] Set up environment files and `app.config.ts` (AC: 1, 2)
  - [x] `src/environments/environment.ts` and `environment.production.ts`
  - [x] `app.config.ts` with `bootstrapApplication` providers (HttpClient, Router, animations, ng2-charts)
  - [x] `app.routes.ts` with all lazy routes (dashboard, entries, sync, settings, auth)
  - [x] `.env.example` documenting `NG_APP_GOOGLE_CLIENT_ID`
- [x] Set up CI/CD pipeline (AC: 8)
  - [x] `.github/workflows/deploy.yml` — push-to-main trigger, Node 22, npm ci, ng build, deploy
- [x] Verify PWA artifacts (AC: 9)
  - [x] Confirm `manifest.webmanifest` has standalone display, theme color, 192×192 + 512×512 icons
  - [x] Confirm `ngsw-config.json` exists and Service Worker is wired up
- [x] Verify production build and Playwright setup (AC: 2)
  - [x] `ng build --configuration=production` passes with no errors
  - [x] `playwright.config.ts` exists; `npx playwright test` runs (0 tests, no crash)

## Dev Notes

### Exact Initialization Sequence

Run in order — do not deviate:

```bash
ng new expense-dashboard --style=scss --routing=true --strict=true --ssr=false
cd expense-dashboard
ng add @angular/material          # → Custom theme | Yes typography | Include animations
ng add @angular/pwa
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init
npm install ng2-charts chart.js
npm install idb
npm install zod
npm install -D @playwright/test
npx playwright install
```

**DO NOT install `uuid`** — use `crypto.randomUUID()` natively everywhere. Native browser API, no external dependency needed.

### Tailwind Configuration (tailwind.config.js)

```js
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',          // ← required for light/dark theme toggle
  theme: { extend: {} },
  plugins: [],
  corePlugins: {
    preflight: false,          // ← CRITICAL: prevents Tailwind reset stripping Material styles
  },
  important: '#app',           // ← CRITICAL: Tailwind utilities win specificity over Material
};
```

Both `preflight: false` and `important: '#app'` are **non-negotiable** — omitting either causes style conflicts that are hard to debug later.

### AppError Discriminated Union (error.model.ts)

**CANONICAL — all 9 variants, including `AUTH_DENIED` (added vs. architecture doc):**

```typescript
export type AppError =
  | { type: 'SCHEMA_VALIDATION'; message: string; details: ZodError }
  | { type: 'SHEETS_API'; status: number; message: string }
  | { type: 'AUTH_EXPIRED' }
  | { type: 'AUTH_REVOKED' }
  | { type: 'AUTH_DENIED' }       // ← emitted when user closes consent without granting access
  | { type: 'NETWORK'; message: string }
  | { type: 'SYNC_FAILED'; entryId: string; message: string }
  | { type: 'IDB_ERROR'; message: string }
  | { type: 'SCHEMA_MISMATCH'; tabName: string; expected: string[]; received: string[] }
```

Error throwing pattern — always use `satisfies AppError`, never throw raw `Error`:
```typescript
throw { type: 'IDB_ERROR', message: err.message } satisfies AppError;  // ✅
throw new Error('IDB failed');                                          // ❌
```

### SyncQueueItem — Final Contract (entry.model.ts)

**Canonical field list from epic AC (epics.md Story 1.1) — supersedes architecture doc (which is missing `targetTabName` and `nextRetryAt`):**

```typescript
export enum QueueState {
  PENDING = 'PENDING',
  SYNC_ERROR = 'SYNC_ERROR',
}

export interface SyncQueueItem {
  id: string;                        // UUID
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  entryData: LocalEntry | null;      // null for DELETE
  targetEntryId: string | null;      // null for INSERT
  targetTabName: string | null;      // null for INSERT; set to originating tab for past-year UPDATE/DELETE retries
  enqueuedAt: number;                // Date.now()
  status: QueueState;
  retryCount: number;
  lastAttemptAt: number | null;
  nextRetryAt: number | null;        // written by markError(); retry scheduler reads on init to resume correct timing
  errorMessage: string | null;
}
```

### SyncQueueService Interface (sync-queue.service.ts)

Define the **locked interface** — E2 implements INSERT enqueue only, E3 implements the full state machine. Both compile against this without modification:

```typescript
export interface ISyncQueueService {
  readonly pendingCount: Signal<number>;
  readonly errorCount: Signal<number>;
  readonly queueItems: Signal<SyncQueueItem[]>;

  enqueue(item: Omit<SyncQueueItem, 'id' | 'enqueuedAt' | 'status' | 'retryCount' | 'lastAttemptAt' | 'nextRetryAt' | 'errorMessage'>): Promise<void>;
  dequeue(id: string): Promise<void>;
  markError(id: string, message: string): Promise<void>;
  markSynced(id: string): Promise<void>;
  retryAll(): Promise<void>;
  getQueue(): Promise<SyncQueueItem[]>;
}
```

Provide a stub `SyncQueueService` class implementing `ISyncQueueService` — methods can throw `'Not implemented'` for now. E2 and E3 fill the implementation.

### LocalEntry Interface (entry.model.ts)

```typescript
export interface LocalEntry {
  id: string;               // UUID — written to Sheet column F
  date: string;             // YYYY-MM-DD
  month: string;            // YYYY-MM (derived, indexed)
  year: number;             // indexed
  category: string;
  amount: number;           // negative = credit/reimbursement
  remarks: string;
  tabName: string;
  schemaVersion: '2025' | '2026';
  sheetRowIndex: number | null;
  syncStatus: 'synced' | 'pending' | 'error';
  isReadOnly: boolean;
}
```

### IDB Schema (idb.service.ts)

Four stores, exact indexes required (other stories query by these):

```typescript
interface ExpenseDashboardDb extends DBSchema {
  entries: {
    key: string;
    value: LocalEntry;
    indexes: { 'by-month': string; 'by-year': number; 'by-sync-status': string };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-status': string; 'by-enqueued': number };
  };
  categories: {
    key: string;
    value: Category;
  };
  appMeta: {
    key: string;
    value: unknown;  // typed per-key via generics in IdbService.get<T>() / IdbService.set<T>()
  };
}

const DB_NAME = 'expense-dashboard';
const DB_VERSION = 1;
```

`IdbService` must be the **only** service that calls `idb` directly — no other service imports from `idb`. All IDB access goes through `IdbService` methods.

### Environment Files

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  googleClientId: '',       // set via NG_APP_GOOGLE_CLIENT_ID at build time
  sheetsApiBaseUrl: 'https://sheets.googleapis.com/v4/spreadsheets',
  gisScriptUrl: 'https://accounts.google.com/gsi/client',
};
```

### app.config.ts Providers

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    provideCharts(withDefaultRegisterables()),  // ng2-charts
    // APP_INITIALIZER for AuthService.init() and CategoriesService.init() added in Stories 1.2 and 1.5
  ],
};
```

### app.routes.ts — All Lazy Routes

```typescript
export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'entries', loadComponent: () => import('./features/entries-list/entries-list.component').then(m => m.EntriesListComponent) },
  { path: 'sync', loadComponent: () => import('./features/sync-review/sync-review.component').then(m => m.SyncReviewComponent) },
  { path: 'settings', loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent) },
  { path: 'auth', loadComponent: () => import('./features/auth/auth.component').then(m => m.AuthComponent) },
  { path: '**', redirectTo: '' },
];
// Note: entry-form has NO route — it opens as MatBottomSheet via FAB only
```

### Component Boilerplate Pattern (mandatory on ALL components)

```typescript
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...],          // named imports only — no barrel MaterialModule
  template: `...`,
})
```

Use `input()` / `output()` signal APIs — never `@Input()` / `@Output()` decorators.

### Sheets Model — Zod Schema Stubs (sheets.model.ts)

Define the Zod header validators now so Stories 1.4+ can import them:

```typescript
import { z } from 'zod';

export const SCHEMA_2026_HEADERS = ['Date', 'Category', 'Amount', 'Remarks', 'Month', 'UUID'];
export const SCHEMA_2025_HEADERS = ['Date', 'Category', 'Amount', 'Remarks'];

export const schema2026Validator = z.tuple([
  z.literal('Date'), z.literal('Category'), z.literal('Amount'),
  z.literal('Remarks'), z.literal('Month'), z.literal('UUID'),
]);

export const schema2025Validator = z.tuple([
  z.literal('Date'), z.literal('Category'), z.literal('Amount'), z.literal('Remarks'),
]);
```

### Category Model (category.model.ts)

```typescript
export interface Category {
  id: string;          // unique, used as CSS custom property suffix: --color-[id]
  name: string;
  color: string;       // hex e.g. '#6366f1'
  position: number;    // for ordering in quick-add picker
}
```

### NotificationService Contract (notification.service.ts)

Define the service now with correct interface — error toasts only, never for routine success:

```typescript
@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private snackBar: MatSnackBar) {}
  showSuccess(message: string): void { /* MatSnackBar.open with success panel class */ }
  showError(message: string, action?: string): void { /* MatSnackBar.open with error panel class */ }
  showInfo(message: string): void { /* MatSnackBar.open with info panel class */ }
}
```

### CI/CD Pipeline (.github/workflows/deploy.yml)

```yaml
name: Build and Deploy
on:
  push:
    branches: [main]
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npx ng build --configuration=production
        env:
          NG_APP_GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
      - name: Deploy to hosting
        # Configure for target platform (Netlify/Vercel/GitHub Pages)
        # Output dir: dist/expense-dashboard/browser/
        run: echo "Configure deployment step for your target platform"
```

### PWA Artifacts

After `ng add @angular/pwa`, verify and update `manifest.webmanifest`:
- `"display": "standalone"` (required)
- `"theme_color"` set to design token (e.g., indigo `#6366f1`)
- Icons: both 192×192 and 512×512 present at `public/icons/`

### Project Directory Structure

Create all directories and placeholder files matching this exact structure (from architecture.md):

```
expense-dashboard/
├── .github/workflows/deploy.yml
├── e2e/
│   ├── auth.spec.ts
│   ├── dashboard.spec.ts
│   ├── entry-form.spec.ts
│   ├── offline.spec.ts
│   └── sync-review.spec.ts
├── public/icons/
│   ├── icon-192x192.png
│   └── icon-512x512.png
├── src/app/
│   ├── app.component.ts / .html / .scss / .spec.ts
│   ├── app.config.ts
│   ├── app.routes.ts
│   ├── core/
│   │   ├── guards/auth.guard.ts
│   │   ├── interceptors/auth.interceptor.ts
│   │   ├── models/
│   │   │   ├── entry.model.ts      (LocalEntry, SyncQueueItem, QueueState)
│   │   │   ├── error.model.ts      (AppError union)
│   │   │   ├── category.model.ts   (Category)
│   │   │   └── sheets.model.ts     (Zod schemas, Sheets API types)
│   │   └── services/
│   │       ├── auth.service.ts
│   │       ├── categories.service.ts
│   │       ├── entries.service.ts
│   │       ├── idb.service.ts
│   │       ├── notification.service.ts
│   │       ├── sheets.service.ts
│   │       └── sync-queue.service.ts
│   ├── features/
│   │   ├── auth/auth.component.ts / .html / .scss
│   │   ├── dashboard/dashboard.component.ts / .html / .scss / .spec.ts
│   │   ├── entries-list/entries-list.component.ts / .html / .scss / .spec.ts
│   │   ├── entry-form/entry-form.component.ts / .html / .scss / .spec.ts
│   │   ├── settings/settings.component.ts / .html / .scss
│   │   └── sync-review/sync-review.component.ts / .html / .scss / .spec.ts
│   └── shared/
│       ├── components/ (stubs: amount-input, bottom-nav, category-breakdown-bar,
│       │                category-tile, entry-row, hero-card, kpi-row,
│       │                offline-indicator, sparkline-chart, sync-status-bar)
│       ├── directives/long-press.directive.ts
│       └── pipes/ (category-color.pipe.ts, chf-currency.pipe.ts)
├── src/environments/environment.ts / environment.production.ts
├── src/index.html        (add GIS script tag placeholder comment)
├── src/main.ts
├── src/styles.scss       (Material theme, Tailwind directives, --color-* CSS var defaults)
├── .env.example          (documents NG_APP_GOOGLE_CLIENT_ID)
├── angular.json
├── ngsw-config.json
├── playwright.config.ts
├── tailwind.config.js
└── tsconfig.json / tsconfig.app.json / tsconfig.spec.json
```

### Key Naming Conventions

| Entity | Convention |
|--------|-----------|
| Files/dirs | `kebab-case` |
| Classes/interfaces | `PascalCase` |
| Variables/properties | `camelCase` |
| Signals | no suffix (e.g., `entries`, not `entries$` or `entriesSignal`) |
| Observables | `$` suffix |
| Route paths | `kebab-case` |
| Material imports | named per-component (no `MaterialModule` barrel) |

### What This Story Does NOT Implement

Story 1.1 creates the scaffold and locked type contracts only. These are stubbed — subsequent stories implement:
- `AuthService.init()` → Story 1.2
- `SheetsService` discovery → Story 1.4
- `CategoriesService.init()` → Story 1.5
- `SyncQueueService` full state machine → Story 3.1
- `auth.guard.ts` active logic → Story 1.2
- `AuthInterceptor` token injection → Story 1.2
- `APP_INITIALIZER` wiring → Stories 1.2 and 1.5

All service stubs must be injectable and satisfy TypeScript's strict mode — no `// @ts-ignore`.

### styles.scss Global Setup

```scss
// Tailwind directives
@tailwind base;
@tailwind components;
@tailwind utilities;

// Angular Material M3 theme (generated by ng add @angular/material)
// ... (keep generated theme)

// CSS custom property defaults — category colors populated by CategoriesService at runtime
:root {
  --background: #ffffff;
  --foreground: #0f172a;
  --card: #f8fafc;
  --border: #e2e8f0;
  --muted: #94a3b8;
  --accent: #6366f1;
}

.dark {
  --background: #0f172a;
  --foreground: #f8fafc;
  --card: #1e293b;
  --border: #334155;
  --muted: #64748b;
  --accent: #818cf8;
}

// Prevent entrance animations when reduced motion is active
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

### Project Structure Notes

- All services: `providedIn: 'root'` — no exceptions
- All components: `standalone: true` + `changeDetection: ChangeDetectionStrategy.OnPush` — no exceptions
- Services never live inside feature directories — always in `src/app/core/services/`
- Shared components are presentational only — no service injection inside `src/app/shared/components/`
- `IdbService` is the sole importer of the `idb` library

### References

- Initialization sequence: [Source: architecture.md#Selected-Starter-Angular-CLI]
- IDB schema: [Source: architecture.md#Data-Architecture]
- AppError union: [Source: architecture.md#API-Communication-Patterns] + [Source: epics.md#Story-1.1 AC (adds AUTH_DENIED)]
- SyncQueueItem final contract: [Source: epics.md#Story-1.1 AC] (supersedes architecture.md — adds `targetTabName`, `nextRetryAt`)
- Project directory structure: [Source: architecture.md#Complete-Project-Directory-Structure]
- Naming patterns: [Source: architecture.md#Naming-Patterns]
- Tailwind config: [Source: architecture.md#Styling-Solution] + [Source: architecture.md#Starter-Options-Considered]
- CI/CD: [Source: architecture.md#Infrastructure-Deployment]
- Component patterns: [Source: architecture.md#Component-Architecture]
- NotificationService: [Source: architecture.md#Gap-Analysis-Results Gap-2]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Tailwind v4 was installed by default; downgraded to v3 to match story spec (`tailwind.config.js` + `@tailwind` directives)
- Angular 21 uses Vitest (not Karma) and new file naming: `app.ts` / `app.html` (no `.component` infix on root component)
- `@esbuild/darwin-arm64` was missing due to Node version mismatch; resolved by explicitly installing with Node 22 on PATH
- SCSS `@use` must come before `@tailwind` directives — reordered in `styles.scss`
- `@angular/animations` needed as explicit dependency for `provideAnimationsAsync()` to resolve

### Completion Notes List

- Angular 21.2.10 scaffolded with Angular CLI 21 on Node 22.12.0 (nvm)
- All 9 deps installed: @angular/material, @angular/pwa (→ @angular/service-worker), tailwindcss@3, ng2-charts, idb, zod, @playwright/test
- Tailwind configured with `preflight: false`, `important: '#app'`, `darkMode: 'class'`
- All 9 AppError variants defined (including AUTH_DENIED per epics.md)
- SyncQueueItem with all canonical fields: targetTabName, nextRetryAt included
- ISyncQueueService interface locked; stub SyncQueueService compiles under strict mode
- IdbService with 4 stores and all required indexes
- All lazy routes wired in app.routes.ts; all feature component stubs created
- Shared components (10), directives (long-press), pipes (category-color, chf-currency) stubbed
- CI/CD pipeline: Node 22, npm ci, ng build production, deploy placeholder
- PWA: display:standalone, theme_color:#6366f1, 192×192 + 512×512 icons
- Production build: clean, no errors, all lazy chunks resolved
- Unit tests: 6/6 pass (Vitest 4.1.5)
- Playwright: 5 spec files, all skipped (no crash)
- postcss.config.js created to wire Tailwind into Angular's build pipeline

### File List

- src/app/app.ts
- src/app/app.html
- src/app/app.scss
- src/app/app.spec.ts
- src/app/app.config.ts
- src/app/app.routes.ts
- src/app/core/guards/auth.guard.ts
- src/app/core/interceptors/auth.interceptor.ts
- src/app/core/models/entry.model.ts
- src/app/core/models/error.model.ts
- src/app/core/models/category.model.ts
- src/app/core/models/sheets.model.ts
- src/app/core/services/auth.service.ts
- src/app/core/services/categories.service.ts
- src/app/core/services/entries.service.ts
- src/app/core/services/idb.service.ts
- src/app/core/services/notification.service.ts
- src/app/core/services/sheets.service.ts
- src/app/core/services/sync-queue.service.ts
- src/app/features/auth/auth.component.ts
- src/app/features/auth/auth.component.html
- src/app/features/auth/auth.component.scss
- src/app/features/dashboard/dashboard.component.ts
- src/app/features/dashboard/dashboard.component.html
- src/app/features/dashboard/dashboard.component.scss
- src/app/features/dashboard/dashboard.component.spec.ts
- src/app/features/entries-list/entries-list.component.ts
- src/app/features/entries-list/entries-list.component.html
- src/app/features/entries-list/entries-list.component.scss
- src/app/features/entries-list/entries-list.component.spec.ts
- src/app/features/entry-form/entry-form.component.ts
- src/app/features/entry-form/entry-form.component.html
- src/app/features/entry-form/entry-form.component.scss
- src/app/features/entry-form/entry-form.component.spec.ts
- src/app/features/settings/settings.component.ts
- src/app/features/settings/settings.component.html
- src/app/features/settings/settings.component.scss
- src/app/features/sync-review/sync-review.component.ts
- src/app/features/sync-review/sync-review.component.html
- src/app/features/sync-review/sync-review.component.scss
- src/app/features/sync-review/sync-review.component.spec.ts
- src/app/shared/components/amount-input/amount-input.component.ts
- src/app/shared/components/bottom-nav/bottom-nav.component.ts
- src/app/shared/components/category-breakdown-bar/category-breakdown-bar.component.ts
- src/app/shared/components/category-tile/category-tile.component.ts
- src/app/shared/components/entry-row/entry-row.component.ts
- src/app/shared/components/hero-card/hero-card.component.ts
- src/app/shared/components/kpi-row/kpi-row.component.ts
- src/app/shared/components/offline-indicator/offline-indicator.component.ts
- src/app/shared/components/sparkline-chart/sparkline-chart.component.ts
- src/app/shared/components/sync-status-bar/sync-status-bar.component.ts
- src/app/shared/directives/long-press.directive.ts
- src/app/shared/pipes/category-color.pipe.ts
- src/app/shared/pipes/chf-currency.pipe.ts
- src/environments/environment.ts
- src/environments/environment.production.ts
- src/styles.scss
- src/index.html
- e2e/auth.spec.ts
- e2e/dashboard.spec.ts
- e2e/entry-form.spec.ts
- e2e/offline.spec.ts
- e2e/sync-review.spec.ts
- tailwind.config.js
- postcss.config.js
- playwright.config.ts
- .env.example
- .github/workflows/deploy.yml
- public/manifest.webmanifest

### Review Findings

- [x] [Review][Patch] IDB `openDB` missing `blocked`/`blocking` handlers — silent hang if user has two tabs open during version upgrade [src/app/core/services/idb.service.ts:35]
- [x] [Review][Patch] IDB `openDB` rejection not caught or mapped to `AppError { type: 'IDB_ERROR' }` — untyped exception escapes on storage quota exceeded or private-mode IDB disabled [src/app/core/services/idb.service.ts:34]
- [x] [Review][Patch] `NotificationService.showError` auto-dismisses at 5000 ms even when `action` is provided — caller-supplied action button disappears before user can respond; set `duration: 0` when action is truthy [src/app/core/services/notification.service.ts:16]
- [x] [Review][Patch] `markSynced` method body indented at class level instead of method body level — not present in actual file (diff artifact)
- [x] [Review][Defer] IDB `upgrade` callback has no `oldVersion` guard — `createObjectStore` calls are unconditional; will throw on future `DB_VERSION` bump [src/app/core/services/idb.service.ts:36] — deferred, pre-existing
- [x] [Review][Defer] `SyncQueueItem` uses flat interface with no discriminated union tying `operation` to `entryData`/`targetEntryId` nullability — UPDATE with `entryData: null` is structurally valid [src/app/core/models/entry.model.ts:21] — deferred, pre-existing
- [x] [Review][Defer] `schema2026Validator`/`schema2025Validator` use strict `z.tuple` — fails if user's Sheet has extra trailing columns; consider `.rest(z.unknown())` [src/app/core/models/sheets.model.ts:6] — deferred, pre-existing
- [x] [Review][Defer] `SheetsValueRange.values: string[][]` does not model sparse rows — Sheets API omits trailing empty cells, so `row[3]` on a 4-column schema is `undefined` not `""` [src/app/core/models/sheets.model.ts:21] — deferred, pre-existing
- [x] [Review][Defer] `Category.id` used as CSS custom property suffix with no format constraint — spaces or special chars produce invalid CSS variable names [src/app/core/models/category.model.ts:2] — deferred, pre-existing
- [x] [Review][Defer] `IdbService.get<T>` / `set<T>` are constrained to `'appMeta'` store; other stores require raw `getDb()` bypass with no centralized `IDB_ERROR` mapping — intentional per spec but creates scattered error handling [src/app/core/services/idb.service.ts:52] — deferred, pre-existing
- [x] [Review][Defer] `IdbService.get<T>` casts `unknown` to `T` with no runtime validation — type safety is asserted not enforced; corrupt appMeta data passes through silently [src/app/core/services/idb.service.ts:53] — deferred, pre-existing
