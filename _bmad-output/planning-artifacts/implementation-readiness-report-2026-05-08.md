---
stepsCompleted: [step-01-document-discovery, step-02-prd-analysis, step-03-epic-coverage-validation, step-04-ux-alignment, step-05-epic-quality-review, step-06-final-assessment]
documentsUsed:
  prd: '_bmad-output/planning-artifacts/prd.md'
  architecture: '_bmad-output/planning-artifacts/architecture.md'
  sequenceDiagrams: '_bmad-output/planning-artifacts/sequence-diagrams.md'
  epics: '_bmad-output/planning-artifacts/epics.md'
  ux: '_bmad-output/planning-artifacts/ux-design-specification.md'
assessmentRun: 2026-05-08 (second run — documents updated since first run)
---

# Implementation Readiness Assessment Report

**Date:** 2026-05-08 (revised)
**Project:** expense-dashboard

## Document Inventory

| Type | File | Size | Last Modified |
|------|------|------|---------------|
| PRD | `_bmad-output/planning-artifacts/prd.md` | 33 KB | 2026-05-08 |
| Architecture | `_bmad-output/planning-artifacts/architecture.md` | 49 KB | 2026-05-08 |
| Sequence Diagrams | `_bmad-output/planning-artifacts/sequence-diagrams.md` | 11 KB | 2026-05-08 |
| Epics & Stories | `_bmad-output/planning-artifacts/epics.md` | 77 KB | 2026-05-08 (updated) |
| UX Design | `_bmad-output/planning-artifacts/ux-design-specification.md` | 55 KB | 2026-05-08 (updated) |

No duplicate or sharded documents detected. All required document types present.

**Assessment context:** This is a second-run assessment. The source documents (epics.md, prd.md, ux-design-specification.md) were updated after the first run's findings. This report assesses the updated documents and tracks which prior issues have been resolved.

---

## PRD Analysis

### Functional Requirements

**Expense Entry**

| ID | Requirement |
|----|-------------|
| FR1 | User can log a new expense by providing category and amount; date and remarks are optional |
| FR2 | User can complete a new expense entry in ≤3 taps on a warm app start, with date pre-filled to today |
| FR3 | User can override the pre-filled date when logging an expense |
| FR4 | User can add free-text remarks to any expense entry |
| FR5 | User can log expenses in batch mode, where each submitted entry pre-fills the next row with the same date and category |
| FR6 | User can edit an existing expense entry |
| FR7 | User can delete an existing expense entry |
| FR8 | User can enter negative amounts to represent split expenses or reimbursements |
| FR49 | User is prompted to confirm before an expense entry is deleted, and can undo the deletion within a short grace period |
| FR50 | User can end a batch entry session by saving the final entry, closing the batch view, or tapping a stop control |

**Dashboard & Visualization**

| ID | Requirement |
|----|-------------|
| FR9 | User can view total spend for the current month, inclusive of all categories with no exclusions |
| FR10 | User can view a sparkline comparison of monthly spend across the last 6–12 months |
| FR11 | User can view spend broken down by category for any selected month |
| FR12 | User can tap a category in the breakdown to view all entries for that category in that month |
| FR13 | User can navigate to any month via previous/next controls (not a calendar picker) |
| FR14 | User can switch between years and view an aggregated all-years view |

**Entry Discovery & Search**

| ID | Requirement |
|----|-------------|
| FR15 | User can filter the entry list by category |
| FR16 | User can filter the entry list by month |
| FR17 | User can filter the entry list by year |
| FR18 | User can search entries by free-text remarks content |
| FR19 | User can filter entries by merchant name |

**Category Management**

| ID | Requirement |
|----|-------------|
| FR20 | The app seeds the category registry from the connected Sheet on first load |
| FR55 | The category registry is global across all years — categories are not scoped to a specific tab or year |
| FR21 | User can create new categories within the app |
| FR22 | User can assign a display color to each category |
| FR23 | User can reorder categories in the quick-add interface |
| FR24 | Categories created in the app are written back to the Sheet |

**Google Sheets Integration**

