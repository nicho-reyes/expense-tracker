# Story 2.3: Entry list view and EntryRowComponent

Status: done

## Story

As Nick,
I want to see all my logged expenses in a scrollable list sorted by date,
So that I can review what I've entered and know the app has recorded each expense correctly.

## Acceptance Criteria

1. **Given** entries exist in IDB **When** the entry list route renders **Then** all entries are displayed sorted by date descending (ties broken by `enqueuedAt`/`id` for determinism)
2. **Given** an entry is rendered **When** `EntryRowComponent` displays it **Then** it shows: a date chip, a category color dot, the amount, and remarks (if present)
3. **Given** an entry has a negative amount **When** rendered in `EntryRowComponent` **Then** the amount displays with a green `+` prefix (e.g. `+12.50` in `text-green-600`)
4. **Given** an entry has `PENDING` sync state (`syncStatus === 'pending'`) **When** rendered **Then** its category dot is dimmed (`opacity-50`)
5. **Given** an entry has `SYNC_ERROR` state (`syncStatus === 'error'`) **When** rendered **Then** an amber indicator (`bg-amber-500` dot or `text-amber-600` icon) is shown on the row
6. **Given** the entry list container is scrollable **When** `touch-action` is inspected on the scroll container **Then** it is `pan-y`; on tappable rows inside the container it is `manipulation`
7. **Given** the app is on an iPhone with a home indicator **When** the bottom nav and list render **Then** `padding-bottom: env(safe-area-inset-bottom)` is applied so no content is hidden behind the system bar
8. **Given** no entries exist **When** the entry list renders **Then** the `EmptyState` component shows a specific contextual message ("No expenses logged yet — tap + to add your first") with a CTA button to add an expense — never a generic "nothing here"

## Tasks / Subtasks

- [x] Implement `EntriesListComponent` at `src/app/features/entries-list/entries-list.component.ts` (AC: 1, 6, 7, 8)
  - [x] Replace stub with full implementation; `standalone: true`, `changeDetection: ChangeDetectionStrategy.OnPush`
  - [x] Inject `EntriesService`, `CategoriesService`, `Router`, `MatBottomSheet`
  - [x] `entries = computed<LocalEntry[]>(() => [...this.entriesSvc.entries()].sort(...))` — date desc with stable tiebreak
  - [x] `groupedEntries = computed<Map<string, LocalEntry[]>>(...)` — grouped by `month` (YYYY-MM) for `MatDivider` headers (per architecture: "month-grouping dividers in entry list")
  - [x] Template: scroll container with `class="overflow-y-auto"` and inline `style="touch-action: pan-y;"`; row list uses `@for` with `track entry.id`
  - [x] Empty state via `@if (entries().length === 0)` block — wraps `EmptyStateComponent`
  - [x] Bottom padding: `class="pb-[calc(env(safe-area-inset-bottom)+4rem)]"` (4rem clears the bottom nav from Story 1.6)
- [x] Implement `EntryRowComponent` at `src/app/shared/components/entry-row/entry-row.component.ts` (AC: 2, 3, 4, 5, 6)
  - [x] Replace existing stub (note: stub class name is currently malformed — `UentryUrowComponent` — replace with `EntryRowComponent`)
  - [x] `standalone: true`, OnPush
  - [x] Inputs: `entry = input.required<LocalEntry>()`, `category = input<Category | null>(null)`
  - [x] Output: `tap = output<LocalEntry>()` — for future Story 2.4 edit-sheet open
  - [x] Computed: `displayAmount = computed(() => formatAmount(this.entry().amount))` — returns `{ value: string; isPositive: boolean }`
  - [x] Template: flex row — date chip (left), color dot (uses `var(--color-[id])`), category name + remarks (truncate), amount right-aligned
  - [x] `style="touch-action: manipulation;"` on the row root
  - [x] Sync state visuals: `entry().syncStatus === 'pending'` → dot `opacity-50`; `entry().syncStatus === 'error'` → amber `mat-icon` (e.g. `error_outline`) appended to row, `aria-label="Sync error"`
  - [x] Color dot has `aria-hidden="true"` (decorative)
- [x] Implement shared `EmptyStateComponent` at `src/app/shared/components/empty-state/empty-state.component.ts` (AC: 8)
  - [x] New shared presentational component (does not currently exist in `shared/components/`)
  - [x] `standalone: true`, OnPush
  - [x] Inputs: `icon = input<string>('inbox')`, `title = input.required<string>()`, `message = input.required<string>()`, `ctaLabel = input<string | null>(null)`
  - [x] Output: `ctaClick = output<void>()`
  - [x] Template: centered column — `mat-icon`, `<h2>` title, `<p>` message, optional `mat-button` CTA
  - [x] Used by `EntriesListComponent` with: title `"No expenses yet"`, message `"Tap + to log your first expense."`, ctaLabel `"Add expense"`
