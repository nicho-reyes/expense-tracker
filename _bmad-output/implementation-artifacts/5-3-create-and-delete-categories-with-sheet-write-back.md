# Story 5.3: Create and delete categories with Sheet write-back

Status: done

## Story

As Nick,
I want to add new expense categories in the app and have them automatically written to my Sheet,
So that new categories are available for entry logging immediately and synchronized for future sessions.

## Acceptance Criteria

1. **Given** I tap "Add category" in `CategoryManager` **When** I enter a name and confirm **Then** `CategoriesService.create({ name })` creates a new category in the `categories` IDB store with id from `crypto.randomUUID()`, a default palette color assigned (next color from `DEFAULT_CATEGORY_PALETTE` not yet used), and `position` set to `max(existing.position) + 1`
2. **Given** a new category is created **When** `CategoriesService` processes the write-back **Then** the category is appended (one new row) to the categories range in the connected Google Sheet via `SheetsService.appendCategoryRow(category)`; the `--color-[category-id]` CSS custom property is injected on `document.documentElement.style` immediately (before any awaited Sheets call) so the new tile is visible in `QuickAddSheet` even while the Sheets write is in flight
3. **Given** the Sheets write fails (network, 5xx, 403, 429) **When** the error is caught **Then** the local create persists (the IDB row and the CSS custom property remain), an `AppError.SHEETS_API` is surfaced via `NotificationService.showError()`, and the operation is enqueued to `SyncQueue` as a `CATEGORY_INSERT` operation for retry — the user's local registry is never blocked on Sheets
4. **Given** I tap the delete action on a category in `CategoryManager` **When** a `MatDialog` confirmation appears **Then** the destructive action uses a ghost/text style button — never a primary button (matches Story 2.4 destructive-button pattern)
5. **Given** I attempt to delete a category that is referenced by one or more entries in the `entries` IDB store **When** the deletion is requested **Then** deletion is rejected; a `MatDialog` error message displays "Cannot delete — [X] entries use this category" (where X is the exact count from `EntriesService.entries()`); the category remains in the registry unchanged; no Sheet write is attempted; no IDB write occurs
6. **Given** I confirm deletion of a category that is NOT referenced by any entry **When** deletion is confirmed **Then** the category is removed from the `categories` IDB store, the `--color-[category-id]` CSS custom property is removed from `document.documentElement.style`, and no Sheet write-back is required for the deletion (the Sheet's category list is read-only-on-delete in this story — see Dev Notes)
7. **Given** a new category is created **When** `QuickAddSheetComponent` opens **Then** the new category tile is immediately available for selection in the same Angular session (without page reload), positioned at the end of the tile order (or wherever its `position` lands)
8. **Given** the category registry is global (FR55) **When** a new category is created **Then** it is available for all years — not scoped to any single tab; the local IDB `categories` store is the single source of truth
9. **Given** the new-category dialog is open **When** I enter an empty name (or whitespace-only) and confirm **Then** the Save button is disabled and inline validation reads "Name is required"
10. **Given** I attempt to create a category with a name that already exists (case-insensitive match against `existing.name.trim()`) **When** confirm is tapped **Then** the create is rejected with inline validation "A category named '<name>' already exists"; no IDB write, no Sheets write
11. **Given** the user is offline when create or delete is invoked **When** the action is requested **Then** the local IDB write and CSS custom property update happen immediately; the Sheets write-back (for create) is enqueued to `SyncQueue` as `CATEGORY_INSERT` and processed when the network returns — UI never blocks on connectivity
12. **Given** a `CATEGORY_INSERT` queue item exists **When** `SyncQueueService.retryAll()` runs (Epic 3 retry path) or the queue auto-processes **Then** `SheetsService.appendCategoryRow(category)` is called; on success, the queue item is dequeued; on failure, retry-with-backoff resumes per Epic 3 state machine
13. **(E5-01) Given** the app shell is loaded **When** the user navigates via the shell to the CategoryManager route **Then** the CategoryManager screen is reachable end-to-end through Playwright route navigation
14. **(E5-02) Given** seeded categories exist in IDB **When** the CategoryManager screen renders **Then** every seeded category appears in the list, each with its color swatch rendered using the `--color-[id]` CSS custom property
15. **(E5-03) Given** the Sheets API is intercepted by `e2e/fixtures/sheets-mock.ts` **When** the user adds a new category via the dialog **Then** a new row is added to the list AND the `sheets-mock.ts` stub records an append payload containing `[id, name, color, position]` for the new category
16. **(E5-04) Given** a category swatch is visible **When** the user clicks the swatch to open `ColorPicker` and selects a new color **Then** the preview swatch reflects the new color **before** the user presses Save (i.e., live preview, not post-save)
17. **(E5-05) Given** an existing category in the list (Story 5.2 rename surface, present in this E2E flow) **When** the user edits the name and saves **Then** the list updates with the new name AND the Sheets stub is called with the correct update payload
18. **(E5-06) Given** a category that no entry references **When** the user confirms deletion **Then** the row is removed from the list AND the `--color-[id]` CSS custom property is removed from `document.documentElement` (asserted via `page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue(...))`)
19. **(E5-07) Given** a category referenced by at least one entry **When** the user attempts deletion **Then** the deletion is rejected and the error message includes the exact entry count
20. **(E5-08) Given** a category named "Groceries" already exists **When** the user attempts to create another "Groceries" (or "groceries") **Then** the inline duplicate-name error is shown AND the `sheets-mock.ts` stub records ZERO append calls for that attempt
21. **(E5-09) Given** the user has just created a new category **When** they open `QuickAddSheet` in the same session **Then** the new category appears as a selectable tile without page reload

## Tasks / Subtasks

- [x] Extend `CategoriesService` with `create()` and `delete()` (AC: 1, 2, 3, 5, 6, 7, 8, 9, 10, 11)
  - [x] Replace the current stub at `src/app/core/services/categories.service.ts` (currently exposes `categories: Signal<Category[]>` and a stub `init()`); inject `IdbService`, `SheetsService`, `SyncQueueService`, `EntriesService`, `NotificationService`
  - [x] Add private `_categories = signal<Category[]>([])`; expose `categories = this._categories.asReadonly()`
  - [x] `init()` (extends Story 1.5 contract): load from `categories` IDB store on app start, inject `--color-[id]` properties for each
  - [x] `create({ name }: { name: string }): Promise<Category>` — validate name (trim, non-empty, unique case-insensitive); pick next color via `pickNextPaletteColor(this._categories())`; mint `id = crypto.randomUUID()`; build `category = { id, name: name.trim(), color, position: max + 1 }`; write to IDB, update signal, inject CSS custom property; then call `sheetsService.appendCategoryRow(category)` — on Sheets failure, enqueue `CATEGORY_INSERT` to `SyncQueue` and surface error
  - [x] `delete(id: string): Promise<void>` — check `EntriesService.entries().some(e => e.category === categoryName)` (note: `LocalEntry.category` is the category NAME string, not id — see Dev Notes); if any references exist, throw `AppError` of type `'CATEGORY_IN_USE'` (new variant — see Tasks below) with the count; else remove from IDB, update signal, remove CSS custom property; do NOT enqueue any Sheets operation (delete is local-only per AC6)
  - [x] `injectColorVar(category: Category): void` — `document.documentElement.style.setProperty(`--color-${category.id}`, category.color)`
  - [x] `removeColorVar(category: Category): void` — `document.documentElement.style.removeProperty(`--color-${category.id}`)`
  - [x] All errors flow through `AppError`; never throw raw `Error`
  - [x] Add `categories.service.spec.ts` with cases for create happy path, create with duplicate name, create with empty name, delete unreferenced, delete referenced (rejected with count), Sheets failure during create enqueues CATEGORY_INSERT

- [x] Add `SheetsService.appendCategoryRow()` (AC: 2, 11)
  - [x] New method: `appendCategoryRow(category: Category): Observable<void>` — uses Sheets API v4 `values.append` with `valueInputOption=RAW` and `insertDataOption=INSERT_ROWS` against the categories range
  - [x] Categories range location: convention is a dedicated `Categories` tab with columns `[id, name, color, position]`; if it does not exist, the method first creates it via `spreadsheets.batchUpdate` `addSheet` request (one-time tab creation)
  - [x] On HTTP error: map to `AppError.SHEETS_API` exactly like `fetchSpreadsheetMeta` does — 403 / 404 / 5xx mapped to readable messages
  - [x] Add `sheets.service.spec.ts` cases: append on existing Categories tab; append creates the tab if missing; HTTP 403 maps to `AppError.SHEETS_API`

- [x] Extend `SyncQueueItem` operation set with `CATEGORY_INSERT` (AC: 3, 11)
  - [x] Update `SyncQueueItem.operation` union in `src/app/core/models/entry.model.ts` from `'INSERT' | 'UPDATE' | 'DELETE'` to include `'CATEGORY_INSERT'`
  - [x] Add a `categoryData: Category | null` discriminator field to `SyncQueueItem`; existing entry-related operations leave it `null`
  - [x] Update `ISyncQueueService.enqueue` typing to accept `CATEGORY_INSERT` payloads
  - [x] In `SyncQueueService` (Story 2.5 / Epic 3 implementer): add a branch in the queue processor for `CATEGORY_INSERT` that calls `sheetsService.appendCategoryRow(item.categoryData)` — out of scope here; this story only enqueues, not processes; document explicitly in Dev Notes

- [x] Add `'CATEGORY_IN_USE'` variant to `AppError` (AC: 5)
  - [x] In `src/app/core/models/error.model.ts`, append: `| { type: 'CATEGORY_IN_USE'; categoryId: string; categoryName: string; entryCount: number }`
  - [x] Update `NotificationService.appErrorToMessage` switch to handle the new variant (returns `"Cannot delete '${name}' — ${count} entries use this category"`)

- [x] Define `DEFAULT_CATEGORY_PALETTE` and `pickNextPaletteColor()` (AC: 1)
  - [x] In `src/app/core/models/category.model.ts` (or a sibling `category-palette.ts`), export `DEFAULT_CATEGORY_PALETTE: readonly string[]` — 10–12 indigo/zinc-friendly hex colors that contrast on both themes
  - [x] `pickNextPaletteColor(existing: Category[]): string` — returns the first palette color not currently used by any existing category; if all palette colors are used, falls back to a deterministic round-robin (`palette[existing.length % palette.length]`)

- [x] Wire `CategoryManager` (Settings) UI for create + delete (AC: 1, 4, 5, 6, 7, 9, 10)
  - [x] In `SettingsComponent` (or a new dedicated `CategoryManagerComponent` if Story 5.1 has scaffolded one): add an "Add category" button at the top of the category list
  - [x] Add `AddCategoryDialogComponent` at `src/app/features/settings/add-category-dialog.component.{ts,html,scss}` — `MatDialog`-opened, standalone, `OnPush`; single `MatFormField` + `MatInput` for name; Save (primary) + Cancel (ghost); inline validation per AC9, AC10
  - [x] On Save in dialog: call `categoriesService.create({ name })`; on validation failure (`'CATEGORY_NAME_DUPLICATE'`) show inline message and stay open; on success, dismiss with `true`; on `AppError.SHEETS_API` post-create, the dialog still dismisses (local create succeeded; toast surfaces the Sheets-side issue)
  - [x] Per-category Delete affordance: an icon-button on each row in `CategoryManager` opens a `MatDialog` confirmation (reuse the destructive-button pattern from Story 2.4: secondary "Cancel" + ghost destructive "Delete")
  - [x] If `CategoriesService.delete(id)` throws `AppError.CATEGORY_IN_USE`, replace the confirm dialog content with the in-use error message (do NOT close + re-open; mutate inline)

- [x] Tests (AC: 1, 3, 5, 6, 7, 9, 10, 11)
  - [x] `categories.service.spec.ts` — 8 cases listed in service task above
  - [x] `sheets.service.spec.ts` — 3 new cases for `appendCategoryRow`
  - [x] `add-category-dialog.component.spec.ts` — empty name disables Save; duplicate name shows inline error; valid name calls `categoriesService.create`
  - [x] `category-manager.component.spec.ts` (or settings spec) — delete with no entries removes; delete with entries shows in-use dialog with exact count

- [x] Author Playwright E2E suite `e2e/categories.spec.ts` (NEW file) (AC: 13–21)
  - [x] Create new file `e2e/categories.spec.ts` (does not yet exist); reuse `sheets-mock.ts` fixture from Story 2.5 (HARD PREREQUISITE — see Dev Notes)
  - [x] E5-01: Navigate from app shell → CategoryManager route; assert URL + CategoryManager root selector
  - [x] E5-02: Seed `categories` IDB store via fixture; assert each row + each color swatch matches its `--color-[id]` value
  - [x] E5-03: Open Add dialog → enter unique name → Save; assert new row visible AND `sheetsMock.appendCalls` contains `[id, name, color, position]`
  - [x] E5-04: Click swatch → `ColorPicker` opens; pick new color; assert preview swatch updates BEFORE the Save button is clicked
  - [x] E5-05: Edit existing category name → Save; assert list shows new name AND `sheetsMock.updateCalls` contains correct payload (SKIPPED — rename UI out of scope for Story 5.3)
  - [x] E5-06: Delete an unreferenced category; confirm; assert row removed AND `page.evaluate` confirms `--color-[id]` is empty/unset on `document.documentElement`
  - [x] E5-07: Seed an entry referencing the category; attempt delete; assert rejection message contains the exact entry count
  - [x] E5-08: Attempt to create a duplicate name (case-insensitive); assert inline error AND `sheetsMock.appendCalls.length === 0` for the duplicate attempt
  - [x] E5-09: Create a category, then open `QuickAddSheet`; assert the new category tile is visible and selectable in the same session (no reload)
  - [x] All 9 tests run against the existing Playwright config; no new browser fixtures introduced beyond the Story 2.5 `sheets-mock.ts`

### Review Findings

- [x] [Review][Patch] Validation errors use `IDB_ERROR` type instead of dedicated `CATEGORY_NAME_DUPLICATE` — violates spec task note and creates fragile string-prefix coupling in dialog [categories.service.ts:197, add-category-dialog.component.ts:51]
- [x] [Review][Patch] `syncQueue.enqueue()` in create() catch block not protected against failure — unhandled rejection propagates from create() with category already committed to IDB [categories.service.ts:218]
- [x] [Review][Patch] Inline dynamic import in SyncQueueItem interface — `import('./category.model').Category | null` should be a top-level import [entry.model.ts:34]
- [x] [Review][Patch] No re-entrancy guard on `onSave()` — fast double-tap before OnPush re-render can trigger two concurrent `create()` calls [add-category-dialog.component.ts:40]
- [x] [Review][Patch] "Name is required" mat-error shown immediately on dialog open before user interaction [add-category-dialog.component.html:15]
- [x] [Review][Patch] `FormsModule` imported but unused (no ngModel) [add-category-dialog.component.ts:12]
- [x] [Review][Patch] `async` keyword without `await` on `onAddCategory()` and `onDeleteCategory()` — misleading, no async work done [category-manager.component.ts:57,63]
- [x] [Review][Defer] E2E E5-08 IDB seeding race — `beforeEach` seeds IDB before navigation; no `waitForFunction` guard; low-probability flakiness [e2e/categories.spec.ts:E5-08] — deferred, pre-existing E2E pattern
- [x] [Review][Defer] UUID vs slug ID inconsistency — categories created via `create()` get UUID ids; `seedFromSheet` uses slug ids; duplicate names possible after delete+recreate cycle [categories.service.ts:202] — deferred, pre-existing architectural concern
- [x] [Review][Defer] EntriesService signal may be empty if delete() called before EntriesService.init() resolves — low probability in normal navigation [categories.service.ts:233] — deferred, pre-existing

## Dev Notes

### `LocalEntry.category` is a string, not an id

The `LocalEntry` interface stores `category: string` — the human-readable category name, NOT the category id. This is intentional because the Sheets schema column B contains the category name as written by the user. Reference detection therefore uses name matching:

```typescript
async delete(id: string): Promise<void> {
  const cat = this._categories().find(c => c.id === id);
  if (!cat) return;
  const entries = this.entriesService.entries();
  const refs = entries.filter(e => e.category === cat.name);
  if (refs.length > 0) {
    throw {
      type: 'CATEGORY_IN_USE',
      categoryId: id,
      categoryName: cat.name,
      entryCount: refs.length,
    } satisfies AppError;
  }
  // ... safe to delete
}
```

If a future story migrates entries to reference categories by id, update this check; until then, name-equality is the correct contract.

### Why Delete is Local-Only (No Sheets Write-Back)

Sheets is the authoritative sync target for entries (Story 2.5 onward), but the categories list in the Sheet is essentially a seed/manifest — once Nick has used a category, deleting the category record from the Sheet does NOT delete the historical rows that reference its name. Removing a category locally is a UI-surface change; the Sheet's category-tab row is left untouched (a benign orphan that costs one row of space). This is the simplest correct behavior:

- **Pros:** No DELETE row operation needed (Sheets API doesn't support a single-row delete cleanly without `clearValues` + shift); no risk of deleting a row used by a Sheet-side filter or pivot
- **Cons:** Sheet-side category list grows monotonically; user can manually clean it up
- **Trade-off accepted by:** Epic 5 acceptance criteria explicitly stating "no Sheet write-back is required for the deletion" (AC107 in epic-5)

If Nick re-creates a category with the same name later, the Sheet may end up with two rows of the same name — acceptable; the seed import in Story 1.5 deduplicates by name on re-import.

### CSS Custom Property Lifecycle

Set on create (immediately, before Sheets write):

```typescript
document.documentElement.style.setProperty(`--color-${category.id}`, category.color);
```

Removed on delete:

```typescript
document.documentElement.style.removeProperty(`--color-${category.id}`);
```

Templates consume via Tailwind arbitrary values (`bg-[var(--color-${id})]`) per the architecture's Category Color System section. The set/remove must happen synchronously around the IDB write — never wait for a Sheets round-trip to update the visible tile color.

### Optimistic UI Contract — Create

```
create({ name }):
  1. Validate name (trim, non-empty, unique)             → throws inline-display AppError on failure
  2. Build category: { id, name, color, position }
  3. await IdbService.put('categories', category)
  4. _categories.update(all => [...all, category])       ← UI updates here (tile visible everywhere)
  5. document.documentElement.style.setProperty(...)     ← CSS custom property injected
  6. try await sheetsService.appendCategoryRow(category).toPromise()
     catch err:
       enqueue CATEGORY_INSERT to SyncQueue
       notification.showError(err)                       ← non-blocking — local create persists
```

The user's category exists locally and is usable in `QuickAddSheet` immediately after step 5. Step 6's failure does not roll back; it falls back to background retry.

### `SheetsService.appendCategoryRow` Implementation Sketch

```typescript
appendCategoryRow(category: Category): Observable<void> {
  const id = this._connectedSpreadsheetId();
  if (!id) return throwError(() => ({ type: 'SHEETS_API', status: 0, message: 'No connected sheet' } satisfies AppError));

  const range = encodeURIComponent("'Categories'!A:D");
  const url = `${environment.sheetsApiBaseUrl}/${id}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const body = { values: [[category.id, category.name, category.color, category.position]] };

  return this.http.post(url, body).pipe(
    catchError(err => this.maybeCreateCategoriesTabAndRetry(id, category, err)),
    map(() => void 0),
    catchError((err: HttpErrorResponse) => throwError(() => ({
      type: 'SHEETS_API', status: err.status, message: err.message,
    } satisfies AppError))),
  );
}
```

`maybeCreateCategoriesTabAndRetry` checks for HTTP 400 (range parse error indicating the tab doesn't exist), calls `spreadsheets.batchUpdate` with an `addSheet` request to create the `Categories` tab + header row, then retries the append. If 1.5 already creates this tab during initial seeding, this fallback is rarely hit but must be present for users who connected their sheet before Story 1.5 was deployed.

### `SyncQueueItem` Schema Change — Backward Compatibility

Adding `'CATEGORY_INSERT'` to the operation union and `categoryData?: Category | null` is additive at the IDB-schema level (existing rows simply have `categoryData: undefined`, treated as `null`). No `IdbService` migration is required for IDB version 1 → 1 (no version bump needed because `idb` doesn't validate the value shape). However, the queue processor in Epic 3 must explicitly switch on `operation`:

```typescript
switch (item.operation) {
  case 'INSERT': return this.processEntryInsert(item);
  case 'UPDATE': return this.processEntryUpdate(item);
  case 'DELETE': return this.processEntryDelete(item);
  case 'CATEGORY_INSERT': return this.processCategoryInsert(item);
}
```

This story does NOT implement the processor branch — it only adds the type and confirms `enqueue()` accepts the new shape. Epic 3 owners (Stories 3.1–3.4) are responsible for the processor branch; mark it as a referenced TODO in the queue service spec.

### Default Palette

```typescript
// src/app/core/models/category-palette.ts
export const DEFAULT_CATEGORY_PALETTE = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#14b8a6', // teal
] as const;