| ID | Requirement |
|----|-------------|
| FR25 | The app discovers Sheet tabs matching the "CH Daily Expenses" naming prefix without manual configuration |
| FR26 | The app validates the column schema of a tab before reading or writing any data |
| FR27 | The app identifies the schema version (2026 active vs. 2025 legacy) of each discovered tab |
| FR28 | The app reads 2025 legacy tab data in read-only mode, mapping legacy columns to the current schema |
| FR29 | New entries are always written to the current year's active tab |
| FR30 | Entries from past years using the current schema can be edited and deleted; changes write back to their originating tab |
| FR31 | The app assigns a unique identifier to each entry, stored in an app-managed column in the Sheet; if this column is absent on session load, the app surfaces a schema error |
| FR32 | The app surfaces an actionable error when sheet discovery fails or a tab has an unrecognized schema |
| FR51 | Entries sourced from the 2025 legacy tab are read-only; editing and deleting them is blocked in the app |

**Offline & Sync**

| ID | Requirement |
|----|-------------|
| FR33 | User can log, edit, and view entries while offline |
| FR34 | A persistent indicator shows connectivity status and the count of unsynced entries |
| FR35 | User can review all queued entries before they are pushed to Google Sheets |
| FR36 | User can edit an individual queued entry before it is synced |
| FR37 | User can cancel (discard) an individual queued entry before it is synced |
| FR38 | Failed sync attempts are retried automatically with exponential backoff |
| FR39 | A user-visible warning is surfaced when sync failure persists beyond a defined threshold |
| FR40 | The app displays the timestamp of the last successful sync |
| FR41 | The full dashboard and entry history remain browseable while offline or during token-invalid periods |
| FR52 | The sync queue indicator visually distinguishes PENDING entries from SYNC_ERROR entries |
| FR53 | User can manually trigger a sync retry from the sync indicator |

**Authentication & Session**

| ID | Requirement |
|----|-------------|
| FR42 | User can authenticate with their Google account via OAuth |
| FR43 | The app maintains authentication across sessions without re-login on each visit |
| FR44 | The app prompts re-authentication when the OAuth token expires or is revoked; if silent token refresh fails, the user is redirected to the OAuth flow without data loss |
| FR45 | The app remains fully usable in offline/read mode and continues accepting queued entries during re-authentication |
| FR46 | On successful re-authentication, the pending queue is flushed and the latest Sheet data is fetched |

**First-Run & Setup**

| ID | Requirement |
|----|-------------|
| FR47 | On first launch, the app guides the user through Google authentication and Sheets access approval |
| FR48 | The user provides their Google Sheet URL or spreadsheet ID once on first launch; the app persists the connection to `appMeta` IDB and reconnects automatically on all subsequent sessions without requiring manual re-entry |
| FR54 | After completing authentication on first launch, the app confirms the connected Sheet name before loading data |

**Total FRs: 55**

---

### Non-Functional Requirements

**Performance**

| ID | Requirement |
|----|-------------|
| NFR-P1 | Dashboard loads in < 2s on mid-range device on 4G |
| NFR-P2 | Entry save perceived latency < 200ms via optimistic local update |
| NFR-P3 | First Meaningful Paint on 4G < 3s for returning users (cached assets) |
| NFR-P4 | Category × month drill-down opens in < 500ms |
| NFR-P5 | Sheet data refreshed on every app open and tab focus; cached with 5-minute TTL within session |

**Security**

| ID | Requirement |
|----|-------------|
| NFR-S1 | OAuth tokens stored in browser storage, never exposed in URLs, logs, or error messages |
| NFR-S2 | All Google API communication uses HTTPS exclusively |
| NFR-S3 | No financial data transmitted to any service other than Google Sheets |
| NFR-S4 | Minimum necessary Google OAuth scopes — Sheets read/write scoped to identified spreadsheet only |

**Reliability**

