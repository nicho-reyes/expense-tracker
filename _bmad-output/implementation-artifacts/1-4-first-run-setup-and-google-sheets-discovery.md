# Story 1.4: First-run setup and Google Sheets discovery

Status: done

## Story

As Nick,
I want the app to guide me through connecting my Google account on first launch and automatically find my expense Sheet,
So that I can start logging expenses without entering any Sheet URL or ID.

## Acceptance Criteria

1. **Given** this is my first app launch (no auth token in storage) **When** I open the app **Then** I see a first-run onboarding screen prompting me to sign in with Google and approve Sheets access
2. **Given** I complete authentication **When** the app prompts for Sheet connection **Then** I am asked to enter my Google Sheet URL or spreadsheet ID once; the app derives the `spreadsheetId`, validates the spreadsheet is accessible, and persists it to the `appMeta` IDB store — no Drive-level file search is performed and the `spreadsheets` scope is sufficient
3. **Given** a matching Sheet is found **When** discovery completes **Then** the app displays the connected Sheet name and waits for my confirmation before loading any data
4. **Given** a Sheet tab is found **When** the app reads its header row **Then** Zod validates the column schema before any read or write operation is attempted
5. **Given** Zod schema validation passes on a tab **When** the header row is inspected **Then** the app identifies the schema version as either 2026 (6-column, writable) or 2025 (4-column, read-only) and stores this classification per tab in `appMeta.schemaCache`
6. **Given** a 2026-schema tab is identified **When** column F (the app-managed UUID column) is absent **Then** an `AppError.SCHEMA_MISMATCH` is emitted, no data is read or written, and I see an actionable error message explaining the missing column
7. **Given** Sheet discovery fails entirely (network error or no matching spreadsheet) **When** the error is surfaced **Then** I see an actionable `AppError.SHEETS_API` message with a retry option — no unhandled exception or blank screen
8. **Given** a tab's header row matches neither the 2026 nor 2025 schema **When** it is encountered during discovery **Then** an `AppError.SCHEMA_VALIDATION` is emitted, the tab is skipped, and I see a user-visible warning identifying the problematic tab

## Tasks / Subtasks

- [x] Add `TabSchemaResult` type and `schema2026PartialValidator` to `sheets.model.ts` (AC: 4, 5, 6, 8)
  - [x] Export `TabSchemaResult` discriminated union: `'2026' | '2025' | 'mismatch' | 'invalid' | 'error'`
  - [x] Export `schema2026PartialValidator` (first 5 columns: Date, Category, Amount, Remarks, Month)
- [x] Implement `SheetsService` full implementation (AC: 2, 3, 4, 5, 6, 7, 8)
  - [x] `connectedSpreadsheetId` private WritableSignal + public readonly signal
  - [x] `isSheetConnected = computed(() => !!this._connectedSpreadsheetId())`
  - [x] `ensureLoaded(): Promise<void>` — reads `appMeta` IDB key `'spreadsheetId'`, no-op on second call
  - [x] `extractSpreadsheetId(input: string): string | null` — parses URL or bare ID
  - [x] `fetchSpreadsheetMeta(spreadsheetId: string): Observable<SheetsSpreadsheet>` — GET spreadsheet metadata, maps HTTP errors to `AppError.SHEETS_API`
  - [x] `detectSchema(tabName: string, headers: string[]): TabSchemaResult` — priority: 2026 → mismatch → 2025 → invalid (mismatch before 2025 to satisfy AC6)
  - [x] `validateAllTabs(spreadsheetId: string, tabs: SheetsSheetMeta[]): Promise<TabSchemaResult[]>` — reads `!A1:F1` for each tab
  - [x] `connectSheet(spreadsheetId: string, schemaCache: Record<string, '2026' | '2025'>): Promise<void>` — persists `'spreadsheetId'` and `'schemaCache'` to appMeta IDB
  - [x] Write `src/app/core/services/sheets.service.spec.ts`
- [x] Create `setupGuard` at `src/app/core/guards/setup.guard.ts` (AC: 1)
  - [x] Inject `SheetsService`, call `ensureLoaded()`, redirect to `/setup` if not connected
