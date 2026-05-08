---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
workflowType: 'architecture'
project_name: 'expense-dashboard'
user_name: 'Nick'
date: '2026-05-08'
lastStep: 8
status: 'complete'
completedAt: '2026-05-08'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
55 FRs across 8 capability areas:
- Expense Entry (FR1–FR8, FR49, FR50): Quick-add with ≤3-tap constraint, batch mode, edit/delete, negative amounts
- Dashboard & Visualization (FR9–FR14): Monthly hero card, sparkline, category breakdown bar, category × month drill-down, month/year navigation
- Entry Discovery & Search (FR15–FR19): Filters by category/month/year, full-text remarks search, merchant filtering
- Category Management (FR20–FR24, FR55): Sheet-seeded registry (global across years), color picker, ordering, write-back
- Google Sheets Integration (FR25–FR32, FR51): Tab discovery by naming prefix, schema validation, schema version detection (2025 legacy read-only vs. 2026 active), UUID-managed rows, month column auto-derived
- Offline & Sync (FR33–FR41, FR52, FR53): Full offline entry/view, IndexedDB queue, pre-sync review screen, per-row edit/cancel, exponential backoff retry, PENDING/SYNC_ERROR state distinction, manual retry trigger
- Authentication & Session (FR42–FR46): Google OAuth PKCE, session persistence, silent-iframe refresh → redirect fallback, offline usability during token-invalid periods, queue flush on re-auth
- First-Run & Setup (FR47–FR48, FR54): OAuth onboarding, auto-discovery of Sheet, connected Sheet confirmation before data load

**Non-Functional Requirements:**
- Dashboard load: <2s on 4G after initial cache warm
- Entry save response: <200ms (optimistic local write; Sheets sync is async background)
- FMP: <3s on cold launch
- Drill-down navigation: <500ms
- Category data TTL: 5-minute local cache
- Kill condition: if logging takes more taps than opening Google Sheets directly, the app has failed
- Offline: full feature parity for entry and view; graceful degradation for sync-only operations
- PWA installable (iOS home screen, Android standalone)
- WCAG 2.1 AA minimum
- Single user — no multi-tenancy, no server infrastructure

**Scale & Complexity:**
- Primary domain: Progressive Web App (SPA + Service Worker)
- Complexity level: Medium — persistence complexity (dual-schema Sheets + IDB queue) exceeds UI complexity
- No backend server: pure SPA communicating directly with Google Sheets API v4
- Estimated architectural components: ~15–20 Angular services/components of substance

### Technical Constraints & Dependencies

- **Google Sheets API v4** (REST) as the only persistence layer — no custom backend
- **Google Identity Services (GIS)** for PKCE OAuth — script-tag inclusion only
- **IndexedDB** (via `idb` library) for offline queue and entry cache
- **Single-user** — authentication is identity confirmation, not access control
- **Static hosting** — Netlify / Vercel / GitHub Pages (all output must be a static build)
- **No SSR** — pure client-side SPA; all rendering in browser
- **Schema dual-support**: 2025 legacy tabs (4-column, read-only) and 2026 active tabs (6-column, writable)
- **UUID-managed rows**: every entry written to Sheets carries an app-controlled UUID in column F for idempotency

### Cross-Cutting Concerns Identified

1. **Offline/Sync state** — every data-writing feature must account for PENDING/SYNC_ERROR queue states
2. **Auth token lifecycle** — silent refresh, expiry detection, and offline-graceful degradation affect all API calls
3. **Schema version detection** — every Sheets read must first validate header row; drives read-only vs. writable mode
4. **Optimistic UI** — writes go to IDB immediately; UI reflects local state; Sheets sync is fire-and-background
5. **Category color system** — CSS custom properties (`--color-[category-id]`) must be injected consistently at app startup for all visualization components
6. **Error taxonomy** — discriminated union `AppError` type used across services; display layer maps to user-facing messages

## Starter Template Evaluation

### Primary Technology Domain

Progressive Web App (SPA) — Angular CLI (`ng new`) with add-on schematics.

### Starter Options Considered

| Option | Assessment |
|---|---|
| Angular CLI (`ng new`) | Native to the stack. Strict TypeScript, esbuild application builder, standalone components by default, Vitest unit test runner, @angular/pwa schematic for Service Worker. ✅ Selected |
| Nx workspace | Overkill for a single-app project; adds monorepo tooling complexity with no benefit here |
| AnalogJS | SSR/SSG-oriented Angular meta-framework; incompatible with the pure SPA + static hosting constraint |

### Selected Starter: Angular CLI (`ng new`)

**Rationale for Selection:**
Angular CLI is the canonical, team-maintained scaffold for Angular projects. Standalone components (default since Angular 17), esbuild application builder, and first-party PWA/Material/testing schematics mean every downstream add-on integrates without configuration gymnastics.

**Initialization Sequence:**

