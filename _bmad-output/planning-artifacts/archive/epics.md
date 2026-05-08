---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories']
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
---

# expense-dashboard - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for expense-dashboard, decomposing the requirements from the PRD, UX Design, and Architecture documents into implementable stories.

## Requirements Inventory

### Functional Requirements

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

### NonFunctional Requirements

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

### Additional Requirements

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

### UX Design Requirements

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

### FR Coverage Map

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

## Epic List

### Epic 1: Foundation, Authentication & First-Run Setup

Nick can open the app, authenticate with Google, have the app auto-discover his expense Sheet, validate the schema, seed the category registry, and land on a working connected app shell — the complete foundation enabling all subsequent epics.

**FRs covered:** FR20, FR25, FR26, FR27, FR31, FR32, FR42, FR43, FR44, FR45, FR46, FR47, FR48, FR54, FR55
**Architecture items:** Angular CLI scaffold + all npm packages + Tailwind config (`preflight: false`), IDB schema (`entries`, `syncQueue`, `categories`, `appMeta` stores), `AuthService` + GIS `initTokenClient` (implicit grant, token in memory only), `APP_INITIALIZER` bootstrap order, `SheetsService` tab discovery + Zod schema validation, `CategoriesService` initial seeding + CSS custom property injection (categories seeded with default palette colors so `--color-[id]` properties are always populated before E4 renders), `AuthInterceptor`, `auth.guard.ts`, CI/CD pipeline, PWA manifest
**SyncQueueService contract (locked here):** Full `SyncQueueItem` type, `QueueState` enum (`PENDING` | `SYNC_ERROR`), and all method signatures (`enqueue()`, `dequeue()`, `markError()`, `markSynced()`, `retryAll()`, `getQueue()`) defined as a typed interface in E1 — E2 implements INSERT enqueue only, E3 implements the full state machine; both epics implement against this locked contract

---

### Epic 2: Expense Entry & Local-First Core

Nick can log, edit, and delete expenses — the ≤3-tap quick-add form works, entries appear instantly via optimistic local write, the full entry list is functional, and basic online Sheets write (INSERT) delivers data to the Sheet on the happy path.

**FRs covered:** FR1, FR2, FR3, FR4, FR6, FR7, FR8, FR29, FR49
**Architecture items:** `EntriesService` (IDB CRUD + optimistic signal update + basic SyncQueue enqueue), `SyncQueueService` INSERT enqueue (implementing the interface contract locked in E1), `QuickAddSheetComponent` via `MatBottomSheet`, `CategoryTileComponent`, `EntryRowComponent`, `AmountInputComponent`, FAB, bottom nav, haptic feedback on Save, `touch-action` pairing, safe area insets

---

### Epic 3: Google Sheets Sync, Offline Resilience & Legacy Schema

> **Highest-risk epic** — covers three distinct concern areas; stories should be sub-grouped and sequenced within the epic to reduce integration risk.

All entries sync to Google Sheets reliably through full offline operation — the IndexedDB queue survives restarts, 2025 legacy entries appear in read-only mode, the pre-sync review screen works, PENDING/SYNC_ERROR states are visually distinguished, and exponential backoff retry handles network failures.

**FRs covered:** FR28, FR30, FR33, FR34, FR35, FR36, FR37, FR38, FR39, FR40, FR41, FR51, FR52, FR53

**Sub-groups (story sequencing within epic):**
- **3A — SyncQueue State Machine:** `SyncQueueService` full state machine (PENDING → SYNC_ERROR, exponential backoff 1s/2s/4s/8s/16s cap), `SheetsService` batch UPDATE/DELETE, `SyncStatusBar` PENDING/SYNC_ERROR visual distinction, manual retry (FR38, FR39, FR40, FR52, FR53)
- **3B — Offline Resilience & Queue Review:** offline detection (`navigator.onLine`), queue survives restart, `SyncReviewComponent`, `SyncReviewRow`, `OfflineIndicator`, edit/cancel queued entries (FR33, FR34, FR35, FR36, FR37, FR41)
- **3C — Legacy Schema Support:** 2025 tab read-only mode, legacy column mapping, read-only entry enforcement, past-year 2026-schema tab edit/delete with write-back (FR28, FR30, FR51)

**Architecture items:** `SyncQueueService` full state machine (implementing the interface contract locked in E1), `SheetsService` batch UPDATE/DELETE, offline detection (`navigator.onLine`), `SyncReviewComponent`, `SyncStatusBar`, `OfflineIndicator`, `SyncReviewRow`, 2025 legacy column mapping, read-only entry enforcement

---

### Epic 4: Dashboard & Spending Insights

Nick can answer "how am I doing this month?" in under 10 seconds — the monthly hero card, 7-bar sparkline, KPI row, and category breakdown bar are visible on the dashboard, and tapping a category opens the full entry drill-down for that category and month.

**FRs covered:** FR9, FR10, FR11, FR12, FR13
**Architecture items:** `DashboardComponent`, `HeroCardComponent` + skeleton loader, `SparklineChartComponent` (ng2-charts), `KpiRowComponent`, `CategoryBreakdownBarComponent` (CSS percentage divs), `EntriesListComponent` (drill-down view), `DrillDownHeader`, month prev/next navigation, `EmptyState` component, deep-linkable drill-down route

---

### Epic 5: Category Management & Visual Customization

Nick can customize category colors (overriding the defaults seeded in E1), reorder categories in the quick-add list, add new categories, and see those colors reflected consistently throughout the dashboard bars, entry list dots, and drill-down — with light/dark theme toggle available in Settings.

