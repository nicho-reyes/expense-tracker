---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
releaseMode: single-release
inputDocuments:
  - '_bmad-output/brainstorming/brainstorming-session-2026-05-08-now.md'
workflowType: 'prd'
classification:
  projectType: web_app
  domain: personal_finance_productivity
  complexity: medium
  projectContext: greenfield
---

# Product Requirements Document — expense-dashboard

**Author:** Nick
**Date:** 2026-05-08

## Executive Summary

A mobile-optimized personal expense tracking web app that makes "how am I doing this month?" answerable in seconds. Google Sheets serves as the persistent source of truth; the app provides the dashboard, drill-down, and entry UX that Sheets cannot. Built for a single user (Nick), denominated in CHF, backed by an existing multi-year Sheet with ~20 categories. No subscription cost, full ownership, no schema imposed by a third-party service.

The primary interaction loop: log a new expense in under 3 taps, then immediately understand where the money went via a category × month drill-down. If logging an entry takes more steps than opening Google Sheets and typing a row, the app fails its core purpose.

### What Makes This Different

Generic expense trackers impose their own category taxonomies, sync models, and subscription costs. This app is the front-end your Google Sheet never had — it inherits your exact schema, color-codes your categories your way, and adds the one capability Sheets lacks: instant visual clarity on spending patterns without manual scrolling or formula-hunting. Ownership is a first-class requirement: the data lives in your Sheet, the app is self-hosted, and there is no vendor lock-in. Sheets is the persistence layer — not the UX. The core experience is complete and valid without an active Sheets connection; sync is a feature.

## Project Classification

| Field | Value |
|---|---|
| **Project Type** | Web App (SPA, mobile-optimized) |
| **Domain** | Personal finance / productivity |
| **Complexity** | Medium — Google Sheets sync, offline queue with conflict resolution, multi-schema legacy data (2025 vs 2026), dual mobile/desktop UX |
| **Project Context** | Greenfield |

## Success Criteria

### User Success

- An expense entry can be logged from app open to saved in ≤ 3 taps; date defaults to today, reducing required input to category + amount (and optionally remarks)
- The monthly spend dashboard answers "how am I doing this month?" without opening Google Sheets
- The app becomes the primary spending review interface — the Sheet's manual summary rows are never consulted again
- Category × month drill-down surfaces all entries for a given category in a given month without any filtering or scrolling through raw data

### Business Success

This is a single-user personal tool; business success is measured by personal adoption and utility:

- The app replaces Google Sheets as the primary interface for both expense logging and spending review within the first month of use
- Zero data loss across all sync scenarios, including offline entry and conflict resolution
- The app runs indefinitely at zero ongoing cost — self-hosted, no third-party subscriptions

### Technical Success

- Entries submitted while offline are queued locally and pushed to Sheets without data loss on reconnect, with a pre-sync review step
- Schema version detection correctly identifies the 2026 active schema and the 2025 legacy read-only schema before reading any tab
- Google OAuth authentication remains valid across sessions without re-prompting
- Category registry bootstrapped from Sheet on first load and kept in sync bidirectionally thereafter

### Measurable Outcomes

| Outcome | Target |
|---|---|
| Entry logging time (app open → saved) | ≤ 3 taps; date pre-filled to today |
| Data integrity across sync | 100% — zero entries lost |
| Dashboard load time (current month total + breakdown) | < 2 seconds |
| Sheet dependency for monthly review | Zero — all answers available in app |

## Product Scope

Three tiers define the feature universe. The single-release strategy collapses MVP + selected Growth features into one shipment; see Project Scoping for the authoritative Must-Have / Nice-to-Have cut.

### MVP — Minimum Viable Product

