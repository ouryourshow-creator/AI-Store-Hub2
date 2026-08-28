---
name: Analytics country attribution
description: Country attribution behavior when Replit preview or deployment proxies do not expose reliable visitor IP headers.
---

Country analytics should prefer trusted proxy country headers, then use a validated client country hint, and only then attempt server-side IP lookup. When a known country arrives for a visitor, older `UNKNOWN` rows for that same visitor can be repaired safely.

**Why:** Replit's preview proxy can make the API see a local/private address and public IP lookup services can be rate-limited, so server-only detection produces persistent `UNKNOWN` results.

**How to apply:** Keep client hints limited to analytics, validate them as two-letter codes, cache them per visitor, and never infer a historical visitor's country from another visitor or from an assumed default.