```bash
# 1. Create project (strict TypeScript, SCSS, no SSR, standalone)
ng new expense-dashboard \
  --style=scss \
  --routing=true \
  --strict=true \
  --ssr=false

cd expense-dashboard

# 2. Add Angular Material (M3 theme, global typography, animations)
ng add @angular/material
# → Choose: Custom theme | Yes typography | Include animations

# 3. Add PWA support
ng add @angular/pwa

# 4. Add Tailwind CSS (manual — no schematic needed)
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init

# 5. Add ng2-charts + Chart.js
npm install ng2-charts chart.js

# 6. Add idb (IndexedDB abstraction)
npm install idb

# 7. Add Zod (schema validation for Sheets header rows)
npm install zod

# 8. Add Playwright (E2E)
npm install -D @playwright/test
npx playwright install

# 9. Configure Tailwind to coexist with Angular Material
# tailwind.config.js:
#   content: ['./src/**/*.{html,ts}']
#   corePlugins: { preflight: false }   ← CRITICAL: prevents Material CSS reset conflicts
#   important: '#app'                   ← ensures Tailwind utilities win specificity battles
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
TypeScript 5.x, strict mode (`strictNullChecks`, `strictPropertyInitialization`, `noImplicitAny`). Angular 21 standalone components — no `NgModule` boilerplate.

**Styling Solution:**
SCSS for component encapsulation (Angular ViewEncapsulation.Emulated default). Tailwind CSS (utility-first, via PostCSS) for layout/spacing/typography. Angular Material (M3 token system) for interactive component scaffolding. `corePlugins: { preflight: false }` is mandatory to prevent Tailwind's CSS reset from stripping Material component base styles.

**Build Tooling:**
Angular CLI application builder (esbuild + Rollup). `ng serve` — HMR dev server. `ng build` — hashed static output to `dist/expense-dashboard/browser/`. Lazy-loaded routes via `loadComponent()`.

**Testing Framework:**
- Unit: Vitest (via `@angular/build:unit-test` builder) — replaces deprecated Karma
- E2E: Playwright (`@playwright/test`) — covers mobile flows (≤3 taps, offline queue, sync review)

**Code Organization:**
Angular standalone component architecture. Feature-based directory layout under `src/app/features/`. Injectable services under `src/app/core/services/`. No NgModules.

**Development Experience:**
- `ng serve` — HMR dev server (esbuild, <1s cold start)
- `ng build` — production build with tree-shaking, hashed assets
- `ng test` — Vitest unit tests
- `npx playwright test` — E2E suite
- Angular DevTools browser extension

**Note:** Project initialization using this command sequence should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Local-first data architecture (IDB primary, Sheets async secondary)
- Auth flow: Google OAuth PKCE via GIS script tag
- Tailwind + Angular Material coexistence config (`preflight: false`)
- Angular Signals as reactive state primitive (no NgRx)
- AppError discriminated union as the single error type across the service layer

**Important Decisions (Shape Architecture):**
- Dual schema support (2025 read-only / 2026 writable) handled at service layer
- UUID idempotency pattern for Sheets writes
- Sync queue state machine (PENDING → SYNC_ERROR, exponential backoff)
- Category color injection via CSS custom properties at app startup
- Lazy-loaded route components for all feature screens

**Deferred Decisions (Post-MVP):**
- Multi-Sheet support (currently one Sheet per user)
- Budget alerts / threshold notifications
- Export to CSV functionality

### Data Architecture

**Primary Store: IndexedDB via `idb` library**
All expense entries are written to IndexedDB first. Sheets is the async durable backup, not the primary read source. This single commitment resolves sync latency, cold-launch performance, and the offline story simultaneously.

**IndexedDB Schema:**

```typescript
interface LocalEntry {
  id: string;               // UUID — written to Sheet column F
  date: string;             // YYYY-MM-DD
  month: string;            // YYYY-MM (derived, indexed)
  year: number;             // indexed
  category: string;
  amount: number;           // negative = credit
  remarks: string;
  tabName: string;
  schemaVersion: '2025' | '2026';
  sheetRowIndex: number | null;
  syncStatus: 'synced' | 'pending' | 'error';
  isReadOnly: boolean;
}

interface SyncQueueItem {
  id: string;               // UUID — idempotency key
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  entryData: LocalEntry | null;
  targetEntryId: string | null;
  enqueuedAt: number;
  status: 'PENDING' | 'SYNC_ERROR';
  retryCount: number;
  lastAttemptAt: number | null;
  errorMessage: string | null;
}
```

**IDB stores:** `entries` (indexed by `month`, `year`, `syncStatus`), `syncQueue` (indexed by `status`, `enqueuedAt`), `categories` (flat list, TTL-checked on read), `appMeta` (spreadsheetId, lastSyncAt, schemaCache).

**Google Sheets API v4 (REST):**
- Direct REST calls via Angular `HttpClient` with Bearer token
- No backend proxy — all calls from browser
- Tab discovery: list all sheets, filter by naming prefix
- Header-row validation via Zod before any data operations
- Batch writes (`batchUpdate`) for INSERT/UPDATE to minimize API quota usage
- Schema 2026: columns A (Date), B (Category), C (Amount), D (Remarks), E (Month auto), F (UUID)
- Schema 2025: columns A (Date), B (Category), C (Amount), D (Remarks) — read-only in this app

**Zod Schema Validation:**
Header rows validated at tab-open time. Schema mismatch emits `AppError.SCHEMA_MISMATCH` and marks tab as incompatible (no data loaded, user notified). Validation result cached in `appMeta.schemaCache` keyed by tab name.

**Caching Strategy:**
- Entries: IDB is the cache; 5-minute TTL on categories store
- Categories: re-fetched from Sheet if TTL expired or explicit invalidation
- No in-memory cache beyond Angular service instance lifetime

### Authentication & Security

**Google OAuth 2.0 PKCE via Google Identity Services (GIS):**
GIS library loaded via `<script>` tag in `index.html`. PKCE flow (not implicit) — access token obtained client-side, never sent to any server. No backend token exchange.

**Token Storage:**
Access token held in memory only (Angular service instance). Not persisted to localStorage or sessionStorage — prevents XSS token theft. On page reload, silent iframe refresh re-acquires the token invisibly.

**Session Lifecycle:**
1. App boot → check GIS session state
2. If valid session → silent iframe token refresh → proceed
3. If no session → redirect to Google OAuth consent
4. Token expiry during session → silent refresh; if iframe fails → redirect
5. Token invalid but offline → continue with cached IDB data; sync blocked
6. Re-auth after offline → flush sync queue on token acquisition

**Scope:** `https://www.googleapis.com/auth/spreadsheets` (read + write) + `https://www.googleapis.com/auth/userinfo.email` (display only).