**FRs covered:** FR21, FR22, FR23, FR24
**Architecture items:** `CategoriesService` full CRUD + CSS custom property update (overriding defaults established in E1), `CategoryManager` settings screen, `ColorPicker` component, CDK drag-drop reorder, `SettingsComponent`, light/dark theme toggle (`localStorage['theme']`), category write-back to Sheet

---

### Epic 6: Entry Discovery, Search & Batch Entry

> **Explicit cut line** — this epic is complete, shippable functionality but is the first to defer under time pressure. E1–E5 constitute the full core product; E6 enhances discovery and power-user workflows.

Nick can browse past entries using filters (category, month, year), search by remarks text, find entries by merchant name, log a week of expenses in one batch session with automatic pre-fill, and switch to view historical years or an all-time aggregated view.

**FRs covered:** FR5, FR14, FR15, FR16, FR17, FR18, FR19, FR50
**Architecture items:** `FilterChipRow` component, `EntriesListComponent` filter/search capabilities, `EntriesService` IDB-side filtering, remarks full-text search (debounced), merchant name extraction, batch entry mode with same-date+category pre-fill, year switcher on dashboard, all-years aggregated view

---

## Epic 1: Foundation, Authentication & First-Run Setup

Nick can open the app, authenticate with Google, have the app auto-discover his expense Sheet, validate the schema, seed the category registry, and land on a working connected app shell — the complete foundation enabling all subsequent epics.

### Story 1.1: Project scaffold, toolchain, and CI/CD pipeline

As Nick,
I want the project initialized with all required dependencies, toolchain configuration, and a working CI/CD pipeline,
So that I have a deployable app shell as the verified starting point for all subsequent stories.

**Acceptance Criteria:**

**Given** a clean environment with Node.js and Angular CLI installed
**When** `ng new expense-dashboard --style=scss --routing=true --strict=true --ssr=false` is run and all packages are installed
**Then** `ng serve` starts without errors and the default app shell renders at `/`

**Given** the project is initialized
**When** Angular Material (`ng add @angular/material`), PWA (`ng add @angular/pwa`), Tailwind CSS, ng2-charts, idb, Zod, and Playwright are added
**Then** all package imports resolve without errors and `ng build --configuration=production` produces a clean build

**Given** Tailwind is configured
**When** `tailwind.config.js` is inspected
**Then** `preflight: false` and `important: '#app'` are set, and no style conflicts exist between Tailwind and Angular Material

**Given** the `AppError` discriminated union is defined with variants: `SCHEMA_VALIDATION`, `SHEETS_API`, `AUTH_EXPIRED`, `AUTH_REVOKED`, `NETWORK`, `SYNC_FAILED`, `IDB_ERROR`, `SCHEMA_MISMATCH`
**When** any service emits an error in any subsequent story
**Then** the emitted type is `AppError` — no raw `Error` objects are thrown or emitted by services

**Given** the `SyncQueueService` interface contract is defined with full `SyncQueueItem` type, `QueueState` enum (`PENDING` | `SYNC_ERROR`), and method signatures (`enqueue()`, `dequeue()`, `markError()`, `markSynced()`, `retryAll()`, `getQueue()`)
**When** E2 and E3 implement `SyncQueueService`
**Then** both epics compile against this locked interface without modification

**Given** the `SyncQueueItem` type is defined
**When** its fields are inspected
**Then** it includes exactly: `id: string`, `operation: 'INSERT' | 'UPDATE' | 'DELETE'`, `entryData: LocalEntry | null`, `targetEntryId: string | null`, `targetTabName: string | null` (null for INSERT operations; set to the originating tab name for past-year UPDATE/DELETE — required by Story 3.7), `enqueuedAt: number`, `status: QueueState`, `retryCount: number`, `lastAttemptAt: number | null`, `nextRetryAt: number | null` (written by `markError()` to persist the scheduled retry time across app restarts — required by Story 3.1), `errorMessage: string | null`

**Given** the IDB database is opened via the `idb` library
**When** the app initializes for the first time
**Then** four object stores exist: `entries`, `syncQueue`, `categories`, and `appMeta`

**Given** a commit is pushed to `main`
**When** the GitHub Actions `deploy.yml` workflow runs
**Then** it executes `npm ci` → `ng build --configuration=production` → deploys `dist/expense-dashboard/browser/` to the configured static host, and the workflow exits with status 0

**Given** `manifest.webmanifest` exists
**When** it is inspected
**Then** it has `display: standalone`, a theme color, and both 192×192 and 512×512 icon entries so the app is installable on iOS and Android

---

### Story 1.2: Google OAuth authentication flow

As Nick,
I want to sign in with my Google account via a standard OAuth flow,
So that the app can access my Google Sheets on my behalf with the minimum necessary permissions.

**Acceptance Criteria:**

**Given** I am not authenticated
**When** I open the app
**Then** I am redirected to `/auth` and shown a "Sign in with Google" prompt

**Given** I click "Sign in with Google"
**When** the Google Identity Services OAuth flow via `initTokenClient` completes successfully
**Then** I am redirected to the main app and my authentication state is `AUTHENTICATED`

**Given** I have previously authenticated
**When** I open the app in a new browser session
**Then** I am not prompted to sign in again (session is persisted across visits)

**Given** the access token is obtained
**When** it is stored
**Then** it is held in memory only and not written to `localStorage`, `sessionStorage`, cookies, or any URL parameter