- [x] Create `SetupComponent` at `src/app/features/setup/` (AC: 1, 2, 3, 6, 7, 8)
  - [x] 3-state flow: `'input'` → `'validating'` → `'confirm'` (with back to `'input'` on error)
  - [x] `onValidate()`: parse ID → `fetchSpreadsheetMeta()` → show confirm with title
  - [x] `onConnect()`: `validateAllTabs()` → handle SCHEMA_MISMATCH (blocking) + SCHEMA_VALIDATION (warning) → `connectSheet()` → navigate to `/`
  - [x] Inline error display per `AppError` type — do NOT use only snackbar
  - [x] `standalone: true`, `changeDetection: ChangeDetectionStrategy.OnPush`
- [x] Update `app.routes.ts` (AC: 1)
  - [x] Add `/setup` route with `canActivate: [authGuard]` (no `setupGuard` — this is the setup destination)
  - [x] Add `setupGuard` to all existing protected routes: `canActivate: [authGuard, setupGuard]`

## Dev Notes

### ⚠️ Critical: First-Run Flow — No AuthService Changes Required

`AuthService.handleTokenResponse()` already navigates to `/` after sign-in. For a first-time user, this triggers the router:
1. `/` route → `canActivate: [authGuard, setupGuard]`
2. `authGuard`: authenticated → pass
3. `setupGuard`: `ensureLoaded()` → no spreadsheetId in IDB → redirect to `/setup`

No changes to `AuthService` or `AuthComponent` are needed. The existing sign-in flow already routes users to the correct setup screen on first run.

### ⚠️ Critical: Guard Order in canActivate Array

Guards in `canActivate: [authGuard, setupGuard]` run **in array order**. If `authGuard` returns `router.createUrlTree(['/auth'])`, `setupGuard` never runs. This is correct and intentional — unauthenticated users go to auth, authenticated users without a sheet go to setup.

The `/setup` route uses `canActivate: [authGuard]` only — no `setupGuard`, because setup is where the user connects the sheet.

### SheetsService Implementation Shape

```typescript
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, from } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { IdbService } from './idb.service';
import { NotificationService } from './notification.service';
import { environment } from '../../../environments/environment';
import { AppError } from '../models/error.model';
import {
  SheetsSpreadsheet, SheetsSheetMeta, SheetsValueRange,
  TabSchemaResult, schema2026Validator, schema2025Validator,
  schema2026PartialValidator, SCHEMA_2026_HEADERS,
} from '../models/sheets.model';

@Injectable({ providedIn: 'root' })
export class SheetsService {
  private readonly http = inject(HttpClient);
  private readonly idb = inject(IdbService);
  private readonly notification = inject(NotificationService);

  private readonly _connectedSpreadsheetId = signal<string | null>(null);
  private _loadedFromIdb = false;

  readonly connectedSpreadsheetId = this._connectedSpreadsheetId.asReadonly();
  readonly isSheetConnected = computed(() => !!this._connectedSpreadsheetId());

  async ensureLoaded(): Promise<void> {
    if (this._loadedFromIdb) return;
    const id = await this.idb.get<string>('appMeta', 'spreadsheetId');
    this._connectedSpreadsheetId.set(id ?? null);
    this._loadedFromIdb = true;
  }

  async connectSheet(
    spreadsheetId: string,
    schemaCache: Record<string, '2026' | '2025'>,
  ): Promise<void> {
    await this.idb.set('appMeta', 'spreadsheetId', spreadsheetId);
    await this.idb.set('appMeta', 'schemaCache', schemaCache);
    this._connectedSpreadsheetId.set(spreadsheetId);
  }

  extractSpreadsheetId(input: string): string | null {
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
    return null;
  }

  fetchSpreadsheetMeta(spreadsheetId: string): Observable<SheetsSpreadsheet> {
    const url = `${environment.sheetsApiBaseUrl}/${spreadsheetId}` +
      `?fields=spreadsheetId,properties.title,sheets.properties`;
    return this.http.get<SheetsSpreadsheet>(url).pipe(
      catchError((err: HttpErrorResponse) => {
        const msg = err.status === 403
          ? 'No access to this spreadsheet — check sharing settings.'
          : err.status === 404
          ? 'Spreadsheet not found — check the URL or ID.'
          : `Sheets error (${err.status}): ${err.message}`;
        return throwError(() => ({
          type: 'SHEETS_API', status: err.status, message: msg,
        } satisfies AppError));
      }),
    );
  }

  async validateAllTabs(
    spreadsheetId: string,
    tabs: SheetsSheetMeta[],
  ): Promise<TabSchemaResult[]> {
    return Promise.all(tabs.map(tab => this.readTabHeaderRow(spreadsheetId, tab.properties.title)));
  }

  private async readTabHeaderRow(spreadsheetId: string, tabName: string): Promise<TabSchemaResult> {
    const range = encodeURIComponent(`'${tabName}'!A1:F1`);
    const url = `${environment.sheetsApiBaseUrl}/${spreadsheetId}/values/${range}`;
    try {
      const response = await this.http.get<SheetsValueRange>(url).toPromise();
      const headers = (response?.values?.[0] ?? []) as string[];
      return this.detectSchema(tabName, headers);
    } catch (err) {
      const httpErr = err as HttpErrorResponse;
      return {
        type: 'error', tabName,
        error: { type: 'SHEETS_API', status: httpErr.status ?? 0, message: httpErr.message } satisfies AppError,
      };
    }
  }

  detectSchema(tabName: string, headers: string[]): TabSchemaResult {
    // 1. Try 2026 (6-column, writable)
    if (schema2026Validator.safeParse(headers.slice(0, 6)).success) {
      return { type: '2026', tabName };
    }
    // 2. Try 2025 (4-column, read-only)
    if (schema2025Validator.safeParse(headers.slice(0, 4)).success) {
      return { type: '2025', tabName };
    }
    // 3. Detect 2026-intent tab with missing UUID column (first 5 match)
    if (schema2026PartialValidator.safeParse(headers.slice(0, 5)).success) {
      return {
        type: 'mismatch', tabName,
        error: {
          type: 'SCHEMA_MISMATCH', tabName,
          expected: SCHEMA_2026_HEADERS,
          received: headers,
        } satisfies AppError,
      };
    }
    // 4. Completely unrecognized
    const zodErr = schema2026Validator.safeParse(headers.slice(0, 6));
    return {
      type: 'invalid', tabName,
      error: {
        type: 'SCHEMA_VALIDATION',
        message: `Tab "${tabName}" has unrecognized column headers`,
        details: !zodErr.success ? zodErr.error : (null as never),
      } satisfies AppError,
    };
  }
}
```