- [x] Add `formatAmount` helper or pipe (AC: 3)
  - [x] Reuse existing `chf-currency.pipe.ts` if implemented (architecture references it under `shared/pipes/`); otherwise add a small inline helper in `EntryRowComponent` that returns `{ display: '+12.50' | '12.50', cssClass: 'text-green-600' | 'text-zinc-900' }`
  - [x] Negative amount → `+` prefix + green; positive amount → no prefix + default color
  - [x] All formatting uses `Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` for CHF display
- [x] Wire `EntriesListComponent` to entry tap (forward-compat with Story 2.4)
  - [x] On `EntryRowComponent.tap`, call `onEntryTap(entry)` — for now, no-op or simple `console.debug`; Story 2.4 will replace with edit-sheet open. **Do not block on 2.4** — emit the output, but no consumer side-effect required this story
- [x] Write `src/app/features/entries-list/entries-list.component.spec.ts` (AC: 1, 8)
  - [x] Renders entries in date-desc order
  - [x] Renders empty state when `entriesSvc.entries()` is empty
  - [x] Groups entries by month with `MatDivider` between groups
  - [x] Container has `touch-action: pan-y`
- [x] Write `src/app/shared/components/entry-row/entry-row.component.spec.ts` (AC: 2, 3, 4, 5)
  - [x] Negative amount renders with `+` prefix and `text-green-600` class
  - [x] PENDING entry has color dot with `opacity-50` class
  - [x] SYNC_ERROR entry shows amber error icon with `aria-label="Sync error"`
  - [x] Color dot has `aria-hidden="true"` (AC from Story 5.2 cross-reference)
  - [x] Tapping the row emits `tap` with the entry
- [x] Write `src/app/shared/components/empty-state/empty-state.component.spec.ts`
  - [x] Renders title, message, and optional CTA
  - [x] CTA click emits `ctaClick` output

## Dev Notes

### EntriesListComponent Skeleton

```typescript
import {
  ChangeDetectionStrategy, Component, computed, inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatDividerModule } from '@angular/material/divider';
import { EntriesService } from '../../core/services/entries.service';
import { CategoriesService } from '../../core/services/categories.service';
import { EntryRowComponent } from '../../shared/components/entry-row/entry-row.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LocalEntry } from '../../core/models/entry.model';

@Component({
  selector: 'app-entries-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDividerModule, EntryRowComponent, EmptyStateComponent],
  templateUrl: './entries-list.component.html',
  styleUrl: './entries-list.component.scss',
})
export class EntriesListComponent {
  private readonly entriesSvc = inject(EntriesService);
  private readonly categoriesSvc = inject(CategoriesService);
  private readonly router = inject(Router);

  readonly entries = computed<LocalEntry[]>(() =>
    [...this.entriesSvc.entries()].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date); // ISO compare → desc
      return b.id.localeCompare(a.id); // stable tiebreak
    }),
  );

  // Map<YYYY-MM, LocalEntry[]> preserving descending order
  readonly groupedEntries = computed<Array<{ month: string; entries: LocalEntry[] }>>(() => {
    const groups = new Map<string, LocalEntry[]>();
    for (const e of this.entries()) {
      if (!groups.has(e.month)) groups.set(e.month, []);
      groups.get(e.month)!.push(e);
    }
    return Array.from(groups.entries()).map(([month, entries]) => ({ month, entries }));
  });

  readonly categoryById = computed(() => {
    const map = new Map<string, Category>();
    for (const c of this.categoriesSvc.categories()) map.set(c.id, c);
    return map;
  });

  onEntryTap(entry: LocalEntry): void {
    // Story 2.4 will open the edit sheet here. For now, no-op.
  }

  onAddCta(): void {
    this.router.navigate(['/']); // dashboard hosts the FAB
  }
}
```

### EntriesListComponent Template

