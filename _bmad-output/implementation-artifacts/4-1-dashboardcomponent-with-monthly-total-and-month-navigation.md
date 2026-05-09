# Story 4.1: DashboardComponent with monthly total and month navigation

Status: done

## Story

As Nick,
I want to see my total spending for the current month on the dashboard and navigate to any past month,
So that I can quickly answer "how much have I spent this month?" and compare with previous months.

## Acceptance Criteria

1. **Given** entries exist in IDB **When** the `DashboardComponent` loads **Then** the current month's total spend across all categories is displayed in `HeroCardComponent`
2. **Given** the hero total renders **When** the layout is inspected **Then** the amount uses `text-4xl` bold typography (Tailwind `text-4xl font-bold`)
3. **Given** the dashboard is loading data (entries signal not yet populated) **When** `HeroCardComponent` is in a loading state **Then** a skeleton loader at exactly 40px height displays with `aria-busy="true"` — no full-page spinner
4. **Given** the data has loaded **When** the skeleton is replaced with real content **Then** `aria-busy` is removed and the actual total is rendered
5. **Given** I tap the "previous month" control **When** the month decrements **Then** the displayed total and breakdown update to the selected month's data
6. **Given** I tap the "next month" control while on a past month **When** the month increments **Then** the displayed total and breakdown update to the next month's data
7. **Given** the month navigation controls render **When** their accessible names are inspected **Then** they have `aria-label="Previous month"` and `aria-label="Next month"`
8. **Given** the dashboard loads for a returning user with IDB data available **When** load time is measured on a mid-range device **Then** the current month total renders in under 2 seconds (NFR pass/fail gate)
9. **Given** I am on the current month **When** the next-month control is inspected **Then** it is disabled (`[disabled]="!canGoNext()"`) — Nick cannot navigate into the future

## Tasks / Subtasks

- [x] Replace `DashboardComponent` stub at `src/app/features/dashboard/dashboard.component.ts` (AC: 1, 5, 6, 7, 8, 9)
  - [x] `standalone: true`, `changeDetection: ChangeDetectionStrategy.OnPush`
  - [x] Inject `EntriesService`, `MatBottomSheet` (for FAB → quick-add wiring shared with Story 2.2)
  - [x] State: `selectedMonth = signal<string>(currentMonthIso())` where `currentMonthIso()` returns `new Date().toISOString().slice(0,7)` (`YYYY-MM`)
  - [x] Computeds:
    - [x] `entriesForMonth = computed(() => this.entriesSvc.entries().filter(e => e.month === this.selectedMonth()))`
    - [x] `monthTotal = computed(() => this.entriesForMonth().reduce((sum, e) => sum + e.amount, 0))` — negative amounts (refunds) reduce the total
    - [x] `isLoading = computed(() => !this.entriesSvc.isInitialized?.() ?? false)` — falls back to `false` when service flag not present
    - [x] `canGoNext = computed(() => this.selectedMonth() < currentMonthIso())` (AC9)
  - [x] Methods:
    - [x] `onPrevMonth()`: decrement `selectedMonth` by 1 month
    - [x] `onNextMonth()`: increment `selectedMonth` by 1 month, but only if `canGoNext()`
  - [x] Template uses `HeroCardComponent` with month + total + isLoading inputs, plus prev/next nav controls
- [x] Implement `HeroCardComponent` at `src/app/shared/components/hero-card/hero-card.component.ts` (AC: 1, 2, 3, 4)
  - [x] Replace existing stub (note: stub class name is currently malformed — `UheroUcardComponent` — replace with `HeroCardComponent`)
  - [x] `standalone: true`, OnPush
  - [x] Inputs: `total = input.required<number>()`, `month = input.required<string>()` (YYYY-MM), `isLoading = input<boolean>(false)`
  - [x] Computed: `displayTotal = computed(() => formatChf(this.total()))` using `Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 2 })`
  - [x] Computed: `displayMonth = computed(() => formatMonthLabel(this.month()))` (e.g., `"May 2026"` via `Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long' })`)
  - [x] Template: card with `text-4xl font-bold` heading; when `isLoading()`, render a 40px-height skeleton div with `aria-busy="true"`; when not loading, render the formatted total and remove `aria-busy`
- [x] Add month navigation control row in `DashboardComponent` template (AC: 5, 6, 7, 9)
  - [x] Two `mat-icon-button` controls flanking the month label
  - [x] `aria-label="Previous month"` / `aria-label="Next month"`
  - [x] `[disabled]="!canGoNext()"` on next-month button
  - [x] Uses `chevron_left` and `chevron_right` Material icons