### sheets.model.ts Additions

Add these to **`src/app/core/models/sheets.model.ts`** (do NOT redefine existing exports):

```typescript
import { AppError } from './error.model';

// Add alongside existing validators:
export const schema2026PartialValidator = z.tuple([
  z.literal('Date'), z.literal('Category'), z.literal('Amount'),
  z.literal('Remarks'), z.literal('Month'),
]);

// Add TabSchemaResult discriminated union:
export type TabSchemaResult =
  | { type: '2026'; tabName: string }
  | { type: '2025'; tabName: string }
  | { type: 'mismatch'; tabName: string; error: AppError }
  | { type: 'invalid'; tabName: string; error: AppError }
  | { type: 'error'; tabName: string; error: AppError };
```

**Existing exports to REUSE (do not redefine):**
- `SCHEMA_2026_HEADERS`, `SCHEMA_2025_HEADERS` — array of expected header strings
- `schema2026Validator`, `schema2025Validator` — Zod tuple validators
- `SheetsValueRange`, `SheetsSpreadsheet`, `SheetsSheetMeta` — API response types

### SetupComponent 3-State Pattern

```typescript
type SetupStep = 'input' | 'validating' | 'confirm';

@Component({
  selector: 'app-setup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule,
            MatProgressSpinnerModule, FormsModule],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss',
})
export class SetupComponent {
  private readonly sheets = inject(SheetsService);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);

  readonly step = signal<SetupStep>('input');
  readonly inputValue = signal('');
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly spreadsheetTitle = signal<string | null>(null);
  private pendingSpreadsheetId: string | null = null;
  private pendingTabs: SheetsSheetMeta[] = [];

  async onValidate(): Promise<void> {
    const spreadsheetId = this.sheets.extractSpreadsheetId(this.inputValue());
    if (!spreadsheetId) {
      this.errorMessage.set('Enter a valid Google Sheets URL or spreadsheet ID.');
      return;
    }
    this.step.set('validating');
    this.errorMessage.set(null);
    this.isLoading.set(true);
    try {
      const meta = await firstValueFrom(this.sheets.fetchSpreadsheetMeta(spreadsheetId));
      this.spreadsheetTitle.set(meta.properties.title);
      this.pendingSpreadsheetId = spreadsheetId;
      this.pendingTabs = meta.sheets;
      this.step.set('confirm');
    } catch (err) {
      this.errorMessage.set(this.mapError(err as AppError));
      this.step.set('input');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onConnect(): Promise<void> {
    if (!this.pendingSpreadsheetId || !this.pendingTabs.length) return;
    this.isLoading.set(true);
    try {
      const results = await this.sheets.validateAllTabs(
        this.pendingSpreadsheetId, this.pendingTabs
      );

      // Block on any SCHEMA_MISMATCH (missing UUID column in a 2026-like tab)
      const mismatches = results.filter(r => r.type === 'mismatch');
      if (mismatches.length > 0) {
        const tabNames = mismatches.map(r => r.tabName).join(', ');
        this.errorMessage.set(
          `Tab "${tabNames}" is missing column F (UUID). Add a "UUID" header to column F and try again.`
        );
        this.step.set('confirm'); // stay on confirm to show error inline
        return;
      }

      // Warn about unrecognized tabs (SCHEMA_VALIDATION) — non-blocking
      const invalids = results.filter(r => r.type === 'invalid');
      for (const inv of invalids) {
        this.notification.showError(
          `Tab "${inv.tabName}" has unrecognized columns and will be skipped.`
        );
      }

      // Build schemaCache for valid tabs only
      const schemaCache: Record<string, '2026' | '2025'> = {};
      for (const r of results) {
        if (r.type === '2026' || r.type === '2025') {
          schemaCache[r.tabName] = r.type;
        }
      }

      await this.sheets.connectSheet(this.pendingSpreadsheetId, schemaCache);
      await this.router.navigate(['/']);
    } catch (err) {
      this.errorMessage.set(this.mapError(err as AppError));
    } finally {
      this.isLoading.set(false);
    }
  }

  onBack(): void {
    this.step.set('input');
    this.errorMessage.set(null);
  }

  private mapError(err: AppError): string {
    switch (err.type) {
      case 'SHEETS_API': return err.message;
      case 'SCHEMA_MISMATCH':
        return `Tab "${err.tabName}" is missing column F (UUID). Add a "UUID" header and retry.`;
      case 'SCHEMA_VALIDATION': return `Data validation error: ${err.message}`;
      case 'NETWORK': return `Connection failed — check your internet and try again.`;
      default: return 'Something went wrong. Please try again.';
    }
  }
}
```

