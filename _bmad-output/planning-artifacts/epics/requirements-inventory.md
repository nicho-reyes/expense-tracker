# Requirements Inventory

## Functional Requirements

**Expense Entry**
- FR1: User can log a new expense by providing category and amount; date and remarks are optional
- FR2: User can complete a new expense entry in ≤3 taps on a warm app start, with date pre-filled to today
- FR3: User can override the pre-filled date when logging an expense
- FR4: User can add free-text remarks to any expense entry
- FR5: User can log expenses in batch mode, where each submitted entry pre-fills the next row with the same date and category
- FR6: User can edit an existing expense entry
- FR7: User can delete an existing expense entry
- FR8: User can enter negative amounts to represent split expenses or reimbursements
- FR49: User is prompted to confirm before an expense entry is deleted, and can undo the deletion within a short grace period
- FR50: User can end a batch entry session by saving the final entry, closing the batch view, or tapping a stop control

**Dashboard & Visualization**
- FR9: User can view total spend for the current month, inclusive of all categories with no exclusions
- FR10: User can view a sparkline comparison of monthly spend across the last 6–12 months
- FR11: User can view spend broken down by category for any selected month
- FR12: User can tap a category in the breakdown to view all entries for that category in that month
- FR13: User can navigate to any month via previous/next controls (not a calendar picker)
- FR14: User can switch between years and view an aggregated all-years view

**Entry Discovery & Search**
- FR15: User can filter the entry list by category
- FR16: User can filter the entry list by month
- FR17: User can filter the entry list by year
- FR18: User can search entries by free-text remarks content
- FR19: User can filter entries by merchant name

**Category Management**
- FR20: The app seeds the category registry from the connected Sheet on first load
- FR21: User can create new categories within the app
- FR22: User can assign a display color to each category
- FR23: User can reorder categories in the quick-add interface
- FR24: Categories created in the app are written back to the Sheet
- FR55: The category registry is global across all years — categories are not scoped to a specific tab or year

**Google Sheets Integration**
- FR25: The app discovers Sheet tabs matching the "CH Daily Expenses" naming prefix without manual configuration
- FR26: The app validates the column schema of a tab before reading or writing any data
- FR27: The app identifies the schema version (2026 active vs. 2025 legacy) of each discovered tab
- FR28: The app reads 2025 legacy tab data in read-only mode, mapping legacy columns to the current schema
- FR29: New entries are always written to the current year's active tab
- FR30: Entries from past years using the current schema can be edited and deleted; changes write back to their originating tab
- FR31: The app assigns a unique identifier to each entry stored in an app-managed column in the Sheet; if this column is absent on session load, the app surfaces a schema error
- FR32: The app surfaces an actionable error when sheet discovery fails or a tab has an unrecognized schema
- FR51: Entries sourced from the 2025 legacy tab are read-only; editing and deleting them is blocked in the app

**Offline & Sync**
- FR33: User can log, edit, and view entries while offline
- FR34: A persistent indicator shows connectivity status and the count of unsynced entries
- FR35: User can review all queued entries before they are pushed to Google Sheets
- FR36: User can edit an individual queued entry before it is synced
- FR37: User can cancel (discard) an individual queued entry before it is synced
- FR38: Failed sync attempts are retried automatically with exponential backoff
- FR39: A user-visible warning is surfaced when sync failure persists beyond a defined threshold
- FR40: The app displays the timestamp of the last successful sync
- FR41: The full dashboard and entry history remain browseable while offline or during token-invalid periods
- FR52: The sync queue indicator visually distinguishes PENDING entries (queued, not yet attempted) from SYNC_ERROR entries (attempted and failed)
- FR53: User can manually trigger a sync retry from the sync indicator

**Authentication & Session**
- FR42: User can authenticate with their Google account via OAuth
- FR43: The app maintains authentication across sessions without re-login on each visit
- FR44: The app prompts re-authentication when the OAuth token expires or is revoked; if silent token refresh fails, the user is redirected to the OAuth flow without data loss
- FR45: The app remains fully usable in offline/read mode and continues accepting queued entries during re-authentication
- FR46: On successful re-authentication, the pending queue is flushed and the latest Sheet data is fetched

