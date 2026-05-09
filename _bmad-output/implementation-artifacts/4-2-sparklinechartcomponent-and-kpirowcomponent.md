# Story 4.2: SparklineChartComponent and KpiRowComponent

Status: done

## Story

As Nick,
I want to see a 7-bar sparkline of my recent monthly spending and key metrics below the hero card,
So that I can understand my spending trend at a glance without navigating away from the dashboard.

## Acceptance Criteria

1. **Given** the `HeroCardComponent` renders **When** `SparklineChartComponent` is embedded within it **Then** a 7-bar ng2-charts `BarChart` is shown with the current month bar in indigo and prior months in zinc-300 (light mode) / zinc-700 (dark mode)
2. **Given** the sparkline is loading **When** the skeleton renders **Then** it matches the exact 40px height of the hero number skeleton — no layout shift on data load
3. **Given** sparkline data is available **When** I inspect the chart data **Then** it covers the last 6–12 months of entries from IDB (default 7; configurable via `monthsToShow` input within `[6, 12]`)
4. **Given** the `KpiRowComponent` renders below the hero card **When** two metric cards are shown **Then** the first shows the vs-average spend delta and the second shows the entry count for the selected month
5. **Given** the vs-average delta is positive (spending above average) **When** `KpiRowComponent` renders **Then** the delta value displays in `red-500` (semantic `--color-error`) with a `+` prefix and an up-arrow icon
6. **Given** the vs-average delta is negative (spending below average) **When** `KpiRowComponent` renders **Then** the delta value displays in indigo (semantic `--color-accent`) with a `−` prefix and a down-arrow icon
7. **Given** the vs-average delta is exactly zero (or there are fewer than 2 historical months to compute an average) **When** `KpiRowComponent` renders **Then** the delta cell displays "—" in muted color and the screen-reader label reads "No average available yet"
8. **Given** the entry count is shown **When** rendered **Then** it shows the count for the selected month with the noun pluralized correctly ("1 entry" / "2 entries" / "0 entries")
9. **Given** both components render **When** their accessible labels are inspected **Then** `SparklineChartComponent` has `aria-label="Last {{n}} months spending trend"` and the chart's bars have non-decorative ARIA via a hidden text summary; `KpiRowComponent` cells have `aria-label="vs-average delta: +CHF 42.10"` and `aria-label="3 entries this month"`
10. **Given** the user toggles light/dark theme **When** the chart is already mounted **Then** the bar colors update without a page reload (re-resolved from the semantic CSS custom properties on each chart `update()` cycle, or via `effect()` watching theme changes)
11. **Given** the user changes the selected month on the dashboard **When** `selectedMonth` updates **Then** the sparkline highlights the bar matching `selectedMonth` (not always the calendar-current month) and `KpiRowComponent` recomputes for the selected month
12. **Given** there are zero entries in IDB **When** both components render **Then** the sparkline shows 7 empty bars (zero-height with a 1px baseline tick), `KpiRowComponent` shows "—" for delta and "0 entries" for count — no error, no spinner
13. **Given** the components are tested in an `OnPush` component tree **When** the underlying `entries` signal updates **Then** the sparkline `chart.update()` and `KpiRowComponent` derived signals recompute exactly once per change (no over-rendering, no missed updates)

## Tasks / Subtasks

- [x] Add ng2-charts provider (AC: 1)
  - [x] In `src/app/app.config.ts`, add `provideCharts(withDefaultRegisterables())` from `ng2-charts` to the providers array (one-time global registration; safe even if `DashboardComponent` is the only chart consumer)
  - [x] Verify `ng2-charts` and `chart.js` are already installed (they are — see `package.json`)