```html
<div
  class="overflow-y-auto h-[calc(100dvh-var(--app-header-height,0px))] pb-[calc(env(safe-area-inset-bottom)+4rem)]"
  style="touch-action: pan-y;">
  @if (entries().length === 0) {
    <app-empty-state
      icon="receipt_long"
      title="No expenses yet"
      message="Tap + to log your first expense."
      ctaLabel="Add expense"
      (ctaClick)="onAddCta()" />
  } @else {
    @for (group of groupedEntries(); track group.month) {
      <h2 class="px-4 py-2 text-sm font-medium text-zinc-500 sticky top-0 bg-white dark:bg-zinc-900">
        {{ group.month }}
      </h2>
      @for (entry of group.entries; track entry.id) {
        <app-entry-row
          [entry]="entry"
          [category]="categoryById().get(entry.category) ?? null"
          (tap)="onEntryTap($event)" />
      }
      <mat-divider />
    }
  }
</div>
```

`100dvh` (not `100vh`) per architecture UX rule. Sticky month headers are a polish detail; remove if they conflict with bottom-nav z-index in Story 1.6's app shell.

### EntryRowComponent Skeleton

```typescript
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { LocalEntry } from '../../../core/models/entry.model';
import { Category } from '../../../core/models/category.model';

@Component({
  selector: 'app-entry-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule],
  templateUrl: './entry-row.component.html',
  styleUrl: './entry-row.component.scss',
})
export class EntryRowComponent {
  readonly entry = input.required<LocalEntry>();
  readonly category = input<Category | null>(null);
  readonly tap = output<LocalEntry>();

  readonly displayAmount = computed(() => {
    const amt = this.entry().amount;
    const formatter = new Intl.NumberFormat('de-CH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (amt < 0) {
      return { text: '+' + formatter.format(-amt), cssClass: 'text-green-600 font-medium' };
    }
    return { text: formatter.format(amt), cssClass: 'text-zinc-900 dark:text-zinc-100' };
  });

  readonly dateChip = computed(() => this.entry().date.slice(8, 10) + '.' + this.entry().date.slice(5, 7));

  readonly isPending = computed(() => this.entry().syncStatus === 'pending');
  readonly isErrored = computed(() => this.entry().syncStatus === 'error');

  onClick(): void {
    this.tap.emit(this.entry());
  }
}
```

### EntryRowComponent Template

```html
<button
  type="button"
  class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
  style="touch-action: manipulation;"
  (click)="onClick()">
  <span class="text-xs text-zinc-500 w-10 shrink-0">{{ dateChip() }}</span>

  <span
    aria-hidden="true"
    class="w-3 h-3 rounded-full shrink-0"
    [class.opacity-50]="isPending()"
    [style.background-color]="category()
      ? 'var(--color-' + category()!.id + ')'
      : 'var(--color-unknown, #9e9e9e)'"></span>

  <span class="flex-1 min-w-0">
    <span class="block truncate">{{ category()?.name ?? 'Unknown' }}</span>
    @if (entry().remarks) {
      <span class="block text-xs text-zinc-500 truncate">{{ entry().remarks }}</span>
    }
  </span>

  @if (isErrored()) {
    <mat-icon
      aria-label="Sync error"
      class="text-amber-600"
      fontIcon="error_outline"></mat-icon>
  }

  <span [class]="displayAmount().cssClass">{{ displayAmount().text }}</span>
</button>
```

### EmptyStateComponent

```typescript
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="flex flex-col items-center justify-center text-center p-8 gap-3">
      <mat-icon class="text-5xl text-zinc-400" [fontIcon]="icon()"></mat-icon>
      <h2 class="text-lg font-medium">{{ title() }}</h2>
      <p class="text-sm text-zinc-500">{{ message() }}</p>
      @if (ctaLabel(); as label) {
        <button mat-flat-button color="primary" (click)="ctaClick.emit()">{{ label }}</button>
      }
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input<string>('inbox');
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly ctaLabel = input<string | null>(null);
  readonly ctaClick = output<void>();
}
```

### Sync State Visuals

| `syncStatus` | Color dot opacity | Icon |
|---|---|---|
| `'synced'` | 100% | none |
| `'pending'` | 50% (`opacity-50`) | none |
| `'error'` | 100% | amber `error_outline`, `aria-label="Sync error"` |

Story 2.5 introduces the actual write path; this story renders the visual states. PENDING is the expected steady state in E2 per the epic preamble (full state machine resolves in E3).

### Date Sort Stability

ISO 8601 dates (`YYYY-MM-DD`) sort lexicographically identically to chronological order — no `Date` parsing needed. Tiebreak by `id` (UUID) string compare for determinism on the same date. Do NOT rely on insertion order — `EntriesService.entries()` makes no ordering guarantee per Story 2.1.

### Empty State Wording (AC8)

