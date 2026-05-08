# Non-Functional Requirements

## Performance

- **NFR-P1:** Dashboard (current month total + category breakdown) loads in < 2 seconds on a mid-range device on 4G
- **NFR-P2:** Entry save perceived latency (tap Save → entry appears in list) is < 200ms via optimistic local update
- **NFR-P3:** First Meaningful Paint on 4G < 3 seconds for returning users (cached assets)
- **NFR-P4:** Category × month drill-down opens in < 500ms
- **NFR-P5:** Sheet data is refreshed on every app open and tab focus; within a session, data is cached with a 5-minute TTL to avoid redundant re-fetches on navigation

## Security

- **NFR-S1:** OAuth tokens are stored in browser storage and never exposed in URLs, logs, or error messages
- **NFR-S2:** All communication with Google APIs uses HTTPS exclusively
- **NFR-S3:** No financial data is transmitted to any service other than Google Sheets
- **NFR-S4:** The app requests the minimum necessary Google OAuth scopes — Sheets read/write access scoped to the identified spreadsheet only

## Reliability

- **NFR-R1:** Zero entries are lost across all sync scenarios, including offline entry, reconnect, partial flush, and mid-flush token expiry
- **NFR-R2:** Queued entries survive app restarts, tab closes, and browser updates via IndexedDB persistence
- **NFR-R3:** After 1 hour of continuous sync failure for a given entry, the user receives a visible warning with a manual retry action
- **NFR-R4:** Schema validation blocks any write to Google Sheets when the column schema cannot be verified; no silent mismap

## Integration

- **NFR-I1:** The app remains fully functional during Sheets API outages by serving cached data and queuing new entries locally
- **NFR-I2:** Sheets API writes are batched where possible to remain within the 100 requests/100 seconds quota
- **NFR-I3:** Sheets API quota errors and transient failures are handled gracefully — no data loss, no silent failure, user-visible retry state

## Accessibility

- **NFR-A1:** Body text minimum 16px; interactive touch targets minimum 44×44px
- **NFR-A2:** Standard semantic HTML elements used throughout; no custom interactive components that break native browser behaviour
