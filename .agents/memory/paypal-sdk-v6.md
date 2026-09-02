---
name: PayPal JavaScript SDK v6
description: PayPal v6 checkout and card-field integration constraints verified against current SDK documentation.
---

PayPal JavaScript SDK v6 uses the core Web SDK URL and payment sessions instead of the legacy `sdk/js` loader, `Buttons`, or `CardFields` APIs. The current Card Fields API hosts number, expiry, and CVV components; cardholder name is supplied through the session submit options rather than a hosted name component. Standalone guest card checkout uses the basic-card custom element and the guest payment session.

**Why:** The v5 and v6 APIs expose similar concepts with different initialization, eligibility, callback, and component contracts; mixing them causes checkout controls to appear unavailable or fail at runtime.

**How to apply:** Load v6 components explicitly, check `findEligibleMethods` for `paypal`, `advanced_cards`, and `card`, return `{ orderId }` from the frontend order callback, and keep order creation/capture and secrets on the backend.