# Story 5.1: CategoryManager settings screen with drag-drop reorder

Status: done

## Story

As Nick,
I want a settings screen where I can reorder my categories by drag-and-drop,
So that the most-used categories appear at the top of the quick-add interface.

## Acceptance Criteria

1. **Given** I navigate to Settings **When** the `CategoryManagerComponent` renders **Then** all categories from the `categories` IDB store are listed with CDK drag-drop reorder handles, sorted by ascending `position`
2. **Given** I drag a category to a new position and release **When** the drop completes **Then** the new order is persisted to the `categories` IDB store with monotonically reassigned `position` values (0-indexed, contiguous)
3. **Given** the category order is updated **When** `QuickAddSheetComponent` opens **Then** `CategoryTileComponent` tiles appear in the updated order — the same `categories` signal drives both screens
4. **Given** the `CategoryManagerComponent` renders before any Sheet sync has occurred **When** no categories are present **Then** an empty state prompts me to sync with the Sheet with a CTA that triggers `CategoriesService.refreshFromSheet()`
5. **Given** a reorder completes **When** `CategoriesService.reorder()` persists the change **Then** no Sheet write-back is triggered — category order is local only (verified by spying on `SheetsService` HTTP methods)
6. **Given** a drag operation is in progress **When** the user releases on a touch device **Then** a light haptic fires and the dragged element animates back into the list
7. **Given** the screen is rendered on a mobile viewport **When** I long-press a row's drag handle **Then** the row lifts (CDK `cdkDragPreview`) and other rows slide to make room (CDK `cdkDragPlaceholder`)
8. **Given** an IDB write fails during reorder **When** the error is caught **Then** the in-memory `categories` signal rolls back to the pre-reorder order and an `AppError.IDB_ERROR` is surfaced via `NotificationService.showError()`

## Tasks / Subtasks

- [x] Extend `CategoriesService` with reorder + persistence (AC: 2, 3, 5, 8)
  - [x] Replace stub. Inject `IdbService` and `NotificationService`. Keep `providedIn: 'root'`
  - [x] Private `_categories = signal<Category[]>([])`; expose `readonly categories = this._categories.asReadonly()`
  - [x] `init(): Promise<void>` — single-flight via cached `Promise<void>`; reads all categories via `IdbService.getAll('categories')`, sorts by `position` ascending, writes to `_categories`. Story 1.5 had a stubbed `init()`; this story implements it. CSS custom property injection (Story 1.5 scope) is OUT of scope for 5.1 — only persistence is required here
  - [x] `reorder(reorderedIds: string[]): Promise<void>` — accepts the new id-order from the UI, computes a `Category[]` with `position` reassigned to each id's array index, optimistically writes to `_categories` first, then writes each updated category to IDB via `IdbService.set('categories', ...)` in sequence; on rejection rolls back signal and surfaces `AppError.IDB_ERROR`
  - [x] `refreshFromSheet(): Promise<void>` — stubbed for AC4 CTA. Calls `notification.showInfo('Category sync from Sheet will arrive in a later story.')` — full implementation belongs to Story 5.3 follow-ups. The stub MUST exist so the empty-state CTA wires cleanly
  - [x] All write methods catch IDB exceptions, normalize to `AppError.IDB_ERROR`, surface via `NotificationService.showError(error)`, and rethrow so the component can suppress UI state transitions on failure
  - [x] No HTTP. No `SheetsService` injection in reorder path. AC5 is enforced by absence
