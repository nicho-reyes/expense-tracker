# Success Criteria

## User Success

- An expense entry can be logged from app open to saved in ≤ 3 taps; date defaults to today, reducing required input to category + amount (and optionally remarks)
- The monthly spend dashboard answers "how am I doing this month?" without opening Google Sheets
- The app becomes the primary spending review interface — the Sheet's manual summary rows are never consulted again
- Category × month drill-down surfaces all entries for a given category in a given month without any filtering or scrolling through raw data

## Business Success

This is a single-user personal tool; business success is measured by personal adoption and utility:

- The app replaces Google Sheets as the primary interface for both expense logging and spending review within the first month of use
- Zero data loss across all sync scenarios, including offline entry and conflict resolution
- The app runs indefinitely at zero ongoing cost — self-hosted, no third-party subscriptions

## Technical Success

- Entries submitted while offline are queued locally and pushed to Sheets without data loss on reconnect, with a pre-sync review step
- Schema version detection correctly identifies the 2026 active schema and the 2025 legacy read-only schema before reading any tab
- Google OAuth authentication remains valid across sessions without re-prompting
- Category registry bootstrapped from Sheet on first load and kept in sync bidirectionally thereafter

## Measurable Outcomes

| Outcome | Target |
|---|---|
| Entry logging time (app open → saved) | ≤ 3 taps; date pre-filled to today |
| Data integrity across sync | 100% — zero entries lost |
| Dashboard load time (current month total + breakdown) | < 2 seconds |
| Sheet dependency for monthly review | Zero — all answers available in app |