| ID | Requirement |
|----|-------------|
| NFR-R1 | Zero entries lost across all sync scenarios including offline entry, reconnect, partial flush, mid-flush token expiry |
| NFR-R2 | Queued entries survive app restarts, tab closes, and browser updates via IndexedDB persistence |
| NFR-R3 | After 1 hour of continuous sync failure for a given entry, the user receives a visible warning with manual retry action |
| NFR-R4 | Schema validation blocks any write to Google Sheets when column schema cannot be verified; no silent mismap |

**Integration**

| ID | Requirement |
|----|-------------|
| NFR-I1 | App remains fully functional during Sheets API outages by serving cached data and queuing new entries locally |
| NFR-I2 | Sheets API writes batched where possible to stay within 100 requests/100 seconds quota |
| NFR-I3 | Sheets API quota errors and transient failures handled gracefully — no data loss, no silent failure, user-visible retry state |

**Accessibility**

| ID | Requirement |
|----|-------------|
| NFR-A1 | Body text minimum 16px; interactive touch targets minimum 44×44px |
| NFR-A2 | Standard semantic HTML elements used throughout; no custom interactive components that break native browser behaviour |

**Total NFRs: 18**

---

### PRD Completeness Assessment

The PRD has been updated since the first assessment. Key change: **FR48 has been corrected** — it now accurately reflects the "provide once, persist forever" model: "The user provides their Google Sheet URL or spreadsheet ID once on first launch; the app persists the connection to `appMeta` IDB and reconnects automatically on all subsequent sessions without requiring manual re-entry." This resolves the previously flagged FR48 conflict.

All 55 FRs are clearly numbered and domain-organized. The PRD is complete and internally consistent.

---

## Epic Coverage Validation

### Coverage Matrix

