# Epic 4: Dashboard & Spending Insights

Nick can answer "how am I doing this month?" in under 10 seconds — the monthly hero card, 7-bar sparkline, KPI row, and category breakdown bar are visible on the dashboard, and tapping a category opens the full entry drill-down for that category and month.

## Story 4.1: DashboardComponent with monthly total and month navigation

As Nick,
I want to see my total spending for the current month on the dashboard and navigate to any past month,
So that I can quickly answer "how much have I spent this month?" and compare with previous months.

**Acceptance Criteria:**

**Given** entries exist in IDB
**When** the `DashboardComponent` loads
**Then** the current month's total spend across all categories is displayed in `HeroCardComponent`

**Given** the hero total renders
**When** the layout is inspected
**Then** the amount uses `text-4xl` bold typography

**Given** the dashboard is loading data
**When** `HeroCardComponent` is in a loading state
**Then** a skeleton loader at exactly 40px height displays with `aria-busy="true"` — no full-page spinner

**Given** the data has loaded
**When** the skeleton is replaced with real content
**Then** `aria-busy` is removed and the actual total is rendered

**Given** I tap the "previous month" control
**When** the month decrements
**Then** the displayed total and breakdown update to the selected month's data

**Given** I tap the "next month" control while on a past month
**When** the month increments
**Then** the displayed total and breakdown update to the next month's data

**Given** the month navigation controls render
**When** their accessible names are inspected
**Then** they have `aria-label="Previous month"` and `aria-label="Next month"`

**Given** the dashboard loads for a returning user with IDB data available
**When** load time is measured on a mid-range device
**Then** the current month total renders in under 2 seconds

---

## Story 4.2: SparklineChartComponent and KpiRowComponent

As Nick,
I want to see a 7-bar sparkline of my recent monthly spending and key metrics below the hero card,
So that I can understand my spending trend at a glance without navigating away from the dashboard.

**Acceptance Criteria:**

**Given** the `HeroCardComponent` renders
**When** `SparklineChartComponent` is embedded within it
**Then** a 7-bar ng2-charts `BarChart` is shown with the current month bar in indigo and prior months in zinc-300 (light mode) / zinc-700 (dark mode)

**Given** the sparkline is loading
**When** the skeleton renders
**Then** it matches the exact 40px height of the hero number skeleton — no layout shift on data load

**Given** sparkline data is available
**When** I inspect the chart data
**Then** it covers the last 6–12 months of entries from IDB

**Given** the `KpiRowComponent` renders below the hero card
**When** two metric cards are shown
**Then** the first shows the vs-average spend delta and the second shows the entry count for the selected month

**Given** the vs-average delta is positive (spending above average)
**When** `KpiRowComponent` renders
**Then** the delta value displays in red-500

**Given** the vs-average delta is negative (spending below average)
**When** `KpiRowComponent` renders
**Then** the delta value displays in indigo

---

## Story 4.3: CategoryBreakdownBarComponent

As Nick,
I want to see my spending broken down by category for the selected month as a proportional bar chart,
So that I can immediately see which categories are driving my spending.

**Acceptance Criteria:**

**Given** a month is selected on the dashboard
**When** `CategoryBreakdownBarComponent` renders
**Then** each category with spend shows: a color dot, the category label, a full-width track, a colored fill bar sized by CSS percentage, and the CHF amount

**Given** the fill bar color is rendered
**When** inspected
**Then** it uses the `--color-[category-id]` CSS custom property — no hardcoded hex colors

**Given** a category has zero spend for the selected month
**When** rendered
**Then** it is greyed out and sorted to the bottom of the list

**Given** the breakdown is loading
**When** the skeleton renders
**Then** 5 rows of varying-width grey bars appear — no spinners in the data area

**Given** the breakdown has loaded
**When** `aria-busy` is inspected on the container
**Then** it is `false`; skeleton elements have `aria-hidden="true"`

**Given** I tap a category row
**When** the tap registers
**Then** I am navigated to the drill-down for that category and the selected month

**Given** the category drill-down transition completes
**When** render time is measured
**Then** the drill-down opens in under 500ms

**Given** an entry's `categoryId` no longer exists in the `categories` IDB store
**When** `CategoryBreakdownBarComponent` renders
**Then** the entry is grouped under an "Unknown" label using a fixed neutral color (`--color-unknown: #9e9e9e`); no CSS variable fallback is unhandled, no rendering error is thrown, and no exception escapes the component