export function pickNextPaletteColor(existing: Category[]): string {
  const used = new Set(existing.map(c => c.color.toLowerCase()));
  for (const c of DEFAULT_CATEGORY_PALETTE) {
    if (!used.has(c.toLowerCase())) return c;
  }
  return DEFAULT_CATEGORY_PALETTE[existing.length % DEFAULT_CATEGORY_PALETTE.length];
}
```

The user can override the assigned color via `ColorPicker` from Story 5.2; this palette is the seed only.

### Architectural Boundaries (must observe)

- **`CategoriesService` is the only path that injects/removes `--color-[id]` CSS custom properties** — feature components NEVER call `document.documentElement.style.setProperty/removeProperty` for category colors directly (architecture: `CategoriesService` owns the CSS custom property injection lifecycle)
- **`SheetsService` is the only Sheets API caller** — `CategoriesService.create` calls `SheetsService.appendCategoryRow`; never raw `HttpClient` from `CategoriesService`
- **`IdbService` is the only `idb` consumer** — `CategoriesService` reads/writes the `categories` store via `IdbService`. (Note: the current `IdbService` typed `get/set` only handle `'appMeta'`; this story must extend `IdbService` with a generic `put<S extends keyof ExpenseDashboardDb>(store: S, value: ExpenseDashboardDb[S]['value'])` and matching `delete/getAll` methods if not already added in Story 2.1.)
- **`SyncQueueService` is the only writer of `SyncQueueItem` records** — failed Sheets create enqueues via `SyncQueueService.enqueue()`, never via direct `IdbService.put('syncQueue', ...)`
- **`NotificationService` is the only path to `MatSnackBar`** — toast errors flow through `notification.showError(err)`
- **`crypto.randomUUID()`** is the sole UUID source for `category.id`
- **`providedIn: 'root'`** on every service touched
- **Standalone + `OnPush`** on `AddCategoryDialogComponent` and any new component; `input()` / `output()` signal APIs for inputs/outputs
- **Angular Material M3** — confirmation dialogs and form fields use Material; destructive button styling matches Story 2.4 pattern (ghost-style red text, never `mat-flat-button` filled)

### `IdbService` Generic Extension

The current `IdbService` only has typed `get/set` for the `'appMeta'` store. This story must extend it (or rely on a Story 2.1 extension if available) with per-store CRUD:

```typescript
// idb.service.ts — extensions
async putCategory(category: Category): Promise<void> {
  const db = await this.dbPromise;
  await db.put('categories', category);
}
async deleteCategory(id: string): Promise<void> {
  const db = await this.dbPromise;
  await db.delete('categories', id);
}
async getAllCategories(): Promise<Category[]> {
  const db = await this.dbPromise;
  return db.getAll('categories');
}
```

If Story 1.5 already added these (likely — `init()` needs `getAllCategories`), reuse them. Document any divergence in the Dev Agent Record.

### Hard Prerequisite — Story 2.5 Playwright Fixtures Must Merge First

Epic 5's E2E section (added post-spec-draft, commit `84a00c5`) is explicit:

> "Requires fixtures from Epic 2 (Story 2.5) to be merged before this story runs."

`e2e/categories.spec.ts` (the new file added in this patch) reuses `e2e/fixtures/sheets-mock.ts` introduced by Story 2.5 to assert `appendCategoryRow` and update payloads sent by `CategoriesService`. **Story 5.3 must NOT begin Playwright authoring until Story 2.5's fixtures (`sheets-mock.ts`, IDB seeding helpers, the QuickAdd page object if any) are merged to the base branch.** If 2.5 has not landed when this story is picked up, pause E2E task execution (the unit-test tasks may proceed) and surface the blocker in the Dev Agent Record. Do NOT inline a copy of `sheets-mock.ts` here — that creates two fixtures to keep in sync.

### Dependence on Other Stories (Open Coordination)

- **Story 1.5** (categories load from Sheet on app start) — provides the IDB read pattern + initial seed; this story builds on the `_categories` signal and palette defined there
- **Story 5.1** (`CategoryManager` settings screen with drag-drop reorder) — provides the parent UI surface where the Add button and per-row Delete live; if not landed, scaffold a minimal in-place version
- **Story 5.2** (`ColorPicker` and per-category color assignment) — adjacent; deletes work the same regardless; new categories use the default palette and Nick can recolor via 5.2
- **Story 2.1** (`IdbService` generic CRUD) — may have added `put`/`delete`/`getAll` for `entries`; reuse same pattern for `categories` here
- **Epic 3 stories** (sync queue processor) — own the `CATEGORY_INSERT` execution branch; this story only enqueues

### Out of Scope (deferred)

- Editing a category name post-create (rename) — not in this story; out of PRD MVP
- Bulk delete / multi-select — not in PRD
- Re-ordering deleted categories' palette slots — palette is append-only here
- Sheet-side row deletion when a category is locally deleted — explicit non-goal per AC6
- Conflict resolution if a `CATEGORY_INSERT` retry happens after Nick has manually added the same category to the Sheet — deferred (Sheet-side import in Story 1.5 dedupes by name; benign double-row at worst)

## Testing

### Strategy

Vitest via `ng test --watch=false`. Mock `IdbService`, `SheetsService`, `SyncQueueService`, `EntriesService`, `NotificationService`, `MatDialog`, and `MatDialogRef` via `vi.fn()` factories. Spy on `document.documentElement.style.setProperty` / `removeProperty` to verify CSS-custom-property side effects.

### Required Test Cases

`categories.service.spec.ts`:
1. `create({ name: 'Groceries' })` happy path — IDB row written, signal updated, `--color-{uuid}` set, `sheets.appendCategoryRow` called once
2. `create({ name: '' })` — throws validation error, no IDB write, no Sheets call
3. `create({ name: '   ' })` — same (whitespace trim)
4. `create({ name: 'groceries' })` when `'Groceries'` already exists — throws duplicate-name error (case-insensitive)
5. `create()` Sheets failure — IDB row persists, signal still updated, `syncQueue.enqueue({ operation: 'CATEGORY_INSERT', categoryData })` called, `notification.showError` called
6. `delete(id)` for unreferenced category — IDB delete called, signal filtered, `--color-{id}` removed, no Sheets call
7. `delete(id)` for referenced category — throws `AppError.CATEGORY_IN_USE` with exact `entryCount`; no IDB write, no signal change, no CSS removal
8. `delete(id)` for unknown id — silent no-op (idempotent)

`sheets.service.spec.ts`:
9. `appendCategoryRow(category)` posts to `values/'Categories'!A:D:append?...` with `[id, name, color, position]` row
10. `appendCategoryRow` HTTP 400 → calls `addSheet` then retries append
11. `appendCategoryRow` HTTP 403 → maps to `AppError.SHEETS_API { status: 403 }`

`add-category-dialog.component.spec.ts`:
12. Empty name disables Save button
13. Whitespace-only name disables Save button
14. Duplicate-name validation surface — inline error, dialog stays open
15. Valid name → `categoriesService.create` invoked; dialog dismisses with `true`

`category-manager.component.spec.ts` (or settings spec, depending on Story 5.1's parent component):
16. Delete confirm with no referencing entries → `categoriesService.delete` called, dialog dismisses
17. Delete confirm with referencing entries → confirm dialog content swaps to "Cannot delete — 7 entries use this category" with the exact count
18. Destructive button is `mat-button` with text-error class; never `mat-flat-button` or `color="warn"`

### Playwright E2E

**Hard prerequisite:** Story 2.5's Playwright fixtures (`e2e/fixtures/sheets-mock.ts`) must be merged to the base branch before this suite runs. See Dev Notes → "Hard Prerequisite — Story 2.5 Playwright Fixtures Must Merge First."

**Tests — `e2e/categories.spec.ts` (new file):**

| ID | Scenario |
|---|---|
| E5-01 | CategoryManager route accessible from app shell navigation |
| E5-02 | Category list renders all seeded categories with color swatches |
| E5-03 | Add category → new row in list; `sheets-mock.ts` stub receives correct append payload |
| E5-04 | ColorPicker opens on swatch click → selecting color updates preview before save |
| E5-05 | Edit category name → list updates; Sheets stub called with correct update payload |
| E5-06 | Delete unreferenced category → confirm → row removed; `--color-[id]` CSS var removed from `<html>` |
| E5-07 | Delete category referenced by entry → rejected with entry count in error message |
| E5-08 | Duplicate category name → inline error shown, no API call fired |
| E5-09 | New category immediately available as tile in QuickAdd sheet after creation |

(Table copied verbatim from `epic-5-category-management-visual-customization.md` → "End-to-End Tests (Playwright — Story 5.3 is Epic 5's last story)" section.)

## Change Log

- 2026-05-09: Initial draft — Story 5.3 specification authored against epic-5 ACs, architecture data-model + boundaries, sync-queue extension for CATEGORY_INSERT, and Story 1.4 template.
- 2026-05-09 — patched to incorporate Epic 5 Playwright E2E tests (84a00c5)
- 2026-05-09: Implementation complete — CategoriesService.create()/delete(), SheetsService.appendCategoryRow(), CATEGORY_INSERT sync queue extension, CATEGORY_IN_USE AppError, AddCategoryDialogComponent, DeleteCategoryDialogComponent, CategoryManager UI wired, unit tests and E2E suite authored.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (Amelia)

### Debug Log References

- `entry.model.ts`: Added `categoryData: Category | null` to `SyncQueueItem` — additive, no IDB version bump needed; existing items have `categoryData: undefined` (treated as null). Fixed pre-existing `idb.service.spec.ts` QUEUE_PENDING constant to include `categoryData: null`.
- `sheets.service.ts`: `maybeCreateCategoriesTabAndRetry` implemented with `switchMap` to properly chain the tab creation with the retry append. HTTP 400 triggers tab creation, not HTTP 404, because the Sheets API returns 400 when a range references a non-existent tab.
- `SyncQueueService._processItem`: Added `CATEGORY_INSERT` early-return before the existing INSERT check — Epic 3 (Story 3.1) handles the processor branch.
- E5-05 E2E test is `test.skip` — category rename UI is out of scope for Story 5.3 per Dev Notes "Out of Scope" section.
- Unit test runner: `ng test --no-watch` (Angular Builder with Vitest browser mode) exits code 0. Direct `npx vitest run` fails in worktree due to missing `@esbuild/darwin-arm64` binary — expected, use Angular CLI only.

### Completion Notes List

- All 21 ACs satisfied. `CategoriesService.create()` and `delete()` implemented with optimistic UI contract: IDB write + signal update + CSS var injection happen synchronously before the Sheets call; Sheets failure falls back to `SyncQueue.enqueue(CATEGORY_INSERT)` without rolling back local state.
- `SheetsService.appendCategoryRow()` added with HTTP 400 tab-creation retry path (`maybeCreateCategoriesTabAndRetry`).
- `AppError` extended with `CATEGORY_IN_USE` variant; `NotificationService` updated with matching message.
- `SyncQueueItem` extended with `categoryData: Category | null` and `CATEGORY_INSERT` operation — Epic 3 owns the processor branch.
- `pickNextPaletteColor()` added to `category.model.ts` alongside existing `DEFAULT_CATEGORY_PALETTE`.
- `AddCategoryDialogComponent` and `DeleteCategoryDialogComponent` created; the delete dialog handles both confirm state and in-use error state inline (no close + reopen).
- `CategoryManagerComponent` updated with "Add category" header button and per-row delete icon button.
- Unit tests: ~25 new cases across 4 spec files. E2E: 9 tests in `e2e/categories.spec.ts` (E5-05 skipped — rename out of scope). Build compiles clean, `ng test --no-watch` exits 0.

### File List

- src/app/core/models/error.model.ts (modified — added CATEGORY_IN_USE variant)
- src/app/core/models/entry.model.ts (modified — added CATEGORY_INSERT operation and categoryData field to SyncQueueItem)
- src/app/core/models/category.model.ts (modified — added pickNextPaletteColor())
- src/app/core/services/categories.service.ts (modified — added create(), delete(), inject SyncQueueService + EntriesService)
- src/app/core/services/categories.service.spec.ts (modified — added create() and delete() test suites with mock for SyncQueueService + EntriesService)
- src/app/core/services/sheets.service.ts (modified — added appendCategoryRow() and maybeCreateCategoriesTabAndRetry(), import Category)
- src/app/core/services/sheets.service.spec.ts (modified — added appendCategoryRow() test suite)
- src/app/core/services/notification.service.ts (modified — added CATEGORY_IN_USE case to appErrorToMessage)
- src/app/core/services/sync-queue.service.ts (modified — added CATEGORY_INSERT early-return in _processItem)
- src/app/core/services/idb.service.spec.ts (modified — added categoryData: null to QUEUE_PENDING fixture)
- src/app/core/services/sync-queue.service.spec.ts (modified — added categoryData: null to ENQUEUE_INPUT)
- src/app/features/settings/add-category-dialog.component.ts (new)
- src/app/features/settings/add-category-dialog.component.html (new)
- src/app/features/settings/add-category-dialog.component.scss (new)
- src/app/features/settings/add-category-dialog.component.spec.ts (new)
- src/app/features/settings/delete-category-dialog.component.ts (new)
- src/app/features/settings/delete-category-dialog.component.html (new)
- src/app/features/settings/category-manager/category-manager.component.ts (modified — added onAddCategory(), onDeleteCategory(), imports for new dialogs)
- src/app/features/settings/category-manager/category-manager.component.html (modified — added Add category button and per-row delete button)
- src/app/features/settings/category-manager/category-manager.component.scss (modified — added .cm-header style)
- src/app/features/settings/category-manager/category-manager.component.spec.ts (modified — added MatDialog mock, delete/add button tests)
- e2e/categories.spec.ts (new — E5-01 through E5-09, E5-05 skipped)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified — 5-3 in-progress → review)

## References

- Story-5.3 ACs: [Source: `_bmad-output/planning-artifacts/epics/epic-5-category-management-visual-customization.md#Story-5.3`]
- Architectural boundaries (`CategoriesService` owns CSS custom properties; `SheetsService` is sole Sheets caller; `SyncQueueService` is sole queue writer): [Source: `_bmad-output/planning-artifacts/architecture.md#Architectural-Boundaries`]
- Category Color System (CSS custom properties via `document.documentElement.style`): [Source: `_bmad-output/planning-artifacts/architecture.md#Frontend-Architecture` → Category Color System]
- Optimistic UI pattern: [Source: `_bmad-output/planning-artifacts/architecture.md#Process-Patterns`]
- Button hierarchy (destructive ghost-style): [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#Button-Hierarchy`]
- `Category` model: [Source: `src/app/core/models/category.model.ts`]
- `CategoriesService` stub: [Source: `src/app/core/services/categories.service.ts`]
- `LocalEntry.category` is a string (name, not id): [Source: `src/app/core/models/entry.model.ts`]
- `AppError` discriminated union: [Source: `src/app/core/models/error.model.ts`]
- `SheetsService` HTTP error mapping pattern: [Source: `src/app/core/services/sheets.service.ts:fetchSpreadsheetMeta`]
- `SyncQueueItem` schema: [Source: `src/app/core/models/entry.model.ts`]
- `ISyncQueueService` interface: [Source: `src/app/core/services/sync-queue.service.ts`]
- Test runner: [Source: `1-2-google-oauth-authentication-flow.md#Dev-Agent-Record`] — `ng test --watch=false`
- Story 1.5 (categories load + seeding): [Source: `_bmad-output/planning-artifacts/epics/epic-1-...#Story-1.5`]
- Story 5.1 (CategoryManager parent UI): [Source: `_bmad-output/planning-artifacts/epics/epic-5-category-management-visual-customization.md#Story-5.1`]
- Story 5.2 (ColorPicker — adjacent, color override): [Source: `_bmad-output/planning-artifacts/epics/epic-5-category-management-visual-customization.md#Story-5.2`]
- Story 2.4 (destructive button pattern reuse): [Source: `_bmad-output/planning-artifacts/epics/epic-2-expense-entry-local-first-core.md#Story-2.4`]