**Given** any HTTP call to the Google Sheets API is made via `HttpClient`
**When** the `AuthInterceptor` processes the request
**Then** an `Authorization: Bearer <token>` header is present on the request

**Given** I am authenticated
**When** I navigate to any route other than `/auth`
**Then** the functional `auth.guard.ts` permits access

**Given** I am unauthenticated
**When** I navigate to any protected route
**Then** I am redirected to `/auth` with no data loss

**Given** the OAuth authorization request is constructed
**When** the scopes are inspected
**Then** only `https://www.googleapis.com/auth/spreadsheets` is requested — no Drive, Gmail, or other scopes (spreadsheet discovery uses a user-provided ID persisted to `appMeta`, not Drive file enumeration)

**Given** all API calls are made
**When** the request URL is inspected
**Then** the scheme is `https://` exclusively — no plain HTTP

> ⚠️ **Pre-sprint note (resolve before Story 1.2 implementation):** Add ACs for two missing auth failure paths: (1) User cancels Google consent screen → return to `/auth` with "Sheets access is required" message; do not emit `AUTH_REVOKED` (no token was ever issued). (2) Network timeout during initial OAuth flow → return to `/auth` with retry option, emit `AppError.NETWORK`. May require an `AUTH_DENIED` variant in the `AppError` discriminated union — decide in Story 1.1 before implementing Story 1.2.

---

### Story 1.3: Token refresh and re-authentication resilience

As Nick,
I want the app to silently refresh my session and only prompt me to re-authenticate when absolutely necessary,
So that token expiry never causes data loss and the app remains usable during any auth interruption.

**Acceptance Criteria:**

**Given** my access token is nearing expiry
**When** the GIS silent iframe refresh attempt succeeds
**Then** the new token is swapped in memory with no visible interruption to my session

**Given** the silent iframe refresh attempt fails
**When** the fallback triggers
**Then** I am redirected to the full OAuth flow at `/auth` without losing any locally stored data

**Given** I am on the re-authentication screen
**When** I look at the entry list and sync queue indicator
**Then** previously entered data is still visible and I can view all cached entries in read mode

**Given** I complete re-authentication
**When** the app resumes
**Then** `SyncQueueService.retryAll()` is called to flush the pending queue and the latest Sheet data is fetched

**Given** a Sheets API call returns HTTP 401 during an active session
**When** the error is handled
**Then** an `AppError.AUTH_REVOKED` is emitted, I am prompted to re-authenticate, and no data is lost

---

### Story 1.4: First-run setup and Google Sheets discovery

As Nick,
I want the app to guide me through connecting my Google account on first launch and automatically find my expense Sheet,
So that I can start logging expenses without entering any Sheet URL or ID.

**Acceptance Criteria:**

**Given** this is my first app launch (no auth token in storage)
**When** I open the app
**Then** I see a first-run onboarding screen prompting me to sign in with Google and approve Sheets access

**Given** I complete authentication
**When** the app prompts for Sheet connection
**Then** I am asked to enter my Google Sheet URL or spreadsheet ID once; the app derives the `spreadsheetId`, validates the spreadsheet is accessible, and persists it to the `appMeta` IDB store — no Drive-level file search is performed and the `spreadsheets` scope is sufficient

**Given** a matching Sheet is found
**When** discovery completes
**Then** the app displays the connected Sheet name and waits for my confirmation before loading any data

**Given** a Sheet tab is found
**When** the app reads its header row
**Then** Zod validates the column schema before any read or write operation is attempted

**Given** Zod schema validation passes on a tab
**When** the header row is inspected
**Then** the app identifies the schema version as either 2026 (6-column, writable) or 2025 (4-column, read-only) and stores this classification per tab

**Given** a 2026-schema tab is identified
**When** column F (the app-managed UUID column) is absent
**Then** an `AppError.SCHEMA_MISMATCH` is emitted, no data is read or written, and I see an actionable error message explaining the missing column

**Given** Sheet discovery fails entirely (network error or no matching spreadsheet)
**When** the error is surfaced
**Then** I see an actionable `AppError.SHEETS_API` message with a retry option — no unhandled exception or blank screen

**Given** a tab's header row matches neither the 2026 nor 2025 schema
**When** it is encountered during discovery
**Then** an `AppError.SCHEMA_VALIDATION` is emitted, the tab is skipped, and I see a user-visible warning identifying the problematic tab

---

### Story 1.5: Category registry seeding and CSS custom property injection

As Nick,
I want the app to load my expense categories from the Sheet at startup and display them with distinct colors throughout the app,
So that my categories are ready to use immediately with full visual differentiation before I log a single entry.

**Acceptance Criteria:**

**Given** Sheet discovery and authentication are complete
**When** `APP_INITIALIZER` runs
**Then** `AuthService.init()` completes fully before `CategoriesService.init()` begins — no parallel initialization

**Given** `CategoriesService.init()` runs
**When** the category data is read from the Sheet
**Then** categories are stored in the `categories` IDB store and the registry is global across all years — not scoped to any individual tab

**Given** a category has no user-assigned color
**When** `CategoriesService.init()` processes it
**Then** it is assigned a color from a predefined default palette (indexed by position in the registry) so `--color-[category-id]` is always populated

**Given** all categories have colors (default or user-assigned)
**When** `CategoriesService.init()` completes
**Then** `--color-[category-id]` CSS custom properties are injected into `document.documentElement.style` for every category

**Given** `APP_INITIALIZER` finishes
**When** the first route renders
**Then** all category CSS custom properties are already set — no flash of un-colored bars, dots, or tiles on initial paint

