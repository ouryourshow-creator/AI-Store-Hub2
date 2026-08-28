---
name: Admin whitelist deployment
description: Production admin email configuration must be present in the published environment.
---

Preview-only workflow exports do not automatically become production environment variables. The admin whitelist must be configured in the production environment as well as any temporary preview workflow.

**Why:** A published app can authenticate a user successfully but still return a generic unauthorized screen when `ADMIN_EMAILS` is absent from its production process.

**How to apply:** When changing the admin whitelist, verify the production environment variable exists, then republish so the live process receives the value.