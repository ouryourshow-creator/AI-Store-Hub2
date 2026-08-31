---
name: Abandoned cart schema compatibility
description: The canonical Keytopia Neon database may contain an older abandoned-cart table than the local source schema.
---

Before changing abandoned-cart storage, inspect the canonical Keytopia database rather than relying only on the local Drizzle snapshot. Existing deployments may use a legacy `cart_id`/`subtotal` shape and already contain customer cart records.

**Why:** The project uses a separate canonical Neon connection, and the built-in development database can report a different schema. A local Drizzle push can therefore target the wrong database or prompt about a misleading table conflict.

**How to apply:** Preserve the canonical table and records when adding CRM behavior; either write compatibility code for the existing columns or perform an explicit, reviewed migration on the canonical connection.