| FR | PRD Requirement (short) | Epic | Story | Status |
|----|------------------------|------|-------|--------|
| FR1 | Log expense: category + amount minimum | Epic 2 | 2.1, 2.2 | ✓ Covered |
| FR2 | ≤3 taps from warm start, date pre-filled | Epic 2 | 2.2 | ✓ Covered |
| FR3 | Override pre-filled date | Epic 2 | 2.2 | ✓ Covered |
| FR4 | Free-text remarks field | Epic 2 | 2.2 | ✓ Covered |
| FR5 | Batch mode with same-date+category pre-fill | Epic 6 | 6.4 | ✓ Covered |
| FR6 | Edit existing entry | Epic 2 | 2.4 | ✓ Covered |
| FR7 | Delete existing entry | Epic 2 | 2.4 | ✓ Covered |
| FR8 | Negative amounts for reimbursements | Epic 2 | 2.2 | ✓ Covered |
| FR9 | Monthly total on dashboard | Epic 4 | 4.1 | ✓ Covered |
| FR10 | 6–12 month sparkline | Epic 4 | 4.2 | ✓ Covered |
| FR11 | Category breakdown by month | Epic 4 | 4.3 | ✓ Covered |
| FR12 | Category × month drill-down | Epic 4 | 4.3, 4.4 | ✓ Covered |
| FR13 | Prev/next month navigation | Epic 4 | 4.1 | ✓ Covered |
| FR14 | Year switcher + all-years view | Epic 6 | 6.3 | ✓ Covered |
| FR15 | Filter entry list by category | Epic 6 | 6.1 | ✓ Covered |
| FR16 | Filter entry list by month | Epic 6 | 6.1 | ✓ Covered |
| FR17 | Filter entry list by year | Epic 6 | 6.1 | ✓ Covered |
| FR18 | Full-text remarks search | Epic 6 | 6.2 | ✓ Covered |
| FR19 | Filter by merchant name | Epic 6 | 6.2 | ✓ Covered |
| FR20 | Seed category registry from Sheet on first load | Epic 1 | 1.5 | ✓ Covered |
| FR21 | Create new categories in app | Epic 5 | 5.3 | ✓ Covered |
| FR22 | Per-category display color | Epic 5 | 5.2 | ✓ Covered |
| FR23 | Reorder categories in quick-add | Epic 5 | 5.1 | ✓ Covered |
| FR24 | Write new categories back to Sheet | Epic 5 | 5.3 | ✓ Covered |
| FR25 | Discover Sheet tabs by "CH Daily Expenses" prefix | Epic 1 | 1.4 | ✓ Covered |
| FR26 | Validate column schema before read/write | Epic 1 | 1.4 | ✓ Covered |
| FR27 | Detect schema version (2026 vs 2025) | Epic 1 | 1.4 | ✓ Covered |
| FR28 | Read 2025 legacy tab (read-only, column mapping) | Epic 3 | 3.6 | ✓ Covered |
| FR29 | Write new entries to current year's active tab | Epic 2 | 2.5 | ✓ Covered |
| FR30 | Edit/delete past-year 2026-schema entries with tab write-back | Epic 3 | 3.7 | ✓ Covered |
| FR31 | UUID column management; schema error if absent | Epic 1 | 1.4 | ✓ Covered |
| FR32 | Actionable error on discovery failure or unrecognized schema | Epic 1 | 1.4 | ✓ Covered |
| FR33 | Log, edit, view entries while offline | Epic 3 | 3.4 | ✓ Covered |
| FR34 | Persistent connectivity + unsynced-count indicator | Epic 3 | 3.2, 3.4 | ✓ Covered |
| FR35 | Review queued entries before push | Epic 3 | 3.5 | ✓ Covered |
| FR36 | Edit individual queued entry before sync | Epic 3 | 3.5 | ✓ Covered |
| FR37 | Cancel individual queued entry | Epic 3 | 3.5 | ✓ Covered |
| FR38 | Exponential backoff retry on failure | Epic 3 | 3.1 | ✓ Covered |
| FR39 | User-visible warning after failure threshold | Epic 3 | 3.1, 3.3 | ✓ Covered |
| FR40 | Display last successful sync timestamp | Epic 3 | 3.3 | ✓ Covered |
| FR41 | Dashboard + history browseable offline | Epic 3 | 3.4 | ✓ Covered |
| FR42 | Google OAuth authentication | Epic 1 | 1.2 | ✓ Covered |
| FR43 | Session persistence across visits | Epic 1 | 1.2 | ✓ Covered |
| FR44 | Re-auth on token expiry; silent→redirect fallback | Epic 1 | 1.3 | ✓ Covered |
| FR45 | App usable in offline/read mode during re-auth | Epic 1 | 1.3 | ✓ Covered |
| FR46 | Queue flush + latest Sheet fetch on re-auth success | Epic 1 | 1.3 | ✓ Covered |
| FR47 | First-launch auth + Sheets access guide | Epic 1 | 1.4 | ✓ Covered |
| FR48 | User provides Sheet URL/ID once; app persists and auto-reconnects | Epic 1 | 1.4 | ✓ Covered |
| FR49 | Delete confirmation + grace-period undo | Epic 2 | 2.4 | ✓ Covered |
| FR50 | End batch session (save / close / stop control) | Epic 6 | 6.4 | ✓ Covered |
| FR51 | Block edit/delete on 2025 legacy entries | Epic 3 | 3.6 | ✓ Covered |
| FR52 | PENDING vs SYNC_ERROR visual distinction | Epic 3 | 3.2 | ✓ Covered |
| FR53 | Manual sync retry from sync indicator | Epic 3 | 3.2 | ✓ Covered |
| FR54 | Confirm connected Sheet name before loading data | Epic 1 | 1.4 | ✓ Covered |
| FR55 | Category registry global across all years | Epic 1 | 1.5 | ✓ Covered |

### Missing Requirements

None. All 55 FRs are fully covered with no conflicts. FR48, which was previously in conflict, has been resolved in both the PRD and Story 1.4.

### Coverage Statistics

- Total PRD FRs: 55
- FRs covered in epics: 55 (100%)
- FRs with PRD-to-epic conflicts: 0 (resolved from prior 1)
- Coverage percentage: 100% conflict-free

---

## UX Alignment Assessment

### UX Document Status