### API & Communication Patterns

**Angular `HttpClient` for all Sheets API calls:**
All HTTP calls are wrapped in Angular injectable services. No raw `fetch` calls. `HttpClient` interceptors handle Bearer token injection and 401/403 detection.

**AppError Discriminated Union:**
Single error type used by all services:

```typescript
export type AppError =
  | { type: 'SCHEMA_VALIDATION'; message: string; details: ZodError }
  | { type: 'SHEETS_API'; status: number; message: string }
  | { type: 'AUTH_EXPIRED' }
  | { type: 'AUTH_REVOKED' }
  | { type: 'NETWORK'; message: string }
  | { type: 'SYNC_FAILED'; entryId: string; message: string }
  | { type: 'IDB_ERROR'; message: string }
  | { type: 'SCHEMA_MISMATCH'; tabName: string; expected: string[]; received: string[] }
```

Services return `Observable<T>` or throw typed `AppError`. Components catch at boundary and dispatch to a `NotificationService` for user-facing messages.

**Sync Queue State Machine:**
`PENDING` → on successful Sheets write → removed from queue
`PENDING` → on Sheets API failure → retry with exponential backoff (1s, 2s, 4s, 8s, 16s cap)
`PENDING` → on max retries exceeded → `SYNC_ERROR`
`SYNC_ERROR` → manual retry from review screen → `PENDING`

**Offline Detection:**
`navigator.onLine` + `online`/`offline` events. `SyncService` subscribes and auto-triggers queue flush when online.

### Frontend Architecture

**State Management: Angular Signals**
No NgRx. Angular Signals (`signal()`, `computed()`, `effect()`) for all reactive state. One service per domain exposes signals as the public API. Components read signals directly via template bindings. No global store; state lives in services.

Domain signal services:
- `AuthService` — `currentUser`, `isAuthenticated`, `tokenState`
- `EntriesService` — `entries`, `selectedMonth`, `syncStatus`
- `CategoriesService` — `categories`, `categoryColors`
- `SyncQueueService` — `pendingCount`, `errorCount`, `queueItems`
- `SheetsService` — `connectedSpreadsheetId`, `availableTabs`

**Component Architecture:**
Standalone components throughout (no NgModules). `OnPush` change detection on all components — safe because all state flows through Signals. `ChangeDetectorRef.markForCheck()` is unnecessary with Signals + OnPush.

**Routing:**
Angular Router with `loadComponent()` lazy loading per feature route. Route guards (functional guards, not class-based) for auth protection.

```typescript
// Route structure — entry-form has no route; opens as MatBottomSheet via FAB
[
  { path: '', loadComponent: () => import('./features/dashboard/dashboard.component') },
  { path: 'entries', loadComponent: () => import('./features/entries-list/entries-list.component') },
  { path: 'sync', loadComponent: () => import('./features/sync-review/sync-review.component') },
  { path: 'settings', loadComponent: () => import('./features/settings/settings.component') },
  { path: 'auth', loadComponent: () => import('./features/auth/auth.component') },
]
```

**Angular Material Usage:**
- `MatBottomSheet` — `QuickAddSheetComponent` (entry-form), edit entry drawer, category picker, date picker; opened from FAB — no route
- `MatDialog` — delete confirmation, category color picker
- `MatSnackBar` — error notifications only (sync failure, auth error); never for routine success; via `NotificationService`
- `MatFormField` + `MatInput` — all form inputs
- `MatSelect` — category picker fallback (desktop)
- `MatDatepicker` — date selection
- `MatButton`, `MatIconButton`, `MatFab` — all action buttons
- `MatChip` / `MatBadge` — sync pending count, category chips, `FilterChipRow`
- `MatDivider` — month-grouping dividers in entry list
- `MatBottomNav` (custom via Material toolbar) — bottom navigation bar
- `@angular/cdk/drag-drop` — category reorder handles in `CategoryManager` (Settings)
- `MatSidenav` / CDK Overlay — drill-down panel at `md:` breakpoint and above

**Note on Toast Notifications:** `MatSnackBar` via `NotificationService` is the sole toast implementation — errors only, never for routine success. The UX spec and this architecture are aligned on this policy.

**Charts: ng2-charts (Chart.js wrapper)**
- `SparklineChartComponent` — 7-bar mini `BarChart`, current month indigo, prior months zinc
- `CategoryBreakdownBarComponent` — CSS percentage-width divs (no chart library needed; pure Tailwind)
- ng2-charts configured standalone via `provideCharts(withDefaultRegisterables())`

**Dark Mode:**
CSS class toggle on `<html>` element. Angular Material M3 color scheme toggled via `[color-scheme]` attribute. Tailwind dark mode via `darkMode: 'class'` in `tailwind.config.js`. No JS media query detection — user-controlled toggle only.

**Category Color System:**
At app startup (APP_INITIALIZER), `CategoriesService` injects `--color-[category-id]` CSS custom properties into `document.documentElement.style`. Tailwind arbitrary values (`bg-[var(--color-groceries)]`) consume them in templates.

### Infrastructure & Deployment

**Static Hosting (multi-platform support):**
- Primary: Netlify (auto-deploy from GitHub, free tier, custom domain)
- Alternative: Vercel (equivalent free tier)
- Alternative: GitHub Pages (requires `--base-href` config for subdirectory deployments)
- All targets receive identical `dist/expense-dashboard/browser/` output

**CI/CD: GitHub Actions**
```yaml
# .github/workflows/deploy.yml
on: [push to main]
jobs:
  build-deploy:
    - Checkout
    - Node 22 setup
    - npm ci
    - ng build --configuration=production
    - Deploy dist/ to hosting platform
```

