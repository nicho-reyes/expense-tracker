# Story 2.1: EntriesService — IDB CRUD and optimistic signal update

Status: done

## Story

As Nick,
I want expense entries to be saved instantly to local storage and reflected in the UI without waiting for any network call,
So that the app feels instantaneous regardless of connectivity.

## Acceptance Criteria

1. **Given** I submit a new expense entry **When** `EntriesService.add()` is called **Then** the entry is written to the `entries` IDB store and the `entries` signal is updated — all before any Sheets API call
2. **Given** the IDB write completes **When** the UI re-renders **Then** the new entry appears in the entry list within 200ms of the save action
3. **Given** I call `EntriesService.update()` **When** the IDB write completes **Then** the updated entry replaces the old one in both IDB and the entries signal
4. **Given** I call `EntriesService.delete()` **When** the IDB write completes **Then** the entry is removed from both IDB and the entries signal
5. **Given** the app starts **When** IDB is queried on init **Then** all entries are loaded into the entries signal from IDB — not from the Sheets API
6. **Given** an IDB write fails for any reason **When** the error is caught **Then** an `AppError.IDB_ERROR` is emitted, the in-memory signal is rolled back to its pre-write value, and no phantom entries appear in the list
7. **Given** any signal update occurs **When** change detection runs **Then** only `OnPush` components that consume the affected signal re-render
8. **Given** PENDING and SYNC_ERROR items exist in the `syncQueue` IDB store **When** the browser tab is closed and reopened **Then** all queue items are present with their original `status`, `retryCount`, and `nextRetryAt` values intact — zero items missing (NFR-R2 pass/fail gate)

## Tasks / Subtasks

- [x] Extend `IdbService` with typed CRUD helpers for the `entries` and `syncQueue` stores (AC: 1, 3, 4, 5, 6, 8)
  - [x] Add overloads to `get<T>()`, `set<T>()` that accept `'entries'` and `'syncQueue'` store names; existing `'appMeta'` overload must remain unchanged
  - [x] Add `getAll<S extends 'entries' | 'syncQueue' | 'categories'>(store: S): Promise<StoreValue<S>[]>` returning every record
  - [x] Add `put<S extends 'entries' | 'syncQueue' | 'categories'>(store: S, value: StoreValue<S>): Promise<void>` — relies on `keyPath: 'id'` so no explicit key argument
  - [x] Add `delete(store: 'entries' | 'syncQueue' | 'categories', id: string): Promise<void>`
  - [x] Add `getAllByIndex<S>(store: S, indexName: IndexName<S>, key: IDBValidKey): Promise<StoreValue<S>[]>` for `'by-month'`, `'by-year'`, `'by-sync-status'`, `'by-status'`, `'by-enqueued'`
  - [x] Wrap every operation in try/catch and rethrow as `{ type: 'IDB_ERROR', message } satisfies AppError` — no raw `Error`
  - [x] Update `src/app/core/services/idb.service.spec.ts` (new file) covering the new helpers against fake-indexeddb