**Found:** `_bmad-output/planning-artifacts/ux-design-specification.md` (55 KB). Comprehensive specification covering all 14 workflow steps: executive summary, platform strategy, emotional response mapping, UX pattern analysis, design system foundation, all user journey flows, component strategy, visual design system, UX consistency patterns, and responsive/accessibility strategy.

### UX ↔ PRD Alignment

**Excellent alignment.** All previously flagged misalignments have been resolved:

| Issue | Prior Status | Current Status |
|-------|-------------|----------------|
| FR48 conflict — UX Journey 5 showed auto-discovery via Google Drive | ⚠️ Medium | ✅ Resolved — Journey 5 now shows: Auth → "Sheet setup screen: Enter Google Sheet URL or ID" → App validates → Confirm connection screen → Connect. The manual URL entry step is now in the UX flow. |
| Filter persistence not in PRD FRs | ℹ️ Low | Acceptable as implementation detail — no action required |

**Remaining low-priority UX observation:**

| Item | Severity | Detail |
|------|----------|--------|
| Performance metric ambiguity | ℹ️ Low | UX spec testing section (line 1067): "Warm PWA launch to first meaningful paint: target < 200ms." PRD NFR-P3: "FMP < 3s." These appear to target different things — the 200ms is likely the QuickAddDrawer open animation budget. Story 1.6 now has an explicit NFR-P3 AC (< 3s measured via Lighthouse), so the PRD requirement has a testable gate. Risk is low: the ambiguity cannot cause an incorrect implementation given the Story 1.6 AC is authoritative. Recommend clarifying the UX spec's 200ms target label ("drawer open animation" vs "FMP"). |

### UX ↔ Architecture Alignment

**Excellent alignment.** All UX-DR requirements (UX-DR1 through UX-DR26) remain well-derived from the UX specification and correctly reflected in epics. No new architectural misalignments detected.

### Warnings

1. **Story 6.4 batch entry mode has no UX journey flow** — The UX spec's Journey 1 (Quick-Add) covers single-entry behavior only. No batch entry UX journey or `QuickAddSheetComponent` extension spec exists for batch mode. Story 6.4's ACs are sufficient for implementation, but the absence of a UX flow means developers will interpret the batch interaction independently. Since E6 is the explicit cut line, this is a pre-Sprint-6 concern only, not a Sprint-1 blocker.

---

## Epic Quality Review

### Epic Structure Validation

| Epic | User-Centric? | User Value | Independent? | Verdict |
|------|--------------|------------|--------------|---------|
| E1: Foundation, Auth & First-Run | Borderline | Nick can auth, connect Sheet, land on working app | ✓ Stands alone | ⚠️ Story 1.1 is technical scaffold — acceptable for greenfield |
| E2: Expense Entry & Local-First Core | ✓ | Nick can log, edit, delete expenses instantly | ✓ Uses only E1 | ✓ Strong |
| E3: Sync, Offline & Legacy Schema | ✓ | All entries sync reliably through full offline | ✓ Uses E1+E2 | ✓ Explicit 3A/3B/3C cut line — correct |
| E4: Dashboard & Spending Insights | ✓ | "How am I doing?" in <10 seconds | ✓ Uses E1+E2 | ✓ Strong |
| E5: Category Management & Visual | ✓ | Customize colors, reorder, create categories | ✓ Uses E1 | ✓ Acceptable |
| E6: Entry Discovery, Search & Batch | ✓ | Filter, search, batch-entry week of expenses | ✓ Uses E1–E5 | ✓ Correct explicit cut line |

---

### Issues Resolved Since Prior Assessment

The following were Critical or Major issues in the first assessment. All have been resolved:

**CV-1 (Critical — RESOLVED):** Story 1.1 previously referenced "required by Story 3.7" inside the `targetTabName` AC — a forward dependency in AC text. The AC has been rewritten as a self-contained contract: "`targetTabName`: null for INSERT operations; set to the originating tab name for past-year UPDATE/DELETE operations — always present so that UPDATE/DELETE retries can target the correct originating tab without re-querying the entry." No story numbers are referenced.

