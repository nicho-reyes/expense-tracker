# Story 4.5: SpendingMatrix year view with category drilldown sheet

Status: in-progress

## Story

As Nick,
I want a single year-view matrix that shows every category's spending across all 12 months alongside an at-a-glance summary strip,
So that I can see the shape of my year's spending in one screen and tap any category or month cell to drill into the underlying entries.

## Context

Additive surface on top of Stories 4.1 and 4.2 — does NOT replace them. The HeroCard / SparklineChart / KpiRow components remain in the repo and will be reintroduced into the dashboard layout in a subsequent iteration. While this story is in flight, the Dashboard temporarily renders only the new matrix + summary strip + FAB. The month-navigation logic from 4.1 (`selectedMonth` signal, `addMonths`, `canGoNext`, `onPrev/NextMonth`) is removed from `DashboardComponent` during this story and will be restored when 4.1/4.2 components are re-composed.

Story 4.4 (Category × month drill-down with `DrillDownHeader`) is **not** subsumed by this story — 4.4 remains scoped to a dedicated routed drill-down screen with focus management and deep-link support. The drilldown introduced here is a lightweight `MatBottomSheet` for fast in-context inspection from the matrix.

## Acceptance Criteria

1. **Given** the dashboard renders **When** the summary strip is shown **Then** four cards display in order: Today / This month / This year / All time, each using `ChfCurrencyPipe` for formatting
2. **Given** `SpendingMatrixComponent` mounts for the current year **When** the table renders **Then** rows are one-per-category (alphabetical by `category.name`), columns are 12 months (Jan–Dec), with the leftmost column sticky to keep the category name visible while horizontally scrolling
3. **Given** an entry's `LocalEntry.category` (a display name) **When** the matrix groups totals **Then** the entry is bucketed by `slugifyCategoryId(category)` matching the corresponding `Category.id` — entries referencing unknown categories are excluded from the matrix
4. **Given** a cell has zero total **When** it renders **Then** it shows an em-dash (`—`) in muted color and is non-clickable
5. **Given** a cell has a non-zero total **When** it renders **Then** the amount is formatted with `Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` and the cell is clickable
6. **Given** the matrix has an `exclusionSets` input **When** the totals row(s) render **Then** one subtotal row appears per exclusion set, labelled with `ExclusionSet.label` and showing per-month + grand totals computed over rows whose `category.id` is NOT in `excludeIds`
7. **Given** the matrix renders **When** the final row is shown **Then** a "Grand Total" row sums all per-month columns and produces a single grand total across all 12 months
8. **Given** a row whose total is zero across all months **When** it renders **Then** it remains visible but at `opacity-40` (Tailwind), preserving alphabetical order without surprising row removal
9. **Given** I tap a category name in the left column **When** the click fires **Then** `CategoryDrilldownSheetComponent` opens as a `MatBottomSheet` with all entries for that category in the current year (`month: null`)
10. **Given** I tap a non-zero month cell **When** the click fires **Then** `CategoryDrilldownSheetComponent` opens with entries for that category filtered to the clicked `month` (YYYY-MM)
11. **Given** the drilldown sheet renders **When** the header is shown **Then** it displays a color dot (via `--color-{category.id}` custom property), category name, subtitle ("Month Year" when scoped to a month, otherwise the year), entry count, total, and a close button
12. **Given** the drilldown sheet shows the entry list **When** entries render **Then** they are sorted by `date` descending and each row shows date (formatted as `D MMM`), remarks (or `—` when empty), and CHF amount — negative amounts render in red
13. **Given** the dashboard wires the matrix **When** the inputs are inspected **Then** Dashboard passes `exclusionSets` = `[{ label: "Excl. Taxes & Contributions", excludeIds: ["taxes", "contributions"] }, { label: "Excl. Taxes, Contributions & Investment", excludeIds: ["taxes", "contributions", "investment"] }]`
14. **Given** `SpendingMatrixComponent` is consumed **When** its API is inspected **Then** it is `standalone: true`, `OnPush`, uses signal-based `input.required()` / `input()` / `output()` APIs only, injects NO services, and emits a single `categoryClick = output<{ categoryId: string; month: string | null }>()` event
15. **Given** the matrix is in a `OnPush` tree **When** the upstream `entries` signal updates **Then** `rows`, `columnTotals`, `grandTotal`, and `exclusionTotals` computed signals recompute exactly once without manual change detection

