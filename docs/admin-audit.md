# Keytopia admin architecture audit

## Current architecture

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, Wouter, TanStack Query and Recharts. The existing production admin is the single `/admin` page; its tabs are component state rather than duplicate routes.
- **Backend:** Express with typed OpenAPI/Zod contracts and Drizzle ORM. The API server also serves the production SPA.
- **Data:** Neon PostgreSQL. Orders and rewards use `NUMERIC(12,2)`; API mapping converts values to numbers for presentation. Orders, items, customer profiles, cashback transactions, promo codes, products, categories, reviews, visits and settings already exist and must be reused.
- **Authentication:** Clerk middleware authenticates requests. Admin endpoints use `requireAdmin`, which verifies a Clerk user's verified email against `ADMIN_EMAILS`. The client `/api/admin/me` check is only a UX gate; authorization remains server-side.

## Existing behavior and relationships

- An order belongs to a Clerk customer id and has order items, an idempotency key, a coupon snapshot, payment method and one of the existing workflow states (`awaiting_payment`, `payment_proof_received`, `confirmed`, `fulfilled`, `cancelled`).
- Checkout recalculates product prices and discounts on the server. Order insertion, cashback reservation and customer-profile upsert run in a database transaction.
- Cashback is an append-only transaction ledger. Its unique order/type/customer constraint and advisory locks protect rewards and redemptions from duplication.
- Referral rewards reuse cashback transactions with `source=referral`; reconciliation uses a transaction, advisory lock and existing-reward checks.
- Coupon use is currently represented by the immutable promo-code snapshot and discount stored on each order; there is no parallel coupon-usage table.
- Visitor tracking records a pseudonymous visitor id, path, optional product and country. It does not currently record checkout/cart funnel events.
- Cart contents remain client-side until checkout, so reliable abandoned-cart reporting requires a deliberately designed persistence migration rather than inferred or fabricated records.

## Risks and incremental plan

1. Preserve `/admin`, all existing management actions and API contracts while replacing only the horizontal navigation shell.
2. Keep legacy workflow statuses in storage until a separately tested migration maps them to the requested three business statuses; changing labels alone could trigger or hide reward behavior.
3. Introduce shared date-range semantics before expanding analytics, with an explicit Egypt business timezone decision. Current analytics uses UTC day boundaries.
4. Add server pagination/search before CRM growth; the current users and orders screens download complete result sets.
5. Add only necessary tables in later migrations: customer notes and persisted cart activity/recovery. Extend the cashback ledger with a reason field before exposing additional manual corrections.
6. Build XLSX exports server-side from filtered aggregate queries; do not expose Clerk ids or authentication metadata by default.