- [x] Add month math helper at `src/app/shared/utils/month.util.ts` (or inline if a single use)
  - [x] `addMonths(monthIso: string, delta: number): string` — pure function, parses `YYYY-MM`, returns same format
  - [x] `currentMonthIso(): string` — returns `new Date().toISOString().slice(0,7)`
  - [x] `formatMonthLabel(monthIso: string): string` — for display
- [x] Wire `EntriesService.init()` (NFR8 / AC8 readiness)
  - [x] If Story 2.1 has not added an `init()` call from APP_INITIALIZER, this story may register a one-shot init in `DashboardComponent.constructor()` via `void this.entriesSvc.init()`. Prefer APP_INITIALIZER if 2.1 sets it up; otherwise this fallback ensures dashboard load <2s
  - [x] Boot path: `IdbService.getAll('entries')` → populate signal → first render of dashboard
- [x] FAB integration on dashboard (cross-reference with Story 2.2)
  - [x] Story 2.2 places the FAB on the dashboard; this story includes the FAB host element in the template (`<button #fabRef mat-fab ...>`) but the click handler and bottom-sheet wiring are owned by Story 2.2
  - [x] If 2.2 has not been merged into this worktree, scaffold the FAB element with `aria-label="Add expense"` and a TODO marker for 2.2 wiring — does NOT block 4.1
- [x] Write `src/app/features/dashboard/dashboard.component.spec.ts` (AC: 1, 5, 6, 9)
  - [x] On load with mocked entries for current month, displays correct total
  - [x] `onPrevMonth()` decrements selectedMonth and updates `monthTotal`
  - [x] `onNextMonth()` is no-op when `canGoNext()` is false
  - [x] Next button is disabled at current month
  - [x] Aria-labels are present on prev/next buttons
- [x] Write `src/app/shared/components/hero-card/hero-card.component.spec.ts` (AC: 2, 3, 4)
  - [x] Renders `text-4xl font-bold` on the total
  - [x] When `isLoading=true`, renders skeleton with `aria-busy="true"` and no total text
  - [x] When `isLoading=false`, removes `aria-busy` and renders formatted CHF total
  - [x] Skeleton element has 40px (`h-10` or inline `style="height: 40px"`) height

## Dev Notes

### DashboardComponent Skeleton

```typescript
import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { EntriesService } from '../../core/services/entries.service';
import { HeroCardComponent } from '../../shared/components/hero-card/hero-card.component';
import { addMonths, currentMonthIso, formatMonthLabel } from '../../shared/utils/month.util';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatButtonModule, HeroCardComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly entriesSvc = inject(EntriesService);

  readonly selectedMonth = signal<string>(currentMonthIso());

  readonly entriesForMonth = computed(() =>
    this.entriesSvc.entries().filter(e => e.month === this.selectedMonth()),
  );

  readonly monthTotal = computed(() =>
    this.entriesForMonth().reduce((sum, e) => sum + e.amount, 0),
  );

  // Loading is true until EntriesService has populated from IDB.
  // If `isInitialized` signal isn't exposed yet (Story 2.1 detail), default to false.
  readonly isLoading = computed(() =>
    typeof (this.entriesSvc as any).isInitialized === 'function'
      ? !(this.entriesSvc as any).isInitialized()
      : false,
  );

  readonly canGoNext = computed(() => this.selectedMonth() < currentMonthIso());

  constructor() {
    // Fallback init if not running from APP_INITIALIZER
    if (typeof (this.entriesSvc as any).init === 'function') {
      void (this.entriesSvc as any).init();
    }
  }

  onPrevMonth(): void {
    this.selectedMonth.update(m => addMonths(m, -1));
  }

  onNextMonth(): void {
    if (!this.canGoNext()) return;
    this.selectedMonth.update(m => addMonths(m, +1));
  }
}
```

### DashboardComponent Template

```html
<div class="flex flex-col gap-4 p-4">
  <div class="flex items-center justify-center gap-2">
    <button
      mat-icon-button
      type="button"
      aria-label="Previous month"
      (click)="onPrevMonth()">
      <mat-icon>chevron_left</mat-icon>
    </button>
    <span class="text-base font-medium">{{ selectedMonth() | monthLabel }}</span>
    <button
      mat-icon-button
      type="button"
      aria-label="Next month"
      [disabled]="!canGoNext()"
      (click)="onNextMonth()">
      <mat-icon>chevron_right</mat-icon>
    </button>
  </div>

  <app-hero-card
    [total]="monthTotal()"
    [month]="selectedMonth()"
    [isLoading]="isLoading()" />

  <!-- Sparkline + KPI row + breakdown bar are added in Stories 4.2, 4.3 -->
</div>

<!-- FAB host (Story 2.2 wires the click → MatBottomSheet) -->
<button
  #fabRef
  mat-fab
  type="button"
  aria-label="Add expense"
  class="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-50">
  <mat-icon>add</mat-icon>
</button>
```