**Template states (`setup.component.html`):**
- `@if (step() === 'input')`: title "Connect your Sheet", text input with hint "Paste a Google Sheets URL or spreadsheet ID", primary button "Connect", error message div with `role="alert"`
- `@if (step() === 'validating')`: spinner + "Checking your Sheet…"
- `@if (step() === 'confirm')`: show `spreadsheetTitle()` prominently, secondary button "Back", primary button "Confirm & Connect", inline error message if `errorMessage()`

Input field must use `[(ngModel)]` or reactive forms. Use `ngModel` (simpler, FormsModule already known to compile cleanly with OnPush when read via signal — bind with `(ngModelChange)="inputValue.set($event)"`).

### setupGuard Pattern

```typescript
// src/app/core/guards/setup.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SheetsService } from '../services/sheets.service';

export const setupGuard: CanActivateFn = async () => {
  const sheets = inject(SheetsService);
  const router = inject(Router);
  await sheets.ensureLoaded();
  if (!sheets.isSheetConnected()) {
    return router.createUrlTree(['/setup']);
  }
  return true;
};
```

### Route Update (app.routes.ts)

```typescript
import { authGuard } from './core/guards/auth.guard';
import { setupGuard } from './core/guards/setup.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard, setupGuard],   // ← add setupGuard
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'entries',
    canActivate: [authGuard, setupGuard],   // ← add setupGuard
    loadComponent: () => import('./features/entries-list/entries-list.component').then(m => m.EntriesListComponent),
  },
  {
    path: 'sync',
    canActivate: [authGuard, setupGuard],   // ← add setupGuard
    loadComponent: () => import('./features/sync-review/sync-review.component').then(m => m.SyncReviewComponent),
  },
  {
    path: 'settings',
    canActivate: [authGuard, setupGuard],   // ← add setupGuard
    loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
  },
  {
    path: 'setup',
    canActivate: [authGuard],              // ← NO setupGuard here
    loadComponent: () => import('./features/setup/setup.component').then(m => m.SetupComponent),
  },
  { path: 'auth', loadComponent: () => import('./features/auth/auth.component').then(m => m.AuthComponent) },
  { path: '**', redirectTo: 'auth' },
];
```

