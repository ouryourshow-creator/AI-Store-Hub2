# Keytopia mobile storefront audit

## Existing responsive architecture

- The storefront is one React 19/Vite application using Tailwind's mobile-first utilities. `Layout` is shared by the home, product, checkout, orders, about and policy routes; Clerk continues to own authentication and `CartContext` owns the browser cart.
- Products, categories and reviews already come from the existing API. Product URLs use stable slugs, product-view analytics are already recorded, and checkout revalidates prices before using the existing order API.
- The homepage marquee already uses request-animation-frame movement, three repeated sequences, pointer interaction pausing, automatic resume and `prefers-reduced-motion` support. It can be adapted rather than replaced.

## Mobile usability findings

1. The header is 80px tall and followed by a second horizontally scrolling navigation row. Language, currency, cart and a text account button compete for limited width.
2. Homepage search appears after the hero, trust row, statistics and marquee. The hero consumes substantial first-screen space and loads twelve continuously animated decorative images.
3. The statistics section includes hard-coded customer, product and business-age claims. Only sold count, product count and managed review count are reliably available.
4. Two product cards per 320px row produce very small names, prices and buttons. Discount and cashback benefits are hidden on mobile.
5. Product pages show a large square image before price and purchase details; essential activation/account/warranty facts are scattered below the purchase card.
6. The full-width WhatsApp pill floats over content and can conflict with drawers or bottom actions. Cart quantity controls are below the recommended touch size.
7. Checkout and account screens already collapse to one column and reuse secure business logic, but benefit from the shared compact shell and safe-area spacing rather than parallel mobile implementations.

## Incremental redesign plan and risks

1. Upgrade only the shared storefront shell on small screens: compact header, accessible drawer, bottom navigation and safe-area spacing. Preserve the desktop header and public routes.
2. Move search and real trust proof above discovery content; shorten the mobile hero and preserve the existing marquee mechanics with phone-appropriate card width.
3. Make cards readable at one card plus a partial next card in carousels and one/two adaptive columns in the grid; expose discount and calculated 5% cashback without changing reward logic.
4. Reorder the product-page mobile hierarchy, add compact facts and a safe-area sticky purchase bar wired to the existing `handleAddToCart` function.
5. Tighten cart controls and summary while retaining revalidation, Clerk redirects, currencies, checkout and order creation.
6. Avoid schema/API changes in this phase. Review image derivatives and route-level code splitting separately because changing media delivery or bundling is higher risk than responsive UI work.