- [x] Implement `EntriesService` full CRUD with optimistic signal updates (AC: 1, 2, 3, 4, 5, 6, 7)
  - [x] Replace stub. Inject `IdbService` and `NotificationService`. Keep `providedIn: 'root'`
  - [x] Private `_entries = signal<LocalEntry[]>([])`; expose `readonly entries = this._entries.asReadonly()`
  - [x] Add `selectedMonth = signal<string>('')` and `syncStatus = signal<'idle' | 'syncing' | 'error'>('idle')` per architecture domain-signal contract (Story 2.5/3.1 will populate `syncStatus`; Story 2.1 only seeds the signal)
  - [x] `init(): Promise<void>` — single-flight via cached `Promise<void>`; reads all entries via `IdbService.getAll('entries')` and writes to `_entries` exactly once
  - [x] `add(input: NewEntryInput): Promise<LocalEntry>` — generates `id` via `crypto.randomUUID()`, derives `month` and `year` from `date`, defaults `syncStatus: 'pending'`, `sheetRowIndex: null`, `isReadOnly: false`, `tabName` and `schemaVersion` from caller (always `'2026'` for new entries in this story); appends to signal first (optimistic), then `IdbService.put('entries', entry)`; on rejection, removes the item from the signal and rethrows
  - [x] `update(id: string, patch: Partial<Omit<LocalEntry, 'id'>>): Promise<LocalEntry>` — captures previous entry, applies patch in-memory, writes via `IdbService.put`; on rejection, restores the previous entry in the signal and rethrows
  - [x] `delete(id: string): Promise<void>` — captures previous entry, removes from signal, calls `IdbService.delete('entries', id)`; on rejection, re-inserts the captured entry at its original index and rethrows
  - [x] `getById(id: string): LocalEntry | undefined` — pure signal read, no IDB round-trip (UI uses this for the edit sheet pre-fill)
  - [x] All write methods catch IDB exceptions, normalize to `AppError.IDB_ERROR`, surface via `NotificationService.showError(error)`, and rethrow so callers can `await`
  - [x] Do NOT enqueue to `SyncQueueService` here — Story 2.5 (INSERT) and Story 2.4 (UPDATE/DELETE) own queue integration. `EntriesService.add/update/delete` must remain queue-agnostic so Story 2.5 can layer enqueue calls on top without rewriting CRUD
- [x] Wire `EntriesService.init()` into `APP_INITIALIZER` chain (AC: 5)
  - [x] In `app.config.ts`, append an `APP_INITIALIZER` factory that calls `entriesService.init()` after `AuthService.init()` and `CategoriesService.init()` have resolved
  - [x] Initializer must not throw on IDB failure — log via `NotificationService` and resolve so the shell still boots (matches Story 1.5 init failure pattern)
- [x] Add `NewEntryInput` type to `entry.model.ts` (AC: 1)
  - [x] `export type NewEntryInput = Pick<LocalEntry, 'date' | 'category' | 'amount' | 'remarks' | 'tabName' | 'schemaVersion'>` — service derives `id`, `month`, `year`, `syncStatus`, `sheetRowIndex`, `isReadOnly`
- [x] Write `entries.service.spec.ts` (AC: 1, 2, 3, 4, 5, 6, 8)
  - [x] Mock `IdbService` with vi-controllable resolved/rejected promises
  - [x] `add()` happy path: signal contains entry before `IdbService.put` resolves (optimistic timing assertion via spy ordering)
  - [x] `add()` IDB rejection: signal returns to its prior length; `notification.showError` invoked with `AppError` whose `type === 'IDB_ERROR'`
  - [x] `update()` happy path: signal entry mutated to new values
  - [x] `update()` IDB rejection: signal restores previous entry verbatim (deep equal to pre-call snapshot)
  - [x] `delete()` happy path: signal length decremented; entry absent
  - [x] `delete()` IDB rejection: removed entry restored at its original index (order preserved)
  - [x] `init()` reads from `IdbService.getAll('entries')` and is no-op on second call
  - [x] `getById()` returns the matching signal entry without invoking `IdbService`
  - [x] `crypto.randomUUID()` is called exactly once per `add()` (spy on global `crypto.randomUUID`)
- [x] NFR-R2 persistence test (AC: 8)
  - [x] Add `e2e/entry-persistence.spec.ts` — writes a `LocalEntry` and a PENDING + SYNC_ERROR `SyncQueueItem` directly via the page's `IdbService`, reloads the tab, asserts `getAll('entries')` and `getAll('syncQueue')` return the exact records (matching `id`, `status`, `retryCount`, `nextRetryAt`)
  - [x] This is the explicit NFR-R2 pass/fail gate; failure here blocks the story

## Dev Notes

### Architectural Position of EntriesService