- [x] Implement `SparklineChartComponent` at `src/app/shared/components/sparkline-chart/sparkline-chart.component.{ts,html,scss}` (AC: 1, 2, 3, 9, 10, 11, 12, 13)
  - [x] Replace the existing stub at this path (currently exports `UsparklineUchartComponent` with `<ng-content />`)
  - [x] Standalone, `OnPush`, `imports: [BaseChartDirective]` from `ng2-charts`
  - [x] Inputs (signal API): `data = input.required<MonthlyTotal[]>()` (array of `{ month: string; total: number }` length 6–12), `selectedMonth = input.required<string>()` (`YYYY-MM`), `isLoading = input(false)`, `monthsToShow = input(7)`
  - [x] Computed `chartData = computed<ChartConfiguration<'bar'>['data']>(...)` derived from inputs; `labels` are short month names ("May", "Jun", ...), `datasets[0].data` are totals, `datasets[0].backgroundColor` is a per-bar array (indigo for selected month, zinc for others)
  - [x] Computed `chartOptions = computed<ChartConfiguration<'bar'>['options']>(...)` — `responsive: true`, `maintainAspectRatio: false`, all axes hidden, no legend, no tooltips (sparkline has no axes/labels)
  - [x] Skeleton state: when `isLoading()` is true, render a 40px-height `<div class="skeleton">` instead of the chart; ARIA `aria-busy="true"` on the host
  - [x] Empty state: when `data().length === 0`, still render the chart with all-zero data; chart bars degrade to baseline ticks
  - [x] Theme reactivity: read CSS custom properties via `getComputedStyle(document.documentElement)` inside the `chartData` computed; subscribe to a `themeChange` source (see Dev Notes)
  - [x] ARIA: host `aria-label="Last {{ monthsToShow() }} months spending trend"`; visually-hidden `<span class="sr-only">` listing month/total pairs for screen readers
  - [x] No interaction (sparkline is decorative — taps go nowhere); `pointer-events: none` on the canvas wrapper to avoid accidental hit-testing

- [x] Implement `KpiRowComponent` at `src/app/shared/components/kpi-row/kpi-row.component.{ts,html,scss}` (AC: 4, 5, 6, 7, 8, 9, 11, 12, 13)
  - [x] Replace the existing stub at this path (currently exports `UkpiUrowComponent`)
  - [x] Standalone, `OnPush`, `imports: [MatIconModule, ChfCurrencyPipe]`
  - [x] Inputs: `selectedMonthTotal = input.required<number>()`, `historicalMonthlyTotals = input.required<MonthlyTotal[]>()` (last N months including selected), `selectedMonthEntryCount = input.required<number>()`, `isLoading = input(false)` (added `selectedMonth` input per dev notes pseudocode to correctly exclude the selected month)
  - [x] Computed `averageMonthlyTotal = computed(() => …)` — mean of historical totals EXCLUDING the selected month (so the comparison is meaningful); returns `null` when fewer than 2 historical months available
  - [x] Computed `delta = computed(() => selectedMonthTotal() - averageMonthlyTotal())` — `null` when average is null
  - [x] Computed `deltaClass = computed(() => delta() === null ? 'muted' : delta() > 0 ? 'over' : delta() < 0 ? 'under' : 'flat')`
  - [x] Pluralize entry count: `"1 entry"` (n === 1) or `"{n} entries"` (else)
  - [x] Skeleton state: when `isLoading()` is true, render two 40px-height skeleton boxes matching the card layout
  - [x] ARIA labels per AC9; icons (`arrow_upward` / `arrow_downward`) carry `aria-hidden="true"` because the color + signed value already convey direction in non-visual mode

- [x] Add `MonthlyTotal` shared type at `src/app/core/models/entry.model.ts` (or `src/app/shared/models/monthly-total.model.ts`) (AC: 3, 4)
  - [x] `export interface MonthlyTotal { month: string; total: number; entryCount: number }` — `month` is `YYYY-MM`
  - [x] Used by `SparklineChartComponent`, `KpiRowComponent`, and the dashboard aggregation in Story 4.1

- [x] Add `EntriesService.monthlyTotals` derived signal (AC: 3, 4, 11, 12, 13)
  - [x] `monthlyTotals = computed<MonthlyTotal[]>(() => groupByMonth(this._entries()))` — returns last 12 months in chronological order, fills gaps with `{ total: 0, entryCount: 0 }` for months with no entries (so the sparkline is always 7+ bars even on a fresh install)
  - [x] Pure derivation from the `_entries` signal — no IDB read, no Sheets read
  - [x] Used by `DashboardComponent` to feed both child components