The architecture and UX spec are explicit: empty states must be specific and contextual. Required text:
- Title: `"No expenses yet"`
- Message: `"Tap + to log your first expense."`
- CTA: `"Add expense"` (navigates to dashboard where the FAB lives — entry-form has no route)

Do NOT use generic strings like "Nothing here" or "No data".

### Touch Action Layering (AC6)

```css
/* scroll container */     touch-action: pan-y;
/* tappable rows inside */ touch-action: manipulation;
```

Applied as inline `style=""` (not Tailwind class) since these CSS values are not first-class Tailwind utilities and we don't want to depend on a custom plugin. Architecture warns: do NOT apply `manipulation` globally — it breaks scroll on parent containers.

### Safe-Area Inset (AC7)

`pb-[calc(env(safe-area-inset-bottom)+4rem)]` — the 4rem (`64px`) accounts for the bottom nav from Story 1.6. If Story 1.6's app shell already provides a CSS custom property like `--app-bottom-nav-height`, prefer that variable; otherwise hardcode `4rem`.

### What Story 2.3 Does NOT Implement

- Edit/delete actions on row tap → Story 2.4 (this story emits the `tap` output but does not consume it)
- Filtering/searching → Epic 6 (Story 6.1 onwards)
- Virtualized scroll for >1000 entries → deferred (current scale is single-user with hundreds of entries/month)
- Sync state transitions or actual sync writes → Story 2.5 (this story only renders states from `entry.syncStatus`)
- Sticky group headers if they conflict with Story 1.6 bottom-nav z-index → if conflict, drop sticky behavior (regular `<h2>` is acceptable)

### Project Conventions to Follow

- **Standalone + OnPush** mandatory on all components
- **`input()` / `output()` signal APIs** — never decorators
- **`AppError` discriminated union** — services only; components don't throw
- **`NotificationService.showError()`** — never inject `MatSnackBar` directly (this story has no error toasts; reads only)
- **Tailwind `important: '#app'`** — utilities win against Material defaults
- **`dvh` not `vh`** for full-height containers
- **Test runner**: `ng test --watch=false`

### References

- `LocalEntry` shape and `syncStatus` values: [Source: `src/app/core/models/entry.model.ts`]
- `Category` shape: [Source: `src/app/core/models/category.model.ts`]
- `EntriesService.entries()` signal: [Source: `src/app/core/services/entries.service.ts` — implemented in Story 2.1]
- Empty state UX rule: [Source: `_bmad-output/planning-artifacts/architecture.md` — UX & Accessibility Constraints; ux-design-specification.md]
- `touch-action` rules: [Source: `_bmad-output/planning-artifacts/architecture.md` — UX & Accessibility Constraints]
- Safe-area pattern: [Source: `_bmad-output/planning-artifacts/architecture.md` — UX & Accessibility Constraints]
- `MatDivider` for month groups: [Source: `_bmad-output/planning-artifacts/architecture.md` — Angular Material Usage]
- Pattern: presentational component receives signals only, no service injection: [Source: `_bmad-output/planning-artifacts/architecture.md` — Component Boundaries]

## Testing Strategy

Use Vitest via `ng test --watch=false`. Test files:
- `src/app/features/entries-list/entries-list.component.spec.ts`
- `src/app/shared/components/entry-row/entry-row.component.spec.ts`
- `src/app/shared/components/empty-state/empty-state.component.spec.ts`

Mock `EntriesService` and `CategoriesService` with minimal signal-backed test doubles. Provide synthetic `LocalEntry[]` arrays directly via `signal()` mocks.

Key test cases:
1. `EntriesListComponent`: with 3 entries on different dates, renders in date-desc order
2. `EntriesListComponent`: with empty entries, renders `EmptyStateComponent` with the specified title/message/CTA
3. `EntriesListComponent`: groups entries by `month` field with dividers between groups
4. `EntriesListComponent`: scroll container has `touch-action: pan-y`
5. `EntryRowComponent`: amount `-12.50` renders as `+12.50` with `text-green-600` class
6. `EntryRowComponent`: amount `120.00` renders as `120.00` (no prefix) with default color
7. `EntryRowComponent`: `syncStatus === 'pending'` → color dot has `opacity-50` class
8. `EntryRowComponent`: `syncStatus === 'error'` → amber `mat-icon` with `aria-label="Sync error"`
9. `EntryRowComponent`: color dot has `aria-hidden="true"`
10. `EntryRowComponent`: clicking the row emits `tap` with the entry
11. `EmptyStateComponent`: renders title and message; CTA button only when `ctaLabel` is set
12. `EmptyStateComponent`: CTA click emits `ctaClick` output