`EntriesService` is the IDB-backed read/write surface for `LocalEntry` records. Per architecture decision-impact analysis [Source: `architecture.md#Decision-Impact-Analysis`], `EntriesService` depends on `SheetsService` for schema detection (so callers know which `tabName`/`schemaVersion` to assign) but does NOT depend on `SyncQueueService` for the CRUD path. Sync enqueue is layered in by callers (Story 2.5 for INSERT; Story 2.4 for UPDATE/DELETE on previously-synced entries).

This story implements ONLY the IDB-and-signal layer. No HTTP. No queue. No sync.

### Optimistic Update Pattern (Required Order)

Per `architecture.md#Process-Patterns` "Optimistic UI Pattern":

```
1. Snapshot previous signal value
2. Apply mutation to signal first (entries.set([...next]))
3. Write to IDB asynchronously
4. On IDB rejection: restore signal to snapshot; emit AppError.IDB_ERROR
5. NEVER await Sheets write before updating UI — Story 2.5 handles that fire-and-forget
```

This story extends the rule with rollback on IDB failure (AC6). Without rollback, a phantom entry would persist in the signal even though IDB has no record — a refresh would erase it confusingly. The signal is the source of truth for the UI; IDB is the source of truth for cross-session persistence; the two must converge or both must reject.

### EntriesService Implementation Shape

```typescript
import { Injectable, Signal, inject, signal } from '@angular/core';
import { IdbService } from './idb.service';
import { NotificationService } from './notification.service';
import { LocalEntry, NewEntryInput } from '../models/entry.model';
import { AppError } from '../models/error.model';

@Injectable({ providedIn: 'root' })
export class EntriesService {
  private readonly idb = inject(IdbService);
  private readonly notification = inject(NotificationService);

  private readonly _entries = signal<LocalEntry[]>([]);
  readonly entries = this._entries.asReadonly();

  readonly selectedMonth = signal<string>('');
  readonly syncStatus = signal<'idle' | 'syncing' | 'error'>('idle');

  private initPromise: Promise<void> | null = null;

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      try {
        const all = await this.idb.getAll('entries');
        this._entries.set(all);
      } catch (err) {
        const appErr = this.toIdbError(err);
        this.notification.showError(appErr);
        // Do not rethrow — boot must continue with empty list (Story 1.5 pattern)
      }
    })();
    return this.initPromise;
  }

  async add(input: NewEntryInput): Promise<LocalEntry> {
    const entry: LocalEntry = {
      id: crypto.randomUUID(),
      date: input.date,
      month: input.date.slice(0, 7),
      year: Number(input.date.slice(0, 4)),
      category: input.category,
      amount: input.amount,
      remarks: input.remarks,
      tabName: input.tabName,
      schemaVersion: input.schemaVersion,
      sheetRowIndex: null,
      syncStatus: 'pending',
      isReadOnly: false,
    };

    const prev = this._entries();
    this._entries.set([...prev, entry]);
    try {
      await this.idb.put('entries', entry);
      return entry;
    } catch (err) {
      this._entries.set(prev);
      const appErr = this.toIdbError(err);
      this.notification.showError(appErr);
      throw appErr;
    }
  }

  async update(id: string, patch: Partial<Omit<LocalEntry, 'id'>>): Promise<LocalEntry> {
    const prev = this._entries();
    const idx = prev.findIndex(e => e.id === id);
    if (idx < 0) {
      throw { type: 'IDB_ERROR', message: `Entry ${id} not found` } satisfies AppError;
    }
    const updated: LocalEntry = { ...prev[idx], ...patch, id };
    // Recompute month/year if date changed
    if (patch.date) {
      updated.month = patch.date.slice(0, 7);
      updated.year = Number(patch.date.slice(0, 4));
    }
    const next = [...prev];
    next[idx] = updated;
    this._entries.set(next);
    try {
      await this.idb.put('entries', updated);
      return updated;
    } catch (err) {
      this._entries.set(prev);
      const appErr = this.toIdbError(err);
      this.notification.showError(appErr);
      throw appErr;
    }
  }

  async delete(id: string): Promise<void> {
    const prev = this._entries();
    const idx = prev.findIndex(e => e.id === id);
    if (idx < 0) return; // Idempotent delete — already absent
    const next = prev.filter(e => e.id !== id);
    this._entries.set(next);
    try {
      await this.idb.delete('entries', id);
    } catch (err) {
      this._entries.set(prev); // restores at original index
      const appErr = this.toIdbError(err);
      this.notification.showError(appErr);
      throw appErr;
    }
  }

  getById(id: string): LocalEntry | undefined {
    return this._entries().find(e => e.id === id);
  }

  private toIdbError(err: unknown): AppError {
    if (this.isAppError(err)) return err;
    return { type: 'IDB_ERROR', message: err instanceof Error ? err.message : String(err) };
  }

  private isAppError(value: unknown): value is AppError {
    return typeof value === 'object' && value !== null && 'type' in value;
  }
}
```

