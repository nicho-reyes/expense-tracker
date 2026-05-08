# Design Philosophy

## Principle 1: The Kill Condition

If logging an expense in the app takes more steps than opening Google Sheets and typing a row directly, the app has failed its primary purpose. This is not a UX aspiration — it is a pass/fail threshold. Every entry flow decision is evaluated against it.

Concretely: an expense must be saveable from app open in ≤ 3 taps, with date pre-filled to today. The minimum required input is category + amount.

## Principle 2: Sheets is Plumbing, Not the Product

Most spreadsheet-backed apps treat the spreadsheet as the canonical UI and build a thin wrapper. This app inverts that relationship. The app owns the user experience entirely; Google Sheets is the persistence and portability layer. The user never waits for Sheets to respond before seeing feedback — all interactions are optimistic and local-first. Sheets could be swapped for another backend without changing a single user-facing screen.

This inversion produces concrete decisions at every level: optimistic UI on entry, offline-tolerant architecture, independent dashboard rendering, and an explicit sync state model that treats connectivity as a feature, not a requirement.