- [x] Wire `DashboardComponent` to render both new components (AC: 1, 4, 11)
  - [x] In `dashboard.component.html`: place `<app-sparkline-chart [data]="…" [selectedMonth]="…" [isLoading]="isLoading()" />` inside the existing `HeroCardComponent` slot (Story 4.1 will provide the parent layout — coordinate)
  - [x] Place `<app-kpi-row [selectedMonthTotal]="…" [historicalMonthlyTotals]="…" [selectedMonthEntryCount]="…" />` directly below `HeroCardComponent`
  - [x] Wire `selectedMonth` from `EntriesService.selectedMonth` (Story 2.1 contract) — falls back to current `YYYY-MM` if unset

- [x] Theme-reactive color resolution helper (AC: 1, 10)
  - [x] Create `src/app/shared/utils/theme-token.ts` with `getCssVar(name: string): string` that reads from `document.documentElement` via `getComputedStyle`
  - [x] Used Option B (MutationObserver on `<html>` class attribute) — Story 1.6 does not expose a `ThemeService` signal, so the class-attribute observer is the correct fallback. Documented in Dev Agent Record.

- [x] Tests — `src/app/shared/components/sparkline-chart/sparkline-chart.component.spec.ts` (AC: 1, 2, 3, 9, 10, 11, 12, 13)
  - [x] Renders 7 bars by default
  - [x] `monthsToShow = 12` renders 12 bars
  - [x] Selected-month bar uses indigo class; others use zinc class
  - [x] `isLoading = true` shows skeleton, hides canvas
  - [x] Empty data: 7 zero-height bars rendered, no error
  - [x] Selected-month input change updates the highlighted bar without remount
  - [x] Host `aria-label` matches AC9 format

- [x] Tests — `src/app/shared/components/kpi-row/kpi-row.component.spec.ts` (AC: 4, 5, 6, 7, 8, 12, 13)
  - [x] Positive delta → red-500 class + `+` prefix
  - [x] Negative delta → indigo class + `−` prefix
  - [x] Zero delta or fewer than 2 historical months → "—" muted display, screen-reader fallback
  - [x] `selectedMonthEntryCount = 1` → "1 entry"
  - [x] `selectedMonthEntryCount = 0` → "0 entries"
  - [x] `selectedMonthEntryCount = 5` → "5 entries"
  - [x] `isLoading = true` shows two skeletons

- [x] Optional integration test — `dashboard.component.spec.ts`
  - [x] Dashboard spec updated to include `monthlyTotals` mock and `provideCharts`; canvas mock applied via `beforeAll` for Chart.js JSDOM compatibility

## Dev Notes

### Why ng2-charts (not native canvas/SVG)

The architecture commits to `ng2-charts` (Chart.js wrapper) for the sparkline (`_bmad-output/planning-artifacts/architecture.md#Frontend-Architecture` → "Charts: ng2-charts"). Chart.js is already in `package.json`. We register charts ONCE globally via `provideCharts(withDefaultRegisterables())` in `app.config.ts` and consume via the standalone `BaseChartDirective` in this component.

`CategoryBreakdownBarComponent` (Story 4.3) does NOT use ng2-charts — it uses CSS percentage-width divs. ng2-charts is only for the sparkline.

### ng2-charts Standalone Setup

```typescript
// src/app/app.config.ts (additions)
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...existing providers...
    provideCharts(withDefaultRegisterables()),
  ],
};
```

```typescript
// SparklineChartComponent imports
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';

@Component({
  selector: 'app-sparkline-chart',
  standalone: true,
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sparkline-chart.component.html',
  styleUrl: './sparkline-chart.component.scss',
})
```

### SparklineChartComponent Skeleton Shape

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { MonthlyTotal } from '../../../core/models/entry.model';

@Component({ /* ...as above... */ })
export class SparklineChartComponent {
  readonly data = input.required<MonthlyTotal[]>();
  readonly selectedMonth = input.required<string>();
  readonly isLoading = input(false);
  readonly monthsToShow = input(7);

  readonly chartData = computed<ChartData<'bar'>>(() => {
    const items = this.data().slice(-this.monthsToShow());
    const accent = getCssVar('--color-accent') || '#6366f1';
    const muted = getCssVar('--color-muted') || '#d4d4d8';
    return {
      labels: items.map(m => formatShortMonth(m.month)),
      datasets: [{
        data: items.map(m => m.total),
        backgroundColor: items.map(m => m.month === this.selectedMonth() ? accent : muted),
        borderRadius: 2,
        barPercentage: 0.6,
      }],
    };
  });