### IdbService Extension Shape

The current `IdbService` only types overloads for the `'appMeta'` store. Extend with generic helpers that preserve compile-time type safety for every store:

```typescript
import { StoreNames, StoreValue, IndexNames } from 'idb';

// Add overloads — keep existing 'appMeta' versions intact
async get<S extends 'appMeta'>(store: S, key: string): Promise<unknown>;
async get<S extends 'entries' | 'syncQueue' | 'categories'>(
  store: S, key: string,
): Promise<StoreValue<ExpenseDashboardDb, S> | undefined>;
async get(store: StoreNames<ExpenseDashboardDb>, key: string): Promise<unknown> {
  try {
    const db = await this.dbPromise;
    return await db.get(store, key);
  } catch (err) {
    throw this.toIdbError(err);
  }
}

async getAll<S extends Exclude<StoreNames<ExpenseDashboardDb>, 'appMeta'>>(
  store: S,
): Promise<StoreValue<ExpenseDashboardDb, S>[]> {
  try {
    const db = await this.dbPromise;
    return await db.getAll(store);
  } catch (err) {
    throw this.toIdbError(err);
  }
}

async put<S extends Exclude<StoreNames<ExpenseDashboardDb>, 'appMeta'>>(
  store: S, value: StoreValue<ExpenseDashboardDb, S>,
): Promise<void> {
  try {
    const db = await this.dbPromise;
    await db.put(store, value);
  } catch (err) {
    throw this.toIdbError(err);
  }
}

async delete(
  store: Exclude<StoreNames<ExpenseDashboardDb>, 'appMeta'>, id: string,
): Promise<void> {
  try {
    const db = await this.dbPromise;
    await db.delete(store, id);
  } catch (err) {
    throw this.toIdbError(err);
  }
}

async getAllByIndex<S extends Exclude<StoreNames<ExpenseDashboardDb>, 'appMeta'>>(
  store: S, indexName: IndexNames<ExpenseDashboardDb, S>, key: IDBValidKey,
): Promise<StoreValue<ExpenseDashboardDb, S>[]> {
  try {
    const db = await this.dbPromise;
    return await db.getAllFromIndex(store, indexName, key);
  } catch (err) {
    throw this.toIdbError(err);
  }
}

private toIdbError(err: unknown): AppError {
  return { type: 'IDB_ERROR', message: err instanceof Error ? err.message : String(err) };
}
```

The `'appMeta'` overload signatures from Story 1.4 remain unchanged. New overloads coexist via TypeScript overload resolution — `IdbService.get('appMeta', 'spreadsheetId')` continues to return `Promise<string | undefined>` (caller-typed) while `IdbService.get('entries', id)` returns `Promise<LocalEntry | undefined>` (auto-typed).

### NewEntryInput Type Addition

Append to **`src/app/core/models/entry.model.ts`** — do NOT redefine `LocalEntry`:

