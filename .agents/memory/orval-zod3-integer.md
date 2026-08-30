---
name: Orval integer response compatibility
description: OpenAPI integer response fields can generate unsupported static zod.int() calls in this workspace.
---

OpenAPI integer response properties may be emitted as `zod.int()` by the installed Orval generator, while this workspace uses Zod 3 where that static helper is unavailable.

**Why:** A generated client-library typecheck failed after adding pagination metadata with integer response schemas.

**How to apply:** Keep integer validation on query inputs where needed, but use numeric response schemas unless the generator/Zod versions are upgraded together.