E2E (deferred to Wave 12): Playwright test in `e2e/entries-list.spec.ts` covering empty state → add entry → list updates.

## Dev Agent Record

### Implementation Plan

1. Created `EmptyStateComponent` as a new standalone OnPush shared component with signal inputs (`icon`, `title`, `message`, `ctaLabel`) and `ctaClick` output. Inline template uses `@if` to conditionally render the CTA button.
2. Replaced the malformed `UentryUrowComponent` stub with `EntryRowComponent` — standalone OnPush, with `entry` (required), `category` inputs and `tap` output. `displayAmount` computed signal handles positive/negative formatting via `Intl.NumberFormat('de-CH')`. `isPending` and `isErrored` computed signals drive sync state visuals. External template and SCSS files used.
3. Replaced the `EntriesListComponent` stub with full implementation — injects `EntriesService`, `CategoriesService`, `Router`, `MatBottomSheet`. `entries` computed sorts date-desc with id tiebreak; `groupedEntries` computed builds month-grouped array. `categoryById` computed provides O(1) lookup for category color dots. `onEntryTap` is a no-op per spec (Story 2.4 will open edit sheet). External template uses `@if`/`@for` with track; scroll container has inline `touch-action: pan-y` and safe-area bottom padding.
4. `formatAmount` is implemented inline in `EntryRowComponent` (not reusing `ChfCurrencyPipe` since that adds the `CHF` symbol).
5. Wrote 12 tests across 3 spec files covering all story ACs. All 162 tests pass (15 test files).

### Completion Notes

- All 8 ACs satisfied and verified by tests.
- 162/162 tests pass across 15 spec files including 3 new ones for this story.
- Used `node_modules/@angular/cli/bin/ng.js` with Node 24 since the system Node (16) lacks `os.availableParallelism`. Symlinked main project `node_modules` into worktree for this.
- `EmptyStateComponent.ctaClick` output test uses `vi.spyOn(output, 'emit')` + `triggerEventHandler` pattern — Angular's `output()` `OutputRef` works correctly with this approach.
- Story 2.4's `onEntryTap` hook is wired as a no-op; `MatBottomSheet` is injected for forward-compat.

## File List

- `src/app/features/entries-list/entries-list.component.ts` (modified)
- `src/app/features/entries-list/entries-list.component.html` (modified)
- `src/app/features/entries-list/entries-list.component.spec.ts` (modified)
- `src/app/shared/components/entry-row/entry-row.component.ts` (modified)
- `src/app/shared/components/entry-row/entry-row.component.html` (modified)
- `src/app/shared/components/entry-row/entry-row.component.spec.ts` (new)
- `src/app/shared/components/empty-state/empty-state.component.ts` (new)
- `src/app/shared/components/empty-state/empty-state.component.spec.ts` (new)
- `_bmad-output/implementation-artifacts/2-3-entry-list-view-and-entryrowcomponent.md` (this file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status updated)

## Change Log

- 2026-05-09: Initial draft for Wave 6. Spec covers `EntriesListComponent`, `EntryRowComponent` (replacing malformed stub class), and new shared `EmptyStateComponent`. Sort by date desc with stable id tiebreak; group by month with `MatDivider`. Negative amounts render with `+` prefix in green. PENDING dims dot; SYNC_ERROR shows amber icon with ARIA label.
- 2026-05-09: Implementation complete by Amelia (bmad-agent). All tasks/subtasks done. 162/162 tests pass. Status → review.
- 2026-05-09: Code review complete (Winston, Sally, Amelia). 2 patches applied, 0 deferred, multiple dismissed. Status → done.

### Review Findings

- [x] [Review][Patch] Intl.NumberFormat recreated on every signal recomputation [entry-row.component.ts:21] — moved to module-level `CHF_FORMATTER` constant
- [x] [Review][Patch] Trailing mat-divider rendered after last group (no separator function) [entries-list.component.html:22] — fixed with `let last = $last` guard; updated divider-count test from 2→1
- [x] [Review][Dismiss] MatBottomSheet injected but not used — intentional per spec for Story 2.4 forward-compat
- [x] [Review][Dismiss] AC1 tiebreak uses id not enqueuedAt — LocalEntry has no enqueuedAt; id is the correct fallback per spec notes
- [x] [Review][Dismiss] Various defensive null guards for date/month/amount — data model type guarantees prevent these at runtime