**PWA: @angular/pwa**
Service Worker generated by `@angular/service-worker`. Precaches all static assets. Network-first for API calls (Sheets, GIS). Cache-first for app shell. Installable: `manifest.webmanifest` with app icons, `standalone` display, theme color.

**Environment Configuration:**
`environment.ts` / `environment.production.ts` — Angular CLI file replacement pattern.
```typescript
export const environment = {
  production: false,
  googleClientId: '',       // Loaded from env at build time
  sheetsApiBaseUrl: 'https://sheets.googleapis.com/v4/spreadsheets',
  gisScriptUrl: 'https://accounts.google.com/gsi/client',
}
```
Google Client ID supplied via `NG_APP_GOOGLE_CLIENT_ID` env var at CI build time.

### Decision Impact Analysis

**Implementation Sequence (order matters):**
1. Angular CLI scaffold + all `ng add` schematics
2. Tailwind config (`preflight: false`, `important: '#app'`)
3. IDB schema setup (`idb` stores + typed interfaces)
4. `AuthService` + GIS integration (gates everything else)
5. `SheetsService` — tab discovery + schema validation
6. `EntriesService` — IDB read/write + Sheets sync
7. `SyncQueueService` — queue state machine + retry logic
8. `CategoriesService` — Sheet-seeded registry + CSS property injection
9. Feature components (Dashboard → Entry Form → Entries List → Sync Review)

**Cross-Component Dependencies:**
- All feature components depend on `AuthService` being initialized first
- `EntriesService` depends on `SheetsService` for schema detection
- `SyncQueueService` depends on both `EntriesService` and `SheetsService`
- `CategoriesService` must complete before any component renders category colors
- `APP_INITIALIZER` token: `AuthService.init()` + `CategoriesService.init()` run before first render

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 8 areas where AI agents could make incompatible choices without these rules.

### Naming Patterns

**File & Directory Naming — kebab-case throughout:**
```
entry-form.component.ts       ✅
EntryForm.component.ts        ❌
entryForm.component.ts        ❌

sync-queue.service.ts         ✅
SyncQueueService.ts           ❌
```

**Class & Interface Naming — PascalCase:**
```typescript
export class EntriesService { }          ✅
export interface LocalEntry { }          ✅
export type AppError = ...               ✅ (type alias also PascalCase)
```

**Variable & Property Naming — camelCase:**
```typescript
const selectedMonth = signal('');        ✅
const selected_month = signal('');       ❌
```

**Signal Naming — no suffix:**
```typescript
entries = signal<LocalEntry[]>([]);      ✅
entries$ = signal<LocalEntry[]>([]);     ❌  ($ suffix is RxJS Observable convention)
entriesSignal = signal<LocalEntry[]>([]); ❌
```

**Observable Naming — `$` suffix (only for Observables, never Signals):**
```typescript
entries$: Observable<LocalEntry[]>;     ✅
syncStatus$: Observable<SyncStatus>;    ✅
```

**Angular Material imports — named, per-component:**
```typescript
imports: [MatButtonModule, MatInputModule]   ✅
imports: [MaterialModule]                    ❌  (no barrel module)
```

**Route paths — kebab-case:**
```
/sync-review     ✅
/syncReview      ❌
/sync_review     ❌
```

### Structure Patterns

**Project Organization — feature-based under `src/app/features/`:**
Each feature is a self-contained directory containing its component(s), local types, and feature-specific pipes. Services always live in `src/app/core/services/`, never inside a feature directory.

```
src/app/
  core/
    services/          ← ALL injectable services live here
    guards/
    interceptors/
    models/            ← shared interfaces and types (LocalEntry, AppError, etc.)
  features/
    dashboard/
    entry-form/
    entries-list/
    sync-review/
    settings/
    auth/
  shared/
    components/        ← reusable presentational components (SparklineChart, etc.)
    pipes/
    directives/
```

**Test co-location — `.spec.ts` files beside source:**
```
entry-form.component.ts
entry-form.component.spec.ts   ✅ (co-located)
```
Not in a separate `tests/` directory. E2E tests in `e2e/` at project root.

**Service structure — always `providedIn: 'root'`:**
```typescript
@Injectable({ providedIn: 'root' })
export class EntriesService { }         ✅

@Injectable()                           ❌  (never without providedIn)
```

**Component structure — standalone + OnPush always:**
```typescript
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...],
  template: `...`,
})
```
`OnPush` is mandatory on every component. Signals make this safe without manual `markForCheck()`.

### Format Patterns

**API Response Handling — unwrap inside service, expose typed Observable:**
```typescript
// ✅ Service unwraps and types the response
getEntries(): Observable<LocalEntry[]> {
  return this.http.get<SheetsResponse>(...).pipe(
    map(response => this.mapToLocalEntries(response))
  );
}

// ❌ Never expose raw API responses to components
getEntries(): Observable<SheetsResponse> { ... }
```

**Date Format — ISO 8601 in all data layers:**
```typescript
date: '2026-05-08'    ✅  (stored in IDB, sent to Sheets)
date: '08/05/2026'    ❌  (locale-formatted — display layer only)
month: '2026-05'      ✅  (derived field, always YYYY-MM)
```
All date formatting for display uses Angular's `DatePipe` with explicit locale format strings.

**Amount — number, negative for credits:**
```typescript
amount: -45.50    ✅  (credit/refund)
amount: 120.00    ✅  (expense)
amount: '-45.50'  ❌  (never string)
```

**Boolean in templates — never coerce with `!!`:**
```html
@if (isAuthenticated()) { ... }   ✅  (Signal read)
@if (!!isAuthenticated()) { ... } ❌
```