**First-Run & Setup**
- FR47: On first launch, the app guides the user through Google authentication and Sheets access approval
- FR48: The user provides their Google Sheet URL or spreadsheet ID once on first run; the app derives and persists the `spreadsheetId` to `appMeta` IDB and connects automatically on all subsequent sessions — no re-entry required after initial setup
- FR54: After completing authentication on first launch, the app confirms the connected Sheet name before loading data

## NonFunctional Requirements

**Performance**
- NFR-P1: Dashboard (current month total + category breakdown) loads in < 2 seconds on a mid-range device on 4G
- NFR-P2: Entry save perceived latency (tap Save → entry appears in list) is < 200ms via optimistic local update
- NFR-P3: First Meaningful Paint on 4G < 3 seconds for returning users (cached assets)
- NFR-P4: Category × month drill-down opens in < 500ms
- NFR-P5: Sheet data is refreshed on every app open and tab focus; within a session, data is cached with a 5-minute TTL to avoid redundant re-fetches on navigation

**Security**
- NFR-S1: OAuth tokens are stored in browser storage and never exposed in URLs, logs, or error messages
- NFR-S2: All communication with Google APIs uses HTTPS exclusively
- NFR-S3: No financial data is transmitted to any service other than Google Sheets
- NFR-S4: The app requests the minimum necessary Google OAuth scopes — Sheets read/write access scoped to the identified spreadsheet only

**Reliability**
- NFR-R1: Zero entries are lost across all sync scenarios, including offline entry, reconnect, partial flush, and mid-flush token expiry
- NFR-R2: Queued entries survive app restarts, tab closes, and browser updates via IndexedDB persistence
- NFR-R3: After 1 hour of continuous sync failure for a given entry, the user receives a visible warning with a manual retry action
- NFR-R4: Schema validation blocks any write to Google Sheets when the column schema cannot be verified; no silent mismap

**Integration**
- NFR-I1: The app remains fully functional during Sheets API outages by serving cached data and queuing new entries locally
- NFR-I2: Sheets API writes are batched where possible to remain within the 100 requests/100 seconds quota
- NFR-I3: Sheets API quota errors and transient failures are handled gracefully — no data loss, no silent failure, user-visible retry state

**Accessibility**
- NFR-A1: Body text minimum 16px; interactive touch targets minimum 44×44px
- NFR-A2: Standard semantic HTML elements used throughout; no custom interactive components that break native browser behaviour

## Additional Requirements

Architecture-derived requirements that directly shape implementation:

- **Starter Template:** Angular CLI scaffold is story 1 of Epic 1 — the exact initialization sequence (`ng new expense-dashboard --style=scss --routing=true --strict=true --ssr=false`, then `ng add @angular/material`, `ng add @angular/pwa`, Tailwind, ng2-charts, idb, Zod, Playwright) must be completed before all other stories
- **Angular 21 standalone components** with `OnPush` change detection on every component; no NgModules
- **Angular Signals** (`signal()`, `computed()`, `effect()`) as the sole reactive state primitive — no NgRx, no BehaviorSubject; one service per domain
- **IndexedDB via `idb` library** as the primary data store — four stores: `entries`, `syncQueue`, `categories`, `appMeta`; IDB is the UI source of truth, not Sheets
- **APP_INITIALIZER** must run `AuthService.init()` + `CategoriesService.init()` before first render; all other services initialize lazily
- **AppError discriminated union** (`SCHEMA_VALIDATION`, `SHEETS_API`, `AUTH_EXPIRED`, `AUTH_REVOKED`, `NETWORK`, `SYNC_FAILED`, `IDB_ERROR`, `SCHEMA_MISMATCH`) as the sole error type; services never throw raw `Error` objects
- **NotificationService** is the only path to `MatSnackBar`; errors only — never for routine success; canonical interface: `showSuccess()`, `showError()`, `showInfo()`
- **Tailwind + Angular Material coexistence config**: `preflight: false` and `important: '#app'` in `tailwind.config.js` are mandatory — omitting either causes style conflicts
- **`AuthInterceptor`** injects Bearer token on all Sheets API HTTP calls via `HttpClient`
- **`auth.guard.ts`** (functional guard, not class-based) protects all routes except `/auth`
- **Category CSS custom properties** (`--color-[category-id]`) injected by `CategoriesService` into `document.documentElement.style` via `APP_INITIALIZER` before first render
- **Lazy-loaded routes** via `loadComponent()` for dashboard, entries-list, sync-review, settings, auth features; entry-form has no route — opens as `MatBottomSheet` via FAB
- **Dual schema support**: 2026 (6-column, writable) and 2025 (4-column, read-only); Zod validates header rows before any data operation; mismatch emits `AppError.SCHEMA_MISMATCH`
- **UUID via `crypto.randomUUID()`**: no external uuid library; written to column F of every Sheet row as idempotency key
- **GitHub Actions CI/CD** pipeline (`deploy.yml`): push to main → `npm ci` → `ng build --configuration=production` → deploy `dist/expense-dashboard/browser/` to static hosting
- **Dark mode**: CSS class toggle on `<html>`, preference persisted to `localStorage` under key `'theme'`; read on app boot in `app.component.ts`
- **Optimistic UI pattern**: IDB write first → update signal → show success → enqueue to SyncQueue; never await Sheets write before updating UI

## UX Design Requirements

