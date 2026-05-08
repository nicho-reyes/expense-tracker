---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Web app for personal expense tracking backed by Google Sheets as source of truth'
session_goals: 'Feature ideation for dashboard, entry management, categories, bulk ops, sync architecture, iOS portability'
selected_approach: 'ai-recommended'
techniques_used: ['question-storming', 'scamper', 'reversal-inversion']
ideas_generated: 26
session_active: false
workflow_completed: true
context_file: ''
---

# Brainstorming Session — Expense Dashboard

**User:** Nick
**Date:** 2026-05-08

---

## Session Overview

**Topic:** Web app for personal expense tracking backed by Google Sheets as source of truth
**Goals:** Feature ideation for dashboard, entry management, categories, bulk ops, sync architecture, and future iOS portability

### Source Sheet Structure (2026 — active schema)

Columns: Month | Date | Category (color-coded) | Price | Remarks
~20 categories: Groceries, Eat out, Leisure, Household, Rent, Utilities, Shopping, Smoking, Holidays, Taxes, Insurance, Transportation, Contributions, Allowances, Investment, Medicine, Personal care, Administration, Other, Transfers

Sheets (by tab):
- CH Daily Expenses 2026 — active
- CH Daily Expenses 2025 — complete, read-only, different schema
- CH Daily Expenses 2027 — blank template
- Other tabs (Travel, Transfers, Furnishing, etc.) — ignored by app

### Key Constraints

- Google Sheets always wins on conflict
- Google OAuth for authentication
- Single user currently (Nick)
- Mobile-optimized web view now; native iOS after web app is validated
- 2025 data has a different schema (Date | Particulars | Price | Category | Remarks) — read-only legacy

---

## Technique Selection

**Approach:** AI-Recommended
**Sequence:** Question Storming → SCAMPER → Reversal Inversion

---

## Technique Execution

### Technique 1: Question Storming

Surfaced the following unknowns and decisions:

**Sync model:**
- Google Sheets always wins on conflict — no merge, Sheet is authoritative
- Live reload — real-time sync when online
- Direct writes to Sheet on entry submission
- When offline: queue pending changes, app is temporary source of truth
- On reconnect: show pre-sync review screen before pushing queue

**Offline / queue:**
- "Unreachable" = no internet OR Sheets API down
- User wants to see queued changes before sync
- Per-row actions on queue: push, modify, cancel, resolve conflict
- Persistent offline status bar showing pending count

**Categories:**
- Colors managed in app, bootstrapped from Sheet on first load
- Category definition is bidirectional (app or Sheet)
- Categories are global across all years
- No Category column in the Sheet's formatting needs to carry app colors

**Dashboard:**
- Primary question to answer: "how much did I spend this month?"
- Month-by-month comparison wanted
- Summary table in Sheet is replaced by the dashboard entirely
- "Total without Taxes & Contributions" rows in Sheet are exclusion views — Grand Total includes everything