**Error handling — always use AppError type, never throw raw Error:**
```typescript
throw { type: 'IDB_ERROR', message: err.message } satisfies AppError;   ✅
throw new Error('IDB failed');                                           ❌
```

### Communication Patterns

**Signal updates — always via service methods, never direct `.set()` from components:**
```typescript
// ✅ Component calls service method
this.entriesService.addEntry(entry);

// ❌ Component mutates service signal directly
this.entriesService.entries.set([...newEntries]);
```

**Angular Material Snackbar — only via NotificationService:**
```typescript
// ✅ All toast calls go through NotificationService
this.notificationService.showError('Sync failed — tap to retry');

// ❌ Never inject MatSnackBar directly into feature components
constructor(private snackBar: MatSnackBar) { }
```

**Component inputs — use `input()` signal (Angular 17+), not `@Input()` decorator:**
```typescript
readonly amount = input.required<number>();    ✅
@Input() amount!: number;                     ❌
```

**Component outputs — use `output()` (Angular 17+), not `@Output()` + EventEmitter:**
```typescript
readonly saved = output<LocalEntry>();         ✅
@Output() saved = new EventEmitter<LocalEntry>(); ❌
```

### Process Patterns

**Loading States — Angular Signal, one per async operation:**
```typescript
isLoading = signal(false);
isSyncing = signal(false);
```
No global loading state. Each service owns its own loading signals.

**Error Recovery — surface via NotificationService, never swallow:**
```typescript
catchError(err => {
  this.notificationService.showError(mapAppErrorToMessage(err));
  return EMPTY;  // or rethrow if component needs to handle
})
```

**Optimistic UI Pattern — IDB write first, Sheets async:**
```typescript
// 1. Write to IDB immediately → update entries signal
// 2. Show success UI immediately
// 3. Enqueue to SyncQueue (fire-and-forget)
// 4. SyncService processes queue in background
// ❌ Never await Sheets write before updating UI
```

**Route Guards — functional (not class-based):**
```typescript
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? true : redirect('/auth');
};
```

**APP_INITIALIZER — for critical boot services only:**
Only `AuthService.init()` and `CategoriesService.init()` run as APP_INITIALIZER. All other services initialize lazily on first injection.

### UX & Accessibility Constraints

These requirements come from the UX specification and must be observed during implementation — they are not optional polish.

**iPhone safe area insets (iPhone X+):**
Bottom nav and FAB must include `padding-bottom: env(safe-area-inset-bottom)` to clear the iOS home indicator. Use Tailwind's `pb-safe` or apply the `env()` variable in a CSS layer. Without this, interactive elements sit behind the home indicator on notched iPhones.

**`touch-action` on scrollable lists:**
```css
/* scroll container */  touch-action: pan-y;
/* tappable rows inside scroll container */  touch-action: manipulation;
```
Do not apply `manipulation` globally — it silently breaks scroll behavior on parent containers.

**Haptic feedback (mobile):**
- Light haptic on entry Save
- Medium haptic on sync error
- No haptics for passive state changes

**`aria-live` regions:**
`SyncStatusBar` uses `aria-live="polite"`. The region must be present in the DOM on page load with empty initial content — not conditionally rendered. Content changes inside an already-mounted live region are announced; mounting the region itself is not.

**Focus management on sheet close:**
`QuickAddSheetComponent` on close must return focus explicitly to the FAB (`fabRef.nativeElement.focus()`). Angular does not restore focus automatically when a component unmounts. Keep the FAB in the DOM while the sheet is open (use `visibility: hidden`, not `*ngIf`) — unmounting the FAB breaks focus return silently.

**Skeleton loaders (not spinners):**
Dashboard loading states use skeleton placeholders that match the exact shape and size of the loaded content — same height as the hero number, same bar widths as the category breakdown. No spinners where data will appear; shape consistency prevents layout shift.

**Full-height overlays:**
Use `dvh` units (not `vh`) for full-screen overlays and sheets. iOS Safari's collapsing address bar makes `100vh` taller than the visible viewport; `100dvh` is correct.

### Enforcement Guidelines

**All AI Agents MUST:**
- Use standalone components with `OnPush` change detection on every component
- Use `input()` / `output()` signal APIs — never `@Input()` / `@Output()` decorators
- Use `AppError` discriminated union — never throw raw `Error` objects from services
- Route all toast notifications through `NotificationService` — never inject `MatSnackBar` directly
- Store dates as ISO 8601 strings (`YYYY-MM-DD`) in IDB and Sheets — never locale-formatted strings
- Never write optimistic UI that awaits a Sheets API response before updating the UI

**Good Examples:**
```typescript
// ✅ Correct signal-based service state
@Injectable({ providedIn: 'root' })
export class EntriesService {
  private readonly _entries = signal<LocalEntry[]>([]);
  readonly entries = this._entries.asReadonly();
  readonly isLoading = signal(false);

  async addEntry(entry: Omit<LocalEntry, 'id' | 'syncStatus'>): Promise<void> {
    const newEntry: LocalEntry = { ...entry, id: crypto.randomUUID(), syncStatus: 'pending' };
    await this.idb.put('entries', newEntry);
    this._entries.update(all => [...all, newEntry]);
    this.syncQueue.enqueue({ operation: 'INSERT', entryData: newEntry });
  }
}
```

**Anti-Patterns:**
```typescript
// ❌ Wrong: using Subject/BehaviorSubject when Signals suffice
private _entries$ = new BehaviorSubject<LocalEntry[]>([]);
entries$ = this._entries$.asObservable();

// ❌ Wrong: awaiting Sheets before updating UI (blocks optimistic response)
async addEntry(entry: LocalEntry) {
  await this.sheetsService.appendRow(entry);  // ← blocks UI
  this._entries.update(all => [...all, entry]);
}

// ❌ Wrong: feature component with NgRx-style boilerplate
store.dispatch(loadEntries());  // unnecessary at this scale
```