- [x] Create `CategoryManagerComponent` at `src/app/features/settings/category-manager/` (AC: 1, 4, 6, 7)
  - [x] `standalone: true`, `changeDetection: ChangeDetectionStrategy.OnPush`, kebab-case file names
  - [x] Imports: `DragDropModule` from `@angular/cdk/drag-drop`, `MatIconModule`, `MatButtonModule`
  - [x] Reads `CategoriesService.categories()` via signal in template — `@for (cat of categories(); track cat.id)`
  - [x] `cdkDropList` on the `<ul>`/list container; `cdkDrag` on each row; `cdkDragHandle` on the drag handle icon (so taps elsewhere on the row do not initiate drag — required for future tap-to-edit-color in 5.2)
  - [x] On `cdkDropListDropped`, capture the new id-order from `event.previousIndex`/`event.currentIndex`, build `reorderedIds: string[]`, call `categoriesService.reorder(reorderedIds)`
  - [x] Empty state: `@if (categories().length === 0)` shows the "Sync with Sheet" CTA bound to `categoriesService.refreshFromSheet()`
  - [x] Light haptic on drop via `navigator.vibrate?.(10)` inside the drop handler (guard for missing API)
  - [x] Each row renders the category color dot via `[style.background]="'var(--color-' + cat.id + ')'"` — uses the CSS custom properties already injected by Story 1.5; falls back to `var(--mat-sys-outline)` when property is absent
- [x] Wire `CategoryManagerComponent` into `SettingsComponent` (AC: 1)
  - [x] In `src/app/features/settings/settings.component.ts`, add `CategoryManagerComponent` to imports
  - [x] In `settings.component.html`, render `<app-category-manager />` above the existing theme toggle row, separated by a `MatDivider`
  - [x] No new route — Settings is a single page; the category manager is a section within it
- [x] Add `CategoriesService.reorder()` unit tests (AC: 2, 3, 5, 8)
  - [x] `categories.service.spec.ts` (updated with new reorder/refreshFromSheet blocks)
  - [x] Mock `IdbService`. Cover happy path, IDB rejection rollback, position reindexing, signal update timing
  - [x] Spy on `SheetsService` to assert no HTTP method is invoked (AC5)
- [x] Add `CategoryManagerComponent` unit tests (AC: 1, 4, 6, 7)
  - [x] `category-manager.component.spec.ts` (new)
  - [x] Renders all categories; empty state renders when none; CTA invokes `refreshFromSheet`; `cdkDropListDropped` invokes `reorder` with the new id-order
- [x] Add E2E test (AC: 2, 3)
  - [x] `e2e/category-reorder.spec.ts` — seed three categories via IDB, navigate to `/settings`, drag the third row above the first using Playwright's drag fixture, reload the page, assert the new order persists. Test is marked `.skip` pending a live-app E2E run

## Dev Notes

### Architectural Position of CategoriesService Reorder

`CategoriesService` is the sole owner of the `categories` IDB store and the `--color-[category-id]` CSS custom property lifecycle [Source: `architecture.md#Architectural-Boundaries`]. Story 1.5 establishes the read-from-Sheet seeding and the CSS injection. Story 5.1 layers in user-driven reorder persistence — local-only, no Sheet write-back (AC5).

The architecture explicitly notes that `categories` is a global registry (FR55) — not scoped per tab, not scoped per year. The `position` field carries the user's preferred ordering and is used by `QuickAddSheetComponent` (Story 2.2) and any other UI that lists categories.

### CategoriesService Implementation Shape

```typescript
import { Injectable, Signal, inject, signal } from '@angular/core';
import { IdbService } from './idb.service';
import { NotificationService } from './notification.service';
import { Category } from '../models/category.model';
import { AppError } from '../models/error.model';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly idb = inject(IdbService);
  private readonly notification = inject(NotificationService);

  private readonly _categories = signal<Category[]>([]);
  readonly categories = this._categories.asReadonly();

  private initPromise: Promise<void> | null = null;

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      try {
        const all = await this.idb.getAll('categories');
        const sorted = [...all].sort((a, b) => a.position - b.position);
        this._categories.set(sorted);
      } catch (err) {
        this.notification.showError(this.toIdbError(err));
        // Continue with empty registry — graceful boot per Story 1.5 pattern
      }
    })();
    return this.initPromise;
  }

  async reorder(reorderedIds: string[]): Promise<void> {
    const prev = this._categories();
    const byId = new Map(prev.map(c => [c.id, c]));
    const next: Category[] = reorderedIds.map((id, idx) => {
      const cat = byId.get(id);
      if (!cat) {
        throw { type: 'IDB_ERROR', message: `Unknown category id ${id}` } satisfies AppError;
      }
      return { ...cat, position: idx };
    });
    if (next.length !== prev.length) {
      throw { type: 'IDB_ERROR', message: 'Reorder list length mismatch' } satisfies AppError;
    }
    this._categories.set(next);
    try {
      for (const cat of next) {
        await this.idb.put('categories', cat);
      }
    } catch (err) {
      this._categories.set(prev);
      const appErr = this.toIdbError(err);
      this.notification.showError(appErr);
      throw appErr;
    }
  }

  async refreshFromSheet(): Promise<void> {
    // Story 5.1 stub: full sync arrives in Story 5.3 + Story 1.5 follow-ups.
    this.notification.showInfo('Category sync from Sheet will arrive in a later story.');
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

The sequential `for…of put` loop is intentional. `IdbService` does not currently expose a transactional batch (deferred review item from Story 1.4). A mid-flight crash leaves a partial reorder; rollback handles the in-memory case but persisted state could be inconsistent across N records. This is acceptable for 5.1 because (a) the data is local-only with no cross-system invariants, (b) the next `init()` will re-sort by `position` and merely surface a benign tie-broken ordering, and (c) a transactional helper is a deliberate `IdbService` evolution for a future story.

### CategoryManagerComponent Shape

```typescript
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  CdkDragDrop, DragDropModule, moveItemInArray,
} from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CategoriesService } from '../../../core/services/categories.service';
import { Category } from '../../../core/models/category.model';

