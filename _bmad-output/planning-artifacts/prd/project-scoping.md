# Project Scoping

## Strategy

**Approach:** Single release — Must-Have and Nice-to-Have features ship together as one complete product. No phased delivery.
**Resource:** Solo developer (Nick). No external team dependencies.

All five user journeys (daily quick-add, monthly review & drill-down, offline recovery, batch entry, first-time setup) are fully supported in this release.

## Must-Have Capabilities

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

## Nice-to-Have Capabilities (same release, cuttable under time pressure)

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

## Risk Mitigation

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