## Project Structure & Boundaries

### Requirements to Structure Mapping

**Epic → Directory Mapping:**
- Expense Entry → `src/app/features/entry-form/`
- Dashboard & Visualization → `src/app/features/dashboard/` + `src/app/shared/components/`
- Entry Discovery & Search → `src/app/features/entries-list/`
- Category Management → `src/app/features/settings/` + `src/app/core/services/categories.service.ts`
- Google Sheets Integration → `src/app/core/services/sheets.service.ts`
- Offline & Sync → `src/app/core/services/sync-queue.service.ts` + `src/app/features/sync-review/`
- Authentication → `src/app/core/services/auth.service.ts` + `src/app/features/auth/`
- First-Run & Setup → `src/app/features/auth/` + `src/app/core/services/sheets.service.ts`

### Complete Project Directory Structure

```
expense-dashboard/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── e2e/
│   ├── auth.spec.ts
│   ├── dashboard.spec.ts
│   ├── entry-form.spec.ts
│   ├── offline.spec.ts
│   └── sync-review.spec.ts
├── public/
│   ├── icons/
│   │   ├── icon-192x192.png
│   │   └── icon-512x512.png
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── app.component.ts
│   │   ├── app.component.html
│   │   ├── app.component.scss
│   │   ├── app.component.spec.ts
│   │   ├── app.config.ts              ← bootstrapApplication config, providers
│   │   ├── app.routes.ts              ← all lazy-loaded route definitions
│   │   │
│   │   ├── core/
│   │   │   ├── guards/
│   │   │   │   └── auth.guard.ts
│   │   │   ├── interceptors/
│   │   │   │   └── auth.interceptor.ts  ← injects Bearer token on Sheets API calls
│   │   │   ├── models/
│   │   │   │   ├── entry.model.ts       ← LocalEntry, SyncQueueItem interfaces
│   │   │   │   ├── error.model.ts       ← AppError discriminated union
│   │   │   │   ├── category.model.ts    ← Category interface
│   │   │   │   └── sheets.model.ts      ← Sheets API response types + Zod schemas
│   │   │   └── services/
│   │   │       ├── auth.service.ts
│   │   │       ├── categories.service.ts
│   │   │       ├── entries.service.ts
│   │   │       ├── idb.service.ts       ← IndexedDB abstraction (wraps `idb`)
│   │   │       ├── notification.service.ts  ← MatSnackBar wrapper
│   │   │       ├── sheets.service.ts
│   │   │       └── sync-queue.service.ts
│   │   │
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   │   ├── auth.component.ts
│   │   │   │   ├── auth.component.html
│   │   │   │   └── auth.component.scss
│   │   │   ├── dashboard/
│   │   │   │   ├── dashboard.component.ts
│   │   │   │   ├── dashboard.component.html
│   │   │   │   ├── dashboard.component.scss
│   │   │   │   └── dashboard.component.spec.ts
│   │   │   ├── entries-list/
│   │   │   │   ├── entries-list.component.ts
│   │   │   │   ├── entries-list.component.html
│   │   │   │   ├── entries-list.component.scss
│   │   │   │   └── entries-list.component.spec.ts
│   │   │   ├── entry-form/                    ← opens as MatBottomSheet via FAB; no route
│   │   │   │   ├── entry-form.component.ts
│   │   │   │   ├── entry-form.component.html
│   │   │   │   ├── entry-form.component.scss
│   │   │   │   └── entry-form.component.spec.ts
│   │   │   ├── settings/
│   │   │   │   ├── settings.component.ts
│   │   │   │   ├── settings.component.html
│   │   │   │   └── settings.component.scss
│   │   │   └── sync-review/
│   │   │       ├── sync-review.component.ts
│   │   │       ├── sync-review.component.html
│   │   │       ├── sync-review.component.scss
│   │   │       ├── sync-review.component.spec.ts
│   │   │       └── sync-review-row.component.ts ← individual queued entry row
│   │   │
│   │   └── shared/
│   │       ├── components/
│   │       │   ├── amount-input/
│   │       │   │   ├── amount-input.component.ts
│   │       │   │   └── amount-input.component.html
│   │       │   ├── bottom-nav/
│   │       │   │   ├── bottom-nav.component.ts
│   │       │   │   └── bottom-nav.component.html
│   │       │   ├── category-breakdown-bar/
│   │       │   │   ├── category-breakdown-bar.component.ts
│   │       │   │   └── category-breakdown-bar.component.html
│   │       │   ├── category-tile/
│   │       │   │   ├── category-tile.component.ts
│   │       │   │   └── category-tile.component.html
│   │       │   ├── entry-row/
│   │       │   │   ├── entry-row.component.ts
│   │       │   │   └── entry-row.component.html
│   │       │   ├── hero-card/
│   │       │   │   ├── hero-card.component.ts
│   │       │   │   └── hero-card.component.html
│   │       │   ├── kpi-row/
│   │       │   │   ├── kpi-row.component.ts
│   │       │   │   └── kpi-row.component.html
│   │       │   ├── offline-indicator/
│   │       │   │   ├── offline-indicator.component.ts
│   │       │   │   └── offline-indicator.component.html
│   │       │   ├── sparkline-chart/
│   │       │   │   ├── sparkline-chart.component.ts
│   │       │   │   └── sparkline-chart.component.html
│   │       │   └── sync-status-bar/
│   │       │       ├── sync-status-bar.component.ts
│   │       │       └── sync-status-bar.component.html
│   │       ├── directives/
│   │       │   └── long-press.directive.ts
│   │       └── pipes/
│   │           ├── category-color.pipe.ts
│   │           └── chf-currency.pipe.ts
│   │
│   ├── environments/
│   │   ├── environment.ts
│   │   └── environment.production.ts
│   ├── index.html
│   ├── main.ts
│   └── styles.scss                    ← global styles, Material theme, Tailwind directives
│
├── .env.example
├── .gitignore
├── angular.json
├── ngsw-config.json                   ← Service Worker config (@angular/pwa)
├── package.json
├── playwright.config.ts
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.app.json
└── tsconfig.spec.json
```