**CV-2 (Critical — RESOLVED):** Story 4.3 previously had no AC for orphaned entries (entries whose category has been deleted). Story 4.3 now includes: "Given an entry's `categoryId` no longer exists in the `categories` IDB store, When `CategoryBreakdownBarComponent` renders, Then the entry is grouped under an 'Unknown' label using a fixed neutral color (`--color-unknown: #9e9e9e`); no CSS variable fallback is unhandled, no rendering error is thrown, and no exception escapes the component." Story 4.3 is now independent of E5.

**MI-1/Story 1.2 (Major — RESOLVED):** OAuth cancel and network timeout ACs are now present. `AppError.AUTH_DENIED` is now a first-class variant in the Story 1.1 discriminated union and used explicitly in Story 1.2's cancel flow. `AppError.NETWORK` is emitted on timeout/connection failure.

**MI-1/Story 1.5 (Major — RESOLVED):** Both blocking decisions are now made and encoded as ACs: (1) `APP_INITIALIZER` failure → `CategoriesService.init()` resolves without rejecting; app boots with empty registry + recoverable prompt. (2) Categories source: primary = `Categories` tab column A; fallback = unique non-empty values from column B of active 2026-schema tab. Write-back range for Story 5.3 is also now explicitly defined in Story 1.5.

**MI-1/Story 2.1 (Major — RESOLVED):** NFR-R2 pass/fail gate is now an explicit AC: "Given PENDING and SYNC_ERROR items exist in the `syncQueue` IDB store, When the browser tab is closed and reopened, Then all queue items are present with their original `status`, `retryCount`, and `nextRetryAt` values intact — zero items missing (NFR-R2 pass/fail gate)."

**MI-1/Story 3.1 (Major — RESOLVED):** Two issues fixed: (1) Backoff schedule corrected to `1s/2s/4s/8s/16s/32s/64s/120s cap with ±20% jitter` — the prior 16s cap risked quota exhaustion (~225 req/hour per stuck entry). (2) NFR-R1 pass/fail gate AC is now explicit: "Given N PENDING items at flush start and a network error occurs mid-flush after K items have been successfully ACKed, Then exactly N-K items remain in `syncQueue` with PENDING status — zero items lost, zero items duplicated."

**MI-1/Story 4.3 (Major — RESOLVED):** See CV-2 above.

**MI-1/Story 5.3 (Major — RESOLVED):** Category deletion behavior decided: block-delete if any entry references the category. ACs: "Deletion is rejected; a `MatDialog` message shows 'Cannot delete — [X] entries use this category'." Unreferenced categories can be deleted freely with no Sheet write-back required.

**MI-2 (Major — RESOLVED):** NFR-R1 testable AC added to Story 3.1. See MI-1/Story 3.1 above.

**MI-3 (Major — RESOLVED):** NFR-R2 testable AC added to Story 2.1. See MI-1/Story 2.1 above.

**MI-4 (Major — RESOLVED):** NFR-P3 testable AC added to Story 1.6: "Given the app is installed as a PWA and the user has previously authenticated, When the app is opened on a 4G connection with service worker cached assets, Then First Meaningful Paint occurs in under 3 seconds — measured via Lighthouse or Chrome DevTools Performance panel (NFR-P3 pass/fail gate)."

**MI-5 (Major — RESOLVED):** Epic 3 now explicitly identifies sub-groups 3A (SyncQueue state machine), 3B (offline resilience and queue review), 3C (legacy schema support) with "3C is the internal cut line — defer if timeline requires" and "Ship 3A → 3B first; 3C second." The risk of 3C blocking 3A/3B delivery is now explicitly managed.

**MI-6 (Major — RESOLVED):** Epic 2 now includes an explicit developer note: "E2 intentionally ships with PENDING entries visible in the sync indicator. The PENDING state resolves in E3 when the full sync state machine is implemented. This is expected during sprint development and does not represent a bug in E2."

---

### Remaining Issues

#### 🟡 Minor Concerns

