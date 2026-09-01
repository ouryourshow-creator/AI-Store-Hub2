# KeyTopia

## PayPal Checkout

KeyTopia uses PayPal Checkout's JavaScript SDK in the browser and the PayPal
Orders API exclusively from the Express server. Keep the environment in Sandbox
until the complete buyer flow and webhook delivery have been verified.

### Server environment

```env
PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-secret
PAYPAL_WEBHOOK_ID=your-sandbox-webhook-id
PAYPAL_ENV=sandbox
```

Only the client ID is returned by `/api/paypal/config`. Never place the secret or
webhook ID in a `VITE_` variable or commit credentials.

### Sandbox setup and testing

1. Sign in to the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/),
   create a **Sandbox** REST app, and copy its client ID and secret into the server
   environment.
2. Add a webhook for `https://YOUR_KEYTOPIA_HOST/api/paypal/webhook`. Subscribe to
   `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`,
   `PAYMENT.CAPTURE.REFUNDED`, and `PAYMENT.CAPTURE.REVERSED`; store its webhook ID
   as `PAYPAL_WEBHOOK_ID`.
3. In **Testing Tools → Sandbox Accounts**, create or use a personal buyer. Check
   out with that buyer while `PAYPAL_ENV=sandbox`, then confirm the local order is
   only confirmed after a completed capture. Also use PayPal's webhook simulator
   to verify invalid signatures are rejected and repeated events are harmless.
4. To move to production later, create a Live REST app and Live webhook, replace
   all three credentials together, and set `PAYPAL_ENV=live`. Never reuse Sandbox
   webhook IDs or partially switch an environment.