**Given** I am a returning user and the app is offline
**When** `CategoriesService.init()` runs
**Then** categories are loaded from the `categories` IDB store with no network call required — app shell renders normally

> ⚠️ **Pre-sprint note (resolve before Story 1.5 implementation):** Two gaps need ACs added before work begins: (1) **APP_INITIALIZER failure handling** — `CategoriesService.init()` must never reject; if both IDB and network fail, boot with an empty category registry and show a recoverable prompt, never a blank screen. (2) **Categories tab schema** — define which Sheet tab and column range `CategoriesService.init()` reads from (recommended: exact-name `Categories` tab, column A, header `Category`; fall back to extracting unique values from column B of the active 2026-schema tab if `Categories` tab is absent). The write-back range for Story 5.3 depends on this decision.

---

### Story 1.6: App shell, semantic color system, and light/dark theme

As Nick,
I want a polished app shell with a semantic color system and a working light/dark theme toggle,
So that the app is visually consistent from day one and I can switch to dark mode to match my preference.

**Acceptance Criteria:**

**Given** the app loads
**When** component styles are inspected
**Then** all color values use CSS custom properties (`--background`, `--foreground`, `--card`, `--border`, `--muted`, `--accent`) — no hardcoded hex values in any component style

**Given** the app boots
**When** `localStorage['theme']` is `'dark'`
**Then** the `dark` class is applied to `<html>` and Angular Material's `[color-scheme]` attribute reflects dark mode before the first paint

**Given** `tailwind.config.js` is inspected
**When** the `darkMode` key is read
**Then** its value is `'class'`

**Given** I access the theme toggle in Settings
**When** I tap it
**Then** the `dark` class is toggled on `<html>`, `localStorage['theme']` is updated, and the entire UI transitions without a full page reload

**Given** `prefers-reduced-motion: reduce` is active in my OS settings
**When** any component with entrance animations renders
**Then** no animations play

**Given** the app shell renders on a mobile viewport
**When** I inspect the layout
**Then** a bottom navigation bar, a FAB placeholder, and the main content area are present with no horizontal overflow and correct safe-area-inset padding

**Given** `ngsw-config.json` and `manifest.webmanifest` are configured
**When** the app is served over HTTPS and Chrome's installability criteria are checked
**Then** the "Add to Home Screen" prompt is eligible on Android and the app is bookmarkable as a standalone app on iOS

---

## Epic 2: Expense Entry & Local-First Core

Nick can log, edit, and delete expenses — the ≤3-tap quick-add form works, entries appear instantly via optimistic local write, the full entry list is functional, and basic online Sheets write (INSERT) delivers data to the Sheet on the happy path.

### Story 2.1: EntriesService — IDB CRUD and optimistic signal update

As Nick,
I want expense entries to be saved instantly to local storage and reflected in the UI without waiting for any network call,
So that the app feels instantaneous regardless of connectivity.

**Acceptance Criteria:**

**Given** I submit a new expense entry
**When** `EntriesService.add()` is called
**Then** the entry is written to the `entries` IDB store and the entries signal is updated — all before any Sheets API call

**Given** the IDB write completes
**When** the UI re-renders
**Then** the new entry appears in the entry list within 200ms of the save action

**Given** I call `EntriesService.update()`
**When** the IDB write completes
**Then** the updated entry replaces the old one in both IDB and the entries signal

**Given** I call `EntriesService.delete()`
**When** the IDB write completes
**Then** the entry is removed from both IDB and the entries signal

**Given** the app starts
**When** IDB is queried on init
**Then** all entries are loaded into the entries signal from IDB — not from the Sheets API

**Given** an IDB write fails for any reason
**When** the error is caught
**Then** an `AppError.IDB_ERROR` is emitted and the signal is not updated — no phantom entries appear in the list

**Given** any signal update occurs
**When** change detection runs
**Then** only `OnPush` components that consume the affected signal re-render

> ⚠️ **Pre-sprint note (resolve before Story 2.1 implementation):** Add NFR-R2 pass/fail AC: "Given PENDING and SYNC_ERROR items exist in the `syncQueue` IDB store, when the browser tab is closed and reopened, then all queue items are present with their state and `nextRetryAt` values intact — zero items missing." NFR-R2 has no testable gate anywhere in the current stories.

---

### Story 2.2: QuickAdd bottom sheet — category, amount, date, and remarks

As Nick,
I want to open a quick-add drawer from a FAB, select a category, enter an amount, and save a new expense in 3 taps or fewer,
So that logging an expense is fast enough to do immediately after spending.

**Acceptance Criteria:**

**Given** I tap the FAB
**When** `QuickAddSheetComponent` opens via `MatBottomSheet`
**Then** focus moves to the Date field

**Given** the drawer opens
**When** the Date field is rendered
**Then** it is pre-filled with today's date

**Given** I want a different date
**When** I tap the Date field and change it
**Then** the new date is used for the entry

**Given** I tap a `CategoryTileComponent` tile
**When** the category is selected
**Then** the Amount field auto-focuses and the tile shows a selected ring + fill visual state

**Given** the category tiles are rendered
**When** I inspect their order
**Then** they are sorted by recency/frequency — most-used at top

**Given** I tap the Amount field
**When** the mobile keyboard opens
**Then** `inputmode="decimal"` is set so a numeric keyboard is shown

**Given** I enter an amount of 0
**When** I attempt to save
**Then** the Save button is disabled and a validation message indicates zero is invalid