**MC-A: Story 6.4 (batch entry) has no UX journey flow**
- The UX spec covers single-entry `QuickAddSheetComponent` behavior only. No UX flow diagram exists for batch mode.
- Story 6.4's ACs are sufficient for a skilled developer to implement the behavior correctly, but the absence of a UX flow increases interpretation variance.
- **Impact:** Low — E6 is the explicit cut line and only relevant before Sprint 6.
- **Recommendation:** Author a batch entry UX flow addendum (diagram + component notes for `QuickAddSheetComponent` in batch mode) before Sprint 6 begins.

**MC-B: NFR-P5 has no testable story AC**
- NFR-P5: "Sheet data cached with 5-minute TTL within session; refreshed on app open and tab focus."
- No story has a pass/fail AC for this behavior. The architecture spec describes the TTL, and Story 4.1 covers the dashboard load time (NFR-P1), but the TTL behavior itself is untested by any AC.
- **Impact:** Very low — the behavior is described architecturally and unlikely to be misimplemented.
- **Recommendation:** Optionally add to Story 4.1 or Story 2.5: "Given a Sheet fetch has occurred in the last 5 minutes, When the user navigates between routes within the session, Then no new Sheets API call is made — the cached data is used." Not blocking.

**MC-C: FR48 individual mapping description is stale**
- The FR → Epic individual mapping list in epics.md still reads: "FR48 → Epic 1 — Auto-connect to expense Sheet without manual config."
- The actual FR48 text and Story 1.4 ACs are both correct (manual URL entry). Only this mapping description line is stale.
- **Impact:** Negligible — developers read the story ACs, not the mapping description. Pure documentation drift.
- **Recommendation:** Update the description to: "FR48 → Epic 1 — User provides Sheet URL/ID once on first launch; app persists and auto-reconnects thereafter." One-line edit.

**MC-D: Story 1.1 is a technical proxy story (carry-over, acceptable)**
- "As Nick, I want the project initialized with all required dependencies..." does not deliver direct user value.
- Acceptable for a greenfield project. The team understands this is a prerequisite, not a deliverable.
- **No action required.**

**MC-E: FR numbering non-sequential (carry-over, cosmetic)**
- FRs jump non-sequentially (FR1–FR32, FR49–FR55 interspersed). All FRs are present and covered.
- **No action required.**

---

### Best Practices Compliance Summary (Updated)

| Epic | Delivers User Value | Independent | Stories Sized Correctly | No Forward Dependencies | NFRs Testable | ACs Complete |
|------|--------------------|-----------|-----------------------|------------------------|---------------|-------------|
| E1 | ⚠️ Story 1.1 borderline | ✓ | ✓ | ✓ CV-1 resolved | ✓ P3 gate in 1.6 | ✓ All resolved |
| E2 | ✓ | ✓ | ✓ | ✓ | ✓ R2 gate in 2.1 | ✓ All resolved |
| E3 | ✓ | ✓ | ✓ 3A/3B/3C cut line | ✓ | ✓ R1 gate in 3.1 | ✓ All resolved |
| E4 | ✓ | ✓ | ✓ | ✓ CV-2 resolved | ✓ | ✓ All resolved |
| E5 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ All resolved |
| E6 | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠️ 6.4 no UX flow (pre-Sprint 6 concern) |

---

## Summary and Recommendations

### Overall Readiness Status

## ✅ READY — Implementation Can Begin

All 3 critical violations and all 6 major issues identified in the first assessment have been resolved. The planning artifacts are now in excellent shape. FR coverage is 100% and conflict-free. All critical reliability requirements (NFR-R1, NFR-R2) have testable pass/fail gates. All previously unresolved pre-sprint notes are now complete with blocking decisions made and encoded as ACs.

The remaining 5 concerns are all minor or cosmetic and none are blocking for any sprint.

---

### Resolved Issues (13 of 14 from prior assessment)