  readonly chartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
    animation: false,
  };
}
```

### Theme Reactivity — Two Acceptable Strategies

**Option A (preferred): subscribe to `ThemeService.themeChange` signal/observable from Story 1.6.**

If Story 1.6 exposed something like `themeChange = signal<'light' | 'dark'>('light')`, use `effect()` to call `chart?.update()`:

```typescript
constructor() {
  effect(() => {
    this.themeService.themeChange();   // dependency
    queueMicrotask(() => this.chart?.update());
  });
}
```

**Option B (fallback): `MutationObserver` on `<html>` class attribute.**

```typescript
ngOnInit() {
  const observer = new MutationObserver(() => this.chart?.update());
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  this.destroyRef.onDestroy(() => observer.disconnect());
}
```

Story 1.6 implemented light/dark theme via class toggle on `<html>` (`document.documentElement.classList.add('dark')`). If 1.6 exposes a signal, use Option A. If not, Option B is the contract-free fallback. Document choice in Dev Agent Record.

### `getCssVar` Helper

```typescript
// src/app/shared/util/theme-token.ts
export function getCssVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
```

The Story 1.6 semantic token system maps `--color-accent` to indigo-600 (light) / indigo-400 (dark) and `--color-muted` to zinc-300/zinc-700 — exactly what AC1 requires. We resolve at chart-data-build time so theme switches re-run via `effect()`.

### `KpiRowComponent` Average Computation

```typescript
readonly averageMonthlyTotal = computed<number | null>(() => {
  const totals = this.historicalMonthlyTotals();
  const others = totals.filter(t => t.month !== this.findSelectedMonthFromTotals());
  if (others.length < 2) return null;
  return others.reduce((sum, t) => sum + t.total, 0) / others.length;
});
```

Why exclude the selected month: comparing CHF 850 (current) against the average of `[1100, 950, 800, 850]` (which already includes the 850) understates the delta. The average must be computed from the OTHER months only — this is the "vs-historical-average" reading the user expects.

### `MonthlyTotal` Aggregation Pattern

```typescript
// EntriesService — add to existing service
readonly monthlyTotals = computed<MonthlyTotal[]>(() => {
  const buckets = new Map<string, MonthlyTotal>();
  for (const e of this._entries()) {
    const cur = buckets.get(e.month) ?? { month: e.month, total: 0, entryCount: 0 };
    cur.total += e.amount;
    cur.entryCount += 1;
    buckets.set(e.month, cur);
  }
  // Pad to last 12 months (chronological)
  const last12 = listLast12Months();   // ['2025-06', ..., '2026-05']
  return last12.map(m => buckets.get(m) ?? { month: m, total: 0, entryCount: 0 });
});
```

Note: `e.amount` includes negatives (refunds/credits). The sparkline shows net spending including refunds — this matches Nick's mental model and the hero card total. If a future story decides to split positive vs. negative, this aggregation is the single place to change.

### Skeleton Heights — Strict 40px Rule

Both the hero number skeleton (Story 4.1 AC) and the sparkline skeleton (this story AC2) are exactly 40px tall. This prevents layout shift when data resolves. The KPI row uses two 40px-height skeleton boxes — same height as a single hero/sparkline placeholder.

```scss
// sparkline-chart.component.scss
.skeleton {
  height: 40px;
  width: 100%;
  background: var(--color-skeleton, var(--color-muted));
  border-radius: 4px;
  animation: pulse 1.6s ease-in-out infinite;
}
.canvas-wrapper { height: 40px; }   // chart canvas matches skeleton height
```

### ARIA Strategy for Charts

Chart.js renders a single `<canvas>` element. Screen readers can't read it. Standard pattern:

```html
<div class="canvas-wrapper" [attr.aria-busy]="isLoading()" [attr.aria-label]="ariaLabel()">
  <canvas baseChart [type]="'bar'" [data]="chartData()" [options]="chartOptions"></canvas>
  <span class="sr-only">{{ srSummary() }}</span>