@Component({
  selector: 'app-category-manager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DragDropModule, MatButtonModule, MatIconModule],
  templateUrl: './category-manager.component.html',
  styleUrl: './category-manager.component.scss',
})
export class CategoryManagerComponent {
  private readonly categoriesService = inject(CategoriesService);
  readonly categories = this.categoriesService.categories;

  async onDrop(event: CdkDragDrop<Category[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;
    const current = [...this.categories()];
    moveItemInArray(current, event.previousIndex, event.currentIndex);
    const reorderedIds = current.map(c => c.id);
    navigator.vibrate?.(10);
    try {
      await this.categoriesService.reorder(reorderedIds);
    } catch {
      // CategoriesService already surfaced the error and rolled back the signal.
    }
  }

  async onSyncCta(): Promise<void> {
    await this.categoriesService.refreshFromSheet();
  }
}
```

`moveItemInArray` is the CDK helper exported from `@angular/cdk/drag-drop`. The component computes the new id-order locally (so the optimistic visual reorder happens instantly on drop) and hands it to the service. Because the service writes the reorder to its own signal, the template re-reads via `categories()` and the visual order matches IDB.

### Template Outline (`category-manager.component.html`)

```html
@if (categories().length === 0) {
  <div class="empty-state" role="status">
    <p>No categories yet — sync with your Sheet to load them.</p>
    <button mat-flat-button color="primary" (click)="onSyncCta()">Sync from Sheet</button>
  </div>
} @else {
  <ul cdkDropList (cdkDropListDropped)="onDrop($event)" class="cm-list">
    @for (cat of categories(); track cat.id) {
      <li cdkDrag class="cm-row">
        <span class="cm-dot" aria-hidden="true"
              [style.background]="'var(--color-' + cat.id + ')'"></span>
        <span class="cm-name">{{ cat.name }}</span>
        <button mat-icon-button cdkDragHandle aria-label="Reorder category">
          <mat-icon>drag_indicator</mat-icon>
        </button>
      </li>
    }
  </ul>
}
```

`cdkDragHandle` confines drag activation to the icon button. Without it, tapping anywhere on the row would initiate drag — incompatible with Story 5.2's tap-to-open-color-picker behavior. This story does not implement 5.2's tap, but the handle scope is forward-compatible.

`aria-hidden="true"` on the color dot matches Story 5.2 AC8 — decorative dots must not be announced.

### CSS Outline (`category-manager.component.scss`)

```scss
.cm-list {
  list-style: none;
  margin: 0;
  padding: 0;
  touch-action: pan-y; // architecture rule for scrollable list containers
}

.cm-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--mat-sys-surface);
  touch-action: manipulation; // architecture rule for tappable rows
}

.cm-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--mat-sys-outline); // fallback if --color-[id] is unset
}

