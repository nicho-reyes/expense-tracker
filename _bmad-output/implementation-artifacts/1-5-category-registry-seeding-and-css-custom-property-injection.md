# Story 1.5: Category registry seeding and CSS custom property injection

Status: done

## Story

As Nick,
I want the app to load my expense categories from the Sheet at startup and display them with distinct colors throughout the app,
So that my categories are ready to use immediately with full visual differentiation before I log a single entry.

## Acceptance Criteria

1. **Given** Sheet discovery and authentication are complete **When** `APP_INITIALIZER` runs **Then** `AuthService.init()` completes fully before `CategoriesService.init()` begins — no parallel initialization
2. **Given** `CategoriesService.init()` runs **When** the category data is read from the Sheet **Then** categories are stored in the `categories` IDB store and the registry is global across all years — not scoped to any individual tab
3. **Given** a category has no user-assigned color **When** `CategoriesService.init()` processes it **Then** it is assigned a color from a predefined default palette (indexed by position in the registry) so `--color-[category-id]` is always populated
4. **Given** all categories have colors (default or user-assigned) **When** `CategoriesService.init()` completes **Then** `--color-[category-id]` CSS custom properties are injected into `document.documentElement.style` for every category
5. **Given** `APP_INITIALIZER` finishes **When** the first route renders **Then** all category CSS custom properties are already set — no flash of un-colored bars, dots, or tiles on initial paint
6. **Given** I am a returning user and the app is offline **When** `CategoriesService.init()` runs **Then** categories are loaded from the `categories` IDB store with no network call required — app shell renders normally
7. **Given** both IDB and the Sheet network request fail during `CategoriesService.init()` **When** the error is caught **Then** `CategoriesService.init()` resolves without rejecting; the app boots with an empty category registry; a recoverable "Could not load categories — tap to retry" prompt is shown; no blank screen is displayed
8. **Given** `CategoriesService.init()` reads from the Sheet **When** a tab named exactly `Categories` with a `Category` header in column A is present in the spreadsheet **Then** categories are read from column A of that tab as the primary source
9. **Given** no `Categories` tab is present in the spreadsheet **When** `CategoriesService.init()` falls back **Then** unique non-empty values from column B of the active 2026-schema tab are used as the category list; values are deduplicated and sorted alphabetically
10. **Given** the `Categories` tab was the source of truth at this boot **When** the registry is loaded **Then** the source ('categories-tab' | 'column-b-fallback') and the source tab name are persisted to `appMeta.categorySource` so write-back paths (Story 5.3) can append new categories to the correct location

## Tasks / Subtasks

- [x] Extend `category.model.ts` with the default color palette and helper types (AC: 3)
  - [x] Export `DEFAULT_CATEGORY_PALETTE: readonly string[]` — 12 hex colors chosen for visual distinguishability (decorative-only per UX spec, not the sole carrier of meaning)
  - [x] Export `CategorySource = { type: 'categories-tab'; tabName: 'Categories' } | { type: 'column-b-fallback'; tabName: string }` discriminated union (consumed by Story 5.3 write-back)
  - [x] Export `slugifyCategoryId(name: string): string` helper — lowercase, trim, replace non-alphanumeric runs with `-`, strip leading/trailing dashes (used to build stable `Category.id` from the human-readable name)
- [x] Extend `IdbService` API to support the `categories` store (AC: 2, 6)
  - [x] Add overload `get<T>(store: 'categories', key: string): Promise<T | undefined>` and `set<T>(store: 'categories', key: string, value: T): Promise<void>` — current overloads only accept `'appMeta'`
  - [x] Add `getAll<T>(store: 'categories'): Promise<T[]>` for bulk read of the registry
  - [x] Add `clear(store: 'categories'): Promise<void>` for full-replace seeding semantics (the registry is a snapshot, not a delta)
