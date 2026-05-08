# Executive Summary

A mobile-optimized personal expense tracking web app that makes "how am I doing this month?" answerable in seconds. Google Sheets serves as the persistent source of truth; the app provides the dashboard, drill-down, and entry UX that Sheets cannot. Built for a single user (Nick), denominated in CHF, backed by an existing multi-year Sheet with ~20 categories. No subscription cost, full ownership, no schema imposed by a third-party service.

The primary interaction loop: log a new expense in under 3 taps, then immediately understand where the money went via a category × month drill-down. If logging an entry takes more steps than opening Google Sheets and typing a row, the app fails its core purpose.

## What Makes This Different

Generic expense trackers impose their own category taxonomies, sync models, and subscription costs. This app is the front-end your Google Sheet never had — it inherits your exact schema, color-codes your categories your way, and adds the one capability Sheets lacks: instant visual clarity on spending patterns without manual scrolling or formula-hunting. Ownership is a first-class requirement: the data lives in your Sheet, the app is self-hosted, and there is no vendor lock-in. Sheets is the persistence layer — not the UX. The core experience is complete and valid without an active Sheets connection; sync is a feature.