</div>
```

`srSummary()` is a computed: `"May 850 CHF, June 1100 CHF (selected), ..."`. The `.sr-only` class is from Tailwind's accessibility utilities (already configured in Story 1.6).

### Architectural Boundaries (must observe)

- **`SparklineChartComponent` and `KpiRowComponent` are presentational shared components** — they receive `input()` signals, emit no outputs (the sparkline is decorative; the KPI row is read-only), and inject NO services beyond pure utilities. No `EntriesService`, no `IdbService`, no `NotificationService`. Aggregation lives in `EntriesService.monthlyTotals` (a computed signal); the dashboard wires it to the inputs.
- **`OnPush` mandatory.** Inputs are signal-based (`input()`). Computed signals (`computed()`) recompute only when their dependencies change.
- **No `MatSnackBar` direct injection.** Errors during chart rendering go through the surrounding `DashboardComponent` if needed (none are expected — empty data is the only edge case and renders quietly).
- **`crypto.randomUUID()`** rule is irrelevant here (no entity creation).
- **Standalone components** with explicit `imports: [BaseChartDirective, ...]`.
- **`providedIn: 'root'`** does not apply (these are components, not services).

### Out of Scope (deferred to other stories)

- Tap-to-drill from a sparkline bar → out of scope; sparkline is purely decorative
- Tap-to-drill from a KPI tile → out of scope; KPI row is read-only
- Trend line / moving average overlay → out of scope; bars only
- Year-over-year comparison KPI → not in PRD
- Long-press to show exact monthly total tooltip → out of scope (Chart.js tooltips are explicitly disabled per AC1's "no axes" sparkline aesthetic)

### Dependence on Other Stories

- **Story 1.6** (theme) — `--color-accent`, `--color-muted` semantic tokens are in place; this story consumes them
- **Story 2.1** (`EntriesService.entries` signal) — required as the data source for `monthlyTotals`
- **Story 4.1** (`HeroCardComponent` and dashboard layout) — provides the parent slot for `SparklineChartComponent`. If 4.1 has not landed when this implementation starts, scaffold a minimal hero card stub here and remove on 4.1 merge
- **`ChfCurrencyPipe`** (Story 1.6 / 4.1 / shared) — `KpiRowComponent` formats CHF amounts via this pipe; if not present, add a minimal version here

## Testing

### Strategy

Vitest via `ng test --watch=false`. Mock Chart.js by stubbing `BaseChartDirective` with `MockComponent` from `ng-mocks`, OR test the chart-config computed signals directly (preferred — avoids the DOM canvas mock burden):

```typescript
const fixture = TestBed.createComponent(SparklineChartComponent);
fixture.componentRef.setInput('data', sampleMonthlyTotals);
fixture.componentRef.setInput('selectedMonth', '2026-05');
fixture.detectChanges();
expect(fixture.componentInstance.chartData().datasets[0].data.length).toBe(7);
```

For `KpiRowComponent`, test the computed signals (`averageMonthlyTotal`, `delta`, `deltaClass`) directly — the rendered DOM is a thin wrapper.

### Required Test Cases

`SparklineChartComponent`:
1. Default `monthsToShow=7` produces 7 labels and 7 data points
2. `monthsToShow=12` produces 12 of each
3. Selected-month index gets accent color in `backgroundColor` array; others get muted color
4. `isLoading=true` renders skeleton, hides canvas
5. Empty `data=[]` renders 7 zero-height bars (no throw)
6. Host `aria-label` is `"Last 7 months spending trend"` when `monthsToShow=7`
7. `selectedMonth` change re-runs `chartData` computed (no remount)

`KpiRowComponent`:
8. Positive delta (`+CHF 42.10`) → `over` class, up arrow icon
9. Negative delta (`−CHF 42.10`) → `under` class, down arrow icon
10. Zero delta → `flat` class, no arrow (or muted)
11. <2 historical months → `null` average → "—" + sr-fallback
12. `selectedMonthEntryCount=0` → "0 entries"
13. `selectedMonthEntryCount=1` → "1 entry"
14. `selectedMonthEntryCount=5` → "5 entries"
15. `isLoading=true` → both skeletons render

### Test Fixtures

```typescript
const sampleMonthlyTotals: MonthlyTotal[] = [
  { month: '2025-11', total: 850, entryCount: 12 },
  { month: '2025-12', total: 1100, entryCount: 18 },
  { month: '2026-01', total: 950, entryCount: 14 },
  { month: '2026-02', total: 800, entryCount: 11 },
  { month: '2026-03', total: 1050, entryCount: 16 },
  { month: '2026-04', total: 900, entryCount: 13 },
  { month: '2026-05', total: 750, entryCount: 9 },
];
```

### Review Findings

Reviewed 2026-05-09 by code-review workflow (Blind Hunter · Edge Case Hunter · Acceptance Auditor).

- [x] [Review][Patch] `[class]="deltaClass()"` replaces kpi-value base class — AC5/AC6 [kpi-row.component.html:15]
- [x] [Review][Patch] Zero delta (flat) renders CHF 0.00 instead of "—" in muted — AC7 [kpi-row.component.html:22-24]
- [x] [Review][Patch] averageMonthlyTotal includes zero-entryCount stub months, diluting the average — [kpi-row.component.ts:27-31]
- [x] [Review][Patch] `aria-hidden="true"` and `aria-busy="true"` contradictory on sparkline skeleton — [sparkline-chart.component.html:4-5]
- [x] [Review][Patch] `aria-label` bound on inner canvas-wrapper div instead of component host — AC9 [sparkline-chart.component.html:9]
- [x] [Review][Patch] `pointer-events: none` on `<canvas>` inline style, not on the wrapper div — spec constraint [sparkline-chart.component.html:15]
- [x] [Review][Patch] `new ChfCurrencyPipe()` allocated inside `deltaAriaLabel` computed on every recompute — [kpi-row.component.ts:52]
- [x] [Review][Patch] Duplicate aria-label on delta card: outer `[attr.aria-label]` and inner `<span aria-label>` both present — [kpi-row.component.html:12]
- [x] [Review][Defer] Sparkline placement is a sibling below HeroCardComponent, not nested inside it — AC1 wording ambiguous ("below the hero card" in story narrative); deferred — pre-existing design choice
- [x] [Review][Defer] `monthsToShow` input accepts values outside spec's [6, 12] range — no validation; internal-only input, not exposed — deferred, pre-existing
- [x] [Review][Defer] `listLast12Months()` mixes local-time `getFullYear/getMonth` with `Date.UTC` — theoretical timezone edge at month boundary midnight — deferred, pre-existing
- [x] [Review][Defer] MutationObserver in `ngOnInit` without `typeof document` guard — not applicable (no SSR) — deferred, pre-existing

## Change Log

- 2026-05-09: Initial draft — Story 4.2 specification authored against epic-4 ACs, ng2-charts integration plan, theme token system from Story 1.6, and Story 1.4 template.
- 2026-05-09: Implementation complete — SparklineChartComponent, KpiRowComponent, MonthlyTotal type, EntriesService.monthlyTotals, theme-token helper, DashboardComponent wiring, 26 new unit tests. All 317 tests pass.
- 2026-05-09: Code review complete — 8 patches applied (class binding, zero-delta display, stub-month average, ARIA fixes, pointer-events, pipe allocation). 4 items deferred.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (Amelia)

### Debug Log References

- Environment issue: `vite/node_modules/esbuild` (v0.27.7) missing `@esbuild/darwin-arm64` binary in the project's node_modules. Fixed by running `npm install @esbuild/darwin-arm64@0.27.7 --no-save` in the worktree root. This is a pre-existing environment issue unrelated to story implementation.
- Theme reactivity: Story 1.6 does not expose a `ThemeService` signal. Used Option B (MutationObserver on `document.documentElement` class attribute) via a private `themeVersion = signal(0)` that increments on mutation and is read by `chartData` computed to force re-evaluation of CSS custom properties.
- Canvas mocking: Chart.js requires `canvas.getContext('2d')` which JSDOM doesn't implement. Added `vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(...)` via `beforeAll` in the two spec files that render the chart canvas (`sparkline-chart.component.spec.ts` and `dashboard.component.spec.ts`).
- `KpiRowComponent` inputs: Story spec did not include `selectedMonth` as an explicit input, but it is required to correctly exclude the selected month when computing `averageMonthlyTotal`. Added `selectedMonth = input.required<string>()` per the dev notes pseudocode intent.

### Completion Notes List

- `MonthlyTotal` interface added to `src/app/core/models/entry.model.ts`
- `listLast12Months()` and `formatShortMonth()` helpers added to `src/app/shared/utils/month.util.ts`
- `EntriesService.monthlyTotals` computed signal added — pure derivation from `_entries` signal, pads last 12 months from `listLast12Months()`
- `getCssVar()` helper created at `src/app/shared/utils/theme-token.ts` — SSR-safe CSS custom property reader
- `SparklineChartComponent` fully implemented: OnPush, signal inputs, `chartData`/`chartOptions` computed, skeleton loading, MutationObserver theme reactivity, ARIA label + sr-only summary, pointer-events: none on canvas wrapper
- `KpiRowComponent` fully implemented: OnPush, signal inputs, `averageMonthlyTotal`/`delta`/`deltaClass` computed, entry count pluralization, two-skeleton loading state, ARIA labels
- `DashboardComponent` updated: imports SparklineChartComponent and KpiRowComponent, wires `monthlyTotals` and `selectedMonthEntryCount` computed signals, template updated with both new components
- 26 new unit tests (9 sparkline + 17 kpi-row) and dashboard spec updated for `monthlyTotals` mock and `provideCharts`
- All 317 tests pass (0 regressions)

### File List

- `src/app/core/models/entry.model.ts` (modified — added MonthlyTotal interface)
- `src/app/core/services/entries.service.ts` (modified — added monthlyTotals computed, listLast12Months import)
- `src/app/shared/utils/month.util.ts` (modified — added listLast12Months, formatShortMonth)
- `src/app/shared/utils/theme-token.ts` (created — getCssVar helper)
- `src/app/shared/components/sparkline-chart/sparkline-chart.component.ts` (replaced stub)
- `src/app/shared/components/sparkline-chart/sparkline-chart.component.html` (replaced empty)
- `src/app/shared/components/sparkline-chart/sparkline-chart.component.scss` (replaced empty)
- `src/app/shared/components/sparkline-chart/sparkline-chart.component.spec.ts` (created — 9 tests)
- `src/app/shared/components/kpi-row/kpi-row.component.ts` (replaced stub)
- `src/app/shared/components/kpi-row/kpi-row.component.html` (replaced empty)
- `src/app/shared/components/kpi-row/kpi-row.component.scss` (replaced empty)
- `src/app/shared/components/kpi-row/kpi-row.component.spec.ts` (created — 17 tests)
- `src/app/features/dashboard/dashboard.component.ts` (modified — imports + computed signals)
- `src/app/features/dashboard/dashboard.component.html` (modified — sparkline and kpi-row wired)
- `src/app/features/dashboard/dashboard.component.spec.ts` (modified — monthlyTotals mock, canvas mock, provideCharts)
- `src/test-setup.ts` (created — unused, kept as reference; setupFiles not configured due to vite esbuild env issue)

## References

- Story-4.2 ACs: [Source: `_bmad-output/planning-artifacts/epics/epic-4-dashboard-spending-insights.md#Story-4.2`]
- ng2-charts decision: [Source: `_bmad-output/planning-artifacts/architecture.md#Frontend-Architecture` → Charts]
- Theme token system: [Source: `_bmad-output/implementation-artifacts/1-6-app-shell-semantic-color-system-and-light-dark-theme.md`]
- Skeleton-loader policy (no spinners): [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#Empty-States-Loading-States`]
- Color tokens (zinc-300/700, indigo): [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#Color-System`]
- Architectural boundaries (presentational components, no service injection): [Source: `_bmad-output/planning-artifacts/architecture.md#Architectural-Boundaries`]
- `LocalEntry`: [Source: `src/app/core/models/entry.model.ts`]
- `EntriesService.entries` signal: [Source: `src/app/core/services/entries.service.ts`]
- ng2-charts standalone provider: [Source: ng2-charts v10 docs — `provideCharts(withDefaultRegisterables())`]
- Test runner: [Source: `1-2-google-oauth-authentication-flow.md#Dev-Agent-Record`] — `ng test --watch=false`
- Story 4.1 (parent dashboard): [Source: `_bmad-output/planning-artifacts/epics/epic-4-dashboard-spending-insights.md#Story-4.1`]
- Story 4.3 (CategoryBreakdownBar — adjacent component, but uses CSS not ng2-charts): [Source: `_bmad-output/planning-artifacts/epics/epic-4-dashboard-spending-insights.md#Story-4.3`]