- [x] Add Sheets read helpers to `SheetsService` for the Categories tab + fallback column-B scan (AC: 8, 9)
  - [x] `findCategoriesTab(spreadsheetId: string): Promise<{ tabName: 'Categories' } | null>` — uses the cached spreadsheet meta if available, else `fetchSpreadsheetMeta()`; case-sensitive exact match on `'Categories'`
  - [x] `readCategoriesTabColumn(spreadsheetId: string): Observable<string[]>` — reads `'Categories'!A2:A` (skipping the `Category` header row), maps HTTP errors to `AppError.SHEETS_API`, returns trimmed non-empty values
  - [x] `readActiveTabCategoryColumn(spreadsheetId: string, tabName: string): Observable<string[]>` — reads `'<tab>'!B2:B` from the active 2026-schema tab; same error mapping
  - [x] `getActive2026TabName(): string | null` — resolves the active 2026-schema tab from `appMeta.schemaCache` (preference: most recent year by tab name; for Story 1.5 simply the first `'2026'` entry in the cache)
  - [x] Write/extend `sheets.service.spec.ts` cases for the three new methods (mock `HttpClient`, no real network)
- [x] Implement `CategoriesService` full body (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
  - [x] Replace the stub at `src/app/core/services/categories.service.ts`
  - [x] Private `_categories = signal<Category[]>([])`; expose `readonly categories = this._categories.asReadonly()`
  - [x] Private `_loadError = signal<AppError | null>(null)`; expose `readonly loadError = this._loadError.asReadonly()` so the shell can render the retry prompt (AC7)
  - [x] `async init(): Promise<void>` — never rejects (wraps the entire body in try/catch); see flow below
  - [x] `async retry(): Promise<void>` — re-runs the network seed path after AC7 failure; clears `_loadError` on success
  - [x] `injectCssProperties(categories: Category[]): void` — iterates and calls `document.documentElement.style.setProperty('--color-' + cat.id, cat.color)` for each; runs synchronously inside `init()` before resolving so AC5 is observable on the next paint
  - [x] `assignDefaultColors(names: string[], existing: Map<string, Category>): Category[]` — preserves user-assigned colors from `existing` (matched by `id`), assigns `DEFAULT_CATEGORY_PALETTE[index % palette.length]` to new categories, sets `position` to array index
- [x] Wire `CategoriesService.init()` into `APP_INITIALIZER` after `AuthService.init()` (AC: 1)
  - [x] Update `src/app/app.config.ts` — add a second `APP_INITIALIZER` provider whose factory chains: `() => authService.init().then(() => categoriesService.init())`
  - [x] Do not register two parallel initializers — Angular runs all `APP_INITIALIZER` factories in parallel; we need sequential execution and chaining inside one factory is the only correct pattern
- [x] Surface the AC7 retry prompt in the app shell (AC: 7)
  - [x] In `app.html` (or a small shell-level component): conditionally render an inline banner above the router outlet when `categoriesService.loadError()` is non-null with text "Could not load categories — tap to retry" and a button that calls `categoriesService.retry()`
  - [x] The banner is dismissible only via successful retry — there is no "x" close button (we want the user to fix it, not hide it)
- [x] Write `categories.service.spec.ts` covering the 10 ACs (Vitest)
  - [x] Mock `IdbService`, `SheetsService`, `HttpClient`, and `document.documentElement.style.setProperty`

## Dev Notes

### Critical: APP_INITIALIZER Sequential Chaining

Angular runs all `APP_INITIALIZER` providers **in parallel** when they are registered as separate `multi: true` entries. AC1 requires `AuthService.init()` to complete fully before `CategoriesService.init()` runs. The only correct pattern is to chain inside a single factory:

```typescript
{
  provide: APP_INITIALIZER,
  useFactory: (authService: AuthService, categoriesService: CategoriesService) =>
    () => authService.init().then(() => categoriesService.init()),
  deps: [AuthService, CategoriesService],
  multi: true,
},
```

Replace the existing `AuthService`-only `APP_INITIALIZER` entry — do not add a second one. The `.then()` runs `CategoriesService.init()` only after the auth init promise settles, satisfying AC1.

`CategoriesService.init()` MUST never reject. Wrap the entire body in `try { ... } catch { this._loadError.set(...) }`. Rejecting from `APP_INITIALIZER` blocks app bootstrap (Angular renders nothing) — AC7 explicitly requires the app to boot.

### CategoriesService Implementation Shape

```typescript
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IdbService } from './idb.service';
import { SheetsService } from './sheets.service';
import { NotificationService } from './notification.service';
import { AppError } from '../models/error.model';
import {
  Category,
  CategorySource,
  DEFAULT_CATEGORY_PALETTE,
  slugifyCategoryId,
} from '../models/category.model';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly idb = inject(IdbService);
  private readonly sheets = inject(SheetsService);

  private readonly _categories = signal<Category[]>([]);
  private readonly _loadError = signal<AppError | null>(null);

  readonly categories = this._categories.asReadonly();
  readonly loadError = this._loadError.asReadonly();

  async init(): Promise<void> {
    try {
      // 1. Load cached categories from IDB so the app shell can render immediately
      const cached = await this.idb.getAll<Category>('categories');
      if (cached.length) {
        this._categories.set(cached);
        this.injectCssProperties(cached);
      }

      // 2. Try to refresh from the Sheet (skips silently when offline / no spreadsheet)
      await this.seedFromSheet(cached);
    } catch (err) {
      // AC7: never reject — record the error so the shell shows the retry prompt
      this._loadError.set(this.toAppError(err));
    }
  }

  async retry(): Promise<void> {
    this._loadError.set(null);
    try {
      await this.seedFromSheet(this._categories());
    } catch (err) {
      this._loadError.set(this.toAppError(err));
    }
  }

  private async seedFromSheet(existing: Category[]): Promise<void> {
    await this.sheets.ensureLoaded();
    const spreadsheetId = this.sheets.connectedSpreadsheetId();
    if (!spreadsheetId) return; // setup not complete; nothing to seed yet

    const existingMap = new Map(existing.map((c) => [c.id, c] as const));

    // AC8: prefer the dedicated `Categories` tab
    const categoriesTab = await this.sheets.findCategoriesTab(spreadsheetId);
    let names: string[];
    let source: CategorySource;
    if (categoriesTab) {
      names = await firstValueFrom(this.sheets.readCategoriesTabColumn(spreadsheetId));
      source = { type: 'categories-tab', tabName: 'Categories' };
    } else {
      // AC9: fallback — column B of the active 2026-schema tab
      const activeTab = this.sheets.getActive2026TabName();
      if (!activeTab) return; // no usable source; keep cached registry as-is
      const raw = await firstValueFrom(this.sheets.readActiveTabCategoryColumn(spreadsheetId, activeTab));
      names = Array.from(new Set(raw)).sort((a, b) => a.localeCompare(b));
      source = { type: 'column-b-fallback', tabName: activeTab };
    }

    const next = this.assignDefaultColors(names, existingMap);

    // AC2: persist the registry as a full snapshot (clear + bulk write)
    await this.idb.clear('categories');
    for (const cat of next) {
      await this.idb.set('categories', cat.id, cat);
    }
    // AC10: persist the source so Story 5.3 write-back routes correctly
    await this.idb.set('appMeta', 'categorySource', source);

    this._categories.set(next);
    this.injectCssProperties(next);
    this._loadError.set(null);
  }

  private assignDefaultColors(
    names: string[],
    existing: Map<string, Category>,
  ): Category[] {
    return names
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .map((name, index) => {
        const id = slugifyCategoryId(name);
        const prior = existing.get(id);
        return {
          id,
          name,
          color: prior?.color ?? DEFAULT_CATEGORY_PALETTE[index % DEFAULT_CATEGORY_PALETTE.length],
          position: index,
        } satisfies Category;
      });
  }

  private injectCssProperties(categories: Category[]): void {
    const root = document.documentElement.style;
    for (const cat of categories) {
      root.setProperty(`--color-${cat.id}`, cat.color);
    }
  }

  private toAppError(err: unknown): AppError {
    if (err && typeof err === 'object' && 'type' in err) return err as AppError;
    return { type: 'IDB_ERROR', message: err instanceof Error ? err.message : String(err) };
  }
}
```

### category.model.ts Additions

Replace the existing single-interface file with:

```typescript
export interface Category {
  id: string;       // slugified name; used as CSS custom property suffix: --color-[id]
  name: string;
  color: string;    // hex e.g. '#6366f1'
  position: number; // for ordering in the quick-add picker
}

export type CategorySource =
  | { type: 'categories-tab'; tabName: 'Categories' }
  | { type: 'column-b-fallback'; tabName: string };

// 12 colors chosen for distinguishability across light/dark themes; decorative
// only per UX spec — never the sole carrier of meaning. Order is stable so the
// position-indexed assignment in CategoriesService is deterministic.
export const DEFAULT_CATEGORY_PALETTE: readonly string[] = [
  '#6366f1', // indigo-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
  '#14b8a6', // teal-500
  '#a855f7', // purple-500
  '#0ea5e9', // sky-500
] as const;

export function slugifyCategoryId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

The `id` is derived from the visible `name` via `slugifyCategoryId`. This is intentional: the `--color-[id]` CSS custom property selector is stable across reads (same name always slugifies to the same id) and human-readable when inspected in DevTools. It also means that if Nick renames a category in the Sheet, the new category id replaces the old one — the registry is a full snapshot, not a delta (AC2). Story 5.3 (rename / write-back) re-runs `CategoriesService.init()` after a write to refresh ids.

### IdbService Overload Extensions

Current `IdbService.get` / `set` only declare overloads for the `'appMeta'` store — TypeScript will reject `idb.get('categories', ...)`. Extend the overloads:

```typescript
async get<T>(store: 'appMeta', key: string): Promise<T | undefined>;
async get<T>(store: 'categories', key: string): Promise<T | undefined>;
async get<T>(store: 'appMeta' | 'categories', key: string): Promise<T | undefined> {
  const db = await this.dbPromise;
  return db.get(store, key) as Promise<T | undefined>;
}

async set<T>(store: 'appMeta', key: string, value: T): Promise<void>;
async set<T>(store: 'categories', key: string, value: T): Promise<void>;
async set<T>(store: 'appMeta' | 'categories', key: string, value: T): Promise<void> {
  const db = await this.dbPromise;
  if (store === 'categories') {
    await db.put(store, value as Category);  // keyPath: 'id' — key arg is ignored
  } else {
    await db.put(store, value as unknown, key);
  }
}

async getAll<T>(store: 'categories'): Promise<T[]> {
  const db = await this.dbPromise;
  return db.getAll(store) as Promise<T[]>;
}

async clear(store: 'categories'): Promise<void> {
  const db = await this.dbPromise;
  await db.clear(store);
}
```

The `categories` store uses `keyPath: 'id'` per the existing `IdbService` schema (line 47), so `db.put(store, value)` is sufficient — the `key` argument is unused for keyPath stores. The `appMeta` branch keeps its `(value, key)` signature because that store has no `keyPath`.

`IdbService` remains the **sole** importer of `'idb'`. Do not add `import { ... } from 'idb'` anywhere else (not in `CategoriesService`, not in `SheetsService`, not in tests — mock `IdbService` instead).

### SheetsService Read Helpers

```typescript
async findCategoriesTab(spreadsheetId: string): Promise<{ tabName: 'Categories' } | null> {
  const meta = await firstValueFrom(this.fetchSpreadsheetMeta(spreadsheetId));
  const tab = meta.sheets.find((s) => s.properties.title === 'Categories');
  return tab ? { tabName: 'Categories' } : null;
}

readCategoriesTabColumn(spreadsheetId: string): Observable<string[]> {
  // Skip the header row — start at A2
  const range = encodeURIComponent(`'Categories'!A2:A`);
  const url = `${environment.sheetsApiBaseUrl}/${spreadsheetId}/values/${range}`;
  return this.http.get<SheetsValueRange>(url).pipe(
    map((res) => (res?.values ?? []).map((row) => (row[0] ?? '').trim()).filter((v) => v.length > 0)),
    catchError((err: HttpErrorResponse) => throwError(() =>
      ({ type: 'SHEETS_API', status: err.status, message: err.message }) satisfies AppError,
    )),
  );
}

readActiveTabCategoryColumn(spreadsheetId: string, tabName: string): Observable<string[]> {
  const escaped = tabName.replace(/'/g, "''");
  const range = encodeURIComponent(`'${escaped}'!B2:B`);
  const url = `${environment.sheetsApiBaseUrl}/${spreadsheetId}/values/${range}`;
  return this.http.get<SheetsValueRange>(url).pipe(
    map((res) => (res?.values ?? []).map((row) => (row[0] ?? '').trim()).filter((v) => v.length > 0)),
    catchError((err: HttpErrorResponse) => throwError(() =>
      ({ type: 'SHEETS_API', status: err.status, message: err.message }) satisfies AppError,
    )),
  );
}

getActive2026TabName(): string | null {
  // Reads from in-memory schemaCache. For Story 1.5 we keep it simple: pick the
  // first '2026' entry. Year-aware selection (most recent) is added when needed.
  // schemaCache is populated by SheetsService.connectSheet() (Story 1.4).
  const cache = this._schemaCache();
  for (const [tabName, schema] of Object.entries(cache)) {
    if (schema === '2026') return tabName;
  }
  return null;
}
```

Story 1.4 already persists `schemaCache` to `appMeta` but does not expose it as a signal. Add to `SheetsService`:

```typescript
private readonly _schemaCache = signal<Record<string, '2026' | '2025'>>({});
readonly schemaCache = this._schemaCache.asReadonly();
```

Populate it inside the existing `ensureLoaded()` (read `appMeta.schemaCache`) and `connectSheet()` (set after IDB write). This is a small surgical extension of Story 1.4's service — do NOT rewrite the existing methods.

Tab name escaping (single quotes) follows the same pattern Story 1.4 introduced in `readTabHeaderRow` — escape `'` as `''` before wrapping in single quotes for the A1 range.

### CSS Custom Property Injection — DOM Timing

`document.documentElement.style.setProperty('--color-groceries', '#6366f1')` is a synchronous DOM mutation. Because `CategoriesService.init()` runs to completion inside the `APP_INITIALIZER` factory before Angular bootstraps the root component, all `--color-*` properties are present on `<html>` before the first paint (AC5).

Templates consume them via Tailwind's arbitrary value syntax: `bg-[var(--color-groceries)]`. The `--color-` prefix is fixed; the suffix is the slugified category id.

Do NOT inject into `document.body.style` — `<html>` is `document.documentElement` and is always present at script execution; `<body>` may or may not be parsed yet depending on script position. Use `document.documentElement` exclusively.

The `category-color.pipe.ts` referenced in the architecture (line 820) is **not** part of Story 1.5 — that pipe is a render-time lookup convenience added when components consume the colors. Story 1.5's deliverable is the registry + the CSS custom properties.

### App Shell Retry Banner (AC7)

Add to `src/app/app.html` (above `<router-outlet>`):

```html
@if (categoriesService.loadError(); as err) {
  <div role="alert" class="bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100 px-4 py-2 flex items-center justify-between">
    <span>Could not load categories — tap to retry</span>
    <button mat-button (click)="onRetryCategories()">Retry</button>
  </div>
}
```

In `app.ts`:

```typescript
import { CategoriesService } from './core/services/categories.service';
// ...
protected readonly categoriesService = inject(CategoriesService);
async onRetryCategories(): Promise<void> {
  await this.categoriesService.retry();
}
```

The banner is shell-level (not per-route) because `CategoriesService` is global and the failure mode is global. Inline rendering satisfies the "no blank screen" clause of AC7 and the "actionable retry" clause.

### appMeta IDB Keys for This Story

| Key | Type | Set by |
|-----|------|--------|
| `'categorySource'` | `CategorySource` | `CategoriesService.seedFromSheet()` |

Existing keys from Story 1.4 (`'spreadsheetId'`, `'schemaCache'`) are READ by this story but never written.

### What Story 1.5 Does NOT Implement

- Color picker UI (changing a category's color) → Story 5.2
- Category reorder via drag-drop → Story 5.2
- Writing new categories back to the Sheet → Story 5.3 (uses `appMeta.categorySource` set here to decide where to append)
- 5-minute TTL invalidation on `categories` store → deferred; for Story 1.5 every `init()` re-fetches from the Sheet when online, and the IDB cache is the offline fallback only
- `category-color.pipe.ts` — render-time pipe, added when first consumer ships
- `EntriesService` integration with categories → Stories 2.x
- Category usage in dashboard visualizations (`CategoryBreakdownBarComponent`) → Story 3.x

### Previous Story Patterns to Follow (Stories 1.2, 1.4, 1.6)

- **Angular 21 root component naming**: root component is `src/app/app.ts` / `app.html` (no `.component` infix). Other components use `<name>.component.ts`.
- **OnPush + standalone mandatory** on every component
- **Signals, not `@Input()`/`@Output()`** — use `input()` / `output()` if needed
- **`NotificationService.showError()`** for toast — never inject `MatSnackBar` directly. AC7's retry prompt is **inline** (banner), not a snackbar — snackbar is for transient errors only
- **`providedIn: 'root'`** on `CategoriesService` (already set in the stub)
- **`crypto.randomUUID()` only** for any client-generated IDs — though Story 1.5's category ids are deterministic slugs, not random
- **`firstValueFrom(observable)`** from `'rxjs'` to bridge Observable → Promise
- **Run tests via `ng test --watch=false`** — the `@angular/build:unit-test` builder manages the Vitest runner
- **No `console.log` in shipped code** — use `NotificationService` for user-visible signals

### Testing Guidance

Use Vitest. New test file: `src/app/core/services/categories.service.spec.ts`. Extend `sheets.service.spec.ts` for the three new helpers.

Key test cases for `CategoriesService`:

1. `init()` with empty IDB + no spreadsheet connected → resolves cleanly, `categories()` is `[]`, no error
2. `init()` with cached IDB categories + offline (Sheets call rejects with NETWORK) → categories signal reflects IDB cache, `loadError` is set, CSS properties injected for cached entries (AC6)
3. `init()` with `'Categories'` tab present → reads from `'Categories'!A2:A`, persists with `categorySource = { type: 'categories-tab', tabName: 'Categories' }` (AC8, AC10)
4. `init()` with no `'Categories'` tab + active 2026 tab → reads from `'<tab>'!B2:B`, dedupes, sorts alphabetically, persists `categorySource = { type: 'column-b-fallback', tabName: '<tab>' }` (AC9, AC10)
5. `init()` assigns `DEFAULT_CATEGORY_PALETTE[index % length]` to categories with no prior color (AC3)
6. `init()` preserves user-assigned colors from prior IDB cache when re-seeding (id match)
7. `init()` calls `document.documentElement.style.setProperty('--color-<id>', <hex>)` for every category (mock `setProperty`) (AC4, AC5)
8. `init()` never rejects when `IdbService.getAll` throws — `loadError` is set instead (AC7)
9. `init()` never rejects when both IDB and Sheets fail — `loadError` is set, signal stays `[]` (AC7)
10. `retry()` clears `loadError` on success and re-populates the signal
11. `slugifyCategoryId('Food & Drinks')` === `'food-drinks'`; `slugifyCategoryId('  Café  ')` === `'caf'` (non-ASCII collapses to dashes; matches stable-id intent)
12. `assignDefaultColors`: dedupe, trim, position indexing all behave per spec

Mock `IdbService`, `SheetsService`, and `document.documentElement.style.setProperty` (use `vi.spyOn(document.documentElement.style, 'setProperty')`). Do not use real IDB or real HTTP.

For `SheetsService`:

13. `findCategoriesTab` with meta containing a `'Categories'` sheet → returns `{ tabName: 'Categories' }`
14. `findCategoriesTab` with no matching tab → returns `null`
15. `readCategoriesTabColumn` request URL is `.../values/'Categories'%21A2%3AA` (URL-encoded)
16. `readActiveTabCategoryColumn` escapes single quotes in tab name (e.g. `Fred's 2026` → `Fred''s 2026`)
17. `getActive2026TabName` returns the first `'2026'` entry from `schemaCache`, or `null` if none

### Project Structure Notes

- `categories.service.ts` already exists at `src/app/core/services/categories.service.ts` (stub from Story 1.1) — replace its body, do not move the file
- `category.model.ts` already exists at `src/app/core/models/category.model.ts` — extend with palette, source type, slugify helper
- `idb.service.ts` extension stays in place — extend overloads, do not split into a new service
- `sheets.service.ts` extension stays in place — add three new methods + `schemaCache` signal alongside existing exports
- App shell banner edits to `src/app/app.html` and `src/app/app.ts` (root component, no `.component` infix per Angular 21 convention)
- `app.config.ts` `APP_INITIALIZER` provider replaced (not added) — chain `AuthService.init()` and `CategoriesService.init()` in one factory

### References

- Category color system: [Source: `_bmad-output/planning-artifacts/architecture.md#Frontend-Architecture` (line 341)]
- APP_INITIALIZER ordering: [Source: `_bmad-output/planning-artifacts/architecture.md` (lines 397, 616, 1052)]
- CategoriesService domain signals: [Source: `_bmad-output/planning-artifacts/architecture.md` (line 296)]
- IDB stores: [Source: `_bmad-output/planning-artifacts/architecture.md` (line 220)]
- Per-category color UX: [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` (lines 370–375, 631–634)]
- Decorative-only color rule: [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` (line 672)]
- Tailwind arbitrary values syntax: [Source: `_bmad-output/planning-artifacts/architecture.md` (line 342)]
- `Category` interface: [Source: `src/app/core/models/category.model.ts`]
- `IdbService` API: [Source: `src/app/core/services/idb.service.ts`]
- `SheetsService` from Story 1.4: [Source: `src/app/core/services/sheets.service.ts`]
- `AuthService.init()`: [Source: `src/app/core/services/auth.service.ts:32`]
- Existing APP_INITIALIZER provider: [Source: `src/app/app.config.ts:28-33`]
- AppError discriminated union: [Source: `src/app/core/models/error.model.ts`]
- App shell root component: [Source: `src/app/app.ts`, `src/app/app.html`]
- Test runner command: [Source: `1-2-google-oauth-authentication-flow.md#Dev-Agent-Record`] — use `ng test --watch=false`
- `firstValueFrom` usage: [Source: `1-2-google-oauth-authentication-flow.md#Dev-Notes`]
- Tab name escaping pattern: [Source: `1-4-first-run-setup-and-google-sheets-discovery.md` — `readTabHeaderRow`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- TypeScript compiled clean on first pass (no errors after all changes)
- `app.spec.ts` updated to mock `CategoriesService` after `IdbService` initialization error in test environment
- Pre-existing failures in `auth.interceptor.spec.ts` and `auth.service.spec.ts` remain (not introduced by this story)

### Completion Notes List

- Extended `category.model.ts` with `DEFAULT_CATEGORY_PALETTE` (12-color array), `CategorySource` discriminated union, and `slugifyCategoryId()` helper
- Extended `IdbService` with typed overloads for `get<T>`, `set<T>`, plus new `getAll<T>` and `clear()` methods for the `categories` store (keyPath: 'id' store — `db.put(store, value)` without key arg)
- Extended `SheetsService` with `_schemaCache` signal (populated in `ensureLoaded()` and `connectSheet()`), and three new public methods: `findCategoriesTab()`, `readCategoriesTabColumn()`, `readActiveTabCategoryColumn()`, `getActive2026TabName()`
- Implemented full `CategoriesService` body replacing the stub: `init()` never rejects (AC7), loads IDB cache first then seeds from Sheet, `retry()` re-runs the network path, CSS custom properties injected before resolving (AC5)
- Updated `app.config.ts`: single `APP_INITIALIZER` factory chains `authService.init().then(() => categoriesService.init())` — sequential execution satisfying AC1
- Added retry banner to `app.html` using `@if` block (AC7); wired `onRetryCategories()` in `app.ts`
- 18 new tests in `categories.service.spec.ts` (all pass); 15 new tests in `sheets.service.spec.ts` (29 total, all pass); `app.spec.ts` updated to mock `CategoriesService`

### File List

- `src/app/core/models/category.model.ts` — extended with `DEFAULT_CATEGORY_PALETTE`, `CategorySource`, `slugifyCategoryId`
- `src/app/core/services/idb.service.ts` — added `categories` store overloads for `get`/`set`, plus `getAll` and `clear`
- `src/app/core/services/sheets.service.ts` — added `_schemaCache` signal, `schemaCache` readonly, `findCategoriesTab`, `readCategoriesTabColumn`, `readActiveTabCategoryColumn`, `getActive2026TabName`; populated cache in `ensureLoaded` and `connectSheet`; added `map` to rxjs operator imports
- `src/app/core/services/categories.service.ts` — full implementation replacing stub
- `src/app/app.config.ts` — `APP_INITIALIZER` updated to chain auth + categories init sequentially; added `CategoriesService` import
- `src/app/app.ts` — injected `CategoriesService`, added `onRetryCategories()`, added `MatButton` to imports
- `src/app/app.html` — added retry banner above the main div
- `src/app/core/services/categories.service.spec.ts` — new file, 18 tests covering all ACs
- `src/app/core/services/sheets.service.spec.ts` — extended with 15 new tests for new helpers + updated `ensureLoaded` call-count assertion
- `src/app/app.spec.ts` — updated to mock `CategoriesService` to avoid IDB initialization in test environment

## Change Log

- 2026-05-09: Story 1.5 implemented by claude-sonnet-4-6 — `CategoriesService` full implementation (Sheet seeding + IDB cache + CSS custom property injection), `IdbService` overload extension for the `categories` store, three new `SheetsService` read helpers (`findCategoriesTab`, `readCategoriesTabColumn`, `readActiveTabCategoryColumn`) plus `schemaCache` signal, `category.model.ts` extended with `DEFAULT_CATEGORY_PALETTE` + `CategorySource` + `slugifyCategoryId`, `app.config.ts` APP_INITIALIZER chained to run sequentially after `AuthService.init()`, app-shell retry banner for AC7. Added AC10 to lock the `categorySource` write so Story 5.3 write-back can route correctly.

## Review Findings

### Patch Findings

- [x] [Review][Patch] `injectCssProperties` must be private — spec constraint says it is an implementation detail, not public API [src/app/core/services/categories.service.ts]
- [x] [Review][Patch] `init()` sets `loadError` when Sheets fails even if IDB cache was loaded — violates AC6 ("app shell renders normally" offline) and AC7 ("both IDB and Sheet fail") — fix: only set `loadError` in catch if `_categories()` is still empty [src/app/core/services/categories.service.ts]
- [x] [Review][Patch] Empty or all-non-ASCII category name produces empty id via `slugifyCategoryId` — empty id creates `--color-` CSS property and an empty-key IDB entry — fix: post-slug guard to skip or throw on empty id [src/app/core/models/category.model.ts, src/app/core/services/categories.service.ts:assignDefaultColors]
- [x] [Review][Patch] `findCategoriesTab` does not guard against `meta.sheets` being undefined — if Sheets API returns an unexpected shape the `.find()` call throws uncaught TypeError [src/app/core/services/sheets.service.ts:findCategoriesTab]
- [x] [Review][Patch] `assignDefaultColors` does not deduplicate slugs — two distinct names that resolve to the same slug (e.g. "A&B" and "A B" → "a-b") silently overwrite each other in IDB and the signal array [src/app/core/services/categories.service.ts:assignDefaultColors]
- [x] [Review][Patch] No in-flight guard in `retry()` — concurrent calls (e.g. rapid double-tap of Retry button) race on `idb.clear` causing interleaved writes and potential empty registry [src/app/core/services/categories.service.ts:retry, src/app/app.ts:onRetryCategories]
- [x] [Review][Patch] `ensureLoaded` TOCTOU: two concurrent callers can both pass the `_loadedFromIdb` guard before either sets the flag — fix: single-promise guard [src/app/core/services/sheets.service.ts:ensureLoaded]
- [x] [Review][Patch] Slugify test asserts only structural validity for `'  Café  '` — should assert exact output `'caf'` per spec [src/app/core/services/categories.service.spec.ts]
- [x] [Review][Patch] Dead `as err` binding in banner template — `@if (categoriesService.loadError(); as err)` captures `err` but never uses it; remove the binding [src/app/app.html]
- [x] [Review][Patch] `toAppError` fallback type `IDB_ERROR` is misleading for Sheets/network errors that have no `type` field — rename fallback type to `UNKNOWN_ERROR` or a type that exists in the AppError union [src/app/core/services/categories.service.ts:toAppError]

### Defer Findings

- [x] [Review][Defer] Stale CSS custom properties persist when categories are removed from the sheet — `injectCssProperties` never calls `removeProperty` [src/app/core/services/categories.service.ts] — deferred, out of scope for Story 1.5; relevant when category management (Story 5.x) ships
- [x] [Review][Defer] `getActive2026TabName` returns first '2026' entry via `Object.entries` — non-deterministic with multiple 2026-schema tabs — deferred, spec explicitly says "for Story 1.5 simply the first entry"; year-aware selection added in a later story
- [x] [Review][Defer] No IDB transaction wrapping the `clear` + per-category `set` loop — partial write on tab crash leaves store corrupted — deferred, requires IdbService architecture change beyond Story 1.5 scope
- [x] [Review][Defer] `idb.set` for categories casts `value as Category` without runtime type check — TypeScript overloads enforce type at compile time but a JS caller could pass anything — deferred, pre-existing pattern in IdbService