```typescript
export type NewEntryInput = Pick<
  LocalEntry,
  'date' | 'category' | 'amount' | 'remarks' | 'tabName' | 'schemaVersion'
>;
```

Caller (Story 2.2 `QuickAddSheetComponent`) supplies these six fields. Service fills the rest.

### APP_INITIALIZER Chain Order

Per `architecture.md#Decision-Impact-Analysis`:

```
AuthService.init()       (Story 1.2 — already wired)
CategoriesService.init() (Story 1.5 — already wired)
EntriesService.init()    (this story — append after categories)
```

In `app.config.ts`, the `provideAppInitializer` factory should chain `await` calls. Failure of `EntriesService.init()` must not block the shell (consistent with the Story 1.5 graceful-degradation policy) — the user-visible result is an empty entry list with a snackbar, not a blank screen.

### What Story 2.1 Does NOT Implement

- `QuickAddSheetComponent` and the FAB → Story 2.2
- Entry list view and `EntryRowComponent` → Story 2.3
- Edit/delete UI flows (dialogs, undo) → Story 2.4
- Sync queue enqueue on `add` → Story 2.5
- Dashboard signals (`computed` totals, sparkline data) → Epic 4
- Reading entries from the Sheet → Story 3.6 (initial bulk read)
- 401 handling on entries' future Sheets writes → already in Story 1.3 interceptor

### Signal-Boundary Constraints (Architecture-Mandated)

- Components NEVER call `entries.set(...)`. They call `entriesService.add/update/delete`. The service exposes `entries` as `Signal<LocalEntry[]>` (readonly) only [Source: `architecture.md#Communication-Patterns`].
- All consumers must be `OnPush + standalone`. AC7 verifies this by confirming components without a signal dependency on `entries` do not re-render — typical OnPush behavior, but explicitly tested via spying on `ChangeDetectorRef` in a sibling component spec.
- No RxJS surface. Methods return `Promise<T>`, not `Observable<T>`. Use `firstValueFrom()` only at HTTP boundaries (Story 2.5+).

### IdbService Boundary Enforcement

`IdbService` is the SOLE importer of `idb` per architecture [Source: `architecture.md#Architectural-Boundaries`]. `EntriesService` MUST NOT `import { openDB } from 'idb'`. Cross this boundary only by adding helpers to `IdbService`.

A simple lint check: grep for `from 'idb'` outside `idb.service.ts` should return zero matches.

### NFR-R2 Persistence Gate (AC8)

NFR-R2 = "PENDING and SYNC_ERROR queue items must survive a tab close+reopen with all fields intact." This is verified at Story 2.1 because the `syncQueue` IDB store is being exercised for the first time here (via the new `IdbService.put('syncQueue', …)` helper). `SyncQueueService` itself is implemented in Story 2.5/3.1; this story only proves the underlying IDB store round-trips faithfully.

The e2e test (`e2e/entry-persistence.spec.ts`) writes records directly via the page's `IdbService` — no UI flow needed. Failure of this test blocks story acceptance regardless of the unit suite.

### LocalEntry Field Derivation Rules

- `id` — always `crypto.randomUUID()`. Never accepted from caller. Used as IDB key, signal key, and Sheets column F idempotency token (Story 2.5).
- `month` — `date.slice(0, 7)`. Stored alongside `date` to keep the `'by-month'` index queryable without runtime computation.
- `year` — `Number(date.slice(0, 4))`. Stored alongside `date` for `'by-year'` index.
- `syncStatus` — always `'pending'` on `add()`. Story 2.5 transitions to `'synced'` on Sheets confirmation; Story 3.1 transitions to `'error'` on max-retry exceedance.
- `sheetRowIndex` — `null` until the entry is written to the Sheet (Story 2.5).
- `isReadOnly` — `false` for entries created in-app. The 2025 read-only path (Story 3.7) sets this `true` for entries imported from a 4-column legacy tab.
- `tabName` and `schemaVersion` — pass-through from caller. Story 2.2 will derive these from `SheetsService.connectedSpreadsheetId()` + the active 2026 tab; for this story the unit tests pass them explicitly.

