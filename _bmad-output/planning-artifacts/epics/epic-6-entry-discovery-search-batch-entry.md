# Epic 6: Entry Discovery, Search & Batch Entry

> **Explicit cut line** — E1–E5 constitute the full shippable core product. This epic is the first to defer under time pressure; it enhances discovery and power-user workflows.

Nick can browse past entries using filters (category, month, year), search by remarks text, find entries by merchant name, log a week of expenses in one batch session with automatic pre-fill, and switch to view historical years or an all-time aggregated view.

## Story 6.1: FilterChipRow with category, month, and year filters

As Nick,
I want to filter my entry list by category, month, and year using a row of chips,
So that I can quickly narrow down entries without scrolling through the full history.

**Acceptance Criteria:**

**Given** I am on the entries list screen
**When** `FilterChipRow` renders
**Then** it shows a horizontally scrollable row of filter chips for category, month, and year

**Given** I tap a category chip
**When** it activates
**Then** the chip fills indigo and the entry list filters to show only entries in that category

**Given** I tap a month chip
**When** it activates
**Then** the entry list filters to show only entries from the selected month

**Given** I tap a year chip
**When** it activates
**Then** the entry list filters to show only entries from the selected year

**Given** an active filter chip is shown
**When** I tap the × on the chip
**Then** that single filter is cleared and the list expands accordingly

**Given** any filter is active
**When** "Clear all" is visible
**Then** tapping it removes all active filters and the full entry list is restored

**Given** multiple filters are active simultaneously
**When** the list renders
**Then** only entries matching all active filters are shown

**Given** the filtered result is empty
**When** `EmptyState` renders
**Then** the message names the specific category and/or month — never generic

---

## Story 6.2: Full-text remarks search and merchant name filter

As Nick,
I want to search my entries by remarks text and filter by merchant name,
So that I can find a specific expense without knowing its exact date or category.

**Acceptance Criteria:**

**Given** I type in the search input
**When** the input fires after a 300ms debounce
**Then** the entry list filters to entries whose remarks field contains the typed text (case-insensitive)

**Given** I clear the search input
**When** the field is empty
**Then** the full (or otherwise filtered) entry list is restored

**Given** entries have a merchant name
**When** I filter by merchant name
**Then** only entries matching the merchant name are shown

**Given** search text is active alongside a category chip filter
**When** the list renders
**Then** both filters apply simultaneously — entries must match both search text and active category

**Given** the search returns no results
**When** `EmptyState` renders
**Then** the message references the specific search term — not a generic empty state

---

## Story 6.3: Year switcher and all-years aggregated view

As Nick,
I want to switch between years on the dashboard and see an aggregated view across all years,
So that I can review my long-term spending history in a single place.

**Acceptance Criteria:**

**Given** I am on the dashboard
**When** a year switcher control is visible
**Then** I can tap it to cycle through all available years

**Given** I select a different year
**When** the dashboard updates
**Then** the monthly total, sparkline, and category breakdown all reflect data from that year

**Given** I select the all-years view
**When** the dashboard renders
**Then** the hero card shows the total across all years and the sparkline shows annual rather than monthly aggregation

**Given** I switch to a year with only 2025-schema data
**When** the dashboard renders
**Then** the data is shown but all entry edit and delete actions are disabled — no write actions on legacy data

**Given** the year switcher updates the dashboard
**When** the category breakdown loads from IDB
**Then** it renders in under 500ms

---

## Story 6.4: Batch entry mode with automatic pre-fill

As Nick,
I want to log multiple expenses in a single session where each entry pre-fills from the previous one,
So that I can quickly enter a week's worth of expenses without re-selecting the date and category each time.

**Acceptance Criteria:**

**Given** I activate batch mode
**When** `QuickAddSheetComponent` opens in batch mode
**Then** after saving each entry, a new entry form immediately opens with the same date and category pre-filled

**Given** a batch entry form is pre-filled
**When** I want different values
**Then** I can override the pre-filled date or category before saving

**Given** I want to end the batch session
**When** I tap the stop/done control after saving the final entry
**Then** batch mode ends and the drawer closes

**Given** I tap close on the drawer during batch mode
**When** the drawer dismisses
**Then** the batch session ends — no implicit saving of any unsaved open form

**Given** entries are saved in batch mode
**When** each entry is saved
**Then** it follows the same optimistic IDB-write → SyncQueue enqueue flow as single-entry saves

**Given** batch mode is active and entries have been saved
**When** I review the entry list
**Then** each individually saved batch entry appears as a separate row

### End-to-End Tests (Playwright — Story 6.4 is Epic 6's last story)

**Tests — `e2e/filters.spec.ts` (new file):**

| ID | Scenario |
|---|---|
| E6-01 | FilterChipRow renders: All chip, current month chip, active category chips |
| E6-02 | Select category chip → entry list shows only that category's entries |
| E6-03 | Select month chip → entry list shows only entries for that month |
| E6-04 | Search: typing partial remarks → list narrows in real time (debounced) |
| E6-05 | Search + category chip combined → intersection filter applied correctly |
| E6-06 | Clear all filters → full unfiltered list restored |
| E6-07 | Year switcher → month chips update to reflect selected year |

**Tests — `e2e/batch-entry.spec.ts` (new file):**

| ID | Scenario |
|---|---|
| E6-08 | Batch mode activates; QuickAdd opens with batch controls visible |
| E6-09 | Save entry in batch → new form immediately opens with date and category pre-filled |
| E6-10 | Override pre-filled category → saves with overridden value, not the pre-filled one |
| E6-11 | Stop batch → drawer closes; all saved entries appear in list |
| E6-12 | Each batch save → `syncQueue` IDB contains one PENDING record per entry saved |