## Tasks / Subtasks

- [x] Create `SpendingMatrixComponent` at `src/app/shared/components/spending-matrix/` (AC: 2–8, 14, 15)
  - [x] Standalone, `OnPush`, signal-based I/O
  - [x] Inputs: `entries = input.required<LocalEntry[]>()`, `categories = input.required<Category[]>()`, `year = input.required<number>()`, `exclusionSets = input<ExclusionSet[]>([])`
  - [x] Output: `categoryClick = output<{ categoryId: string; month: string | null }>()`
  - [x] Exported types: `MatrixRow`, `ExclusionSet`
  - [x] `months` / `monthLabels` computed (Jan–Dec of `year`)
  - [x] `rows` computed — groups entries by `slugifyCategoryId(e.category)`, sorts alphabetically by `category.name`
  - [x] `columnTotals` / `grandTotal` / `exclusionTotals` computed
  - [x] Template renders sticky left column, dark-mode classes, em-dash for empty cells, cursor + hover affordance only on non-zero cells

- [x] Create `CategoryDrilldownSheetComponent` at `src/app/features/dashboard/category-drilldown-sheet.component.ts` (AC: 9–12)
  - [x] Standalone, `OnPush`, inline template
  - [x] Consumes `MAT_BOTTOM_SHEET_DATA` with `{ category, entries, month: string | null, year: number }`
  - [x] Title bar: color dot via `--color-{id}` custom property, name, subtitle, entry-count, total, close button
  - [x] Entry list: date sorted desc, `D MMM` date formatting, negative-amount red treatment

- [x] Add 4-card summary strip to `DashboardComponent` (AC: 1)
  - [x] `todayTotal` / `monthTotal` / `yearTotal` / `allTimeTotal` computed signals
  - [x] Cards use `ChfCurrencyPipe`, Tailwind utility styling, dark-mode support

- [x] Wire `DashboardComponent` to the matrix and drilldown (AC: 9, 10, 13)
  - [x] Inject `CategoriesService`; pass `categoriesSvc.categories()` to matrix
  - [x] `yearEntries` computed (entries for `currentYear`)
  - [x] `matrixExclusions` field — the two default exclusion sets per AC13
  - [x] `onCategoryDrilldown(event)` opens `MatBottomSheet` with filtered entries

- [x] Remove dead imports from `DashboardComponent` (AC: 14 — clean OnPush graph)
  - [x] Drop `HeroCardComponent`, `SparklineChartComponent`, `KpiRowComponent` from imports while this story is in flight (components remain in repo for future re-introduction)
  - [x] Remove `selectedMonth` signal, `addMonths`, `canGoNext`, `onPrev/NextMonth`, `formatMonthLabel` — flagged for restoration when 4.1/4.2 are re-composed
  - [x] Remove app-shell FAB from `app.html` (FAB is now dashboard-local only)

- [ ] Unit tests — `src/app/shared/components/spending-matrix/spending-matrix.component.spec.ts`
  - [ ] 12 months rendered (Jan–Dec) when `year = current year`
  - [ ] Alphabetical row sort by `category.name`
  - [ ] Entry bucketed by `slugifyCategoryId` — display-name → slug mapping verified
  - [ ] Empty cell renders `—`; non-zero cell renders de-CH formatted number
  - [ ] `exclusionSets` of length N renders N subtotal rows with correct month-totals and grand totals
  - [ ] Grand-total row sums all rows correctly
  - [ ] All-zero row remains in DOM with `opacity-40` class
  - [ ] Click on category name → emits `categoryClick({ categoryId, month: null })`
  - [ ] Click on non-zero month cell → emits `categoryClick({ categoryId, month: 'YYYY-MM' })`
  - [ ] Click on zero cell does NOT emit
  - [ ] Computed signals recompute on `entries` change (no over-rendering)