### Google Sheets API Endpoints Used

```
# Validate access + get title + tab list
GET https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}
    ?fields=spreadsheetId,properties.title,sheets.properties

# Read header row of one tab (A1:F1 — reads up to 6 columns for schema detection)
GET https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{encodedTabName}!A1:F1
```

`AuthInterceptor` from Story 1.2 already injects `Authorization: Bearer <token>` on all `sheets.googleapis.com` requests. No additional interceptor configuration needed.

`environment.sheetsApiBaseUrl` = `'https://sheets.googleapis.com/v4/spreadsheets'` — use this constant; never hardcode the URL.

### appMeta IDB Keys for This Story

| Key | Type | Set by |
|-----|------|--------|
| `'spreadsheetId'` | `string` | `connectSheet()` |
| `'schemaCache'` | `Record<string, '2026' \| '2025'>` | `connectSheet()` |

Use `IdbService.set('appMeta', key, value)` and `IdbService.get<T>('appMeta', key)`. Never call `idb` directly — always through `IdbService`.

### Schema Detection Priority (in detectSchema())

1. `schema2026Validator.safeParse(headers.slice(0, 6)).success` → `'2026'` (all 6 cols: Date, Category, Amount, Remarks, Month, UUID)
2. `schema2025Validator.safeParse(headers.slice(0, 4)).success` → `'2025'` (first 4 cols: Date, Category, Amount, Remarks)
3. `schema2026PartialValidator.safeParse(headers.slice(0, 5)).success` → `'mismatch'` (first 5 cols match but UUID is missing — emit SCHEMA_MISMATCH)
4. Otherwise → `'invalid'` (emit SCHEMA_VALIDATION, tab is skipped non-blockingly)

Tab names with spaces require single-quote wrapping in Sheets range notation: `'Tab Name'!A1:F1`. Use `encodeURIComponent` on the full range string after quoting the tab name.

### spreadsheetId URL Parser

