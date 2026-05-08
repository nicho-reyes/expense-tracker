# Product Scope

Three tiers define the feature universe. The single-release strategy collapses MVP + selected Growth features into one shipment; see Project Scoping for the authoritative Must-Have / Nice-to-Have cut.

## MVP — Minimum Viable Product

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

## Growth Features (Post-MVP)

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

## Vision (Future)

| ID | Feature |
|---|---|
| D4 | Budget seed fields — optional per-category monthly targets |
| E5 | Net vs gross toggle — dashboard toggle: all positive spend vs. net of reimbursements |
| N1 | Expense logging reminder — configurable push notification (daily or weekly) |
| X1 | Report export — month or year data as PDF or CSV |
| S4 | New year tab scaffold — detect missing next-year tab in December, offer to create from template |