### Architectural Boundaries

**API Boundaries:**
- `SheetsService` is the sole component that calls Google Sheets API v4 REST endpoints
- `AuthService` is the sole component that interacts with the GIS script
- All external HTTP calls route through Angular `HttpClient` with `AuthInterceptor`
- No feature component may call `HttpClient` directly — always via a service

**Component Boundaries:**
- Feature components own their page layout and route-level state
- Shared components are purely presentational — they receive `input()` signals, emit `output()` events, no service injection
- Core services are the only components with direct IDB or HTTP access
- `NotificationService` is the only path to `MatSnackBar` — feature components never inject it directly

**Service Boundaries:**
- `IdbService` abstracts all IndexedDB operations — no other service calls `idb` directly
- `SyncQueueService` is the only component that mutates `SyncQueueItem` records
- `CategoriesService` owns the CSS custom property injection lifecycle
- `AuthService` owns the token — no other service reads from storage for auth tokens

**Data Boundaries:**
- IDB is the source of truth for UI rendering — components read from service signals, not from Sheets
- Sheets is the authoritative sync target — IDB writes are considered durable only after Sheets confirmation
- `appMeta` IDB store is the only place `spreadsheetId` is persisted

### Integration Points

**Internal Communication:**
- Services expose readonly Signals; components bind to them via template
- Components call service methods to trigger mutations
- `SyncQueueService` observes `online`/`offline` events and auto-flushes queue

**External Integrations:**
- Google Sheets API v4 via `HttpClient` (REST, Bearer token)
- Google Identity Services via `window.google.accounts.oauth2` (script tag)
- Service Worker via `@angular/service-worker` (precache + background sync hooks)

**Data Flow:**
```
User Action → Component → Service.method()
  → IdbService.write() → Signal update → Component re-renders (optimistic)
  → SyncQueueService.enqueue()
  → [background] SyncQueueService → SheetsService.batchUpdate()
    → on success: IdbService.markSynced() → Signal update
    → on failure: retry backoff → SYNC_ERROR state
```

### File Organization Patterns

**Configuration Files:**
- `angular.json` — CLI workspace config, build targets, file replacements for environments
- `tailwind.config.js` — content paths, `preflight: false`, `important: '#app'`, dark mode `class`
- `ngsw-config.json` — Service Worker asset groups and data groups
- `tsconfig.json` (base) → `tsconfig.app.json` (app) → `tsconfig.spec.json` (tests)
- `.env.example` — documents `NG_APP_GOOGLE_CLIENT_ID` env var requirement

**Source Organization:**
- `src/app/core/` — singleton services, guards, interceptors, shared types
- `src/app/features/` — one directory per route; component + template + styles + spec
- `src/app/shared/` — reusable presentational components, pipes, directives
- `src/environments/` — environment constants; `angular.json` file replacements swap at build time

**Test Organization:**
- Unit: `.spec.ts` co-located with source file
- E2E: `e2e/*.spec.ts` at project root, Playwright configuration in `playwright.config.ts`

**Asset Organization:**
- `public/icons/` — PWA icons (192×192, 512×512 minimum)
- Component-scoped styles in `.component.scss` files (Angular ViewEncapsulation)
- Global styles in `src/styles.scss`: Angular Material theme tokens, Tailwind `@tailwind` directives, CSS custom property defaults (`--color-*` category placeholders)

### Development Workflow Integration

**Development Server:**
`ng serve` — esbuild HMR, typically <1s reload. `proxy.conf.json` not needed (no backend to proxy).

**Build Process:**
`ng build --configuration=production` → `dist/expense-dashboard/browser/` — hashed filenames, tree-shaken, single-file Service Worker.

**Deployment Structure:**
All three hosting targets (Netlify, Vercel, GitHub Pages) receive the same `dist/expense-dashboard/browser/` directory. Redirect rule required on all platforms: all paths → `index.html` (SPA routing).

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
- Angular 21 + Angular Material: first-party, versioned together — zero compatibility risk
- Tailwind CSS + Angular Material: coexistence config (`preflight: false`, `important: '#app'`) explicitly specified in starter sequence and tailwind.config.js — conflict resolved at day one
- ng2-charts (Chart.js): registered via `provideCharts(withDefaultRegisterables())` in `app.config.ts` — standalone-component compatible
- Angular Signals + OnPush change detection: native pairing; no `markForCheck()` needed — coherent
- idb, zod: framework-agnostic pure-JS libraries — no Angular conflicts
- GIS script tag + pure SPA: correct for PKCE flow without backend; no SSR complications
- @angular/pwa + static hosting: esbuild output to `dist/browser/` matches all three target platforms

**Pattern Consistency:**
- Naming conventions (kebab-case files, PascalCase classes, camelCase vars, no Signal suffix, `$` only for Observables) are consistent across all described code examples
- `providedIn: 'root'` + `OnPush` + `standalone: true` mandatory rules align with standalone component architecture decision
- `input()` / `output()` signal APIs align with Angular 17+ decisions — no legacy decorator patterns introduced
- AppError discriminated union used consistently across all service examples

**Structure Alignment:**
- `core/services/` for singletons, `features/` for routes, `shared/components/` for presentational — clearly bounded, no overlap
- `app.config.ts` (not `app.module.ts`) correctly signals standalone bootstrapApplication pattern
- E2E tests in `e2e/`, unit tests co-located as `.spec.ts` — consistent with Vitest + Playwright tooling

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**