Handles two input forms:
- **Full URL**: `https://docs.google.com/spreadsheets/d/{ID}/edit#gid=0` → extracts `{ID}`
- **Bare ID**: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms` → returned as-is

The regex `/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/` covers all URL variants (including `/edit`, `/view`, `/export` suffixes).

### What Story 1.4 Does NOT Implement

- Reading actual expense entry rows → Stories 2.X, 3.6, 3.7
- Categories loading from the Sheet → Story 1.5
- Token silent refresh → Story 1.3
- 401 handling in interceptor → Story 1.3
- Tab discovery by naming prefix (for write routing) → implemented when needed in entry-writing stories
- Schema cache TTL invalidation → deferred to when needed

### Previous Story Patterns to Follow (Stories 1.2, 1.6)

- **Angular 21 root component naming**: root component is `src/app/app.ts` / `app.html` (no `.component` infix). All other components follow normal `<name>.component.ts` pattern.
- **OnPush + standalone mandatory** on every component (including `SetupComponent`)
- **Signals, not `@Input()`/`@Output()`** — use `input()` / `output()` if the component has inputs/outputs
- **`NotificationService.showError()`** for toast notifications — never inject `MatSnackBar` directly
- **`providedIn: 'root'`** on `SheetsService` — no exceptions
- **Run tests via `ng test --watch=false`** (not bare `npx vitest run`) — the `@angular/build:unit-test` builder manages the Vitest runner
- **`firstValueFrom(observable)`** from `'rxjs'` to bridge Observable → Promise in async methods

### Testing Guidance

Use Vitest. Test file: `src/app/core/services/sheets.service.spec.ts`

Key test cases:
1. `extractSpreadsheetId`: full URL → returns ID
2. `extractSpreadsheetId`: bare ID (≥20 alphanumeric chars) → returns it as-is
3. `extractSpreadsheetId`: invalid string → returns null
4. `detectSchema`: 6-column 2026 headers → `{ type: '2026' }`
5. `detectSchema`: 4-column 2025 headers → `{ type: '2025' }`
6. `detectSchema`: 5-column (missing UUID) → `{ type: 'mismatch' }`
7. `detectSchema`: unrecognized headers → `{ type: 'invalid' }`
8. `fetchSpreadsheetMeta`: mocked `HttpClient` 403 response → throws `AppError { type: 'SHEETS_API', status: 403 }`
9. `ensureLoaded()`: reads IDB `'spreadsheetId'` key → sets `connectedSpreadsheetId` signal; second call is no-op
10. `connectSheet()`: writes both `'spreadsheetId'` and `'schemaCache'` keys to IDB

Mock `IdbService` and `HttpClient` in tests — do not use real IDB or real HTTP in unit tests.

### Project Structure Notes

New files follow the established `src/app/features/<feature>/` pattern:
- Feature components go in `src/app/features/` — one directory per route
- Guards go in `src/app/core/guards/` — same directory as `auth.guard.ts`
- `SheetsService` stays in `src/app/core/services/` — already stubbed there
- `SetupComponent` is a new feature directory: `src/app/features/setup/`

All stub files exist from Story 1.1. `SheetsService` at `src/app/core/services/sheets.service.ts` currently contains only `@Injectable({ providedIn: 'root' })` — replace it entirely with the full implementation.

### References

- First-run flow UX: [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#Journey-5`]
- appMeta IDB store schema: [Source: `_bmad-output/planning-artifacts/architecture.md#Data-Architecture`]
- Sheets API pattern: [Source: `_bmad-output/planning-artifacts/architecture.md#API-Communication-Patterns`]
- Dual-schema (2026/2025): [Source: `_bmad-output/planning-artifacts/architecture.md#Data-Architecture`]
- SheetsService boundary: [Source: `_bmad-output/planning-artifacts/architecture.md#Architectural-Boundaries`]
- AppError discriminated union: [Source: `src/app/core/models/error.model.ts`]
- Existing Zod validators: [Source: `src/app/core/models/sheets.model.ts`]
- IdbService API: [Source: `src/app/core/services/idb.service.ts`]
- Guard pattern: [Source: `src/app/core/guards/auth.guard.ts`]
- AuthService sign-in navigation: [Source: `src/app/core/services/auth.service.ts:189`] — navigates to `/` on success; setupGuard handles redirect to `/setup`
- `environment.sheetsApiBaseUrl`: [Source: `src/environments/environment.ts`]
- `firstValueFrom` usage: [Source: `1-2-google-oauth-authentication-flow.md#Dev-Notes`]
- Angular 21 root file naming: [Source: `1-6-app-shell-semantic-color-system-and-light-dark-theme.md#Dev-Notes`]
- Test runner command: [Source: `1-2-google-oauth-authentication-flow.md#Dev-Agent-Record`] — use `ng test --watch=false`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Detected and fixed schema detection priority bug: story code had `2025` check before `mismatch` check, which made `mismatch` unreachable (any 5-column 2026-like header would match 2025 first). Fixed by swapping order to: 2026 → mismatch → 2025 → invalid, satisfying AC6.

### Completion Notes List

- `sheets.model.ts`: Added `schema2026PartialValidator` (5-column Zod tuple) and `TabSchemaResult` discriminated union type.
- `sheets.service.ts`: Full implementation replacing stub — signals, `ensureLoaded()`, `extractSpreadsheetId()`, `fetchSpreadsheetMeta()`, `detectSchema()`, `validateAllTabs()`, `connectSheet()`. Schema detection priority: 2026 → mismatch → 2025 → invalid.
- `sheets.service.spec.ts`: 16 unit tests covering all 10 key test cases from Dev Notes. All pass.
- `setup.guard.ts`: Functional guard that awaits `ensureLoaded()` and redirects to `/setup` if no sheet is connected.
- `setup.component.ts/html/scss`: 3-state OnPush standalone component (input → validating → confirm) with inline errors, blocking on `SCHEMA_MISMATCH`, toast warnings for `SCHEMA_VALIDATION`, navigates to `/` on success.
- `app.routes.ts`: Added `/setup` route (`canActivate: [authGuard]`) and added `setupGuard` to all 4 protected routes.
- All 42 tests pass (8 test files, no regressions).

### File List

- src/app/core/models/sheets.model.ts (modified)
- src/app/core/services/sheets.service.ts (modified)
- src/app/core/services/sheets.service.spec.ts (new)
- src/app/core/guards/setup.guard.ts (new)
- src/app/features/setup/setup.component.ts (new)
- src/app/features/setup/setup.component.html (new)
- src/app/features/setup/setup.component.scss (new)
- src/app/app.routes.ts (modified)


## Change Log