- UX-DR1: Implement semantic CSS custom property color system — all color values as CSS custom properties (`--background`, `--foreground`, `--card`, `--border`, `--muted`, `--accent`) resolving to light/dark theme values; no hardcoded hex in components; theme switch = single class toggle on `<html>`
- UX-DR2: Implement runtime light/dark theme toggle — Angular Material M3 via `[color-scheme]` attribute; Tailwind `darkMode: 'class'`; preference persisted to `localStorage['theme']`; toggle control accessible in Settings
- UX-DR3: Implement `CategoryTileComponent` — color-coded tappable tiles for category selection; ordered by recency/frequency (most-used at top); unselected / selected (ring + fill) / recently-used visual states
- UX-DR4: Implement `HeroCardComponent` with monthly total in `text-4xl` bold type and embedded `SparklineChartComponent`; SparklineChart: 7-bar ng2-charts BarChart, current month indigo, prior months zinc-300/zinc-700; skeleton loader at exact 40px height matching hero number; `aria-busy="true"` during load
- UX-DR5: Implement `KpiRowComponent` — two side-by-side metric cards: vs-average delta (positive indigo, negative red-500) and entry count; below hero card on dashboard
- UX-DR6: Implement `CategoryBreakdownBarComponent` — CSS percentage-width divs (no chart library); per-row: color dot + category label + full-width track + colored fill bar + CHF amount; tappable for drill-down; zero-spend entries greyed out and sorted last; skeleton: 5 rows of varying-width grey bars
- UX-DR7: Implement `QuickAddSheetComponent` opened via `MatBottomSheet` from FAB; field sequence: Date → Category → Amount → Remarks; date pre-filled to today; amount field auto-focuses after category tap; `inputmode="decimal"` on amount; Save button full-width, always above keyboard; swipe-down to dismiss
- UX-DR8: Implement `SyncStatusBar` permanently mounted (not conditionally rendered) with `aria-live="polite"` and empty initial content; four states: Healthy ("synced Xm ago" — zinc-500 quiet), Pending (amber + count badge), Error (red + "sync failed" — tappable), Offline (grey dot + queued count)
- UX-DR9: Implement `EntryRowComponent` — date chip + category dot + amount + remarks per row; PENDING sync = dim dot; SYNC_ERROR = amber indicator; negative amounts = green `+` prefix; tappable to open entry detail/edit sheet
- UX-DR10: Implement `FilterChipRow` — horizontal scrollable row of chips for category/month/year filters; active chip fills indigo; × to clear individual chip; "Clear all" text link visible when any filter is active
- UX-DR11: Implement `EmptyState` component — icon + specific contextual message (names month or category, never generic) + optional CTA; vertically centered; never styled as error
- UX-DR12: Implement skeleton loading states for `HeroCardComponent` (40px grey rect) and `CategoryBreakdownBarComponent` (5 varying-width grey bars); no spinners in data areas; `aria-busy="true"` on container, `aria-hidden="true"` on skeleton elements
- UX-DR13: Implement `DrillDownHeader` — sticky header on drill-down screen showing category name + color dot + month + total; condensed form appears on scroll; back navigation returns focus to tapped category row
- UX-DR14: Implement `ColorPicker` — swatch grid for per-category color selection; ring indicator on selected; custom hex input option
- UX-DR15: Implement `CategoryManager` settings screen — CDK drag-drop reorder handles, `ColorPicker` per category, add/delete actions; empty state prompts Sheet sync
- UX-DR16: Implement PWA installability — `manifest.webmanifest` (standalone display, theme color, 192×192 + 512×512 icons); `ngsw-config.json` Service Worker config (precache app shell, network-first for API calls); installable on iOS and Android
- UX-DR17: Implement focus management — QuickAddDrawer open: focus → Date field; close: focus → FAB (`fabRef.nativeElement.focus()`); FAB in DOM with `visibility: hidden` while drawer open (not `*ngIf`); drill-down route mount: focus → `<h1>`; dialogs trap focus
- UX-DR18: Implement iPhone safe area insets — bottom nav and FAB include `padding-bottom: env(safe-area-inset-bottom)` (Tailwind `pb-safe` or CSS layer); `dvh` units (not `vh`) on all full-height overlays and sheets
- UX-DR19: Implement `touch-action` pairing — `pan-y` on scrollable list containers; `manipulation` on tappable rows inside scroll containers; `manipulation` NOT applied globally
- UX-DR20: Implement haptic feedback — light haptic on entry Save; medium haptic on sync error; no haptics for passive state changes
- UX-DR21: Implement `OfflineIndicator` — Online (hidden or green dot), Offline (grey dot + "Offline" label), Reconnecting (pulse animation)
- UX-DR22: Implement `SyncReviewRow` for pre-sync review screen — queued / pending push (spinner) / ACK'd (green checkmark) / failed (red + retry) states; review screen header: "N entries ready to sync"; "Sync all" as primary CTA
- UX-DR23: Implement `AmountInputComponent` — `inputmode="decimal"`, zero validation (zero is invalid), negative value handling (green display), CHF currency context
- UX-DR24: Enforce button hierarchy — one primary action per surface; FAB only fixed-position element; destructive actions always ghost/text style gated by `MatDialog` confirmation; never two primary buttons simultaneously
- UX-DR25: Implement ARIA completeness — `aria-label` on all icon-only buttons; `aria-hidden="true"` on decorative color dots; category month nav with `aria-label="Previous month"` / `aria-label="Next month"`; FAB `aria-label="Add expense"`
- UX-DR26: Implement `prefers-reduced-motion` support — no entrance animations when media query is active

## FR Coverage Map

**Epic 1 — Foundation, Authentication & First-Run Setup:**
FR20, FR25, FR26, FR27, FR31, FR32, FR42, FR43, FR44, FR45, FR46, FR47, FR48, FR54, FR55

**Epic 2 — Expense Entry & Local-First Core:**
FR1, FR2, FR3, FR4, FR6, FR7, FR8, FR29, FR49

**Epic 3 — Google Sheets Sync, Offline Resilience & Legacy Schema:**
FR28, FR30, FR33, FR34, FR35, FR36, FR37, FR38, FR39, FR40, FR41, FR51, FR52, FR53

**Epic 4 — Dashboard & Spending Insights:**
FR9, FR10, FR11, FR12, FR13