**Given** I enter a negative amount (e.g. −12.50)
**When** the entry is saved
**Then** it is stored as a negative number and the Save completes normally

**Given** I tap the Remarks field
**When** I type text
**Then** it is stored as remarks on the entry

**Given** all required fields are filled (category + non-zero amount)
**When** I tap Save
**Then** the entry is saved via `EntriesService.add()`, a light haptic fires, and the drawer closes

**Given** the drawer closes
**When** focus returns
**Then** it moves to the FAB

**Given** the FAB is present while the drawer is open
**When** the DOM is inspected
**Then** the FAB has `visibility: hidden` — not `*ngIf` or `display: none` — so focus return works correctly

**Given** the Save button renders
**When** inspected on a mobile viewport with an open keyboard
**Then** it is full-width and remains visible above the keyboard

**Given** I swipe down on the drawer
**When** the gesture completes
**Then** the drawer dismisses without saving

**Given** the FAB renders
**When** its accessible name is inspected
**Then** `aria-label="Add expense"` is set

---

### Story 2.3: Entry list view and EntryRowComponent

As Nick,
I want to see all my logged expenses in a scrollable list sorted by date,
So that I can review what I've entered and know the app has recorded each expense correctly.

**Acceptance Criteria:**

**Given** entries exist in IDB
**When** the entry list route renders
**Then** all entries are displayed sorted by date descending

**Given** an entry is rendered
**When** `EntryRowComponent` displays it
**Then** it shows: a date chip, a category color dot, the amount, and remarks (if present)

**Given** an entry has a negative amount
**When** rendered in `EntryRowComponent`
**Then** the amount displays with a green `+` prefix

**Given** an entry has `PENDING` sync state
**When** rendered in `EntryRowComponent`
**Then** its category dot is dimmed

**Given** an entry has `SYNC_ERROR` state
**When** rendered in `EntryRowComponent`
**Then** an amber indicator is shown on the row

**Given** the entry list container is scrollable
**When** `touch-action` is inspected on the scroll container
**Then** it is `pan-y`; on tappable rows inside the container it is `manipulation`

**Given** the app is on an iPhone with a home indicator
**When** the bottom nav and list render
**Then** `padding-bottom: env(safe-area-inset-bottom)` is applied so no content is hidden behind the system bar

**Given** no entries exist
**When** the entry list renders
**Then** the `EmptyState` component shows a specific contextual message with a CTA to add an expense — never a generic "nothing here"

---

### Story 2.4: Edit and delete entry with confirmation and undo

As Nick,
I want to edit a logged expense or delete it with a confirmation step and a brief undo window,
So that I can correct mistakes without accidentally losing entries.

**Acceptance Criteria:**

**Given** I tap an entry row
**When** the entry detail sheet opens
**Then** all fields (date, category, amount, remarks) are pre-filled with the entry's current values

**Given** I change one or more fields and tap Save
**When** `EntriesService.update()` completes
**Then** the entry is updated in IDB and the entries signal reflects the new values immediately

**Given** I tap the Delete action on an entry
**When** a `MatDialog` confirmation appears
**Then** the destructive action uses a ghost/text style button — never a primary button

**Given** I confirm deletion
**When** `EntriesService.delete()` runs
**Then** the entry is removed from the list and a `MatSnackBar` undo action appears for a short grace period

**Given** the undo snackbar is visible
**When** I tap "Undo"
**Then** the entry is restored in IDB and reappears in the list

**Given** the undo grace period expires without action
**When** the timer completes
**Then** the deletion is finalized and the snackbar dismisses

**Given** the entry I am editing has already been synced to Sheets
**When** I save the edit
**Then** `EntriesService` enqueues an UPDATE operation to `SyncQueue` using the `SyncQueueService` interface defined in Story 1.1

**Given** the entry I am deleting has already been synced to Sheets
**When** deletion is confirmed
**Then** `EntriesService` enqueues a DELETE operation to `SyncQueue`

---

### Story 2.5: SyncQueue INSERT — write new entries to Google Sheets

As Nick,
I want new entries I log while online to be written to my Google Sheet automatically,
So that my Sheet stays up to date without any manual export step.

**Acceptance Criteria:**

**Given** I save a new entry while online and authenticated
**When** `EntriesService.add()` enqueues to `SyncQueue`
**Then** `SyncQueueService.enqueue()` adds a PENDING item with operation type INSERT

**Given** a PENDING INSERT item exists in the queue
**When** the network is available and the token is valid
**Then** `SheetsService` writes the entry to the current year's active tab

**Given** the Sheets write succeeds
**When** `SyncQueueService.markSynced()` is called
**Then** the item is removed from the `syncQueue` IDB store

**Given** the new entry is written to the Sheet
**When** the row is inspected
**Then** column F contains the entry's `crypto.randomUUID()` UUID as an idempotency key

**Given** schema validation has not passed for the current year's tab
**When** an INSERT is attempted
**Then** the write is blocked and an `AppError.SCHEMA_VALIDATION` is emitted — no silent mismap

**Given** a Sheets API write returns a quota error (429) or transient 5xx
**When** the error is caught
**Then** the item remains PENDING in the queue with no data loss

**Given** I am offline when a new entry is saved
**When** `SyncQueueService.enqueue()` runs
**Then** the item is stored as PENDING in IDB and no network call is attempted — full retry is handled in Epic 3

---

## Epic 3: Google Sheets Sync, Offline Resilience & Legacy Schema