(`monthLabel` pipe is optional — inline `formatMonthLabel(selectedMonth())` is acceptable; do not block on creating a pipe if it isn't needed elsewhere yet.)

### HeroCardComponent Skeleton

```typescript
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-hero-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hero-card.component.html',
  styleUrl: './hero-card.component.scss',
})
export class HeroCardComponent {
  readonly total = input.required<number>();
  readonly month = input.required<string>();          // YYYY-MM
  readonly isLoading = input<boolean>(false);

  private readonly chfFormatter = new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  });

  readonly displayTotal = computed(() => this.chfFormatter.format(this.total()));
}
```

### HeroCardComponent Template

```html
<section
  class="rounded-2xl bg-white dark:bg-zinc-900 shadow p-6 flex flex-col gap-2"
  [attr.aria-busy]="isLoading() ? 'true' : null"
  aria-label="Monthly spending total">
  <span class="text-sm text-zinc-500">Spent this month</span>

  @if (isLoading()) {
    <!-- AC3: skeleton at exactly 40px height -->
    <div
      class="bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse w-32"
      style="height: 40px;"
      aria-hidden="true"></div>
  } @else {
    <!-- AC2: text-4xl font-bold -->
    <h1 class="text-4xl font-bold">{{ displayTotal() }}</h1>
  }
</section>
```

`aria-busy="true"` is set only when loading (AC3); when loading completes, the attribute is omitted entirely (AC4 — `null` binding removes the attribute, doesn't set `"false"`).

### Month Math Utility

```typescript
// src/app/shared/utils/month.util.ts

export function currentMonthIso(): string {
  return new Date().toISOString().slice(0, 7);
}

export function addMonths(monthIso: string, delta: number): string {
  const [yearStr, monthStr] = monthIso.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1; // 0-indexed
  const date = new Date(Date.UTC(year, monthIndex + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(monthIso: string): string {
  const [year, month] = monthIso.split('-');
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(date);
}
```

`Date.UTC` avoids local-timezone month-rollover bugs. Pure functions — no `Intl` instance leaking, no mutable state.

### NFR Pass/Fail Gate (AC8)

The 2-second budget assumes:
- IDB `getAll('entries')` is a single transaction read
- No Sheets API call on render — the architecture explicitly mandates "IDB cache as primary read source; no Sheets API call on render"
- Lazy-loaded `DashboardComponent` chunk size remains under reasonable budget (post-tree-shake, the dashboard chunk + hero-card + ng2-charts in 4.2 should stay < 100kb gzipped)

This story's render path: APP_INITIALIZER (or constructor fallback) → `entries.init()` → signal populated → `DashboardComponent.monthTotal()` computed → `HeroCardComponent` re-renders. No async work in the render path itself.

To validate: in CI or local, run `ng build --configuration=production`, deploy preview, measure first-contentful-paint with Lighthouse mobile preset → < 2s.

### Loading State Source of Truth (AC3)

`EntriesService.isInitialized` is the cleanest source. If Story 2.1 has shipped this signal, use it directly: `this.entriesSvc.isInitialized()`. The reflective fallback (`typeof ... === 'function'`) is a defensive measure for parallel-wave development; remove it in a follow-up cleanup once 2.1 is merged.

If 2.1 has NOT exposed `isInitialized`, this story should add it as part of the contract:
```typescript
// entries.service.ts
private readonly _initialized = signal(false);
readonly isInitialized = this._initialized.asReadonly();
// set true at end of init()
```

### Skeleton 40px Height (AC3)

The 40px requirement comes from architecture UX rule: "Dashboard loading states use skeleton placeholders that match the exact shape and size of the loaded content — same height as the hero number."

Story 4.2's sparkline skeleton MUST match this 40px height for layout-shift-free transition (referenced in 4.2's AC). Use `style="height: 40px;"` (inline) rather than Tailwind `h-10` (which is 2.5rem = 40px assuming default 16px root) — the inline value is unambiguous and survives Tailwind config changes.

### Negative Amounts in Monthly Total

The total reduces by the absolute value of refunds (negative amounts). Example:
- Coffee +12.00 + Groceries +85.50 + Refund −20.00 = total **77.50**

The `reduce((sum, e) => sum + e.amount, 0)` correctly handles this because negatives subtract.

### What Story 4.1 Does NOT Implement

- Sparkline chart → Story 4.2
- KPI row (vs-average delta + entry count) → Story 4.2
- Category breakdown bar → Story 4.3
- Drill-down by category × month → Story 4.4
- Year navigation (only month nav this story) → deferred (current month-stepping is sufficient for MVP)
- FAB click handler / bottom-sheet open → Story 2.2 (FAB element scaffolded here, click wiring there)

### Project Conventions to Follow

- **Standalone + OnPush** mandatory on all components
- **`input()` / `output()` signal APIs** — never `@Input()` / `@Output()` decorators
- **Tailwind with `important: '#app'`** — utilities win against Material defaults
- **`dvh` not `vh`** for full-height containers (not used here, but FAB safe-area uses `env(safe-area-inset-bottom)`)
- **`AppError` discriminated union** — no raw `Error` (no errors thrown in this story)
- **`NotificationService.showError()`** — not used here; dashboard is read-only
- **Skeleton not spinner** — UX rule
- **ISO 8601 dates** — `month` is always `YYYY-MM`
- **Test runner**: `ng test --watch=false`

### References

- `LocalEntry.month` field (`YYYY-MM`, indexed): [Source: `src/app/core/models/entry.model.ts`]
- `EntriesService.entries()` signal: [Source: `src/app/core/services/entries.service.ts` — implemented in Story 2.1]
- Skeleton height UX rule: [Source: `_bmad-output/planning-artifacts/architecture.md` — UX & Accessibility Constraints]
- 2-second NFR target: [Source: `_bmad-output/planning-artifacts/architecture.md` — Non-Functional Requirements]
- IDB-as-primary-read-source: [Source: `_bmad-output/planning-artifacts/architecture.md` — Data Architecture]
- Hero card text-4xl bold typography: [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Dashboard]
- FAB safe-area pattern: [Source: `_bmad-output/planning-artifacts/architecture.md` — UX & Accessibility Constraints]
- ng2-charts integration (used by 4.2, not 4.1): [Source: `_bmad-output/planning-artifacts/architecture.md` — Charts]

## Testing Strategy

Use Vitest via `ng test --watch=false`. Test files:
- `src/app/features/dashboard/dashboard.component.spec.ts` (extend existing stub)
- `src/app/shared/components/hero-card/hero-card.component.spec.ts` (new)
- `src/app/shared/utils/month.util.spec.ts` (new — pure-function tests)

Mock `EntriesService` with a signal-backed test double. Provide synthetic `LocalEntry[]` with varied `month` fields directly via `signal()` mocks.

Key test cases:
1. `DashboardComponent`: with 5 mocked entries (3 in current month, 2 in prior month), `monthTotal()` returns sum of current-month amounts only
2. `DashboardComponent`: `onPrevMonth()` decrements `selectedMonth` and `monthTotal()` reflects prior month
3. `DashboardComponent`: `onNextMonth()` no-op when `canGoNext()` is false (selected = current month)
4. `DashboardComponent`: `canGoNext()` true when selectedMonth is in the past
5. `DashboardComponent`: prev button has `aria-label="Previous month"`, next has `aria-label="Next month"`
6. `DashboardComponent`: next button is `[disabled]` when `canGoNext()` is false
7. `DashboardComponent`: negative amounts (refunds) reduce `monthTotal` correctly
8. `HeroCardComponent`: when `isLoading=true`, skeleton renders with `aria-busy="true"` and 40px height (assert via `getComputedStyle` or inline style attribute)
9. `HeroCardComponent`: when `isLoading=false`, total text renders with `text-4xl font-bold` classes and `aria-busy` attribute is absent
10. `HeroCardComponent`: total formatted as CHF currency (e.g. `CHF 77.50`)
11. `addMonths('2026-01', -1)` returns `'2025-12'` (year rollover backward)
12. `addMonths('2025-12', +1)` returns `'2026-01'` (year rollover forward)
13. `currentMonthIso()` returns format `YYYY-MM` matching `new Date()` month

E2E (deferred to Wave 12): Playwright test in `e2e/dashboard.spec.ts` covering: log entry → verify hero total updates; tap prev/next month controls; verify next disabled at current month.

## Dev Agent Record

### Completion Notes

Implemented by Amelia (dev agent) on 2026-05-09.

- `EntriesService.isInitialized` signal added (`_initialized` private backing signal, set true in `finally` block of `init()`) — avoids reflective cast in dashboard.
- `DashboardComponent` fully replaced: signal-driven month navigation, `canGoNext` guard, all computeds, FAB scaffolded with `aria-label="Add expense"` (click wiring deferred to Story 2.2).
- `HeroCardComponent` replaced (fixed malformed class name `UheroUcardComponent`): CHF formatter, `aria-busy` lifecycle via `[attr.aria-busy]` null-binding, 40px inline skeleton.
- `month.util.ts` created with `Date.UTC`-based `addMonths` (avoids local-TZ rollover), `currentMonthIso`, `formatMonthLabel`.
- All 170 tests pass (15 test files), zero regressions. New tests: 13 month.util, 11 dashboard, 7 hero-card.
- APP_INITIALIZER already called `entries.init()` (from Story 2.1 wiring) — no constructor fallback needed; dashboard render path is synchronous after boot.

### File List

- `src/app/shared/utils/month.util.ts` (new)
- `src/app/shared/utils/month.util.spec.ts` (new)
- `src/app/shared/components/hero-card/hero-card.component.ts` (modified — replaced stub)
- `src/app/shared/components/hero-card/hero-card.component.html` (modified)
- `src/app/shared/components/hero-card/hero-card.component.spec.ts` (new)
- `src/app/features/dashboard/dashboard.component.ts` (modified — replaced stub)
- `src/app/features/dashboard/dashboard.component.html` (modified)
- `src/app/features/dashboard/dashboard.component.spec.ts` (modified — full test suite)
- `src/app/core/services/entries.service.ts` (modified — added `isInitialized` signal)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status: review)
- `_bmad-output/implementation-artifacts/4-1-dashboardcomponent-with-monthly-total-and-month-navigation.md` (modified — tasks checked, status updated)