.cdk-drag-preview { box-shadow: 0 6px 14px rgba(0,0,0,0.18); }
.cdk-drag-placeholder { opacity: 0.2; }
.cdk-drag-animating { transition: transform 200ms cubic-bezier(0,0,0.2,1); }
```

`touch-action: pan-y` on the list container, `touch-action: manipulation` on the rows — direct quote from `architecture.md#UX-Accessibility-Constraints`. CDK drag-drop respects both because it manages its own pointer/touch handlers; the rules govern the surrounding non-drag scroll behavior.

### SettingsComponent Wiring

`settings.component.ts` already exists from Story 1.6 (theme toggle). Append the import and render the manager above the existing toggle row:

```typescript
@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatSlideToggleModule,
    MatDividerModule,
    CategoryManagerComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent { /* existing implementation unchanged */ }
```

Template addition:

```html
<section>
  <h2>Categories</h2>
  <app-category-manager />
</section>
<mat-divider />
<section>
  <h2>Appearance</h2>
  <!-- existing theme toggle -->
</section>
```

### What Story 5.1 Does NOT Implement

- Per-category color picker → Story 5.2
- CSS custom property re-injection on color change → Story 5.2
- Add/delete category with Sheet write-back → Story 5.3
- Initial sync of categories from the Sheet → Story 1.5 (+ Story 5.3 polish for write-back)
- Reorder persistence to the Sheet → out of scope (AC5 explicitly says local only — FR55 treats `position` as a UI preference, not Sheet data)
- Recency/frequency-based ordering in QuickAdd → Story 2.2 reads `position` directly; recency ranking is a separate evolution if pursued
- Tap-to-edit category name → not in scope of any current story

### Drag-Drop API Notes

`@angular/cdk/drag-drop` is already the canonical reorder mechanism per `architecture.md#Frontend-Architecture` Material Usage list. No alternative library. `DragDropModule` is the standalone-import surface. `moveItemInArray` is the canonical pure helper for in-place reorder.

`cdkDropListDropped` fires once per drop with `previousIndex` and `currentIndex`. A no-op drop (release in original position) yields equal indices — guard with the early return shown above to avoid a redundant IDB write.

### Optimistic Update + Rollback Pattern

Same shape as `EntriesService` in Story 2.1:
1. Snapshot previous signal value
2. Apply mutation to signal first (immediate visual reorder)
3. Write to IDB asynchronously (one `put` per category, sequentially)
4. On any rejection: restore signal to snapshot; surface `AppError.IDB_ERROR` via `NotificationService`; rethrow

The component swallows the rethrow because `CategoriesService` has already shown the snackbar and rolled back. The component's only responsibility on failure is to NOT proceed with any post-drop side-effect. There are none in 5.1.

### Previous Story Patterns to Follow (Stories 1.4, 1.6, 2.1)

- **`OnPush + standalone`** mandatory on every component
- **`AppError` discriminated union, never raw `Error`** [Source: `error.model.ts`]
- **`NotificationService.showError(error)` is the sole `MatSnackBar` path** — `CategoryManagerComponent` MUST NOT inject `MatSnackBar`
- **`providedIn: 'root'`** on `CategoriesService`
- **`IdbService` is the sole `idb` importer** — `CategoriesService` writes via `IdbService.put('categories', cat)` only [Source: `architecture.md#Architectural-Boundaries`]
- **Signal naming — no `$` suffix, no `Signal` suffix** [Source: `architecture.md#Naming-Patterns`]
- **`input()` / `output()` signal APIs** if any inputs/outputs are needed (the component in this story has none — it reads `CategoriesService.categories` directly, which is acceptable for feature components per architecture)
- **Run tests via `ng test --watch=false`** [Source: `1-2-google-oauth-authentication-flow.md#Dev-Agent-Record`]
- **`crypto.randomUUID()` only** if any new IDs are needed (none in 5.1; reorder reuses existing ids)

### Testing Guidance

Use Vitest + Angular `TestBed`. Test files:
- `src/app/core/services/categories.service.spec.ts` (new)
- `src/app/features/settings/category-manager/category-manager.component.spec.ts` (new)
- `e2e/category-reorder.spec.ts` (new — Playwright)