| FR Category | Architectural Support |
|---|---|
| Expense Entry (FR1–FR8, FR49–50) | `entry-form` feature + `EntriesService.addEntry()` optimistic write + `SyncQueueService.enqueue()` |
| Dashboard & Visualization (FR9–FR14) | `dashboard` feature + `hero-card`, `sparkline-chart`, `category-breakdown-bar` shared components + ng2-charts |
| Entry Discovery & Search (FR15–FR19) | `entries-list` feature + `EntriesService` IDB-side filtering |
| Category Management (FR20–FR24, FR55) | `settings` feature + `CategoriesService` + CSS custom property injection at APP_INITIALIZER |
| Sheets Integration (FR25–FR32, FR51) | `SheetsService` + Zod schemas in `sheets.model.ts` + dual-schema detection |
| Offline & Sync (FR33–FR41, FR52–53) | `IdbService` + `SyncQueueService` state machine + `sync-review` feature |
| Auth & Session (FR42–FR46) | `AuthService` + GIS PKCE + `auth.guard.ts` + `AuthInterceptor` + APP_INITIALIZER |
| First-Run & Setup (FR47–FR48, FR54) | `auth` feature + `SheetsService.discoverSheet()` + `appMeta` IDB store |

**Non-Functional Requirements Coverage:**

| NFR | Architectural Support |
|---|---|
| Entry save <200ms | Optimistic IDB-first write; Sheets sync is fire-and-background |
| Dashboard load <2s | IDB cache as primary read source; no Sheets API call on render |
| FMP <3s | esbuild + lazy `loadComponent()` routes + SW precache of app shell |
| Drill-down <500ms | IDB query (indexed by `month`, `year`) — no network call |
| PWA installable | `@angular/pwa` schematic + `ngsw-config.json` + `manifest.webmanifest` |
| WCAG 2.1 AA | Angular Material components ship with ARIA; pattern rule forbids overriding ARIA attributes |
| Static hosting | `ng build` → `dist/browser/` → Netlify / Vercel / GitHub Pages |
| Single-user, no backend | No server infrastructure; GIS handles identity client-side |

### Implementation Readiness Validation ✅

**Decision Completeness:**
All critical decisions documented with explicit library names. Starter initialization sequence is a concrete ordered bash script — no ambiguity in setup.

**Structure Completeness:**
Complete file tree with every file named. `app.config.ts` vs `app.module.ts` distinction explicit. Every service and component has a defined home directory.

**Pattern Completeness:**
Naming, structure, format, communication, and process patterns all defined. Good examples and anti-patterns provided with code snippets for the highest-risk areas (Signal mutation, optimistic write, toast routing).

### Gap Analysis Results

**Minor Gaps (non-blocking, resolved here):**

**Gap 1 — UUID: `uuid` library removed in favour of `crypto.randomUUID()`**
An earlier draft included `npm install uuid`. The implementation patterns use `crypto.randomUUID()` (native browser API, available in all target environments).
**Resolution (applied):** `uuid` and `@types/uuid` are omitted from the initialization sequence above. Use `crypto.randomUUID()` natively throughout.

**Gap 2 — `NotificationService` interface**
Described as "MatSnackBar wrapper" without method signatures — AI agents could implement it differently.
**Resolution:** Canonical interface:
```typescript
@Injectable({ providedIn: 'root' })
export class NotificationService {
  showSuccess(message: string): void;
  showError(message: string, action?: string): void;
  showInfo(message: string): void;
}
```
All methods call `MatSnackBar.open()` with appropriate duration and panel class.

**Gap 3 — Dark mode preference persistence**
Architecture specifies CSS class toggle on `<html>` but not where the preference is stored between sessions.
**Resolution:** `localStorage.setItem('theme', 'dark' | 'light')`. Read on app boot in `app.component.ts` `ngOnInit`, apply class to `document.documentElement`. No IDB overhead for a single preference flag.

**UX Spec Alignment:**
The UX spec and this architecture are fully aligned: `MatSnackBar` via `NotificationService` for error toasts only, never for routine success. No discrepancy between documents.

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High — all 16 checklist items confirmed, no critical gaps, 3 minor gaps resolved inline.

**Key Strengths:**
- Local-first architecture cleanly solves latency, cold launch, and offline with one decision
- Angular Signals + OnPush is a coherent, low-boilerplate state solution at this project scale
- Explicit `NotificationService` boundary prevents MatSnackBar sprawl across components
- Dual-schema detection at the service layer keeps all version complexity out of UI components
- APP_INITIALIZER ordering (`AuthService` → `CategoriesService`) guarantees color tokens available before first render

**Areas for Future Enhancement:**
- Multi-Sheet support (second spreadsheet or user-configurable sheet ID)
- Budget threshold alerts (additive feature, no architectural changes needed)
- CSV export (pure in-memory transform of IDB entries, no new dependencies)

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns and anti-patterns as the code review standard
- Respect `core/` / `features/` / `shared/` boundaries — no cross-boundary service injection from feature components
- Refer to this document for all architectural questions before making independent decisions

**First Implementation Priority:**
```bash
ng new expense-dashboard --style=scss --routing=true --strict=true --ssr=false
```
Follow the complete initialization sequence in the Starter Template section. This is story 0 — all other stories depend on it.

**uuid:** The initialization sequence above omits the `uuid` package. Use `crypto.randomUUID()` natively throughout — no external dependency needed.

**Route correction:** `QuickAddSheetComponent` (entry-form) has no route. It opens exclusively via `MatBottomSheet` from the FAB. The `/add` route has been removed. The `entries` route imports from `features/entries-list/` (not `features/entries/`).
