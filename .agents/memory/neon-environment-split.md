---
name: Neon environment split
description: Development and production can report the same neondb name while using different Neon branches or endpoints.
---

Development and production use environment-specific database connections. The database name alone is not enough to identify the Neon branch or endpoint; compare the environment when investigating missing rows.

**Why:** The development database can legitimately be empty while the published app has production orders, even though both connections report `neondb` and `public`.

**How to apply:** Query production when validating live data, query development only for preview data, and do not treat an empty development table as evidence that production inserts failed.