- [ ] Unit tests — `src/app/features/dashboard/category-drilldown-sheet.component.spec.ts`
  - [ ] Title shows color dot, category name, "Month Year" subtitle when `month` is set
  - [ ] Title subtitle is just the year when `month` is null
  - [ ] Total + entry-count rendered correctly
  - [ ] Entries sorted descending by date
  - [ ] Date formatted as `D MMM` (e.g. "5 May")
  - [ ] Negative amount renders with `text-red-600`
  - [ ] `close()` dismisses the sheet ref

- [ ] Dashboard spec updates — `src/app/features/dashboard/dashboard.component.spec.ts`
  - [x] Remove Chart.js `getContext` mocks (no longer needed — sparkline removed for now)
  - [x] Cover `todayTotal` / `monthTotal` / `yearTotal` / `allTimeTotal` computeds
  - [ ] Cover `onCategoryDrilldown` opens MatBottomSheet with correct filtered data (year only vs month-scoped)

- [ ] E2E coverage — extend `e2e/dashboard.spec.ts`
  - [ ] Summary-strip values match seeded IDB fixture totals
  - [ ] Tapping a category row opens drilldown with all year entries for that category
  - [ ] Tapping a non-zero month cell opens drilldown filtered to that month
  - [ ] Drilldown close button dismisses without leaving the dashboard route

- [ ] Split bundled non-scope changes into separate commits before merge
  - [ ] `fix(auth):` — `SILENT_REFRESH_TIMEOUT_MS` bump 10s → 20s, remove redundant `router.navigate(['/auth'])` calls, late-silent-refresh redirect from `/auth` → `/`
  - [ ] `fix(hydration):` — re-hydrate current-year tab on init even when `hydratedAt[name]` is set

## Dev Notes

### Category-name → slug mapping

`LocalEntry.category` is stored as the **display name** ("Food"), not the slug ("food"). The matrix groups by slug via `slugifyCategoryId(e.category)` from `core/models/category.model.ts`. The same helper is reused in `DashboardComponent.onCategoryDrilldown` to filter entries client-side before passing them to the sheet. If an entry's category name no longer resolves to a known `Category.id`, the entry is silently dropped from the matrix (no error, no "Unknown" bucket — that's Story 4.3's territory).

### Why alphabetical sort over total-desc

An earlier iteration sorted rows by total descending so heavy categories floated to the top. We switched to alphabetical because (a) the user's mental category list is alphabetical, (b) row order is stable across months (no jitter as the year fills in), and (c) the exclusion subtotals already surface the "what dominates" question without re-ordering rows.

### Why 12 fixed months, not "months elapsed so far"

The matrix renders all 12 columns for the current year even though months in the future have zero entries. This keeps column positions stable across renders (no widening as the year progresses) and makes year-over-year comparison in a future story trivial — same column count, same column positions.

### Drilldown sheet vs Story 4.4 drill-down

| Concern | Story 4.5 drilldown sheet | Story 4.4 drill-down screen |
|---|---|---|
| Surface | `MatBottomSheet` overlay | Routed page |
| Header | Simple title row | `DrillDownHeader` with scroll-condense behaviour |
| Focus | Default modal focus | Explicit `<h1>` focus on mount, focus return on back-nav |
| Deep-link | No | Yes — URL is bookmarkable |
| Empty state | "No entries" text | `EmptyState` component naming the specific month + category |

Both can coexist. The sheet is for fast in-context inspection; 4.4 is the routed surface that supports deep-linking and richer drill-down UX.

