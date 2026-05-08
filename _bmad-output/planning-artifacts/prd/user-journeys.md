# User Journeys

## Journey 1: Nick — Daily Quick-Add (Core Success Path)

**Opening Scene:** It's 12:45 on a Tuesday. Nick has just paid CHF 14.50 at Migros for lunch and is walking back to his desk. He pulls out his phone. In the past, he'd make a mental note and try to remember it when he sat down at his laptop to update the Sheet — and sometimes forget.

**Rising Action:** He opens the app. The quick-add form is already open (or one tap away). Date is pre-filled to today. He taps "Groceries" from the category list — it's near the top because it's used often. He types 14.50. He adds "Migros" in remarks. Three taps, one number typed. He hits Save.

**Climax:** The entry appears instantly in the list. A faint sync indicator pulses, and within seconds the row is live in his Google Sheet — no copy-paste, no tab-switching, no formula adjustment.

**Resolution:** Nick pockets his phone. The expense is logged, categorized, and in the Sheet before he's back at his desk. He never had to open a spreadsheet.

**Requirements revealed:** Quick-add form, date default, category list with recency/frequency ordering, remarks field, immediate local confirmation, background Sheets sync.

---

## Journey 2: Nick — Monthly Review & Drill-Down (Primary Insight Loop)

**Opening Scene:** It's the 22nd of May. Nick has a vague sense he's been eating out more than usual this month. He opens the app to check — not to log anything, just to understand.

**Rising Action:** The dashboard loads with the monthly hero card front and center: **CHF 2,480 spent in May**. The sparkline shows his 6-month average is around CHF 2,150. He's running CHF 330 over trend. He glances at the category breakdown bar below — "Eat out" is the second-largest bar after Rent.

**Climax:** He taps "Eat out." The drill-down opens: 11 entries, CHF 460 total. He can see immediately — two work dinners in the same week, plus a weekend trip. The data tells the story without him having to scroll a spreadsheet, filter columns, or add up numbers manually.

**Resolution:** Nick knows exactly where the overage is coming from. He didn't need to open Google Sheets, write a formula, or construct a pivot table. The question "how am I doing this month?" had an answer in under 10 seconds.

**Requirements revealed:** Monthly hero card with sparkline, category breakdown bar, category × month drill-down with entry list, month navigation, visual spend-vs-trend indicators.

---

## Journey 3: Nick — Offline Catch-Up + Sync (Edge Case / Recovery)

**Opening Scene:** Nick is on a ski trip in the Alps for a long weekend. Phone signal is intermittent — he has connectivity in the chalet but not on the mountain. Over two days he makes several purchases: lift passes, lunch on the slopes, a dinner in the village.

**Rising Action:** Each time he opens the app to log an expense, it works exactly as normal — the form loads, he enters the data, hits Save. He notices the offline status bar at the bottom showing a badge: "4 pending." He doesn't worry about it. The entries are in the app; they'll sync when he's back online.

**Climax:** Back in the chalet with WiFi that evening, the status bar updates to show connectivity restored. Nick taps it out of curiosity. The pre-sync review screen opens, showing all 6 queued entries (he'd logged two more). Each row shows the date, category, amount, and remarks. One entry looks wrong — he'd typed 145 instead of 14.5 for a coffee. He edits it inline, then taps "Sync all."

**Resolution:** All 6 entries push to Google Sheets in order. The Sheet reflects the correct data. No entries were lost, no sync happened without his review, and the error was caught before it landed in the authoritative record.

**Requirements revealed:** Offline entry with local queue, offline status bar with pending count, pre-sync review screen, per-row edit/cancel before push, ordered sync execution, conflict detection on reconnect.

---

## Journey 4: Nick — Weekly Batch Entry (Alternative Entry Mode)

**Opening Scene:** Sunday evening. Nick has been lazy about logging this week — five days of expenses are unrecorded. He sits down with his wallet receipts and his memory. He's done this before in the Sheet: it means opening the tab, scrolling to the bottom, and typing row after row. Tonight he'll do it in the app instead.

**Rising Action:** He activates batch entry mode. He starts with Monday: date set to last Monday, category "Groceries", CHF 22.30, remarks "Coop." He hits Submit. The next row opens pre-filled: same date, same category. He changes the category to "Transportation" and types CHF 4.20 — tram ticket. Submit again. Now he adjusts the date to Tuesday and keeps going.

**Climax:** Twelve entries in, Nick finishes the week. He didn't have to re-select "Groceries" three times, didn't lose his place, and didn't accidentally skip a row. The rhythm of batch mode — submit, adjust, submit — matched how his brain was working through the week chronologically.

**Resolution:** Twelve new rows are in the Sheet. The dashboard now reflects an accurate May total. The batch session took about four minutes — faster than doing it in Sheets and far less error-prone.

**Requirements revealed:** Batch entry mode, pre-fill of previous row's date and category on submit, inline date editing within batch, session-level submit flow distinct from single-entry quick-add.

---

## Journey 5: Nick — First-Time Setup & Category Configuration (Onboarding + Admin)

**Opening Scene:** Nick has just deployed the app for the first time. He opens it in his browser. There's no data yet — just a sign-in screen.

**Rising Action:** He taps "Sign in with Google" and authenticates via OAuth. The app requests read/write access to Google Sheets. He approves. The app begins discovery: it scans his Google Drive for spreadsheets with tabs matching the prefix "CH Daily Expenses." It finds his 2026 spreadsheet immediately.

**Climax:** The app reads the Category column from the 2026 tab and bootstraps the category registry: 20 categories appear in the category manager — Groceries, Eat out, Leisure, Rent, and so on. All are ungrouped and uncolored by default. Nick opens the category manager and starts assigning colors: Groceries gets green, Rent gets grey, Eat out gets orange. He also reorders the quick-add list to put his most-used categories at the top.

**Resolution:** The app is configured. The dashboard shows his historical 2026 data — already 4 months of entries visualized. He makes his first test entry and confirms it lands in the Sheet. Setup is complete; there was no manual import, no CSV upload, no schema configuration. The Sheet was the config.

**Requirements revealed:** Google OAuth flow, Sheets API access request, tab discovery by naming prefix, category seeding from Column C of active tab, category manager with color picker and ordering, initial data load and dashboard render, first-entry confirmation.

---

## Journey Requirements Summary

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
