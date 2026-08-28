---
name: External Clerk key wiring
description: The distinction between owner-managed Clerk keys and Replit-managed host-derived keys.
---

When a project uses an owner-managed external Clerk instance, pass the external publishable and secret keys directly to the client provider and server middleware. Do not derive a publishable key from the Replit preview hostname or enable a Replit-managed proxy unless the project is explicitly using Replit-managed Clerk.

**Why:** Host-derived keys can make an external instance try to load Clerk assets from a generated `clerk.<replit-preview-domain>` host. That host may have no valid certificate, leaving the entire auth UI blank even though the keys themselves exist.

**How to apply:** Check Clerk management status before changing auth wiring. For an external instance, preserve its key-encoded Frontend API host and verify the external Clerk domain has valid TLS and is reachable from the browser. Keep separate development and production key pairs: production keys only work on the configured production domain, while preview needs the matching development instance keys. Server-side Clerk API clients used for user lookups must be constructed with the same environment-specific secret as the request middleware; the default client can otherwise use the production secret in preview.

**Why:** A session verified against the development instance can look valid while an admin lookup against the production instance fails the email whitelist check, producing a misleading unauthorized response.

**How to apply:** When selecting development or production Clerk keys, apply that selection consistently to both `clerkMiddleware` and any `users.getUser` or other backend API client calls.