| ID | Feature |
|---|---|
| E1 | Date-first quick add — date defaults to today; input sequence: Date → Category → Amount → Remarks |
| F1 | Entry list filters — by category, month, year (individually or combined) |
| D1 | Monthly spend hero card — current month total with 6–12 month sparkline comparison |
| D2 | Category breakdown bar — horizontal sorted bar for selected month |
| D3 | Category × month drill-down — tap category → all entries for that category in that month ⭐ |
| S1 | Sheet discovery by naming pattern — auto-discovers tabs matching "CH Daily Expenses" prefix |
| S2 | Offline status bar — persistent indicator with pending queue count |
| S3 | Sync conflict reviewer — pre-sync review screen with per-row push/modify/cancel actions |
| C1 | Sheet-seeded category registry — bootstrapped from Sheet on first load, bidirectional thereafter |
| C2 | In-app color configuration — per-category color picker, decoupled from Sheet formatting |

### Growth Features (Post-MVP)

| ID | Feature |
|---|---|
| E2 | Batch entry mode — next row pre-fills same date and category for weekly catch-up sessions |
| E3 | Large remarks field — multi-line, expandable on tap |
| E4 | Split / reimbursement marker — negative amounts displayed as credits (green, ± indicator) |
| R1 | Merchant tag extractor — surfaces first word of Remarks as soft merchant tag (Migros, Coop, Avec) |
| R2 | Remarks smart search — full-text search with merchant-aware filtering |
| D5 | Year switcher + all-years mode — default active year; switch to past years or aggregated all-time |
| S5 | Legacy schema mapper (2025) — read-only import mapping Particulars → Remarks |
| S6 | Schema version detection — identifies tab schema by column headers before reading |
| M1 | Read-first mobile view — dashboard + drill-down prioritized; quick-add as persistent floating button |

### Vision (Future)

| ID | Feature |
|---|---|
| D4 | Budget seed fields — optional per-category monthly targets |
| E5 | Net vs gross toggle — dashboard toggle: all positive spend vs. net of reimbursements |
| N1 | Expense logging reminder — configurable push notification (daily or weekly) |
| X1 | Report export — month or year data as PDF or CSV |
| S4 | New year tab scaffold — detect missing next-year tab in December, offer to create from template |

## User Journeys

### Journey 1: Nick — Daily Quick-Add (Core Success Path)

**Opening Scene:** It's 12:45 on a Tuesday. Nick has just paid CHF 14.50 at Migros for lunch and is walking back to his desk. He pulls out his phone. In the past, he'd make a mental note and try to remember it when he sat down at his laptop to update the Sheet — and sometimes forget.

**Rising Action:** He opens the app. The quick-add form is already open (or one tap away). Date is pre-filled to today. He taps "Groceries" from the category list — it's near the top because it's used often. He types 14.50. He adds "Migros" in remarks. Three taps, one number typed. He hits Save.

**Climax:** The entry appears instantly in the list. A faint sync indicator pulses, and within seconds the row is live in his Google Sheet — no copy-paste, no tab-switching, no formula adjustment.

**Resolution:** Nick pockets his phone. The expense is logged, categorized, and in the Sheet before he's back at his desk. He never had to open a spreadsheet.

**Requirements revealed:** Quick-add form, date default, category list with recency/frequency ordering, remarks field, immediate local confirmation, background Sheets sync.

---

### Journey 2: Nick — Monthly Review & Drill-Down (Primary Insight Loop)

**Opening Scene:** It's the 22nd of May. Nick has a vague sense he's been eating out more than usual this month. He opens the app to check — not to log anything, just to understand.

**Rising Action:** The dashboard loads with the monthly hero card front and center: **CHF 2,480 spent in May**. The sparkline shows his 6-month average is around CHF 2,150. He's running CHF 330 over trend. He glances at the category breakdown bar below — "Eat out" is the second-largest bar after Rent.

**Climax:** He taps "Eat out." The drill-down opens: 11 entries, CHF 460 total. He can see immediately — two work dinners in the same week, plus a weekend trip. The data tells the story without him having to scroll a spreadsheet, filter columns, or add up numbers manually.

**Resolution:** Nick knows exactly where the overage is coming from. He didn't need to open Google Sheets, write a formula, or construct a pivot table. The question "how am I doing this month?" had an answer in under 10 seconds.

**Requirements revealed:** Monthly hero card with sparkline, category breakdown bar, category × month drill-down with entry list, month navigation, visual spend-vs-trend indicators.