**Entry UX:**
- Input sequence matches Sheet: Date → Category → Price → Remarks
- Month column is derived from Date — app handles invisibly
- Bulk update = primarily category changes; dates/amounts rare but possible
- Batch entry (week's worth in one sitting) is a real workflow
- Quick add is required
- Remarks is free text; user searches but doesn't formally filter by it
- Merchant names often appear at start of Remarks ("Migros", "Coop", "Avec")

**Multi-year:**
- Default view is active year; can switch to other years or all-time
- "CH Daily Expenses" prefix = naming pattern for auto-discovery
- App should offer to scaffold new year tab (currently done manually each January)
- 2025 sheet has different schema — read-only import with column mapping

**Negative amounts:**
- Negative price = split expense / reimbursement (e.g. co-spender pays back)
- "Juicy" is a co-spender name in Remarks — not a separate user of the app
- More negative entries possible in future

**Mobile:**
- Mobile-optimized web view now
- Focus: dashboard reading + drill-down + quick-add

**Notifications & Export:**
- Wants configurable logging reminders (daily or weekly)
- Wants export to PDF and/or CSV

---

### Technique 2: SCAMPER

Ran existing Sheet functionality through 7 lenses. Confirmed features:

**Modify lens confirmed:**
- Entry list filterable by category, month, year
- Category colors configurable in app (decoupled from Sheet formatting)
- Remarks field larger / multi-line on mobile

**Eliminate lens confirmed:**
- Month column eliminated as input (app derives from Date)
- Manual summary table eliminated (dashboard replaces it)
- Sheet cell color formatting not required — app owns colors

**All other lenses parked** as future/non-essential for MVP.

---

### Technique 3: Reversal Inversion

**Flip 1 — Kill condition identified:**
If adding an entry in the app takes more steps than opening Google Sheets and typing a row, the app fails its primary purpose.

**Flip 2 — Architecture validation:**
The core experience (list + dashboard + quick-add) is valid and complete without Sheets. Sheets is a sync/persistence layer, not a UX dependency. This validates offline support, iOS portability, and independent app evolution.

---

## Idea Organization and Prioritization

### Theme 1: Core Data Entry

| ID | Feature | Description |
|---|---|---|
| E1 | Date-First Quick Add | Form opens to Date field, follows Sheet input sequence (Date → Category → Price → Remarks), Month auto-derived invisibly |
| E2 | Batch Entry Mode | Submit a row → next row opens pre-filled with same date and category. Optimized for weekly catch-up sessions |
| E3 | Large Remarks Field | Multi-line textarea, expandable on tap, especially on mobile |
| E4 | Split / Reimbursement Marker | Negative amounts displayed as credits (green, ± indicator), visually distinct from expenses |
| E5 | Net vs Gross Toggle | Dashboard toggle: gross spend (all positive) or net (minus reimbursements) |
| F1 | Entry List Filters | Filter entries by category, month, and/or year — individually or combined |

### Theme 2: Dashboard & Visualization

| ID | Feature | Description |
|---|---|---|
| D1 | Monthly Spend Hero | Primary card: current month total + sparkline/bar comparing last 6–12 months |
| D2 | Category Breakdown Bar | Horizontal sorted bar: spend by category for selected month |
| D3 | Category × Month Drill-Down ⭐ | Tap category → see all entries for that category in that month. The hero feature — replaces manual Sheet scrolling |
| D4 | Budget Seed Fields | Optional per-category budget targets stored in app. Initially empty/hidden, activatable later (e.g. Groceries = 600 CHF/month) |
| D5 | Year Switcher + All Years Mode | Default: active year. Switcher to past years or aggregated all-time view |

### Theme 3: Sync & Infrastructure

| ID | Feature | Description |
|---|---|---|
| S1 | Sheet Discovery by Naming Pattern | App discovers tabs matching configurable prefix "CH Daily Expenses" automatically — new years appear without config changes |
| S2 | Offline Status Bar | Persistent indicator: online/offline state + pending queue count. Tappable to open conflict reviewer |
| S3 | Sync Conflict Reviewer | Pre-sync review screen showing queued changes. Per-row actions: push, modify, cancel, resolve conflict |
| S4 | New Year Tab Scaffold | Detects no tab for next year in December (or on demand), offers to create from blank template |
| S5 | Legacy Schema Mapper (2025) | Read-only import mapping of 2025's different columns: Particulars → Remarks, full date → derived Month |
| S6 | Schema Version Detection | Identifies tab schema version by column headers before reading — handles legacy and current gracefully |

### Theme 4: Search & Discovery

| ID | Feature | Description |
|---|---|---|
| R1 | Merchant Tag Extractor | Scans Remarks text, surfaces first word or known merchant names as a soft tag (Migros, Coop, Avec) — not stored in Sheet, used for app-side filtering |
| R2 | Remarks Smart Search | Full-text search across all Remarks with merchant-aware filtering — "show all Migros entries" |

### Theme 5: Categories

| ID | Feature | Description |
|---|---|---|
| C1 | Sheet-Seeded Category Registry | On first load, discovers categories from Sheet and seeds app registry. After that, bidirectional — create from app or Sheet |
| C2 | In-App Color Configuration | Color picker per category in app's category manager. Decoupled from Sheet cell formatting |

### Theme 6: Notifications & Export

| ID | Feature | Description |
|---|---|---|
| N1 | Expense Logging Reminder | Configurable push notification — daily nudge or weekly prompt if no entries logged in X days |
| X1 | Report Export | Export month or year data as PDF (formatted summary) or CSV (raw data) |

### Theme 7: Mobile

| ID | Feature | Description |
|---|---|---|
| M1 | Read-First Mobile View | Mobile layout prioritizes dashboard and drill-down. Quick-add as persistent floating button |

### Design Principles (Non-Negotiable)

| Principle | Statement |
|---|---|
| Frictionless Add | Maximum 3 taps from app open to saved entry. If slower than opening Google Sheets, the app fails. |
| Sheets is a Sync Layer | Core experience (list + dashboard + quick-add) is valid standalone. Sheets is a feature, not a dependency. |

---

### Prioritization

| Priority | Features |
|---|---|
| **MVP Core** | E1 (quick add), F1 (filters), D1 (monthly hero), D2 (category bar), D3 (drill-down ⭐), S1 (sheet discovery), S2 (offline bar), S3 (conflict reviewer), C1 (category registry), C2 (category colors) |
| **Ship Soon** | E2 (batch entry), E3 (large remarks), E4 (split marker), R1 (merchant extractor), R2 (smart search), D5 (year switcher), S5 (legacy mapper), S6 (schema detection), M1 (mobile view) |
| **Later** | D4 (budget seeds), E5 (net/gross toggle), N1 (reminders), X1 (export), S4 (year scaffold) |
| **Future / Parked** | Natural language date input, AI category suggestion, receipt OCR, unified search+filter UI, combined category+budget panel, cross-year timeline scroll, running balance view, swipe-to-edit, calendar grid view, anomaly-first navigation, same-screen quick-add+dashboard |

---

## Session Summary

**Total confirmed ideas:** 26
**Parked future ideas:** 11
**Techniques used:** Question Storming, SCAMPER, Reversal Inversion

### Key Breakthroughs

1. **The hero feature is the drill-down** — Category × Month drill-down (D3) is the primary reason this app needs to exist. Everything else is scaffolding around it.
2. **Sheets is a sync layer, not the product** — The app can work offline, port to iOS, and evolve independently. This architectural insight shapes every technical decision.
3. **The kill condition** — If adding an entry is harder than opening Google Sheets, the app fails. Frictionless quick-add is the product's most important UX guarantee.
4. **Sheet discovery by prefix** — Eliminates all future maintenance of year-based configuration. The naming pattern IS the config.
5. **2025 is a legacy schema** — One-time mapping layer handles historical data without polluting the active schema.

### Recommended Next Step

Run **`bmad-create-prd`** in a fresh context window. This session document provides the full feature inventory, constraints, and prioritization needed to produce a complete PRD.