### Architectural boundaries

- `SpendingMatrixComponent` is **presentational** — it injects no services. All data and behaviour come through `input()` and `output()`.
- `CategoryDrilldownSheetComponent` injects only `MAT_BOTTOM_SHEET_DATA` and `MatBottomSheetRef` — no `EntriesService`, no `CategoriesService`. The dashboard does all filtering before opening.
- No new `AppError` variants. No new IDB stores or schema changes. No `SheetsService` changes.
- The bundled `auth.service.ts` and `hydration.service.ts` tweaks in the current worktree are **out of scope** for this story and must be committed separately before this story merges (see Tasks).

### Out of scope

- Re-introducing `HeroCardComponent` / `SparklineChartComponent` / `KpiRowComponent` into the dashboard — tracked as a follow-up once the matrix is stable
- Year switcher / "All years" aggregation — Story 6.3
- Routed drill-down screen with `DrillDownHeader` — Story 4.4
- Category breakdown bar — Story 4.3
- Long-press / right-click affordances on cells

## Testing

### Strategy

Vitest for component logic; the matrix is pure derivation over signal inputs so the unit tests focus on the computed signals (`rows`, `columnTotals`, `grandTotal`, `exclusionTotals`) and event emissions. The drilldown sheet is templated DOM — test rendering + sort order + close.

Playwright covers the integration: summary-strip totals, category-tap-opens-drilldown, month-cell-tap-opens-drilldown, close.

## Dev Agent Record

### Implementation snapshot (as of 2026-05-13, uncommitted on master)

**Files created:**
- `src/app/shared/components/spending-matrix/spending-matrix.component.ts`
- `src/app/shared/components/spending-matrix/spending-matrix.component.html`
- `src/app/features/dashboard/category-drilldown-sheet.component.ts`

**Files modified:**
- `src/app/features/dashboard/dashboard.component.ts` — summary-strip computeds, matrix wiring, drilldown handler; removed month-nav signal + helpers
- `src/app/features/dashboard/dashboard.component.html` — summary strip + matrix + dashboard-local FAB
- `src/app/features/dashboard/dashboard.component.spec.ts` — rewritten for summary-strip coverage (Chart.js mock removed)
- `src/app/app.html` — app-shell FAB removed
- `src/app/app.ts` — `MatFabButton` import + `fabVisible` signal removed
- `src/app/core/services/auth.service.ts` — bundled but out of scope (see Tasks)
- `src/app/core/services/hydration.service.ts` — bundled but out of scope (see Tasks)

**Outstanding before review:**
- Unit tests for `SpendingMatrixComponent` and `CategoryDrilldownSheetComponent`
- Dashboard-spec coverage for `onCategoryDrilldown`
- E2E coverage on the new surfaces
- Splitting auth + hydration changes into separate `fix:` commits

## References

- Dashboard pivot context: [Source: memory — Dashboard add-in (in flight)]
- Story 4.1 (parent dashboard, temporarily un-composed): `_bmad-output/implementation-artifacts/4-1-dashboardcomponent-with-monthly-total-and-month-navigation.md`
- Story 4.2 (sparkline/KPI, temporarily un-composed): `_bmad-output/implementation-artifacts/4-2-sparklinechartcomponent-and-kpirowcomponent.md`
- Story 4.3 (category breakdown bar — adjacent): `_bmad-output/planning-artifacts/epics/epic-4-dashboard-spending-insights.md#Story-4.3`
- Story 4.4 (routed drill-down — adjacent, NOT replaced): `_bmad-output/planning-artifacts/epics/epic-4-dashboard-spending-insights.md#Story-4.4`
- `slugifyCategoryId`: `src/app/core/models/category.model.ts`
- `LocalEntry`: `src/app/core/models/entry.model.ts`
- `ChfCurrencyPipe`: `src/app/shared/pipes/chf-currency.pipe.ts`