---

## Story 4.4: Category × month drill-down with DrillDownHeader

As Nick,
I want to tap a category in the breakdown and see all entries for that category in the selected month,
So that I can review exactly what I spent in any category.

**Acceptance Criteria:**

**Given** I tap a category in `CategoryBreakdownBarComponent`
**When** the drill-down route mounts
**Then** focus moves to the `<h1>` of the drill-down screen

**Given** the drill-down screen renders
**When** `DrillDownHeader` is shown
**Then** it displays the category name, color dot, selected month, and category total for that month

**Given** I scroll down on the drill-down screen
**When** `DrillDownHeader` scrolls past a threshold
**Then** a condensed sticky form of the header appears

**Given** I tap back navigation
**When** I return to the dashboard
**Then** focus returns to the tapped category row in `CategoryBreakdownBarComponent`

**Given** no entries exist for the selected category and month
**When** the drill-down renders
**Then** the `EmptyState` component shows a message naming the specific month and category — not a generic message

**Given** the drill-down route is accessed via a direct URL (deep link)
**When** it loads
**Then** the correct category and month data is displayed from IDB

---

## Story 4.5: SpendingMatrix year view with category drilldown sheet

As Nick,
I want a single year-view matrix that shows every category's spending across all 12 months alongside an at-a-glance summary strip,
So that I can see the shape of my year's spending in one screen and tap any category or month cell to drill into the underlying entries.

**Context:** Additive surface — does NOT replace Stories 4.1–4.4. HeroCard/Sparkline/KpiRow components remain in repo and will be re-composed into the dashboard later. Drilldown here is a `MatBottomSheet`; Story 4.4 retains scope for the routed drill-down page with `DrillDownHeader`.

**Acceptance Criteria:**

**Given** the dashboard renders
**When** the summary strip is shown
**Then** four cards display: Today / This month / This year / All time, each formatted via `ChfCurrencyPipe`

**Given** `SpendingMatrixComponent` mounts for the current year
**When** the table renders
**Then** rows are one-per-category (alphabetical by name), columns are 12 months (Jan–Dec), with the leftmost column sticky

**Given** an entry's `LocalEntry.category` (display name)
**When** the matrix groups totals
**Then** the entry is bucketed by `slugifyCategoryId(category)` against `Category.id`; entries referencing unknown categories are excluded

**Given** a cell is zero
**When** it renders
**Then** it shows `—` in muted color and is non-clickable; non-zero cells use `Intl.NumberFormat('de-CH', ...)` and are clickable

**Given** the matrix has an `exclusionSets` input
**When** the totals rows render
**Then** one subtotal row per set appears above the grand total, computing per-month and overall totals excluding the configured `excludeIds`

**Given** I tap a category name OR a non-zero month cell
**When** the click fires
**Then** `CategoryDrilldownSheetComponent` opens as a `MatBottomSheet`: category-name tap scopes to the year, month-cell tap scopes to that month

**Given** the drilldown sheet renders
**When** the entry list is shown
**Then** entries sort descending by date, dates format as `D MMM`, and negative amounts render in red

**Given** the Dashboard wires the matrix
**When** the `exclusionSets` input is inspected
**Then** it passes `[{ "Excl. Taxes & Contributions": [taxes, contributions] }, { "Excl. Taxes, Contributions & Investment": [taxes, contributions, investment] }]`

**Given** `SpendingMatrixComponent` is consumed
**When** its API is inspected
**Then** it is `standalone`, `OnPush`, uses `input()` / `output()` only, injects no services, and emits `categoryClick({ categoryId, month: string | null })`

---

### End-to-End Tests (Playwright — Story 4.4 is Epic 4's last story)

Uses the deterministic 3-month/4-category/20-entry IDB fixture from `idb-helpers.ts`.

**Tests — `e2e/dashboard.spec.ts` (replaces existing placeholder):**

| ID | Scenario |
|---|---|
| E4-01 | KPI row: total spend, largest category, entry count — all non-zero with seeded data |
| E4-02 | Sparkline canvas element present with non-zero bounding box |
| E4-03 | Category breakdown: segment count matches fixture category count |
| E4-04 | Tap category segment → drill-down shows only entries for that category |
| E4-05 | Month switcher → KPI values update to reflect seeded data for selected month |
| E4-06 | No IDB entries → "No data" empty state shown, no JS errors |

---
