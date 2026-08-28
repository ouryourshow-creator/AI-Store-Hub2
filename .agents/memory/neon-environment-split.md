---
name: Neon environment split
description: Development and production can report the same neondb name while using different Neon branches or endpoints.
---

Development and production use environment-specific database connections. For this external-Neon setup, `DATABASE_URL` is runtime-managed by Replit in production, so the app uses a separately named `KEYTOPIA_DATABASE_URL` secret as the canonical Neon connection.

**Why:** The database name alone is not enough to identify the Neon branch or endpoint, and Replit's production `DATABASE_URL` can silently route writes to the managed Replit database instead of Neon.

**How to apply:** Keep `KEYTOPIA_DATABASE_URL` configured for the published environment, republish after changes, and query the matching Neon environment when validating live data.