> **Highest-risk epic** — covers three distinct concern areas; stories are sub-grouped and sequenced to reduce integration risk.

All entries sync to Google Sheets reliably through full offline operation — the IndexedDB queue survives restarts, 2025 legacy entries appear in read-only mode, the pre-sync review screen works, PENDING/SYNC_ERROR states are visually distinguished, and exponential backoff retry handles network failures.

### Story 3.1: SyncQueueService full state machine with exponential backoff

As Nick,
I want failed sync attempts to retry automatically with increasing delays,
So that temporary network issues resolve themselves without me having to do anything.

**Acceptance Criteria:**

**Given** a PENDING queue item fails to sync (network error or API 5xx)
**When** `SyncQueueService.markError()` is called
**Then** the item transitions to SYNC_ERROR state, its `retryCount` is incremented, and `nextRetryAt` is written to IDB as `Date.now() + backoffMs` (backoffMs: 1s attempt 1, 2s attempt 2, 4s attempt 3, 8s attempt 4, 16s cap attempt 5+)

**Given** an item in SYNC_ERROR state
**When** the retry scheduler fires
**Then** it reads `nextRetryAt` from the queue item and does not retry before that timestamp

**Given** an item is retried and the Sheets write succeeds
**When** `SyncQueueService.markSynced()` is called
**Then** the item is removed from the `syncQueue` IDB store and the entry's sync state in the UI updates to reflect success

**Given** the app is closed and reopened while SYNC_ERROR items exist in IDB
**When** the app restarts
**Then** the queue is reloaded from IDB and the retry scheduler uses each item's `nextRetryAt` to schedule the next attempt at the correct future time — backoff timing survives app restart, no immediate spurious retry

**Given** a browser tab is closed and reopened
**When** IDB is read on init
**Then** all PENDING and SYNC_ERROR items are present — no data loss across tab closes

**Given** multiple queued operations target the same Sheet tab
**When** `SheetsService` executes them
**Then** they are batched into a single Sheets API call where possible to stay within quota

> ⚠️ **Pre-sprint note (resolve before Story 3.1 implementation):** Two gaps require ACs before work begins: (1) **Backoff cap** — the current 16s cap generates ~225 req/hour per stuck item and risks Sheets API quota exhaustion under sustained failure. Raise the schedule to `1s, 2s, 4s, 8s, 16s, 32s, 64s, 120s cap` with `±20% random jitter` per interval. Update the `markError()` AC accordingly. (2) **NFR-R1 pass/fail gate** — add AC: "Given N PENDING items at flush start and a network error occurs mid-flush after K items are ACKed, then exactly N-K items remain in `syncQueue` — zero items lost or duplicated." NFR-R1 currently has no testable story AC.

---

### Story 3.2: SyncStatusBar — PENDING/SYNC_ERROR visual states and manual retry

As Nick,
I want a persistent sync status indicator that shows me exactly what state my entries are in and lets me trigger a retry immediately,
So that I always know whether my data has reached Google Sheets and can act if it hasn't.

**Acceptance Criteria:**

**Given** the app renders any screen
**When** the `SyncStatusBar` DOM is inspected
**Then** it is permanently mounted with `aria-live="polite"` and empty initial content — never conditionally rendered

**Given** all entries are synced
**When** `SyncStatusBar` renders in Healthy state
**Then** it shows "synced Xm ago" in a quiet zinc-500 style

**Given** PENDING items exist in the queue
**When** `SyncStatusBar` renders
**Then** it shows an amber badge with the count of unsynced entries

**Given** SYNC_ERROR items exist
**When** `SyncStatusBar` renders
**Then** it shows a red "sync failed" indicator that is tappable

**Given** I tap the red SYNC_ERROR indicator
**When** the tap is registered
**Then** `SyncQueueService.retryAll()` is called immediately and a medium haptic fires

**Given** `retryAll()` is called
**When** the retry begins
**Then** the status updates to the PENDING amber state

**Given** both PENDING and SYNC_ERROR items are present simultaneously
**When** `SyncStatusBar` renders
**Then** SYNC_ERROR takes visual priority over PENDING

**Given** I am offline
**When** `SyncStatusBar` renders in Offline state
**Then** it shows a grey dot with the queued entry count

---

### Story 3.3: Last successful sync timestamp and persistent failure warning

As Nick,
I want to see when my data was last successfully synced and receive a prominent warning if sync has been failing for a long time,
So that I know my data is safe or can take action if it isn't.

**Acceptance Criteria:**

**Given** a Sheets write succeeds
**When** `SyncQueueService.markSynced()` is called
**Then** the current timestamp is written to the `appMeta` IDB store as `lastSyncedAt`

**Given** `lastSyncedAt` exists in `appMeta`
**When** `SyncStatusBar` renders in Healthy state
**Then** it shows the relative time (e.g., "synced 3m ago") derived from this timestamp

**Given** sync has been continuously failing for 1 hour
**When** the failure threshold is crossed
**Then** a user-visible warning is surfaced via `NotificationService` with a manual retry action

**Given** the persistent failure warning is shown
**When** I tap the retry action
**Then** `SyncQueueService.retryAll()` is called

**Given** the failure warning fires
**When** the notification is inspected
**Then** it is routed through `NotificationService` — not a direct `MatSnackBar` call from a service

---

### Story 3.4: Offline detection and offline-resilient browsing

As Nick,
I want to log and view entries normally while offline, with a clear indicator that I'm offline,
So that losing connectivity never interrupts my expense tracking.

**Acceptance Criteria:**

