# Epic List

## Epic 1: Foundation, Authentication & First-Run Setup

Nick can open the app, authenticate with Google, have the app auto-discover his expense Sheet, validate the schema, seed the category registry, and land on a working connected app shell — the complete foundation enabling all subsequent epics.

**FRs covered:** FR20, FR25, FR26, FR27, FR31, FR32, FR42, FR43, FR44, FR45, FR46, FR47, FR48, FR54, FR55
**Architecture items:** Angular CLI scaffold + all npm packages + Tailwind config (`preflight: false`), IDB schema (`entries`, `syncQueue`, `categories`, `appMeta` stores), `AuthService` + GIS `initTokenClient` (implicit grant, token in memory only), `APP_INITIALIZER` bootstrap order, `SheetsService` tab discovery + Zod schema validation, `CategoriesService` initial seeding + CSS custom property injection (categories seeded with default palette colors so `--color-[id]` properties are always populated before E4 renders), `AuthInterceptor`, `auth.guard.ts`, CI/CD pipeline, PWA manifest
**SyncQueueService contract (locked here):** Full `SyncQueueItem` type, `QueueState` enum (`PENDING` | `SYNC_ERROR`), and all method signatures (`enqueue()`, `dequeue()`, `markError()`, `markSynced()`, `retryAll()`, `getQueue()`) defined as a typed interface in E1 — E2 implements INSERT enqueue only, E3 implements the full state machine; both epics implement against this locked contract

---

## Epic 2: Expense Entry & Local-First Core

Nick can log, edit, and delete expenses — the ≤3-tap quick-add form works, entries appear instantly via optimistic local write, the full entry list is functional, and basic online Sheets write (INSERT) delivers data to the Sheet on the happy path.

**FRs covered:** FR1, FR2, FR3, FR4, FR6, FR7, FR8, FR29, FR49
**Architecture items:** `EntriesService` (IDB CRUD + optimistic signal update + basic SyncQueue enqueue), `SyncQueueService` INSERT enqueue (implementing the interface contract locked in E1), `QuickAddSheetComponent` via `MatBottomSheet`, `CategoryTileComponent`, `EntryRowComponent`, `AmountInputComponent`, FAB, bottom nav, haptic feedback on Save, `touch-action` pairing, safe area insets

---

## Epic 3: Google Sheets Sync, Offline Resilience & Legacy Schema

> **Highest-risk epic** — covers three distinct concern areas. **3A and 3B are required for core product; 3C is the internal cut line.** If timeline pressure emerges, 3C (legacy schema support) can be deferred without affecting sync or offline capabilities. Ship 3A → 3B first; 3C second.

All entries sync to Google Sheets reliably through full offline operation — the IndexedDB queue survives restarts, 2025 legacy entries appear in read-only mode, the pre-sync review screen works, PENDING/SYNC_ERROR states are visually distinguished, and exponential backoff retry handles network failures.

**FRs covered:** FR28, FR30, FR33, FR34, FR35, FR36, FR37, FR38, FR39, FR40, FR41, FR51, FR52, FR53

**Sub-groups (story sequencing within epic):**
- **3A — SyncQueue State Machine:** `SyncQueueService` full state machine (PENDING → SYNC_ERROR, exponential backoff 1s/2s/4s/8s/16s/32s/64s/120s cap with ±20% jitter), `SheetsService` batch UPDATE/DELETE, `SyncStatusBar` PENDING/SYNC_ERROR visual distinction, manual retry (FR38, FR39, FR40, FR52, FR53)
- **3B — Offline Resilience & Queue Review:** offline detection (`navigator.onLine`), queue survives restart, `SyncReviewComponent`, `SyncReviewRow`, `OfflineIndicator`, edit/cancel queued entries (FR33, FR34, FR35, FR36, FR37, FR41)
- **3C — Legacy Schema Support** *(internal cut line — defer if timeline requires)*: 2025 tab read-only mode, legacy column mapping, read-only entry enforcement, past-year 2026-schema tab edit/delete with write-back (FR28, FR30, FR51)

**Architecture items:** `SyncQueueService` full state machine (implementing the interface contract locked in E1), `SheetsService` batch UPDATE/DELETE, offline detection (`navigator.onLine`), `SyncReviewComponent`, `SyncStatusBar`, `OfflineIndicator`, `SyncReviewRow`, 2025 legacy column mapping, read-only entry enforcement

---

## Epic 4: Dashboard & Spending Insights

Nick can answer "how am I doing this month?" in under 10 seconds — the monthly hero card, 7-bar sparkline, KPI row, and category breakdown bar are visible on the dashboard, and tapping a category opens the full entry drill-down for that category and month.

**FRs covered:** FR9, FR10, FR11, FR12, FR13
**Architecture items:** `DashboardComponent`, `HeroCardComponent` + skeleton loader, `SparklineChartComponent` (ng2-charts), `KpiRowComponent`, `CategoryBreakdownBarComponent` (CSS percentage divs), `EntriesListComponent` (drill-down view), `DrillDownHeader`, month prev/next navigation, `EmptyState` component, deep-linkable drill-down route

---

## Epic 5: Category Management & Visual Customization

Nick can customize category colors (overriding the defaults seeded in E1), reorder categories in the quick-add list, add new categories, and see those colors reflected consistently throughout the dashboard bars, entry list dots, and drill-down — with light/dark theme toggle available in Settings.

**FRs covered:** FR21, FR22, FR23, FR24
**Architecture items:** `CategoriesService` full CRUD + CSS custom property update (overriding defaults established in E1), `CategoryManager` settings screen, `ColorPicker` component, CDK drag-drop reorder, `SettingsComponent`, light/dark theme toggle (`localStorage['theme']`), category write-back to Sheet

---

## Epic 6: Entry Discovery, Search & Batch Entry

> **Explicit cut line** — this epic is complete, shippable functionality but is the first to defer under time pressure. E1–E5 constitute the full core product; E6 enhances discovery and power-user workflows.

Nick can browse past entries using filters (category, month, year), search by remarks text, find entries by merchant name, log a week of expenses in one batch session with automatic pre-fill, and switch to view historical years or an all-time aggregated view.

**FRs covered:** FR5, FR14, FR15, FR16, FR17, FR18, FR19, FR50
**Architecture items:** `FilterChipRow` component, `EntriesListComponent` filter/search capabilities, `EntriesService` IDB-side filtering, remarks full-text search (debounced), merchant name extraction, batch entry mode with same-date+category pre-fill, year switcher on dashboard, all-years aggregated view

---