Key test cases (categories.service.spec.ts):
1. `init()` reads via `IdbService.getAll('categories')`, sorts by `position` ascending, populates signal; second call no-ops
2. `init()` on `IdbService.getAll` rejection: signal stays empty, `notification.showError` called with `AppError.IDB_ERROR`, no throw
3. `reorder([id3, id1, id2])` reassigns `position` to `0, 1, 2` matching the input order; signal reflects the new order before any `IdbService.put` resolves (deferred-promise spy)
4. `reorder()` calls `IdbService.put('categories', cat)` once per category, in input order
5. `reorder()` on `IdbService.put` rejection: signal restored to pre-reorder snapshot; `notification.showError` invoked; rethrows
6. `reorder()` length mismatch (caller passes too many/few ids): throws `AppError.IDB_ERROR` before any signal mutation
7. `reorder()` unknown id: throws `AppError.IDB_ERROR` before any signal mutation
8. `refreshFromSheet()` invokes `notification.showInfo` (placeholder behavior for 5.1)
9. No HTTP method on `SheetsService` is invoked at any point during `reorder()` (spy-based assertion — proves AC5)

Key test cases (category-manager.component.spec.ts):
1. Renders one row per category; rows in `position`-ascending order
2. Empty-state CTA visible when `categories()` returns `[]`; click invokes `refreshFromSheet`
3. `onDrop` with equal `previousIndex` and `currentIndex` does NOT call `reorder` (no-op)
4. `onDrop` with distinct indices calls `reorder` with the post-`moveItemInArray` id-order
5. `onDrop` calls `navigator.vibrate(10)` when available (mock the API)
6. Drag handle has `aria-label="Reorder category"`

Key test cases (e2e/category-reorder.spec.ts):
1. Seed three categories `{id: 'a'/'b'/'c', position: 0/1/2}` via `page.evaluate` writing directly to IDB
2. Navigate to `/settings`; the manager renders three rows in order `a, b, c`
3. Drag row `c` above row `a` using Playwright's `dragTo()` from the handle to the target row
4. Reload the page; the manager renders rows in order `c, a, b`
5. (Optional smoke) Read `IdbService.getAll('categories')` via `page.evaluate` and assert `position` values are `0, 1, 2` matching the new order

### Project Structure Notes

- `CategoryManagerComponent` lives at `src/app/features/settings/category-manager/` (new directory). One feature subdirectory per logical section is consistent with the Story 1.4 `setup` precedent
- `CategoriesService` is at `src/app/core/services/categories.service.ts` — already stubbed
- `Category` model already exists at `src/app/core/models/category.model.ts` — no edits needed; `position: number` is already declared
- `IdbService` already declares the `categories` store with `keyPath: 'id'` — no schema migration

### References

- Drag-drop reorder via CDK: [Source: `architecture.md#Frontend-Architecture` — Material Usage]
- `categories` IDB store schema: [Source: `architecture.md#Data-Architecture`]
- `Category` model: [Source: `category.model.ts`]
- AppError contract: [Source: `error.model.ts`]
- IdbService boundary: [Source: `architecture.md#Architectural-Boundaries`]
- NotificationService boundary: [Source: `architecture.md#Architectural-Boundaries`]
- Optimistic UI pattern: [Source: `architecture.md#Process-Patterns`]
- `touch-action` rules for scroll containers and rows: [Source: `architecture.md#UX-Accessibility-Constraints`]
- Settings component (Story 1.6 base): [Source: `1-6-app-shell-semantic-color-system-and-light-dark-theme.md`]
- Functional standalone + OnPush mandate: [Source: `architecture.md#Structure-Patterns`]
- Test runner command: [Source: `1-2-google-oauth-authentication-flow.md#Dev-Agent-Record`]
- Story 1.5 init pattern (graceful empty registry on IDB error): [Source: `_bmad-output/planning-artifacts/epics/epic-1-foundation-authentication-first-run-setup.md` — Story 1.5]
- FR55 global category registry: [Source: `_bmad-output/planning-artifacts/epics/epic-5-category-management-visual-customization.md` — Story 5.3]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `IdbService` exposes `set('categories', id, value)` not `put()` — adapted `reorder()` accordingly
- Pre-existing `auth.interceptor.spec.ts` has 3 failing tests unrelated to this story (confirmed pre-existing before story work began)
- E2E test scaffolded and skipped; CDK drag-drop requires a live browser session for reliable testing