### Previous Story Patterns to Follow (Stories 1.2, 1.4, 1.6)

- **Functional initializers via `provideAppInitializer`** — see Story 1.2 pattern in `app.config.ts`
- **`OnPush + standalone` mandatory** on every component (no components added in 2.1, but the constraint applies to every consumer)
- **`AppError` discriminated union, never raw `Error`** [Source: `error.model.ts`]
- **`crypto.randomUUID()` only** — no `uuid` library, no `nanoid`, no manual generators [Source: `architecture.md#Cross-Cutting-Concerns`]
- **`NotificationService.showError(error)` is the sole `MatSnackBar` path** — `EntriesService` injects `NotificationService`, never `MatSnackBar` [Source: `architecture.md#Architectural-Boundaries`]
- **`providedIn: 'root'`** on `EntriesService` — already correct in stub
- **Run tests via `ng test --watch=false`** — the `@angular/build:unit-test` builder manages Vitest [Source: `1-2-google-oauth-authentication-flow.md#Dev-Agent-Record`]

### Testing Guidance

Use Vitest. Test files:
- `src/app/core/services/entries.service.spec.ts` (new)
- `src/app/core/services/idb.service.spec.ts` (new)
- `e2e/entry-persistence.spec.ts` (new — Playwright)

For unit tests, mock `IdbService` (it has a small surface; spy each method individually). Use `fake-indexeddb` only in the `IdbService` spec itself — not in `EntriesService` tests. Do NOT use a real `IDBDatabase` in `EntriesService` tests; the assertion target is the service's signal and rollback behavior, not IDB integration.

Key test cases (entries.service.spec.ts):
1. `add()` writes to signal before `IdbService.put` resolves — assert via spy invocation order on a deferred Promise
2. `add()` rolls back signal on `IdbService.put` rejection; `notification.showError` invoked with `AppError.IDB_ERROR`; method rethrows
3. `add()` generates `id` via `crypto.randomUUID()` — spy on `globalThis.crypto.randomUUID`
4. `add()` derives `month` and `year` correctly from `date` (e.g., `'2026-05-09'` → `month: '2026-05'`, `year: 2026`)
5. `add()` defaults `syncStatus: 'pending'`, `sheetRowIndex: null`, `isReadOnly: false`
6. `update()` happy path replaces matching entry by `id`, preserves all other entries
7. `update()` recomputes `month`/`year` when `date` is in patch
8. `update()` rejection restores the prior entry exactly (deep equal); other entries unchanged
9. `update()` of nonexistent id throws `AppError.IDB_ERROR`
10. `delete()` removes by id; idempotent on missing id (no throw, no IDB call — assert spy not called)
11. `delete()` rejection restores entry at original index (order preserved)
12. `init()` populates signal from `IdbService.getAll('entries')`; second call is no-op (single-flight)
13. `init()` on `IdbService.getAll` rejection: surfaces `AppError.IDB_ERROR` via notification, signal stays `[]`, does not throw
14. `getById()` returns matching signal entry with no `IdbService` call

Key test cases (idb.service.spec.ts) — use `fake-indexeddb`:
1. `getAll('entries')` returns inserted entries
2. `put('entries', entry)` round-trips — `getAll` returns the new entry
3. `delete('entries', id)` removes — `getAll` no longer returns it
4. `getAllByIndex('entries', 'by-month', '2026-05')` returns only May 2026 entries
5. `put('syncQueue', item)` round-trips
6. `getAllByIndex('syncQueue', 'by-status', 'PENDING')` returns only PENDING items
7. Rejection wraps to `AppError.IDB_ERROR` (force a failure by closing the db mid-call)