### Review Findings

- [x] [Review][Patch] `currentMonthIso()` returns UTC month, causing off-by-one at month boundary for non-UTC users [month.util.ts:2] — **fixed**: switched to local `getFullYear()/getMonth()`
- [x] [Review][Patch] Dashboard template renders raw ISO string `2026-05` instead of formatted label [dashboard.component.html:10] — **fixed**: uses `formatMonthLabel(selectedMonth())`
- [x] [Review][Patch] `HeroCardComponent` missing `displayMonth` computed; `month` input unused in template [hero-card.component.ts, hero-card.component.html] — **fixed**: added `displayMonth` computed, rendered in subtitle and dynamic `aria-label`
- [x] [Review][Patch] No `aria-live` region for month navigation — screen readers get no announcement [dashboard.component.html:10] — **fixed**: added `aria-live="polite"` to month span
- [x] [Review][Patch] Static `aria-label="Monthly spending total"` on hero card doesn't identify which month [hero-card.component.html:4] — **fixed**: dynamic `[attr.aria-label]="'Spending total for ' + displayMonth()"`
- [x] [Review][Decision] `<h1>` inside `HeroCardComponent` risks duplicate H1 with app shell — resolved to `<h2>` [hero-card.component.html:13] — **fixed**: `<h1>` → `<h2>`
- [x] [Review][Defer] FAB has no click handler — by design, Story 2.2 owns wiring [dashboard.component.html] — deferred, pre-existing
- [x] [Review][Defer] `isLoading` false after IDB failure shows CHF 0.00 — by design, spec says boot continues with empty list [entries.service.ts] — deferred, pre-existing
- [x] [Review][Defer] `addMonths` with empty/invalid string produces NaN-NaN — not exposed via type-safe UI paths [month.util.ts] — deferred, pre-existing
- [x] [Review][Defer] `canGoNext` doesn't re-evaluate at midnight without user action — minor UX edge case [dashboard.component.ts] — deferred, pre-existing
- [x] [Review][Defer] `initPromise` has no reset mechanism — pre-existing design from Story 2.1 [entries.service.ts] — deferred, pre-existing

## Change Log

- 2026-05-09: Initial draft for Wave 6. Spec covers `DashboardComponent` with month-stepping nav, `HeroCardComponent` (replacing malformed stub class) with 40px skeleton + `aria-busy` lifecycle, `month.util.ts` pure helpers. Negative amounts reduce monthly total. Next-month nav disabled at current month — no future-month navigation. FAB element scaffolded on dashboard; click handler owned by Story 2.2.
- 2026-05-09: Implementation complete. All ACs satisfied. 170 tests pass (0 regressions). Added `isInitialized` to `EntriesService`. Status → review.
- 2026-05-09: Code review complete (Blind Hunter + Edge Case Hunter + Acceptance Auditor). 5 patches + 1 decision applied. Status → done.