| Prior ID | Severity | Description | Resolution |
|----------|----------|-------------|------------|
| CV-1 | 🔴 Critical | Story 1.1 AC referenced Story 3.7 forward | `targetTabName` AC rewritten as self-contained contract |
| CV-2 | 🔴 Critical | Story 4.3 depended on E5 category deletion behavior | "Unknown" category AC added to Story 4.3 |
| CV-3 | 🔴 Critical | All 4 IDB stores created upfront in Story 1.1 | Accepted as deliberate greenfield technical prerequisite |
| MI-1/1.2 | 🟠 Major | OAuth cancel and timeout ACs missing | Both ACs added; `AUTH_DENIED` variant formalized |
| MI-1/1.5 | 🟠 Major | APP_INITIALIZER failure + categories source unresolved | Both decisions made and encoded as ACs in Story 1.5 |
| MI-1/2.1 | 🟠 Major | NFR-R2 survival AC missing | NFR-R2 pass/fail gate AC added to Story 2.1 |
| MI-1/3.1 | 🟠 Major | Backoff cap too low + NFR-R1 untestable | Backoff corrected to 120s cap; NFR-R1 pass/fail gate AC added |
| MI-1/4.3 | 🟠 Major | Orphaned entry AC missing | "Unknown" category AC added to Story 4.3 |
| MI-1/5.3 | 🟠 Major | Category deletion behavior undecided | Block-delete chosen; ACs added to Story 5.3 |
| MI-2 | 🟠 Major | NFR-R1 (zero data loss) untestable | Testable AC added to Story 3.1 |
| MI-3 | 🟠 Major | NFR-R2 (queue persistence) untestable | Testable AC added to Story 2.1 |
| MI-4 | 🟠 Major | NFR-P3 (FMP < 3s) untestable | Testable AC added to Story 1.6 |
| MI-5 | 🟠 Major | E3 over-scoped, 3C risk | 3A/3B/3C sub-groups formalized with explicit 3C cut line |
| MI-6 | 🟠 Major | E2 defers offline to E3 with no developer note | Explicit note added to E2 epic description |
| FR48 conflict | ⚠️ Medium UX | PRD + UX spec said auto-discovery; epics said manual URL | PRD FR48 updated; UX Journey 5 updated; Story 1.4 aligned |

---

### Remaining Items (Non-Blocking)

| ID | Severity | Action Required | Before Sprint |
|----|----------|-----------------|---------------|
| MC-A | 🟡 Minor | Author batch entry UX journey flow | Sprint 6 |
| MC-B | 🟡 Minor | Optionally add NFR-P5 cache TTL AC | Any time |
| MC-C | 🟡 Minor | Update FR48 mapping description in epics.md | Any time |
| MC-D | 🟡 Minor | None — Story 1.1 technical proxy is acceptable | — |
| MC-E | 🟡 Minor | None — FR numbering gaps are cosmetic | — |

---

### Recommended Next Steps

1. **Begin Sprint 1 immediately.** All E1 and E2 blockers are resolved. Stories 1.1–1.6 and 2.1–2.5 are implementation-ready.

2. **Fix the FR48 stale mapping description in epics.md** — one-line edit, takes 30 seconds. "Auto-connect to expense Sheet without manual config" → "User provides Sheet URL/ID once on first launch; app persists and auto-reconnects thereafter."

3. **Author a batch entry UX flow before Sprint 6 begins.** The Story 6.4 ACs are complete, but a UX diagram would reduce interpretation variance when implementing `QuickAddSheetComponent` in batch mode.

4. **Optionally clarify the UX spec's "< 200ms warm launch FMP" label** — this is likely the drawer open animation budget, not FMP. Since Story 1.6 now has the authoritative NFR-P3 AC (< 3s via Lighthouse), the ambiguity cannot cause an incorrect implementation. Clarification is cosmetic.

---

### Issues Summary

| Severity | Count | Items |
|----------|-------|-------|
| 🔴 Critical | 0 | All resolved |
| 🟠 Major | 0 | All resolved |
| 🟡 Minor | 5 | MC-A through MC-E |
| **Total** | **5** | Down from 14 in prior assessment |

---

**Report generated:** `_bmad-output/planning-artifacts/implementation-readiness-report-2026-05-08.md`
**Assessment completed:** 2026-05-08 (second run)
**Assessor:** Claude Code (Implementation Readiness Skill)
