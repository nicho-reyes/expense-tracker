# Functional Requirements

## Expense Entry

- **FR1:** User can log a new expense by providing category and amount; date and remarks are optional
- **FR2:** User can complete a new expense entry in ≤3 taps on a warm app start, with date pre-filled to today
- **FR3:** User can override the pre-filled date when logging an expense
- **FR4:** User can add free-text remarks to any expense entry
- **FR5:** User can log expenses in batch mode, where each submitted entry pre-fills the next row with the same date and category
- **FR6:** User can edit an existing expense entry
- **FR7:** User can delete an existing expense entry
- **FR8:** User can enter negative amounts to represent split expenses or reimbursements
- **FR49:** User is prompted to confirm before an expense entry is deleted, and can undo the deletion within a short grace period
- **FR50:** User can end a batch entry session by saving the final entry, closing the batch view, or tapping a stop control

## Dashboard & Visualization

- **FR9:** User can view total spend for the current month, inclusive of all categories with no exclusions
- **FR10:** User can view a sparkline comparison of monthly spend across the last 6–12 months
- **FR11:** User can view spend broken down by category for any selected month
- **FR12:** User can tap a category in the breakdown to view all entries for that category in that month
- **FR13:** User can navigate to any month via previous/next controls (not a calendar picker)
- **FR14:** User can switch between years and view an aggregated all-years view

## Entry Discovery & Search

- **FR15:** User can filter the entry list by category
- **FR16:** User can filter the entry list by month
- **FR17:** User can filter the entry list by year
- **FR18:** User can search entries by free-text remarks content
- **FR19:** User can filter entries by merchant name

## Category Management

- **FR20:** The app seeds the category registry from the connected Sheet on first load
- **FR55:** The category registry is global across all years — categories are not scoped to a specific tab or year
- **FR21:** User can create new categories within the app
- **FR22:** User can assign a display color to each category
- **FR23:** User can reorder categories in the quick-add interface
- **FR24:** Categories created in the app are written back to the Sheet

## Google Sheets Integration

- **FR25:** The app discovers Sheet tabs matching the "CH Daily Expenses" naming prefix without manual configuration
- **FR26:** The app validates the column schema of a tab before reading or writing any data
- **FR27:** The app identifies the schema version (2026 active vs. 2025 legacy) of each discovered tab
- **FR28:** The app reads 2025 legacy tab data in read-only mode, mapping legacy columns to the current schema
- **FR29:** New entries are always written to the current year's active tab
- **FR30:** Entries from past years using the current schema can be edited and deleted; changes write back to their originating tab
- **FR31:** The app assigns a unique identifier to each entry, stored in an app-managed column in the Sheet; if this column is absent on session load, the app surfaces a schema error
- **FR32:** The app surfaces an actionable error when sheet discovery fails or a tab has an unrecognized schema
- **FR51:** Entries sourced from the 2025 legacy tab are read-only; editing and deleting them is blocked in the app

## Offline & Sync

- **FR33:** User can log, edit, and view entries while offline
- **FR34:** A persistent indicator shows connectivity status and the count of unsynced entries
- **FR35:** User can review all queued entries before they are pushed to Google Sheets
- **FR36:** User can edit an individual queued entry before it is synced
- **FR37:** User can cancel (discard) an individual queued entry before it is synced
- **FR38:** Failed sync attempts are retried automatically with exponential backoff
- **FR39:** A user-visible warning is surfaced when sync failure persists beyond a defined threshold
- **FR40:** The app displays the timestamp of the last successful sync
- **FR41:** The full dashboard and entry history remain browseable while offline or during token-invalid periods
- **FR52:** The sync queue indicator visually distinguishes PENDING entries (queued, not yet attempted) from SYNC_ERROR entries (attempted and failed)
- **FR53:** User can manually trigger a sync retry from the sync indicator

## Authentication & Session

- **FR42:** User can authenticate with their Google account via OAuth
- **FR43:** The app maintains authentication across sessions without re-login on each visit
- **FR44:** The app prompts re-authentication when the OAuth token expires or is revoked; if silent token refresh fails, the user is redirected to the OAuth flow without data loss
- **FR45:** The app remains fully usable in offline/read mode and continues accepting queued entries during re-authentication
- **FR46:** On successful re-authentication, the pending queue is flushed and the latest Sheet data is fetched

## First-Run & Setup

- **FR47:** On first launch, the app guides the user through Google authentication and Sheets access approval
- **FR48:** The user provides their Google Sheet URL or spreadsheet ID once on first launch; the app persists the connection to `appMeta` IDB and reconnects automatically on all subsequent sessions without requiring manual re-entry
- **FR54:** After completing authentication on first launch, the app confirms the connected Sheet name before loading data