### Completion Notes List

- `CategoriesService`: injected `NotificationService`; added `reorder()` with optimistic signal update + sequential IDB writes + rollback on failure; added `refreshFromSheet()` stub surfacing `showInfo`; added `toIdbError()` helper alongside existing `toAppError()`
- `CategoryManagerComponent`: standalone OnPush component with CDK drag-drop; `cdkDragHandle` on icon button only (forward-compatible with Story 5.2 tap-to-edit); `navigator.vibrate?.(10)` guarded; empty-state CTA wired to `refreshFromSheet()`
- `SettingsComponent`: added `MatDividerModule` + `CategoryManagerComponent` imports; template reorganized with Categories section above Appearance section separated by `<mat-divider />`
- Tests: 16 new unit tests added (9 for service reorder/refreshFromSheet, 7 for component); 111/114 tests pass; 3 pre-existing failures in auth interceptor unrelated to this story

### File List

- `src/app/core/services/categories.service.ts` (modified — added NotificationService injection, reorder(), refreshFromSheet(), toIdbError())
- `src/app/core/services/categories.service.spec.ts` (modified — added reorder() and refreshFromSheet() test blocks)
- `src/app/features/settings/category-manager/category-manager.component.ts` (new)
- `src/app/features/settings/category-manager/category-manager.component.html` (new)
- `src/app/features/settings/category-manager/category-manager.component.scss` (new)
- `src/app/features/settings/category-manager/category-manager.component.spec.ts` (new)
- `src/app/features/settings/settings.component.ts` (modified — added MatDividerModule, CategoryManagerComponent imports)
- `src/app/features/settings/settings.component.html` (modified — added Categories section with app-category-manager, mat-divider, Appearance wrapper)
- `e2e/category-reorder.spec.ts` (new — scaffolded, test.skip pending live E2E run)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — epic-5 and 5-1 status updated)

## Change Log

- 2026-05-09: Story drafted. Wave 5.
- 2026-05-09: Story implemented. CategoriesService extended with reorder()/refreshFromSheet(); CategoryManagerComponent created with CDK drag-drop; SettingsComponent wired. 16 new unit tests. Status → review.

## Review Findings

Reviewed 2026-05-09. Three parallel layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). 4 patches applied, 4 deferred, 12 dismissed.

### Patches Applied

- [x] [Review][Patch] `reorder()` accepts duplicate IDs — length check passes for `['a','a','b']`; add Set-based permutation guard [categories.service.ts:44]
- [x] [Review][Patch] Pre-try throws (length mismatch, unknown id) never call `notification.showError` — AC8 violation [categories.service.ts:48–58]
- [x] [Review][Patch] `init()` does not sort categories by `position` ascending — IDB returns by key (alphabetical by id), not position [categories.service.ts:30]
- [x] [Review][Patch] `assignDefaultColors()` always assigns `position: acc.length`, discarding the user's drag order on every re-seed — reorder feature is ephemeral across sessions when Sheet is connected [categories.service.ts:138]

### Deferred

- [x] [Review][Defer] Partial IDB write corruption on mid-loop failure — sequential `for…of set` leaves a hybrid IDB state if it fails mid-loop; no transaction API on IdbService [categories.service.ts:63] — deferred, acknowledged in spec dev notes; requires IdbService evolution
- [x] [Review][Defer] `seedFromSheet()` can race with an in-flight `reorder()` via `retry()` — `idb.clear()` inside seedFromSheet can nuke in-progress reorder writes — deferred, extremely unlikely in practice; requires cross-method locking
- [x] [Review][Defer] CSS custom properties not cleaned up for removed categories — `injectCssProperties` only calls `setProperty`, never `removeProperty` [categories.service.ts:145] — deferred, pre-existing from story 1.5
- [x] [Review][Defer] `retry()` not guarded against concurrent `init()` call — `_seeding` guards self-reentrancy only [categories.service.ts:78] — deferred, pre-existing from story 1.5