---

### Journey 3: Nick — Offline Catch-Up + Sync (Edge Case / Recovery)

**Opening Scene:** Nick is on a ski trip in the Alps for a long weekend. Phone signal is intermittent — he has connectivity in the chalet but not on the mountain. Over two days he makes several purchases: lift passes, lunch on the slopes, a dinner in the village.

**Rising Action:** Each time he opens the app to log an expense, it works exactly as normal — the form loads, he enters the data, hits Save. He notices the offline status bar at the bottom showing a badge: "4 pending." He doesn't worry about it. The entries are in the app; they'll sync when he's back online.

**Climax:** Back in the chalet with WiFi that evening, the status bar updates to show connectivity restored. Nick taps it out of curiosity. The pre-sync review screen opens, showing all 6 queued entries (he'd logged two more). Each row shows the date, category, amount, and remarks. One entry looks wrong — he'd typed 145 instead of 14.5 for a coffee. He edits it inline, then taps "Sync all."

**Resolution:** All 6 entries push to Google Sheets in order. The Sheet reflects the correct data. No entries were lost, no sync happened without his review, and the error was caught before it landed in the authoritative record.

**Requirements revealed:** Offline entry with local queue, offline status bar with pending count, pre-sync review screen, per-row edit/cancel before push, ordered sync execution, conflict detection on reconnect.

---

### Journey 4: Nick — Weekly Batch Entry (Alternative Entry Mode)

**Opening Scene:** Sunday evening. Nick has been lazy about logging this week — five days of expenses are unrecorded. He sits down with his wallet receipts and his memory. He's done this before in the Sheet: it means opening the tab, scrolling to the bottom, and typing row after row. Tonight he'll do it in the app instead.

**Rising Action:** He activates batch entry mode. He starts with Monday: date set to last Monday, category "Groceries", CHF 22.30, remarks "Coop." He hits Submit. The next row opens pre-filled: same date, same category. He changes the category to "Transportation" and types CHF 4.20 — tram ticket. Submit again. Now he adjusts the date to Tuesday and keeps going.

**Climax:** Twelve entries in, Nick finishes the week. He didn't have to re-select "Groceries" three times, didn't lose his place, and didn't accidentally skip a row. The rhythm of batch mode — submit, adjust, submit — matched how his brain was working through the week chronologically.

**Resolution:** Twelve new rows are in the Sheet. The dashboard now reflects an accurate May total. The batch session took about four minutes — faster than doing it in Sheets and far less error-prone.

**Requirements revealed:** Batch entry mode, pre-fill of previous row's date and category on submit, inline date editing within batch, session-level submit flow distinct from single-entry quick-add.

---

### Journey 5: Nick — First-Time Setup & Category Configuration (Onboarding + Admin)

**Opening Scene:** Nick has just deployed the app for the first time. He opens it in his browser. There's no data yet — just a sign-in screen.

**Rising Action:** He taps "Sign in with Google" and authenticates via OAuth. The app requests read/write access to Google Sheets. He approves. The app begins discovery: it scans his Google Drive for spreadsheets with tabs matching the prefix "CH Daily Expenses." It finds his 2026 spreadsheet immediately.

**Climax:** The app reads the Category column from the 2026 tab and bootstraps the category registry: 20 categories appear in the category manager — Groceries, Eat out, Leisure, Rent, and so on. All are ungrouped and uncolored by default. Nick opens the category manager and starts assigning colors: Groceries gets green, Rent gets grey, Eat out gets orange. He also reorders the quick-add list to put his most-used categories at the top.

**Resolution:** The app is configured. The dashboard shows his historical 2026 data — already 4 months of entries visualized. He makes his first test entry and confirms it lands in the Sheet. Setup is complete; there was no manual import, no CSV upload, no schema configuration. The Sheet was the config.

**Requirements revealed:** Google OAuth flow, Sheets API access request, tab discovery by naming prefix, category seeding from Column C of active tab, category manager with color picker and ordering, initial data load and dashboard render, first-entry confirmation.

---

### Journey Requirements Summary

| Capability Area | Revealed By |
|---|---|
| Quick-add form with date default, category list, remarks | J1, J4 |
| Background Sheets sync with local-first confirmation | J1, J3 |
| Monthly hero card + 6-month sparkline | J2 |
| Category breakdown bar | J2 |
| Category × month drill-down with entry list | J2 |
| Offline status bar with pending count | J3 |
| Pre-sync review screen with per-row edit/cancel | J3 |
| Batch entry mode with pre-filled next row | J4 |
| Google OAuth + Sheets API access | J5 |
| Tab discovery by "CH Daily Expenses" prefix | J5 |
| Category registry seeded from Sheet, with color picker | J5 |

## Design Philosophy

### Principle 1: The Kill Condition

If logging an expense in the app takes more steps than opening Google Sheets and typing a row directly, the app has failed its primary purpose. This is not a UX aspiration — it is a pass/fail threshold. Every entry flow decision is evaluated against it.

Concretely: an expense must be saveable from app open in ≤ 3 taps, with date pre-filled to today. The minimum required input is category + amount.

### Principle 2: Sheets is Plumbing, Not the Product

Most spreadsheet-backed apps treat the spreadsheet as the canonical UI and build a thin wrapper. This app inverts that relationship. The app owns the user experience entirely; Google Sheets is the persistence and portability layer. The user never waits for Sheets to respond before seeing feedback — all interactions are optimistic and local-first. Sheets could be swapped for another backend without changing a single user-facing screen.

This inversion produces concrete decisions at every level: optimistic UI on entry, offline-tolerant architecture, independent dashboard rendering, and an explicit sync state model that treats connectivity as a feature, not a requirement.

## Domain-Specific Requirements

### Google Sheets API Constraints

- **Rate limit:** 100 requests / 100 seconds per user (Sheets API v4). Realistic single-user traffic will not approach this limit. Mitigation: batch writes where possible; debounce dashboard reads.
- **Read-through cache:** 5-minute TTL per session (see NFR-P5). The app must not re-fetch the Sheet on every route change or navigation. Reads and writes share the same quota bucket.
- **Header row schema validation on startup:** On every session load, the app reads the header row of the active tab and validates column order against expected schema before any read or write. On mismatch, surface a blocking error — silent mismap is not acceptable.
- **Sheet schema ownership:** The column schema is owned and managed by the app. Manually shifting or adding columns in Google Sheets is an unsupported configuration.
- **App-managed ID column:** The app writes a UUID to a hidden, app-managed column in each Sheet row. This column is never manually maintained by the user and is used as the delete anchor and idempotency key for all sync operations.
- **Month column auto-derived:** The Month column in the Sheet is derived from the Date field — the app computes and writes it automatically. The user never enters a Month value directly.

### OAuth & Token Lifecycle

- **Architecture:** Pure SPA, no backend server. OAuth uses PKCE flow via Google Identity Services library with silent auth via hidden iframe.
- **Silent auth fallback:** If hidden iframe refresh fails (blocked third-party cookies, ITP), the app escalates gracefully to a full redirect re-auth rather than hanging or spinning indefinitely.
- **Token expiry / revocation:** App surfaces a blocking re-auth prompt. While the token is invalid, the app remains fully usable in offline mode — cached dashboard and entry history remain browseable and new entries can be added to the queue.
- **On re-auth success:** Queue flushes and latest Sheet data is fetched.
- **Token expiry mid-flush:** If the token expires during an active flush, the flush pauses, re-auth prompt is shown, and flush resumes on successful re-auth.
- **Permanent revocation:** App distinguishes a revoked grant from a temporary network failure and shows an actionable "Sign in again to resume sync" UI state.

### Offline Queue & Sync

- **Storage:** IndexedDB. Queue survives app restarts, tab closes, and browser updates.
- **Operations supported:** Insert (new entry), Update (edit existing row), Delete (remove row). All three are queued and flushed in order (`ORDER BY enqueued_at ASC, idempotency_key ASC`).
- **Append-only until ACK:** No entry is dequeued until Sheets confirms the write.
- **Idempotency:** Each queued operation carries a UUID written to the app-managed ID column. On retry, the app checks for a row with that UUID before re-appending — prevents duplicate rows on retry after a lost ACK.
- **Delete behavior:** Delete operations target the row by its UUID. If the target row is not found on flush (already deleted), the operation is treated as `ACK_SUCCESS` — not retried.
- **Queue collapse:** If the queue contains Insert(A) followed by Delete(A) and Insert(A) has not yet ACK'd, the app flushes sequentially — Insert fires first, ACK received, then Delete fires. No collapse into no-op.
- **Sync mode:** Always automatic, background, debounced. Users can manually trigger a retry from the sync indicator when entries are in SYNC_ERROR state.
- **Retry:** Exponential backoff. After 1 hour of failed sync attempts for a given entry, the app surfaces a user-visible warning ("Entry unsynced — tap to review").
- **Conflict resolution:** Last-write-wins. Google Sheets' built-in version history is the recovery path for clobbered writes.
- **Queue resume on reconnect:** On reconnect, remaining queued operations are retried in original enqueue order from the last unACKed operation. Partial flush (some ops ACKed, sync dropped mid-queue) is expected behavior, not an error state.
- **Post-reconnect cache refresh:** On reconnect after an offline period, Sheet data is refreshed immediately regardless of remaining session TTL.

### Data Integrity & UI States

- **Schema validation:** Validated at enqueue, not at flush.
- **Two distinct sync states with separate UI treatment:**
  - `PENDING` — queue is non-empty; data is optimistically shown but unconfirmed in Sheets
  - `SYNC_ERROR` — a sync attempt has failed; warning indicator shown with actionable prompt
- **"Last synced" display:** The dashboard always shows the timestamp of the last successful Sheets fetch (informational). The warning indicator activates only on actual sync failure — not on TTL expiry alone.
- **Offline read scope:** While offline or during token-invalid periods, the full cached dashboard and entry history remain browseable. New entries can be added to the queue normally.

### Out of Scope

- Third-party collaborators editing the Sheet outside the app.
- Conflict handling for concurrent external edits.

## Platform Requirements

### Browser Support

**Primary targets (must work flawlessly):**
- iOS Safari 16+ (iPhone, the primary mobile device)
- Android Chrome 110+

**Secondary targets (should work, no dedicated optimization):**
- Desktop Chrome (latest)
- Desktop Safari (latest)

No IE, no legacy browser support. This is a personal tool — the user controls the browser.

### Responsive Design

- **Mobile-first layout** — base breakpoint is 360px width; all core interactions designed for one-handed mobile use
- **Desktop as secondary** — wider viewports get a comfortable reading layout; no dedicated desktop-optimized design effort required
- **PWA installability** — the app is installable as a home screen app on iOS and Android via standard PWA manifest and service worker. Once installed, it behaves like a native app: full-screen, no browser chrome, persistent icon.

### Performance Targets

Performance targets are defined in NFR-P1 through NFR-P5. All targets measured on a mid-range device on 4G.

### Accessibility

Best-effort only. No WCAG compliance target. Single-user personal tool — Nick controls the device and environment. Standard HTML semantics, readable font sizes (min 16px body), and sufficient color contrast as a baseline; no formal audit or compliance required.

### Implementation Considerations

- **Service worker** — required for offline support (queued entries, cached dashboard) and PWA installability. Must handle cache invalidation on app update.
- **Viewport meta tag** — `width=device-width, initial-scale=1` required. No `user-scalable=no` (accessibility baseline).
- **Deep linking** — the drill-down view (category × month) must be directly linkable/bookmarkable so the browser back button works naturally.
- **No SSR required** — pure SPA. Static hosting (GitHub Pages, Netlify, or self-hosted nginx) is sufficient.

## Project Scoping

### Strategy

**Approach:** Single release — Must-Have and Nice-to-Have features ship together as one complete product. No phased delivery.
**Resource:** Solo developer (Nick). No external team dependencies.

All five user journeys (daily quick-add, monthly review & drill-down, offline recovery, batch entry, first-time setup) are fully supported in this release.

### Must-Have Capabilities

| ID | Feature |
|---|---|
| E1 | Date-first quick add — ≤3 taps from app open to saved entry, date pre-filled to today |
| D1 | Monthly hero card — current month total with 6–12 month sparkline comparison |
| D2 | Category breakdown bar — horizontal sorted bar for selected month |
| D3 | Category × month drill-down — tap category → all entries for that category in that month |
| S1 | Sheet discovery by naming pattern — auto-discovers tabs matching "CH Daily Expenses" prefix |
| S2 | Offline status bar — persistent indicator with pending queue count |
| S3 | Sync conflict reviewer — pre-sync review screen with per-row push/edit/cancel actions (row-level granularity) |
| S5 | Legacy schema mapper (2025) — read-only import mapping Particulars → Remarks |
| S6 | Schema version detection — identifies tab schema by column headers before reading |
| C1 | Sheet-seeded category registry — bootstrapped from Sheet on first load, bidirectional thereafter |
| C2 | In-app color configuration — per-category color picker, decoupled from Sheet formatting |
| M1 | Mobile-first layout — entry form as primary mobile surface, persistent floating action button |

### Nice-to-Have Capabilities (same release, cuttable under time pressure)

| ID | Feature |
|---|---|
| F1 | Entry list filters — by category, month, year (individually or combined) |
| E2 | Batch entry mode — next row pre-fills same date and category for weekly catch-up sessions |
| E3 | Large remarks field — multi-line, expandable on tap |
| E4 | Split / reimbursement marker — negative amounts displayed as credits (green, ± indicator) |
| R1 | Merchant tag extractor — surfaces first word of Remarks as soft merchant tag |
| R2 | Remarks smart search — full-text search with merchant-aware filtering |
| D5 | Year switcher + all-years mode — default active year; switch to past years or aggregated all-time view |

**Out of scope (this release):** D4 (budget seeds), E5 (net/gross toggle), N1 (reminders), X1 (export — Google Sheets serves as the native data portability layer), S4 (year scaffold)

### Risk Mitigation

| Risk | Mitigation |
|---|---|
| OAuth silent-iframe ITP failure | Redirect re-auth is a first-class code path, not a fallback afterthought |
| UUID column bootstrap | Technical spike required before E1 development: validate UUID append-to-hidden-column flow end-to-end |
| S3 row-level conflict UX complexity | Prototype S3 early; design for human language ("Which entry is right?"), not data state labels |
| S5/S6 legacy schema edge cases | Build S5+S6 as a discrete pair; test against real 2025 data before shipping; S6 gates S5 |
| E4 offline mutation replay | Dedicated test suite for Insert(positive) → Update(negative) offline → sync during partial failure |
| S1 discovery failure | Discovery failure handler logs rejected sheets with actionable error; manual alias path required |
| Service worker cache invalidation | Versioned cache keys; explicit update testing before release |

Nice-to-have tier (R1, R2, F1 in particular) is cuttable under time pressure with zero impact on the core experience. Cut from the bottom of the nice-to-have list first.

## Functional Requirements

### Expense Entry

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

### Dashboard & Visualization

- **FR9:** User can view total spend for the current month, inclusive of all categories with no exclusions
- **FR10:** User can view a sparkline comparison of monthly spend across the last 6–12 months
- **FR11:** User can view spend broken down by category for any selected month
- **FR12:** User can tap a category in the breakdown to view all entries for that category in that month
- **FR13:** User can navigate to any month via previous/next controls (not a calendar picker)
- **FR14:** User can switch between years and view an aggregated all-years view

### Entry Discovery & Search

- **FR15:** User can filter the entry list by category
- **FR16:** User can filter the entry list by month
- **FR17:** User can filter the entry list by year
- **FR18:** User can search entries by free-text remarks content
- **FR19:** User can filter entries by merchant name

### Category Management

- **FR20:** The app seeds the category registry from the connected Sheet on first load
- **FR55:** The category registry is global across all years — categories are not scoped to a specific tab or year
- **FR21:** User can create new categories within the app
- **FR22:** User can assign a display color to each category
- **FR23:** User can reorder categories in the quick-add interface
- **FR24:** Categories created in the app are written back to the Sheet

### Google Sheets Integration

- **FR25:** The app discovers Sheet tabs matching the "CH Daily Expenses" naming prefix without manual configuration
- **FR26:** The app validates the column schema of a tab before reading or writing any data
- **FR27:** The app identifies the schema version (2026 active vs. 2025 legacy) of each discovered tab
- **FR28:** The app reads 2025 legacy tab data in read-only mode, mapping legacy columns to the current schema
- **FR29:** New entries are always written to the current year's active tab
- **FR30:** Entries from past years using the current schema can be edited and deleted; changes write back to their originating tab
- **FR31:** The app assigns a unique identifier to each entry, stored in an app-managed column in the Sheet; if this column is absent on session load, the app surfaces a schema error
- **FR32:** The app surfaces an actionable error when sheet discovery fails or a tab has an unrecognized schema
- **FR51:** Entries sourced from the 2025 legacy tab are read-only; editing and deleting them is blocked in the app

### Offline & Sync

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

### Authentication & Session

- **FR42:** User can authenticate with their Google account via OAuth
- **FR43:** The app maintains authentication across sessions without re-login on each visit
- **FR44:** The app prompts re-authentication when the OAuth token expires or is revoked; if silent token refresh fails, the user is redirected to the OAuth flow without data loss
- **FR45:** The app remains fully usable in offline/read mode and continues accepting queued entries during re-authentication
- **FR46:** On successful re-authentication, the pending queue is flushed and the latest Sheet data is fetched

### First-Run & Setup

- **FR47:** On first launch, the app guides the user through Google authentication and Sheets access approval
- **FR48:** The user provides their Google Sheet URL or spreadsheet ID once on first launch; the app persists the connection to `appMeta` IDB and reconnects automatically on all subsequent sessions without requiring manual re-entry
- **FR54:** After completing authentication on first launch, the app confirms the connected Sheet name before loading data

## Non-Functional Requirements

### Performance

- **NFR-P1:** Dashboard (current month total + category breakdown) loads in < 2 seconds on a mid-range device on 4G
- **NFR-P2:** Entry save perceived latency (tap Save → entry appears in list) is < 200ms via optimistic local update
- **NFR-P3:** First Meaningful Paint on 4G < 3 seconds for returning users (cached assets)
- **NFR-P4:** Category × month drill-down opens in < 500ms
- **NFR-P5:** Sheet data is refreshed on every app open and tab focus; within a session, data is cached with a 5-minute TTL to avoid redundant re-fetches on navigation

### Security

- **NFR-S1:** OAuth tokens are stored in browser storage and never exposed in URLs, logs, or error messages
- **NFR-S2:** All communication with Google APIs uses HTTPS exclusively
- **NFR-S3:** No financial data is transmitted to any service other than Google Sheets
- **NFR-S4:** The app requests the minimum necessary Google OAuth scopes — Sheets read/write access scoped to the identified spreadsheet only

### Reliability

- **NFR-R1:** Zero entries are lost across all sync scenarios, including offline entry, reconnect, partial flush, and mid-flush token expiry
- **NFR-R2:** Queued entries survive app restarts, tab closes, and browser updates via IndexedDB persistence
- **NFR-R3:** After 1 hour of continuous sync failure for a given entry, the user receives a visible warning with a manual retry action
- **NFR-R4:** Schema validation blocks any write to Google Sheets when the column schema cannot be verified; no silent mismap

### Integration

- **NFR-I1:** The app remains fully functional during Sheets API outages by serving cached data and queuing new entries locally
- **NFR-I2:** Sheets API writes are batched where possible to remain within the 100 requests/100 seconds quota
- **NFR-I3:** Sheets API quota errors and transient failures are handled gracefully — no data loss, no silent failure, user-visible retry state

### Accessibility

- **NFR-A1:** Body text minimum 16px; interactive touch targets minimum 44×44px
- **NFR-A2:** Standard semantic HTML elements used throughout; no custom interactive components that break native browser behaviour