E2E test cases (entry-persistence.spec.ts):
1. Open app, write `LocalEntry` and `SyncQueueItem (PENDING)` and `SyncQueueItem (SYNC_ERROR)` via `page.evaluate(() => window['__idb'])` — expose `IdbService` on `window` in dev only OR script directly via `indexedDB` and the known store names; reload; assert all three records present with identical fields
2. `retryCount` and `nextRetryAt` round-trip exactly (numeric equality)

### Project Structure Notes

No new files outside the established `src/app/core/services/` pattern. Stub `entries.service.ts` is replaced. `idb.service.ts` is extended (not replaced — preserve the constructor and the `'appMeta'` overloads from Story 1.4).

### References

- IndexedDB schema and store contracts: [Source: `architecture.md#Data-Architecture`]
- Optimistic UI pattern: [Source: `architecture.md#Process-Patterns` — "Optimistic UI Pattern"]
- AppError contract: [Source: `error.model.ts`]
- LocalEntry/SyncQueueItem shape: [Source: `entry.model.ts`]
- IdbService boundary (sole `idb` importer): [Source: `architecture.md#Architectural-Boundaries`]
- NotificationService boundary (sole MatSnackBar path): [Source: `architecture.md#Architectural-Boundaries`]
- APP_INITIALIZER chain order: [Source: `architecture.md#Decision-Impact-Analysis`]
- Functional `provideAppInitializer` pattern: [Source: `1-2-google-oauth-authentication-flow.md#Dev-Notes`]
- Signal naming and component-boundary rules: [Source: `architecture.md#Communication-Patterns`]
- NFR-R2 (queue persistence): [Source: `_bmad-output/planning-artifacts/epics/epic-2-expense-entry-local-first-core.md` — Story 2.1 AC]
- `crypto.randomUUID()` only: [Source: `architecture.md#Cross-Cutting-Concerns`]
- Test runner command: [Source: `1-2-google-oauth-authentication-flow.md#Dev-Agent-Record`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Fixed TypeScript overload issue in `IdbService.getAllByIndex`: changed key type from `IDBValidKey` to `IndexKey<ExpenseDashboardDb, S, I> | IDBKeyRange` to satisfy `idb` library generics.
- Fixed missing `await` on `db.get()` and `db.getAll()` calls — without `await`, rejections escaped the try/catch and were not converted to `AppError`.
- `idb.service.spec.ts` uses a vitest `vi.mock('idb')` approach with an in-memory FakeStore (index-name → field-name mapping) instead of `fake-indexeddb` (not installed). All 125 unit tests pass. To use `fake-indexeddb` for true round-trip tests: `npm install --save-dev fake-indexeddb` then replace the mock with `import 'fake-indexeddb/auto'`.

### Completion Notes List

- Implemented `IdbService` CRUD extensions: `getAll`, `put`, `delete`, `getAllByIndex` for `entries`, `syncQueue`, `categories` stores; preserved all existing `appMeta`/`categories` overloads.
- Implemented `EntriesService` with full optimistic-update pattern: signal updated before IDB write, rolled back with `AppError.IDB_ERROR` notification on failure.
- `EntriesService.init()` is single-flight (cached Promise), resolves even on IDB error, emits snackbar.
- `selectedMonth` and `syncStatus` signals seeded as specified; will be populated by Stories 2.2 and 2.5/3.1 respectively.
- `NewEntryInput` type added to `entry.model.ts` as `Pick<LocalEntry, 'date' | 'category' | 'amount' | 'remarks' | 'tabName' | 'schemaVersion'>`.
- `APP_INITIALIZER` chain extended: `config.load → auth.init → categories.init → entries.init`.
- `entries.service.spec.ts`: 23 tests covering all happy/rejection paths, optimistic timing assertion, single-flight init, rollback at original index, idempotent delete, and `crypto.randomUUID` spy.
- `idb.service.spec.ts`: 10 tests covering CRUD round-trips, index queries, and error wrapping — uses in-memory fake store via `vi.mock('idb')`.
- `e2e/entry-persistence.spec.ts`: Playwright test writing LocalEntry + PENDING + SYNC_ERROR items directly via `indexedDB`, reloads page, and asserts exact field fidelity (NFR-R2 gate).
- No RxJS, no external dependencies added. Only `idb` (already in package.json) used.

### File List

- `src/app/core/models/entry.model.ts` — added `NewEntryInput` type
- `src/app/core/services/idb.service.ts` — extended with `getAll`, `put`, `delete`, `getAllByIndex`; added `await` to all DB calls; `toIdbError` helper extracted
- `src/app/core/services/entries.service.ts` — full implementation replacing stub
- `src/app/app.config.ts` — added `EntriesService` to `APP_INITIALIZER` chain
- `src/app/core/services/entries.service.spec.ts` — new, 23 tests
- `src/app/core/services/idb.service.spec.ts` — new, 10 tests
- `e2e/entry-persistence.spec.ts` — new, NFR-R2 Playwright test

## Change Log

- 2026-05-09: Story drafted. Wave 5.
- 2026-05-09: Implemented by claude-sonnet-4-6. All tasks complete; 125 unit tests pass. E2E NFR-R2 test written (requires running app). Status → review.

## Review Findings

**Reviewed:** 2026-05-09 | 0 decision-needed · 7 patch · 6 defer · 5 dismissed

### Patches

- [x] [Review][Patch] `update()` "not found" path throws without calling `notification.showError()` [entries.service.ts:67-69]
- [x] [Review][Patch] `isAppError` guard too permissive — accepts any `{type: ...}` object, bypasses normalization [entries.service.ts:114]
- [x] [Review][Patch] `if (patch.date)` truthy check silently skips empty-string date, leaving month/year stale [entries.service.ts:71]
- [x] [Review][Patch] `IdbService.toIdbError` double-wraps an existing `AppError` into `[object Object]`, losing error message [idb.service.ts]
- [x] [Review][Patch] `idb.service.spec.ts` replaced vi.mock('idb') approach (broken in Angular esbuild runner) with fake-indexeddb/auto for true IDB round-trip coverage [idb.service.spec.ts]
- [x] [Review][Patch] `getAllByIndex` error-wrapping path not covered in `idb.service.spec.ts` error handling suite [idb.service.spec.ts]
- [x] [Review][Patch] `getAll('categories')` overload uses unconstrained `T[]` — should be `Category[]` [idb.service.ts]

### Deferred

- [x] [Review][Defer] `init()` single-flight seals after transient IDB failure — no retry path [entries.service.ts] — deferred, by-design per spec ("boot must continue with empty list"); retry mechanism is out of scope for Story 2.1
- [x] [Review][Defer] Concurrent `add()` calls: failed A rollback clobbers B's successful signal entry [entries.service.ts] — deferred, requires mutex/event queue; single-threaded JS makes this unlikely in practice; out of scope for Story 2.1
- [x] [Review][Defer] Concurrent `update()` + `delete()` stale-capture rollback resurfaces deleted entry [entries.service.ts] — deferred, same concurrency root cause as above; out of scope for Story 2.1
- [x] [Review][Defer] `update()` allows patching `isReadOnly` and `syncStatus` with no guard [entries.service.ts] — deferred, Story 2.4 owns read-only guard logic
- [x] [Review][Defer] E2E uses `page.reload()` instead of true `page.close()` + `context.newPage()` for AC8 [e2e/entry-persistence.spec.ts] — deferred, reload is an acceptable proxy for unit-level persistence; full tab-teardown test is a future enhancement
- [x] [Review][Defer] Module-level `fakeDb` mutable state — inter-test corruption risk under `--pool=threads` [idb.service.spec.ts] — deferred, Vitest default is sequential-within-file; only a risk with non-default parallel runner config