**Epic 5 — Category Management & Visual Customization:**
FR21, FR22, FR23, FR24

**Epic 6 — Entry Discovery, Search & Batch Entry:**
FR5, FR14, FR15, FR16, FR17, FR18, FR19, FR50

---

Individual FR → Epic mapping:
- FR1 → Epic 2 — Quick-add: category + amount minimum required fields
- FR2 → Epic 2 — ≤3-tap entry from warm app start
- FR3 → Epic 2 — Date override in entry form
- FR4 → Epic 2 — Free-text remarks field
- FR5 → Epic 6 — Batch entry mode with pre-fill
- FR6 → Epic 2 — Edit existing entry
- FR7 → Epic 2 — Delete existing entry
- FR8 → Epic 2 — Negative amounts for reimbursements
- FR9 → Epic 4 — Monthly total on dashboard
- FR10 → Epic 4 — 6–12 month sparkline comparison
- FR11 → Epic 4 — Category breakdown by month
- FR12 → Epic 4 — Category × month drill-down
- FR13 → Epic 4 — Previous/next month navigation
- FR14 → Epic 6 — Year switcher + all-years view
- FR15 → Epic 6 — Filter entry list by category
- FR16 → Epic 6 — Filter entry list by month
- FR17 → Epic 6 — Filter entry list by year
- FR18 → Epic 6 — Full-text remarks search
- FR19 → Epic 6 — Filter by merchant name
- FR20 → Epic 1 — Seed category registry from Sheet on first load
- FR21 → Epic 5 — Create new categories in app
- FR22 → Epic 5 — Assign per-category display color
- FR23 → Epic 5 — Reorder categories in quick-add list
- FR24 → Epic 5 — Write new categories back to Sheet
- FR25 → Epic 1 — Discover Sheet tabs by "CH Daily Expenses" prefix
- FR26 → Epic 1 — Validate column schema before read/write
- FR27 → Epic 1 — Detect schema version (2026 vs 2025)
- FR28 → Epic 3 — Read 2025 legacy tab in read-only mode with column mapping
- FR29 → Epic 2 — Write new entries to current year's active tab
- FR30 → Epic 3 — Edit/delete 2026-schema past-year entries with tab write-back
- FR31 → Epic 1 — UUID column management; surface error if column absent
- FR32 → Epic 1 — Actionable error on discovery failure or unrecognized schema
- FR33 → Epic 3 — Log, edit, and view entries while offline
- FR34 → Epic 3 — Persistent connectivity + unsynced-count indicator
- FR35 → Epic 3 — Review queued entries before push
- FR36 → Epic 3 — Edit individual queued entry before sync
- FR37 → Epic 3 — Cancel (discard) individual queued entry
- FR38 → Epic 3 — Exponential backoff retry on sync failure
- FR39 → Epic 3 — User-visible warning after 1 hour of sync failure
- FR40 → Epic 3 — Display last successful sync timestamp
- FR41 → Epic 3 — Dashboard and history remain browseable offline
- FR42 → Epic 1 — Google OAuth authentication
- FR43 → Epic 1 — Session persistence across visits
- FR44 → Epic 1 — Re-auth prompt on token expiry; silent-iframe → redirect fallback
- FR45 → Epic 1 — App usable in offline mode during re-auth
- FR46 → Epic 1 — Queue flush + latest Sheet fetch on re-auth success
- FR47 → Epic 1 — First-launch Google auth + Sheets access guide
- FR48 → Epic 1 — Auto-connect to expense Sheet without manual config
- FR49 → Epic 2 — Delete confirmation + grace-period undo
- FR50 → Epic 6 — End batch session (save / close / stop control)
- FR51 → Epic 3 — Block edit/delete on 2025 legacy entries
- FR52 → Epic 3 — PENDING vs SYNC_ERROR visual distinction on sync indicator
- FR53 → Epic 3 — Manual sync retry from sync indicator
- FR54 → Epic 1 — Confirm connected Sheet name before loading data
- FR55 → Epic 1 — Category registry global across all years (data model constraint)