- 2026-05-08: Implemented Story 1.4 — SheetsService full implementation, SetupComponent 3-state flow, setupGuard, app.routes.ts updated with /setup route and guard on all protected routes. Fixed schema detection priority (mismatch before 2025) to satisfy AC6. 42 tests passing.

## Review Findings

### Decision-Needed

- [ ] [Review][Decision] `detectSchema` mismatch vs invalid for 6-column tab with wrong column F header — A tab with `['Date','Category','Amount','Remarks','Month','BadHeader']` (6 columns, column F present but not 'UUID') hits the partial-match check on `slice(0,5)` and returns `type: 'mismatch'`. AC6 specifies SCHEMA_MISMATCH when column F is "absent" — but here column F is present with the wrong name. Should this classify as `mismatch` (user likely intended a 2026 sheet, wrong header) or `invalid` (unrecognized schema)? Spec does not cover this case explicitly.

### Patches

- [x] [Review][Patch] Tab name with single quote breaks Sheets A1 range URL — single quote in tab name (e.g. "Fred's Budget") terminates the Sheets quoted-name syntax; must be escaped as `''` before constructing the range [sheets.service.ts:readTabHeaderRow]
- [x] [Review][Patch] `error`-type results from `validateAllTabs` silently dropped — `onConnect` filters for `mismatch` and `invalid` but never checks `type === 'error'`; tabs that fail HTTP reads are silently excluded from `schemaCache` with no user notification [setup.component.ts:onConnect]
- [x] [Review][Patch] Empty `pendingTabs` guard fires before `isLoading.set(true)` — when spreadsheet has zero sheets, `onConnect`'s early-return guard fires before loading state is set, producing a silent no-op (no spinner, no error message) [setup.component.ts:onConnect]
- [x] [Review][Patch] `onBack()` leaves stale `pendingSpreadsheetId`/`pendingTabs` — fields are not cleared on back; any re-entrant path to `onConnect` without re-validating reuses stale data [setup.component.ts:onBack]
- [x] [Review][Patch] Duplicate `rxjs` import lines in `SheetsService` — `Observable, throwError` and `firstValueFrom` are imported on separate lines from `'rxjs'`; consolidate into one [sheets.service.ts:3-5]
- [x] [Review][Patch] `NotificationService` dead injection in `SheetsService` — injected via `inject()` but never called anywhere in the service; remove unused dependency [sheets.service.ts]
- [x] [Review][Patch] `(null as never)` cast in `detectSchema` invalid branch — `zodErr.success` is always `false` when the invalid branch is reached; the ternary dead arm is unnecessary; use `zodErr.error` directly [sheets.service.ts:detectSchema]
- [x] [Review][Patch] AC8 violation — `SCHEMA_VALIDATION` warnings only via snackbar, not inline — spec constraint says "do NOT use only snackbar"; `invalid` tab warnings are exclusively `notification.showError()` toast with no inline rendering in the confirm step [setup.component.ts:onConnect / setup.component.html]
- [x] [Review][Patch] Test `.toPromise()` deprecated — three `fetchSpreadsheetMeta` tests use `.toPromise()` which is deprecated in RxJS 7+; replace with `firstValueFrom(...)` [sheets.service.spec.ts:101,114,130]

### Deferred

- [x] [Review][Defer] `ensureLoaded` not concurrency-safe — two simultaneous guard activations both see `_loadedFromIdb === false` and race to read IDB; should gate with a cached `Promise<void>` instead of a boolean flag [sheets.service.ts:ensureLoaded] — deferred, unlikely in Angular router serial navigation; revisit if guard is called from non-router contexts
- [x] [Review][Defer] `connectSheet` non-transactional IDB writes — two sequential `idb.set` calls; a mid-flight crash leaves spreadsheetId persisted without schemaCache [sheets.service.ts:connectSheet] — deferred, requires IdbService transaction support not yet implemented
- [x] [Review][Defer] 401 from Sheets API maps to generic SHEETS_API, not AUTH_EXPIRED — token expiry during setup shows "Sheets error (401)" instead of re-auth prompt [sheets.service.ts:fetchSpreadsheetMeta] — deferred, 401 handling belongs to Story 1.3 (token refresh)
- [x] [Review][Defer] `_loadedFromIdb` not reset if `idb.get` throws — every subsequent guard activation retries the failing IDB call; no error boundary or fallback state [sheets.service.ts:ensureLoaded] — deferred, IDB error handling strategy to be defined in a later story
