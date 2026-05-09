# Story 2.6: Multi-year entry hydration on first sheet connect

Status: done

## Story

As Nick,
I want every existing entry in my Sheet's 2026-schema year tabs (current and any past years) to load into the app on first connect,
So that switching devices or reinstalling does not lose visibility into any data already in my Sheet.

**Scope note:** 2.6 hydrates the canonical 2026-schema year tabs only (e.g. `2026`, future `2027`, and any past-year tabs that already use the 2026 column layout). The legacy **2025** tab uses a different 4-column schema and is intentionally left to Story 3.6, which adds the legacy column mapping plus read-only enforcement. Once 3.6 ships, 2025 entries also become visible — but waiting on 3.6 must not block 2026-schema hydration.

## Acceptance Criteria

1. **Given** I have just completed first-run setup (Story 1.4) and the spreadsheet has been validated against the 2026 schema (Story 1.5's `schemaCache`) **When** the app finishes connecting and before the entry list renders **Then** `SheetsService` enumerates every tab in the spreadsheet whose name matches a year and whose header row passes 2026-schema validation, then reads every data row from each qualifying tab and maps it into a `LocalEntry` with `syncStatus: 'synced'`, `isReadOnly: false`, and `tabName` set to the originating tab
2. **Given** a tab's name does not match a year pattern, or its header row fails 2026-schema validation **When** hydration runs **Then** that tab is skipped (no mapping attempted, no error surfaced); legacy 2025 mapping is explicitly out of scope here and is owned by Story 3.6
3. **Given** a row contains a column-F UUID **When** the row is mapped to a `LocalEntry` **Then** that UUID is used as the `LocalEntry.id` so re-hydration is idempotent — no duplicate IDB rows on a second connect, regardless of which tab the row came from
4. **Given** a row has no column-F UUID (entry predates Story 2.5's UUID idempotency convention) **When** the row is mapped **Then** a deterministic id `hydrated-<tabName>-<row>` is assigned and stored, so subsequent hydrations do not re-import the same row as a new entry
5. **Given** hydration is in progress **When** the user opens the app shell **Then** the entry list shows a hydration progress state distinguishable from the "no entries" empty state, the progress indicator reports per-tab progress (e.g. "Loading 2026 (1 of 2)…"), and the FAB QuickAdd remains tappable so logging is never blocked on hydration
6. **Given** any qualifying tab fails schema validation mid-hydration **When** that specific tab is processed **Then** that tab is skipped with `AppError.SCHEMA_VALIDATION` surfaced via `NotificationService`, and hydration continues with remaining tabs — partial hydration is preferred over total failure, and the user sees a per-tab inline status
7. **Given** hydration completes (fully or partially) **When** the run ends **Then** `appMeta.hydratedAt` is written with a per-tab map of `{ tabName: { lastHydratedAt: number; rowCount: number } }`; full hydration is NOT re-run on every launch — only when a tab is absent from the map or when the user explicitly triggers a re-sync (deferred to Epic 3)
8. **Given** a Sheets API read for any individual tab fails (network, 5xx, quota) **When** the failure surfaces **Then** that tab is left in a "deferred" state in `appMeta.hydratedAt` (no `lastHydratedAt` entry written, or an entry-with-error marker) so retry resumes only the failed tab — successfully hydrated tabs are not re-read
9. **Given** Story 3.6's legacy 2025 hydration and Story 3.7's past-year edit/delete write-back land later **When** they integrate **Then** 2.6 remains the canonical multi-tab hydration entry point — 3.6 plugs in the legacy mapper for 2025 tabs, and 3.7 reuses 2.6's hydrated rows for row-resolution rather than re-reading

## Tasks / Subtasks

- [x] Add hydration types to `sheets.model.ts` (AC: 1, 7, 8)
  - [x] Export `YEAR_TAB_PATTERN = /^\d{4}$/` constant — tab name must be exactly four digits
  - [x] Export `HydratedTabRecord` interface: `{ lastHydratedAt: number; rowCount: number }`
  - [x] Export `HydrationProgress` discriminated union: `{ type: 'idle' } | { type: 'running'; tabName: string; tabIndex: number; tabTotal: number } | { type: 'complete'; hydratedTabs: number; skippedTabs: number; deferredTabs: number }`
  - [x] Export `HydrationTabResult` discriminated union: `{ type: 'hydrated'; tabName: string; rowCount: number } | { type: 'skipped'; tabName: string; reason: 'non-year-name' | 'non-2026-schema' | 'already-hydrated' } | { type: 'invalid'; tabName: string; error: AppError } | { type: 'deferred'; tabName: string; error: AppError }`

- [x] Extend `SheetsService` with multi-year hydration read methods (AC: 1, 2, 3, 4, 6, 8)
  - [x] Add `listYearTabs(spreadsheetId: string): Promise<SheetsSheetMeta[]>` — fetches spreadsheet meta, filters by `YEAR_TAB_PATTERN`, returns metadata only (no row reads). Errors map to `AppError.SHEETS_API`.
  - [x] Add `readTabDataRows(spreadsheetId: string, tabName: string): Observable<string[][]>` — `GET …/values/'<escapedTabName>'!A2:F` (skip header row). Maps 429/5xx to `AppError.SHEETS_API`. Returns the raw `values` array (each inner array is one row, columns A–F by position; trailing empty cells may be omitted by the Sheets API).
  - [x] Add `mapRowToLocalEntry(tabName: string, rowIndex: number, row: string[]): LocalEntry | null` — pure helper, no IO. Returns `null` if row fails the per-row Zod row-shape validator (used by Story 3.6 when it adds the legacy mapper). For 2026 rows: column F is the UUID; if F is empty/whitespace, derive id as `hydrated-${tabName}-${rowIndex}`. Sets `syncStatus: 'synced'`, `isReadOnly: false`, `sheetRowIndex: rowIndex`, `schemaVersion: '2026'`, `tabName` = originating tab, `month` derived from `date.slice(0, 7)`, `year` derived from `Number(date.slice(0, 4))`.
  - [x] Add a Zod row validator (private to SheetsService is fine, or co-located in `sheets.model.ts`): 6-tuple of `[date string, category string, amount string parseable as finite number, remarks string, month string, uuid-or-empty string]`. Used by `mapRowToLocalEntry` to decide hydrated vs invalid per-row.
  - [x] Unit-test new methods in `sheets.service.spec.ts`: year-tab filtering, A2:F range URL, 429 → `AppError.SHEETS_API`, mapping happy path, mapping with empty column-F (deterministic id), mapping with malformed amount (returns null).

- [x] Add per-tab hydration metadata helpers to `IdbService` overloads (AC: 7, 8)
  - [x] No new store — `appMeta` covers it. The new key `'hydratedAt'` stores `Record<string, HydratedTabRecord>` (tabName → record). Existing `IdbService.get('appMeta', 'hydratedAt')` and `IdbService.set('appMeta', 'hydratedAt', value)` already support this via the generic `appMeta` overloads — no new IdbService methods required.
  - [x] Confirm `IdbService.put('entries', ...)` already supports the bulk write pattern used here (a loop is fine — `EntriesService.add()` already uses single `put` per entry).

- [x] Implement `HydrationService` (NEW service) at `src/app/core/services/hydration.service.ts` (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [x] `@Injectable({ providedIn: 'root' })`, standalone-friendly, no lifecycle assumptions beyond `init()`-style invocation from `APP_INITIALIZER`
  - [x] Inject `IdbService`, `SheetsService`, `EntriesService`, `NotificationService`
  - [x] Public read-only signals: `progress: Signal<HydrationProgress>` (defaults `{ type: 'idle' }`), `lastRunSummary: Signal<HydrationTabResult[] | null>`
  - [x] Public method `init(): Promise<void>` — orchestrates the hydration run; called from `APP_INITIALIZER` after `entries.init()` (see "APP_INITIALIZER chain" Dev Note)
  - [x] Public method `hydrate(opts?: { force?: boolean }): Promise<HydrationTabResult[]>` — exposed for future "manual re-sync" trigger (Epic 3); `init()` calls `hydrate({ force: false })`
  - [x] Skip entire run if `SheetsService.connectedSpreadsheetId() === null` (no sheet connected — first launch will be on `/setup`)
  - [x] List year tabs via `SheetsService.listYearTabs()`; cross-reference against `appMeta.hydratedAt`. Tabs already present with a `lastHydratedAt` are skipped (`type: 'already-hydrated'`) unless `force === true`.
  - [x] For each remaining tab: emit `progress = { type: 'running', tabName, tabIndex, tabTotal }`, read schema from `SheetsService.schemaCache()` — if not `'2026'`, record `{ type: 'skipped', reason: 'non-2026-schema' }` and continue
  - [x] Read rows via `SheetsService.readTabDataRows()`; on HTTP failure record `{ type: 'deferred', error }`, surface via `NotificationService`, do NOT write to `appMeta.hydratedAt` for that tab, continue
  - [x] Map each row via `SheetsService.mapRowToLocalEntry()`; collect malformed rows under a single `{ type: 'invalid', error: SCHEMA_VALIDATION }` entry per tab (do NOT abort the tab — partial hydration over total failure per AC6)
  - [x] Write hydrated entries to IDB via `IdbService.put('entries', entry)` in a loop. After all rows persist, call `EntriesService.refreshFromIdb()` (NEW method — see EntriesService task) once per tab to merge into the live signal
  - [x] On tab completion (success path): write `appMeta.hydratedAt[tabName] = { lastHydratedAt: Date.now(), rowCount }` via `IdbService.set('appMeta', 'hydratedAt', updated)`. Read-modify-write the whole map (single small object — atomicity within one `put` is sufficient).
  - [x] On run completion: emit `progress = { type: 'complete', hydratedTabs, skippedTabs, deferredTabs }`; persist `lastRunSummary`
  - [x] Wrap unexpected throws in `AppError.UNKNOWN_ERROR` and notify; never rethrow into `APP_INITIALIZER` (boot must continue)

- [x] Add `EntriesService.refreshFromIdb()` (AC: 1)
  - [x] New public method that re-reads `idb.getAll('entries')` and replaces the `_entries` signal — the same shape as `init()`'s body, factored for reuse by `HydrationService`
  - [x] `init()` should call `refreshFromIdb()` internally to avoid drift; the existing `init()` early-return-on-second-call guard remains
  - [x] Add a unit test in `entries.service.spec.ts` covering: hydrated rows in IDB → `refreshFromIdb()` → signal contains them in stable order

- [x] Wire `HydrationService.init()` into `APP_INITIALIZER` (AC: 1, 5)
  - [x] In `app.config.ts`, append `.then(() => hydration.init())` after `syncQueue.init()`
  - [x] Add `HydrationService` to `deps`, import at the top
  - [x] `init()` failure must NOT block shell boot — `HydrationService.init()` swallows internally (consistent with `EntriesService.init()` and `SyncQueueService.init()`)

- [x] Render hydration progress in `EntriesListComponent` (AC: 5)
  - [x] Inject `HydrationService`; bind to `progress()` signal
  - [x] When `progress.type === 'running'`: show inline progress strip above the list with text "Loading {tabName} ({tabIndex} of {tabTotal})…" and a `mat-progress-bar` (mode `indeterminate` is acceptable — exact-percentage is overkill for tab-granular reads). Do NOT replace the list — show the strip ABOVE the list so already-hydrated tabs from previous runs remain visible during incremental hydration.
  - [x] When `progress.type === 'idle'` AND entries are empty: show the existing `EmptyState` "no entries" component (Story 2.3) — distinguishable from progress state (AC5)
  - [x] FAB remains visible and active during hydration (do not gate QuickAdd on progress state)
  - [x] Add a test in `entries-list.component.spec.ts` (or e2e equivalent): when `HydrationService.progress` is `running`, progress strip is rendered, EmptyState is hidden, FAB is enabled

- [x] Write `hydration.service.spec.ts` — Vitest unit tests (AC: 1, 2, 3, 4, 6, 7, 8)
  - [x] Mock `IdbService`, `SheetsService`, `EntriesService`, `NotificationService`
  - [x] `init()` with no spreadsheet connected → no calls to `listYearTabs`; progress stays `idle`
  - [x] `hydrate()` filters non-year-named tabs (e.g. "Categories", "Summary") — only `^\d{4}$` tabs are processed
  - [x] `hydrate()` skips tabs whose `schemaCache[tabName]` is `'2025'` (legacy — Story 3.6 owns it) — recorded as `{ type: 'skipped', reason: 'non-2026-schema' }`
  - [x] `hydrate()` happy path with one 2026 tab and 3 valid rows → 3 entries written to IDB, `appMeta.hydratedAt[tabName]` written, `EntriesService.refreshFromIdb()` called
  - [x] Row with column-F UUID → `LocalEntry.id` matches the UUID
  - [x] Row with empty column-F → `LocalEntry.id === 'hydrated-2026-5'` (deterministic; row index includes header offset — see "Row index convention" Dev Note)
  - [x] Re-running `hydrate()` after a successful run → tab is skipped with `'already-hydrated'`; no duplicate writes
  - [x] Re-running `hydrate({ force: true })` → tab is re-read; using a UUID-bearing row twice does NOT create duplicates because `IdbService.put('entries', ...)` with the same `id` overwrites
  - [x] `readTabDataRows()` rejects with 429 → tab recorded as `deferred`, `appMeta.hydratedAt` NOT updated for that tab, `NotificationService.showError` called, run continues
  - [x] One row with malformed amount in a 5-row tab → 4 entries hydrated; one `{ type: 'invalid' }` entry recorded; tab still marked `lastHydratedAt` (partial hydration is preferred)

## Dev Notes

### PRD/Architecture Gap This Story Closes

The PRD says "Google Sheets serves as the persistent source of truth," and the architecture says "IDB is the source of truth for UI rendering." These two statements are reconciled by **hydration on first sheet connect**: IDB acts as the read cache, Sheets is the durable backup. Without a hydration story, a user who reinstalls the app or signs in on a new device would see an empty list despite months of historical data sitting in their Sheet.

Stories 1.4 (sheet discovery), 1.5 (categories from Sheet), 2.1 (`EntriesService.add`), and 2.5 (write new entries to Sheet) all assume IDB is already populated for the **read** path — but no upstream story populates IDB from Sheets for entries. Story 2.6 closes that gap.

This is the only "read every entry from Sheets" path in the app. After hydration, all reads go through `EntriesService.entries()` from IDB; Sheets is only touched on write (Story 2.5) and on explicit re-sync (Epic 3).

### Why `appMeta.hydratedAt` Is a Per-Tab Map (Not a Single Timestamp)

A single `lastHydratedAt: number` would force binary all-or-nothing semantics: either all year tabs hydrated, or none. This breaks AC6 and AC8:

- **AC6 partial-tab failure**: a single tab hitting a quota error must not invalidate the hydration of other tabs that succeeded
- **AC8 deferred-tab retry**: when the user re-opens the app after a network blip, only the failed tab(s) should be re-read — successfully hydrated tabs must be skipped

Per-tab semantics also future-proofs Story 3.6 (legacy 2025 hydration): when 3.6 lands, it writes `hydratedAt['2025'] = { lastHydratedAt, rowCount }` using the same map. No schema migration needed. Story 3.7 (past-year edit/delete) can read the map to confirm a row's tab is hydrated before allowing edit.

The map shape is:

```typescript
type HydratedAtMap = Record<string, HydratedTabRecord>; // tabName → record
interface HydratedTabRecord {
  lastHydratedAt: number;   // Date.now()
  rowCount: number;         // count of LocalEntry rows successfully written, post-mapping
}
```

Stored at IDB key `'hydratedAt'` in the `appMeta` store. Read on every `HydrationService.init()`; the absence of a tab in this map is the signal to hydrate it.

### Deterministic ID Deviation From `crypto.randomUUID()`

Project invariant (Story 2.1): new entries use `crypto.randomUUID()`. This story DEVIATES from that invariant for hydration-only:

- **Row has column-F UUID** → use the UUID directly. The Sheet is the durable source; the UUID was either written by Story 2.5 or by a prior hydration run.
- **Row has no column-F UUID** (e.g. rows authored in the Sheet by hand before 2.5 shipped) → use deterministic id `hydrated-${tabName}-${rowIndex}`. Example: `hydrated-2026-5` for row 5 of the `2026` tab.

**Why deterministic, not random?** Hydration must be idempotent. If we used `crypto.randomUUID()` for column-F-empty rows, a second hydration run would assign a different UUID and we'd duplicate the row in IDB. Using a deterministic id makes `IdbService.put('entries', entry)` safely overwriting on re-run.

This deviation is bounded:
- Only the hydration code path uses deterministic ids
- New entries from `EntriesService.add()` continue to use `crypto.randomUUID()`
- The id format `hydrated-<tab>-<row>` is **distinguishable** from a UUID — making it easy to spot in IDB / tooling and easy for Story 3.7 to detect rows that need a UUID assigned on first edit

This mirrors Story 3.6's `legacy-<tab>-<row>` pattern for 2025 rows. Both are intentional, both are documented as deviations from the random-UUID invariant.

### Row Index Convention

Sheets API rows are 1-indexed and the header is row 1. `readTabDataRows()` uses `A2:F` so the first returned row corresponds to **sheet row 2**. When passing to `mapRowToLocalEntry(tabName, rowIndex, row)`:

- The first data row → `rowIndex = 2`
- The Nth data row → `rowIndex = N + 1`

This matches what `appendRow()` would produce (Story 2.5's `updates.updatedRange` returns the actual row in `'TabName'!A42:F42` form). Using the actual sheet row number means deterministic ids align with Story 3.7's row-resolution logic when it ships.

`HydrationService.hydrate()` is responsible for incrementing `rowIndex` correctly when iterating; `SheetsService.mapRowToLocalEntry` accepts `rowIndex` as a parameter and does not compute it.

### Sequencing — APP_INITIALIZER Chain

Hydration must run after auth, schemaCache load, and categories — and BEFORE the entry list first renders. Existing chain in `app.config.ts`:

```
config.load()
  → auth.init()
  → categories.init()       // seeds categories from Sheet (Story 1.5)
  → entries.init()          // loads existing IDB rows (could be empty on first launch)
  → syncQueue.init()        // loads queue from IDB
  → hydration.init()        // NEW — reads year tabs, populates IDB, refreshes EntriesService signal
```

Why this order:
- **After `auth.init()`**: token must be valid before `SheetsService.listYearTabs()` triggers the auth interceptor
- **After `categories.init()` (which calls `seedFromSheet`)**: hydrated entries reference categories by name; categories must exist in IDB so the entry list renders coloured tiles correctly (categories are referenced by string name on the entry, not by FK, but the CSS custom property injection from Story 1.5 must already have run)
- **After `entries.init()`**: reads existing IDB content into the signal; hydration adds to that signal via `refreshFromIdb()`. Order matters because `refreshFromIdb()` does a full `getAll('entries')` — after hydration writes, the next read includes hydrated rows.
- **Before first `EntriesListComponent` render**: `APP_INITIALIZER` blocks bootstrap. Hydration may take seconds for large sheets — that's why AC5 mandates a progress strip and a non-blocking FAB.

`hydration.init()` must NOT throw. If `SheetsService` is not connected (`connectedSpreadsheetId() === null`), it returns immediately — the user is on `/setup` and `setupGuard` will redirect; hydration will run on the next app boot once setup completes.

### HydrationService Implementation Shape

```typescript
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IdbService } from './idb.service';
import { SheetsService } from './sheets.service';
import { EntriesService } from './entries.service';
import { NotificationService } from './notification.service';
import {
  HydratedTabRecord, HydrationProgress, HydrationTabResult, YEAR_TAB_PATTERN,
} from '../models/sheets.model';
import { AppError } from '../models/error.model';

@Injectable({ providedIn: 'root' })
export class HydrationService {
  private readonly idb = inject(IdbService);
  private readonly sheets = inject(SheetsService);
  private readonly entries = inject(EntriesService);
  private readonly notification = inject(NotificationService);

  private readonly _progress = signal<HydrationProgress>({ type: 'idle' });
  private readonly _lastRunSummary = signal<HydrationTabResult[] | null>(null);

  readonly progress = this._progress.asReadonly();
  readonly lastRunSummary = this._lastRunSummary.asReadonly();

  async init(): Promise<void> {
    try {
      await this.hydrate({ force: false });
    } catch (err) {
      this.notification.showError(this.toError(err));
      // Never rethrow — boot must continue
    }
  }

  async hydrate(opts: { force?: boolean } = {}): Promise<HydrationTabResult[]> {
    const spreadsheetId = this.sheets.connectedSpreadsheetId();
    if (!spreadsheetId) {
      this._progress.set({ type: 'idle' });
      return [];
    }

    const yearTabs = await this.sheets.listYearTabs(spreadsheetId);
    const hydratedAt = (await this.idb.get<Record<string, HydratedTabRecord>>('appMeta', 'hydratedAt')) ?? {};
    const schemaCache = this.sheets.schemaCache();

    const results: HydrationTabResult[] = [];
    const tabsToProcess = yearTabs.filter((t) => {
      const name = t.properties.title;
      if (!opts.force && hydratedAt[name]) {
        results.push({ type: 'skipped', tabName: name, reason: 'already-hydrated' });
        return false;
      }
      if (schemaCache[name] !== '2026') {
        results.push({ type: 'skipped', tabName: name, reason: 'non-2026-schema' });
        return false;
      }
      return true;
    });

    for (let i = 0; i < tabsToProcess.length; i++) {
      const tab = tabsToProcess[i];
      const tabName = tab.properties.title;
      this._progress.set({ type: 'running', tabName, tabIndex: i + 1, tabTotal: tabsToProcess.length });

      try {
        const rows = await firstValueFrom(this.sheets.readTabDataRows(spreadsheetId, tabName));
        let validCount = 0;
        let invalidCount = 0;
        for (let r = 0; r < rows.length; r++) {
          const sheetRowIndex = r + 2; // header is row 1; A2:F starts at row 2
          const entry = this.sheets.mapRowToLocalEntry(tabName, sheetRowIndex, rows[r]);
          if (entry === null) {
            invalidCount++;
            continue;
          }
          await this.idb.put('entries', entry);
          validCount++;
        }

        if (invalidCount > 0) {
          this.notification.showError({
            type: 'SCHEMA_VALIDATION',
            message: `${invalidCount} rows in tab "${tabName}" had unrecognized data and were skipped.`,
            details: undefined as never,
          } satisfies AppError);
        }

        const updatedMap = { ...hydratedAt, [tabName]: { lastHydratedAt: Date.now(), rowCount: validCount } };
        await this.idb.set('appMeta', 'hydratedAt', updatedMap);
        hydratedAt[tabName] = updatedMap[tabName];

        results.push({ type: 'hydrated', tabName, rowCount: validCount });
        await this.entries.refreshFromIdb();
      } catch (err) {
        const appErr = this.toError(err);
        results.push({ type: 'deferred', tabName, error: appErr });
        this.notification.showError(appErr);
        // Do NOT update appMeta.hydratedAt — retry on next boot
      }
    }

    const hydrated = results.filter((r) => r.type === 'hydrated').length;
    const skipped = results.filter((r) => r.type === 'skipped').length;
    const deferred = results.filter((r) => r.type === 'deferred').length;
    this._progress.set({ type: 'complete', hydratedTabs: hydrated, skippedTabs: skipped, deferredTabs: deferred });
    this._lastRunSummary.set(results);
    return results;
  }

  private toError(err: unknown): AppError {
    if (err && typeof err === 'object' && 'type' in err) return err as AppError;
    return { type: 'UNKNOWN_ERROR', message: err instanceof Error ? err.message : String(err) };
  }
}
```

### SheetsService Additions Shape

```typescript
// Add YEAR_TAB_PATTERN to sheets.model.ts:
export const YEAR_TAB_PATTERN = /^\d{4}$/;

// Add to SheetsService:
async listYearTabs(spreadsheetId: string): Promise<SheetsSheetMeta[]> {
  const meta = await firstValueFrom(this.fetchSpreadsheetMeta(spreadsheetId));
  return (meta?.sheets ?? []).filter((s) => YEAR_TAB_PATTERN.test(s.properties.title));
}

readTabDataRows(spreadsheetId: string, tabName: string): Observable<string[][]> {
  const escapedTabName = tabName.replace(/'/g, "''");
  const range = encodeURIComponent(`'${escapedTabName}'!A2:F`);
  const url = `${environment.sheetsApiBaseUrl}/${spreadsheetId}/values/${range}`;
  return this.http.get<SheetsValueRange>(url).pipe(
    map((res) => res?.values ?? []),
    catchError((err: HttpErrorResponse) =>
      throwError(() => ({
        type: 'SHEETS_API',
        status: err.status,
        message: err.status === 429
          ? 'Sheets read quota exceeded — hydration deferred for retry.'
          : `Sheets read error (${err.status}): ${err.message}`,
      }) satisfies AppError),
    ),
  );
}

mapRowToLocalEntry(tabName: string, rowIndex: number, row: string[]): LocalEntry | null {
  // Pad to 6 columns — Sheets API may return shorter arrays for trailing-empty cells
  const cells = [row[0] ?? '', row[1] ?? '', row[2] ?? '', row[3] ?? '', row[4] ?? '', row[5] ?? ''];
  const date = cells[0].trim();
  const category = cells[1].trim();
  const amountRaw = cells[2].trim();
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amountRaw === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!category) return null;

  const remarks = cells[3];
  const month = cells[4].trim() || date.slice(0, 7);
  const uuid = cells[5].trim();
  const id = uuid !== '' ? uuid : `hydrated-${tabName}-${rowIndex}`;

  return {
    id,
    date,
    month,
    year: Number(date.slice(0, 4)),
    category,
    amount,
    remarks,
    tabName,
    schemaVersion: '2026',
    sheetRowIndex: rowIndex,
    syncStatus: 'synced',
    isReadOnly: false,
  };
}
```

**Why pure mapping (`mapRowToLocalEntry`) lives in `SheetsService`, not `HydrationService`:** Story 3.6 will need an analogous `mapLegacyRowToLocalEntry` for 2025 schema. Keeping all row-mapping logic in `SheetsService` (already the boundary owner of the Sheets shape) makes 3.6's extension straightforward — one new method, no cross-service imports.

### EntriesService.refreshFromIdb() Shape

```typescript
// Add to EntriesService:
async refreshFromIdb(): Promise<void> {
  try {
    const all = await this.idb.getAll('entries');
    this._entries.set(all);
  } catch (err) {
    const appErr = this.toIdbError(err);
    this.notification.showError(appErr);
  }
}
```

`init()` should be refactored to call `refreshFromIdb()` internally to avoid drift, but the existing `initPromise` guard remains — `init()` runs at most once per session, while `refreshFromIdb()` can be called repeatedly by `HydrationService` after each tab completes.

### appMeta IDB Keys for This Story

| Key | Type | Set by |
|-----|------|--------|
| `'hydratedAt'` | `Record<string, HydratedTabRecord>` | `HydrationService.hydrate()` per tab |

Read via `IdbService.get<Record<string, HydratedTabRecord>>('appMeta', 'hydratedAt')` — uses existing `appMeta` overload, no new IdbService methods needed.

### AppError Variants Used

This story uses existing variants from `error.model.ts` — **no new variants required**:

- `AppError.SHEETS_API` (status 429, 5xx, etc.) — surfaced when a tab's read fails; tab marked `deferred`
- `AppError.SCHEMA_VALIDATION` — surfaced when individual rows fail row-shape validation; tab continues with partial hydration. (Note: like Story 2.5, the `details: ZodError` slot is filled with `undefined as never` since rows are validated by hand-rolled checks, not a single Zod parse — Story 3.6 may revisit this when adding the legacy mapper.)
- `AppError.UNKNOWN_ERROR` — defensive wrap for unexpected throws inside `HydrationService.hydrate()`

### Story 3.6 / 3.7 Integration Notes

**Story 3.6 (Legacy 2025 entry hydration):**
- 3.6 will add `mapLegacyRowToLocalEntry(tabName, rowIndex, row): LocalEntry` to `SheetsService` for the 4-column 2025 schema
- 3.6 will also extend `HydrationService.hydrate()` to handle `schemaCache[tabName] === '2025'` tabs — the current 2.6 code path skips them with `'non-2026-schema'`; 3.6 changes this to dispatch to the legacy mapper instead
- Legacy rows get `id = legacy-<tabName>-<rowIndex>` (mirrors 2.6's `hydrated-<tabName>-<rowIndex>`) and `isReadOnly: true` (the 2025 tab is intentionally read-only per architecture)
- The per-tab `appMeta.hydratedAt` map handles 2025 tabs identically — no schema change

**Story 3.7 (Past-year edit/delete write-back):**
- 3.7 reuses the rows hydrated by 2.6 for row resolution. When the user edits a row in a past year, 3.7 reads `LocalEntry.tabName` and `LocalEntry.sheetRowIndex` (set by 2.6's `mapRowToLocalEntry`) to construct the Sheets `UPDATE` / `DELETE` API call — without re-reading the Sheet
- 3.7 must handle entries with `id` of the form `hydrated-<tab>-<row>` (no UUID): on first edit, 3.7 should generate a `crypto.randomUUID()`, write the new id to column F via `UPDATE`, and update the IDB row's `id`. This is 3.7's responsibility, not 2.6's — 2.6 only ensures the deterministic id is stable across re-hydrations.

### What Story 2.6 Does NOT Implement

- **Legacy 2025 hydration** — Story 3.6 (per AC2 and scope note)
- **Past-year edit/delete write-back** — Story 3.7
- **Manual re-sync trigger / "Refresh from Sheet" button** — deferred to Epic 3 (`hydrate({ force: true })` is already plumbed through; only the UI trigger is missing)
- **Conflict resolution** — if a UUID-bearing row already exists in IDB with different data than the Sheet, 2.6 silently overwrites IDB. This is correct under the "Sheets is source of truth" architecture; full conflict resolution UX is Epic 3 territory.
- **Streaming progress within a single tab** — progress is per-tab (tabIndex / tabTotal), not per-row. Per-row progress is overkill for typical sheet sizes (< 5000 rows/year) and would add UI churn.
- **Background hydration via service worker** — hydration runs at boot in the foreground. Future enhancement; not in scope.

### Previous Story Patterns to Follow

- **`@Injectable({ providedIn: 'root' })`** on `HydrationService`
- **AppError discriminated union** for all errors — never raw `Error`
- **`NotificationService.showError()`** as the sole snackbar path
- **`IdbService` is the only `idb` importer** — `HydrationService` uses `IdbService` for all reads/writes
- **`firstValueFrom(observable)`** to bridge Observable → Promise
- **`init()` graceful degradation**: do NOT rethrow into `APP_INITIALIZER`; let boot continue — match `EntriesService.init()` and `SyncQueueService.init()`
- **OnPush + standalone** mandatory on `EntriesListComponent`'s progress strip changes
- **`crypto.randomUUID()` only for new entries** — hydration uses sheet-provided UUIDs or deterministic ids (documented deviation above)
- **Run tests via `ng test --watch=false`**
- All imports from local project — no new npm dependencies

### Project Structure Notes

New / modified files follow the established `src/app/core/` layout:
- `src/app/core/services/hydration.service.ts` — NEW
- `src/app/core/services/hydration.service.spec.ts` — NEW
- `src/app/core/services/sheets.service.ts` — ADD `listYearTabs`, `readTabDataRows`, `mapRowToLocalEntry`
- `src/app/core/services/sheets.service.spec.ts` — ADD tests for the three new methods
- `src/app/core/services/entries.service.ts` — ADD `refreshFromIdb()`
- `src/app/core/services/entries.service.spec.ts` — ADD test for `refreshFromIdb()`
- `src/app/core/models/sheets.model.ts` — ADD `YEAR_TAB_PATTERN`, `HydratedTabRecord`, `HydrationProgress`, `HydrationTabResult`
- `src/app/app.config.ts` — EXTEND `APP_INITIALIZER` chain with `hydration.init()`
- `src/app/features/entries-list/entries-list.component.ts` — ADD progress strip rendering bound to `HydrationService.progress`
- `src/app/features/entries-list/entries-list.component.html` — ADD `@if (progress().type === 'running')` block
- `src/app/features/entries-list/entries-list.component.spec.ts` — ADD progress rendering test

### Testing Guidance

Use Vitest. Test file: `src/app/core/services/hydration.service.spec.ts`

Mock shape:
```typescript
let idbSpy: { get: vi.fn(); set: vi.fn(); put: vi.fn(); getAll: vi.fn(); };
let sheetsSpy: {
  connectedSpreadsheetId: vi.fn();
  schemaCache: vi.fn();
  listYearTabs: vi.fn();
  readTabDataRows: vi.fn();    // returns Observable
  mapRowToLocalEntry: vi.fn();
};
let entriesSpy: { refreshFromIdb: vi.fn(); };
let notificationSpy: { showError: vi.fn(); };
```

Use `of(rows)` from `rxjs` for `readTabDataRows` mock returns; use `throwError(() => err)` for failures.

### References

- Story 2.5 (UUID idempotency in column F): [Source: `_bmad-output/implementation-artifacts/2-5-syncqueue-insert-write-new-entries-to-google-sheets.md`]
- Story 1.4 (sheet discovery + schemaCache seed): [Source: `_bmad-output/implementation-artifacts/1-4-first-run-setup-and-google-sheets-discovery.md`]
- Story 1.5 (categories from Sheet — same `seedFromSheet` pattern): [Source: `_bmad-output/implementation-artifacts/1-5-category-registry-seeding-and-css-custom-property-injection.md`]
- Story 2.1 (`EntriesService` IDB CRUD pattern): [Source: `_bmad-output/implementation-artifacts/2-1-entriesservice-idb-crud-and-optimistic-signal-update.md`]
- Story 2.3 (`EntriesListComponent`, `EmptyState` pattern): [Source: `_bmad-output/implementation-artifacts/2-3-entry-list-view-and-entryrowcomponent.md`]
- Architecture data flow (IDB-first, Sheets durable): [Source: `_bmad-output/planning-artifacts/architecture.md` lines 184–220, 855–887]
- `LocalEntry` interface: [Source: `src/app/core/models/entry.model.ts`]
- `AppError` discriminated union: [Source: `src/app/core/models/error.model.ts`]
- `IdbService` overloads: [Source: `src/app/core/services/idb.service.ts`]
- `SheetsService` existing methods (`fetchSpreadsheetMeta`, `schemaCache`, `getActive2026TabName`): [Source: `src/app/core/services/sheets.service.ts`]
- `EntriesService.init()` pattern: [Source: `src/app/core/services/entries.service.ts:25`]
- `APP_INITIALIZER` chain: [Source: `src/app/app.config.ts:32`]
- Test runner command: `ng test --watch=false`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation matched spec without deviations.

### Completion Notes List

- Implemented `HydrationService` with `init()` / `hydrate()` / `progress` / `lastRunSummary` per spec
- Added `listYearTabs()`, `readTabDataRows()`, `mapRowToLocalEntry()` to `SheetsService`
- Added `YEAR_TAB_PATTERN`, `HydratedTabRecord`, `HydrationProgress`, `HydrationTabResult` to `sheets.model.ts`
- `EntriesService.init()` refactored to delegate to new `refreshFromIdb()` method
- `APP_INITIALIZER` chain extended: `syncQueue.init() → hydration.init()`
- `EntriesListComponent` shows `mat-progress-bar` + per-tab text strip when hydration is `running`; `EmptyState` shown only when `idle` + no entries
- 397 unit tests pass (26 spec files); 30 net-new tests added
- No new npm dependencies

### File List

- `src/app/core/models/sheets.model.ts` — added `YEAR_TAB_PATTERN`, `HydratedTabRecord`, `HydrationProgress`, `HydrationTabResult`
- `src/app/core/services/sheets.service.ts` — added `listYearTabs()`, `readTabDataRows()`, `mapRowToLocalEntry()`
- `src/app/core/services/sheets.service.spec.ts` — added tests for `listYearTabs`, `readTabDataRows`, `mapRowToLocalEntry` (14 new tests)
- `src/app/core/services/hydration.service.ts` — NEW service
- `src/app/core/services/hydration.service.spec.ts` — NEW spec (13 tests)
- `src/app/core/services/entries.service.ts` — added `refreshFromIdb()`, refactored `init()`
- `src/app/core/services/entries.service.spec.ts` — added `refreshFromIdb()` tests (3 new tests)
- `src/app/app.config.ts` — wired `HydrationService` into `APP_INITIALIZER`
- `src/app/features/entries-list/entries-list.component.ts` — injected `HydrationService`, added `MatProgressBarModule`
- `src/app/features/entries-list/entries-list.component.html` — added progress strip template
- `src/app/features/entries-list/entries-list.component.spec.ts` — added hydration progress tests (3 new tests)
- `src/app/features/entries-list/entries-list.component.html` — added `data-testid` attributes: `hydration-progress`, `empty-state`, `entry-row`
- `e2e/support/idb-helpers.ts` — added `idbPutAppMeta()` and `idbGetAppMeta()` helpers
- `e2e/hydration.spec.ts` — NEW E2E spec: 4 tests (H-01 through H-04) covering IDB-seeded entries visible, full hydration flow, already-hydrated skip, and empty state

### Review Findings

- [x] [Review][Patch] `HydrationTabResult.invalid` variant never instantiated — `hydrate()` notifies on malformed rows but never pushes `{ type: 'invalid' }` to results, leaving `lastRunSummary` without the invalid record (spec task line 88, AC6) [hydration.service.ts:~81]
- [x] [Review][Patch] No concurrency guard on `hydrate()` — concurrent or rapid re-invocations (e.g. future manual re-sync button from Epic 3) cause duplicate IDB writes, duplicate `refreshFromIdb()` calls, and a race on `appMeta.hydratedAt` write-back [hydration.service.ts:~36]
- [x] [Review][Defer] `refreshFromIdb()` called once per tab (O(N tabs) full scans) [hydration.service.ts:~90] — deferred, spec-intended: "call `EntriesService.refreshFromIdb()` once per tab to merge into the live signal"
- [x] [Review][Defer] Tabs absent from `schemaCache` skipped with misleading reason `'non-2026-schema'` [hydration.service.ts:~50] — deferred, design intent: only tabs confirmed '2026' in schemaCache are hydrated; newly-added tabs picked up on next manual re-sync (Epic 3)
- [x] [Review][Defer] `listYearTabs()` / `fetchSpreadsheetMeta()` rate-limit 429 produces generic error message vs explicit quota message in `readTabDataRows()` [sheets.service.ts:~263] — deferred, pre-existing architectural gap; consistent boot-continues pattern
- [x] [Review][Defer] E2E helpers hardcode DB name/version `'expense-dashboard'/1` [e2e/support/idb-helpers.ts] — deferred, currently correct at v1; export constants from IdbService when version bumps
- [x] [Review][Defer] Schema version mismatch undetectable mid-hydration (cached '2026' but headers changed in Sheet) [hydration.service.ts:~44] — deferred, Story 3.6 territory; individual row validation in `mapRowToLocalEntry` provides partial protection

## Change Log

- 2026-05-09: Story drafted. Closes the PRD/architecture hydration gap — IDB-as-UI-source-of-truth requires populating IDB from the canonical Sheet on first connect, especially for users switching devices or reinstalling. Per-tab `appMeta.hydratedAt` map enables partial hydration and per-tab retry. Deterministic `hydrated-<tab>-<row>` ids preserve idempotency for rows lacking column-F UUIDs (mirrors Story 3.6's `legacy-<tab>-<row>` pattern). Sequenced after `entries.init()` and `categories.init()` in `APP_INITIALIZER`; runs before first `EntriesListComponent` render with non-blocking FAB and a per-tab progress strip.
- 2026-05-10: Implementation complete. All 9 ACs satisfied. 26 spec files, 397 tests pass. No regressions.
- 2026-05-10: Added E2E spec `e2e/hydration.spec.ts` (4 tests: IDB-seeded entries, full hydration from mocked Sheets, already-hydrated skip, empty state). Added `data-testid` attributes to `entries-list.component.html`. Extended `idb-helpers.ts` with `idbPutAppMeta` and `idbGetAppMeta`.
- 2026-05-10: Code review (Blind Hunter/Sally, Edge Case Hunter/Winston, Acceptance Auditor/Amelia). Two patches applied: (1) `HydrationTabResult.invalid` now instantiated and pushed to results when malformed rows are found — `lastRunSummary` now surfaces the invalid record per AC6 and spec task line 88; (2) concurrency guard added via `_hydrating` flag — concurrent `hydrate()` calls return `[]` immediately, protecting against duplicate IDB writes and `appMeta` race conditions. One new test added for concurrency guard; existing partial-hydration test strengthened to assert `{ type: 'invalid' }` in results. 398 tests pass. Story promoted to `done`.