**Given** my device goes offline
**When** `navigator.onLine` changes to false
**Then** the `OfflineIndicator` shows a grey dot with an "Offline" label

**Given** I am online
**When** the `OfflineIndicator` renders
**Then** it is hidden or shows only a subtle green dot

**Given** I am reconnecting (the `online` event fires)
**When** the transition occurs
**Then** the `OfflineIndicator` shows a pulse animation for the reconnecting state

**Given** I am offline
**When** I open `QuickAddSheetComponent` and save an entry
**Then** the entry is written to IDB and enqueued as PENDING — no error is shown for the offline save itself

**Given** I am offline
**When** I browse the entry list and dashboard
**Then** all data from IDB is displayed normally — no blocking "you're offline" overlay

**Given** the app comes back online
**When** the `online` event fires
**Then** `SyncQueueService.retryAll()` is called automatically to flush the PENDING queue

---

### Story 3.5: Pre-sync review screen — view, edit, and cancel queued entries

As Nick,
I want to review everything in my sync queue before it goes to the Sheet and be able to edit or discard individual items,
So that I have full control over what gets written to my Google Sheet.

**Acceptance Criteria:**

**Given** PENDING entries exist in the queue
**When** I navigate to the sync review screen
**Then** all queued entries are listed

**Given** the review screen renders
**When** the header is shown
**Then** it displays "N entries ready to sync"

**Given** the "Sync all" primary CTA is visible
**When** I tap it
**Then** `SyncQueueService.retryAll()` is called

**Given** I tap an individual queued entry in the review list
**When** the edit sheet opens
**Then** I can modify date, category, amount, or remarks before it syncs

**Given** I save the edit
**When** the entry is updated
**Then** the `SyncQueue` item is updated in IDB with the new data and remains PENDING

**Given** I tap the cancel/discard action on a queued entry
**When** a `MatDialog` confirmation appears
**Then** the destructive action uses a ghost/text style button

**Given** I confirm the cancel
**When** `SyncQueueService.dequeue()` is called
**Then** the entry is removed from both the `syncQueue` IDB store and the entry list — it will not be written to the Sheet

**Given** an entry in the review list has been attempted and failed
**When** `SyncReviewRow` renders
**Then** it shows a red indicator with a retry button

**Given** an entry is currently being pushed to Sheets
**When** `SyncReviewRow` renders
**Then** it shows a spinner for that row

**Given** an entry has been acknowledged (synced)
**When** `SyncReviewRow` renders
**Then** it shows a green checkmark

---

### Story 3.6: 2025 legacy tab read-only mode with column mapping

As Nick,
I want to see my historical 2025 expenses in the app even though they use an older sheet format,
So that I have complete expense history without any manual migration.

**Acceptance Criteria:**

**Given** a 2025-schema tab is detected during Sheet discovery
**When** data is read from it
**Then** the 4-column legacy format is mapped to the current data model and entries are stored in IDB

**Given** a 2025 entry is stored in IDB
**When** it is written
**Then** it carries a `readOnly: true` flag

**Given** a 2025 entry renders in `EntryRowComponent`
**When** I tap it to open the detail view
**Then** the edit and delete actions are disabled or hidden

**Given** an edit or delete is attempted on a 2025 entry programmatically
**When** the attempt is made
**Then** the operation is blocked and an `AppError.SCHEMA_MISMATCH` is emitted — no write reaches IDB or Sheets

**Given** 2025 and 2026 entries coexist
**When** the entry list renders
**Then** all entries appear sorted by date — no visual segregation is required, but disabled edit controls make the read-only state evident

---

### Story 3.7: Past-year 2026-schema tab edit and delete with write-back

As Nick,
I want to edit or delete entries from previous years that use the current schema format,
So that I can correct historical entries without switching to the Sheet directly.

**Acceptance Criteria:**

**Given** a past-year tab uses the 2026 (6-column) schema
**When** I edit an entry from that tab and save
**Then** the UPDATE is written back to the originating tab — not the current year's tab

**Given** I delete an entry from a past-year 2026-schema tab and confirm
**When** `SheetsService` executes the DELETE
**Then** the corresponding row is deleted from the originating tab

**Given** a write-back to a past-year tab is enqueued
**When** `SheetsService` executes it
**Then** Zod validates the past-year tab's schema before writing — no silent mismap

**Given** schema validation fails for a past-year tab
**When** the error is caught
**Then** an `AppError.SCHEMA_VALIDATION` is emitted and the write is blocked with a user-visible error

**Given** a `SyncQueue` item for a past-year entry is processed
**When** `SyncQueueService` executes it
**Then** `SyncQueueItem.targetTabName` is used to target the correct originating tab — not the current year's active tab

**Given** an UPDATE or DELETE operation for a past-year 2026-schema entry is enqueued
**When** `SyncQueueService.enqueue()` is called
**Then** `targetTabName` is set from the originating entry's tab name; INSERT operations always set `targetTabName` to `null`

---

## Epic 4: Dashboard & Spending Insights

Nick can answer "how am I doing this month?" in under 10 seconds — the monthly hero card, 7-bar sparkline, KPI row, and category breakdown bar are visible on the dashboard, and tapping a category opens the full entry drill-down for that category and month.

### Story 4.1: DashboardComponent with monthly total and month navigation

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

### Story 4.2: SparklineChartComponent and KpiRowComponent

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

### Story 4.3: CategoryBreakdownBarComponent

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

