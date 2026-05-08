# Domain-Specific Requirements

## Google Sheets API Constraints

- **Rate limit:** 100 requests / 100 seconds per user (Sheets API v4). Realistic single-user traffic will not approach this limit. Mitigation: batch writes where possible; debounce dashboard reads.
- **Read-through cache:** 5-minute TTL per session (see NFR-P5). The app must not re-fetch the Sheet on every route change or navigation. Reads and writes share the same quota bucket.
- **Header row schema validation on startup:** On every session load, the app reads the header row of the active tab and validates column order against expected schema before any read or write. On mismatch, surface a blocking error — silent mismap is not acceptable.
- **Sheet schema ownership:** The column schema is owned and managed by the app. Manually shifting or adding columns in Google Sheets is an unsupported configuration.
- **App-managed ID column:** The app writes a UUID to a hidden, app-managed column in each Sheet row. This column is never manually maintained by the user and is used as the delete anchor and idempotency key for all sync operations.
- **Month column auto-derived:** The Month column in the Sheet is derived from the Date field — the app computes and writes it automatically. The user never enters a Month value directly.

## OAuth & Token Lifecycle

- **Architecture:** Pure SPA, no backend server. OAuth uses PKCE flow via Google Identity Services library with silent auth via hidden iframe.
- **Silent auth fallback:** If hidden iframe refresh fails (blocked third-party cookies, ITP), the app escalates gracefully to a full redirect re-auth rather than hanging or spinning indefinitely.
- **Token expiry / revocation:** App surfaces a blocking re-auth prompt. While the token is invalid, the app remains fully usable in offline mode — cached dashboard and entry history remain browseable and new entries can be added to the queue.
- **On re-auth success:** Queue flushes and latest Sheet data is fetched.
- **Token expiry mid-flush:** If the token expires during an active flush, the flush pauses, re-auth prompt is shown, and flush resumes on successful re-auth.
- **Permanent revocation:** App distinguishes a revoked grant from a temporary network failure and shows an actionable "Sign in again to resume sync" UI state.

## Offline Queue & Sync

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

## Data Integrity & UI States

- **Schema validation:** Validated at enqueue, not at flush.
- **Two distinct sync states with separate UI treatment:**
  - `PENDING` — queue is non-empty; data is optimistically shown but unconfirmed in Sheets
  - `SYNC_ERROR` — a sync attempt has failed; warning indicator shown with actionable prompt
- **"Last synced" display:** The dashboard always shows the timestamp of the last successful Sheets fetch (informational). The warning indicator activates only on actual sync failure — not on TTL expiry alone.
- **Offline read scope:** While offline or during token-invalid periods, the full cached dashboard and entry history remain browseable. New entries can be added to the queue normally.

## Out of Scope

- Third-party collaborators editing the Sheet outside the app.
- Conflict handling for concurrent external edits.