> ⚠️ **Pre-sprint note (resolve before Story 4.3 implementation):** Add defensive AC: "Given an entry's `categoryId` no longer exists in the `categories` IDB store (e.g. the category was deleted in Epic 5), when `CategoryBreakdownBarComponent` renders, then the entry is grouped under an 'Unknown' label with a neutral color — no unhandled CSS variable fallback or rendering error." This must be implemented in Epic 4 even though category deletion is an Epic 5 feature — the dashboard must be resilient to orphaned entries from day one.

---

### Story 4.4: Category × month drill-down with DrillDownHeader

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

## Epic 5: Category Management & Visual Customization

Nick can customize category colors (overriding the defaults seeded in E1), reorder categories in the quick-add list, add new categories, and see those colors reflected consistently throughout the dashboard bars, entry list dots, and drill-down — with light/dark theme toggle available in Settings.

### Story 5.1: CategoryManager settings screen with drag-drop reorder

As Nick,
I want a settings screen where I can reorder my categories by drag-and-drop,
So that the most-used categories appear at the top of the quick-add interface.

**Acceptance Criteria:**

**Given** I navigate to Settings
**When** the `CategoryManager` screen renders
**Then** all categories are listed with CDK drag-drop reorder handles

**Given** I drag a category to a new position and release
**When** the drop completes
**Then** the new order is saved to the `categories` IDB store

**Given** the category order is updated
**When** `QuickAddSheetComponent` opens
**Then** `CategoryTileComponent` tiles appear in the updated order

**Given** the `CategoryManager` renders before any Sheet sync has occurred
**When** no categories are present
**Then** an empty state prompts me to sync with the Sheet

**Given** a reorder completes
**When** `CategoriesService` persists the change
**Then** no Sheet write-back is triggered — category order is local only

---

### Story 5.2: ColorPicker and per-category color assignment

As Nick,
I want to assign a custom color to each category and see it reflected everywhere in the app immediately,
So that my expense breakdown bars, entry dots, and tiles all use colors I recognize at a glance.

**Acceptance Criteria:**

**Given** I tap a category in `CategoryManager`
**When** the `ColorPicker` opens
**Then** a swatch grid of color options is shown with a ring indicator on the currently selected color

**Given** the `ColorPicker` has a custom hex input
**When** I enter a valid hex value
**Then** the swatch preview updates and the color becomes selectable

**Given** I select a color and confirm
**When** `CategoriesService.update()` runs
**Then** the `--color-[category-id]` CSS custom property is updated on `document.documentElement.style` immediately — no page reload required

**Given** the CSS custom property is updated
**When** any component consuming that property re-renders
**Then** the new color is reflected in category dots, breakdown bars, and tiles without a full navigation cycle

**Given** the color change is saved to IDB
**When** the app is restarted
**Then** the custom color persists and is re-injected by `CategoriesService.init()`

**Given** a category color dot renders in `EntryRowComponent`
**When** its ARIA attributes are inspected
**Then** `aria-hidden="true"` is set on the decorative dot

---

### Story 5.3: Create and delete categories with Sheet write-back

As Nick,
I want to add new expense categories in the app and have them automatically written to my Sheet,
So that new categories are available for entry logging immediately and synchronized for future sessions.

**Acceptance Criteria:**

**Given** I tap "Add category" in `CategoryManager`
**When** I enter a name and confirm
**Then** `CategoriesService` creates a new category in the `categories` IDB store with a default palette color assigned

**Given** a new category is created
**When** `CategoriesService` processes the write-back
**Then** the category is appended to the categories range in the connected Google Sheet

**Given** I tap the delete action on a category in `CategoryManager`
**When** a `MatDialog` confirmation appears
**Then** the destructive action uses a ghost/text style button — never a primary button

**Given** I confirm deletion
**When** the category is removed
**Then** it is deleted from the `categories` IDB store and its `--color-[category-id]` CSS custom property is removed from `document.documentElement.style`

**Given** the new category is created
**When** `QuickAddSheetComponent` opens
**Then** the new category tile is immediately available for selection

**Given** the category registry is global (FR55)
**When** a new category is created
**Then** it is available for all years — not scoped to any single tab

> ⚠️ **Pre-sprint note (resolve before Story 5.3 implementation):** The delete ACs above do not define what happens to existing entries that reference a deleted category. This decision also affects Story 4.3's "Unknown" defensive rendering. Choose exactly one behavior and add it as a blocking AC: (a) **Block delete** — if any entry references the category, deletion is rejected with a user-visible count of affected entries (recommended: lowest data integrity risk, simplest implementation); (b) **Soft-delete** — mark category `active: false`, keep entries, hide from picker; (c) **Orphan** — entries retain the `categoryId`, render as "Unknown" per Story 4.3's defensive AC; (d) **Reassign** — all entries are re-assigned to a default category (highest risk, requires Sheet write-back for synced entries). This must be decided before Sprint 5 begins.

---

## Epic 6: Entry Discovery, Search & Batch Entry

> **Explicit cut line** — E1–E5 constitute the full shippable core product. This epic is the first to defer under time pressure; it enhances discovery and power-user workflows.

Nick can browse past entries using filters (category, month, year), search by remarks text, find entries by merchant name, log a week of expenses in one batch session with automatic pre-fill, and switch to view historical years or an all-time aggregated view.

### Story 6.1: FilterChipRow with category, month, and year filters

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

### Story 6.2: Full-text remarks search and merchant name filter

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

### Story 6.3: Year switcher and all-years aggregated view

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

### Story 6.4: Batch entry mode with automatic pre-fill

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
