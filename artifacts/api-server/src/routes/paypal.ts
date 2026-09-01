import { Router, type IRouter, type Request } from "express";
import { getAuth } from "@clerk/express";
import { and, eq, inArray } from "drizzle-orm";
import { cashbackTransactionsTable, db, ordersTable } from "@workspace/db";
import { confirmOrder } from "../lib/orderCompletion";
import { validatePayPalCapture } from "../lib/paypalValidation";

const router: IRouter = Router();
const host = () => process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const configured = () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);

async function accessToken(): Promise<string> {
  if (!configured()) throw new Error("PayPal is not configured");
  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${host()}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  if (!response.ok) throw new Error(`PayPal authentication failed (${response.status})`);
  return ((await response.json()) as { access_token: string }).access_token;
}

async function paypal(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  return fetch(`${host()}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers } });
}

function userId(req: Request) { return getAuth(req)?.userId ?? null; }
function captureFrom(payload: any) { return payload?.purchase_units?.[0]?.payments?.captures?.[0]; }

router.get("/paypal/config", (_req, res) => res.json({ available: configured(), clientId: process.env.PAYPAL_CLIENT_ID ?? null, environment: process.env.PAYPAL_ENV === "live" ? "live" : "sandbox" }));

router.post("/paypal/orders", async (req, res): Promise<void> => {
  const customerId = userId(req);
  const localOrderId = Number(req.body?.localOrderId);
  if (!customerId) { res.status(401).json({ error: "Sign in is required" }); return; }
  const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, localOrderId), eq(ordersTable.customerId, customerId))).limit(1);
  if (!order || order.status !== "awaiting_payment" || order.paymentMethod !== "paypal" || order.currency !== "USD") { res.status(409).json({ error: "Order is not eligible for PayPal" }); return; }
  if (order.paypalOrderId) { res.json({ paypalOrderId: order.paypalOrderId, localOrderId: order.id }); return; }
  const response = await paypal("/v2/checkout/orders", { method: "POST", headers: { "PayPal-Request-Id": `keytopia-create-${order.id}` }, body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ reference_id: String(order.id), custom_id: String(order.id), amount: { currency_code: "USD", value: Number(order.total).toFixed(2) } }] }) });
  const payload = await response.json() as { id?: string; message?: string };
  if (!response.ok || !payload.id) { req.log.error({ status: response.status, paypal: payload }, "PayPal create failed"); res.status(502).json({ error: "PayPal is temporarily unavailable" }); return; }
  const [claimed] = await db.update(ordersTable).set({ paypalOrderId: payload.id }).where(and(eq(ordersTable.id, order.id), eq(ordersTable.status, "awaiting_payment"))).returning();
  res.json({ paypalOrderId: claimed?.paypalOrderId ?? payload.id, localOrderId: order.id });
});

router.post("/paypal/orders/:paypalOrderId/capture", async (req, res): Promise<void> => {
  const customerId = userId(req); const id = req.params.paypalOrderId;
  if (!customerId) { res.status(401).json({ error: "Sign in is required" }); return; }
  const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.paypalOrderId, id), eq(ordersTable.customerId, customerId))).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.paypalCaptureId && ["confirmed", "fulfilled"].includes(order.status)) { res.json({ completed: true, orderId: order.id }); return; }
  if (order.status !== "awaiting_payment" || order.paymentMethod !== "paypal") { res.status(409).json({ error: "Order is not awaiting PayPal payment" }); return; }
  const response = await paypal(`/v2/checkout/orders/${encodeURIComponent(id)}/capture`, { method: "POST", headers: { "PayPal-Request-Id": `keytopia-capture-${order.id}` } });
  const payload = await response.json() as any; const capture = captureFrom(payload);
  const amount = capture?.amount;
  const integrityError = !response.ok ? "not_completed" : validatePayPalCapture({ localOrderId: order.id, ownerId: order.customerId, authenticatedUserId: customerId, orderStatus: order.status, paymentMethod: order.paymentMethod, expectedAmount: Number(order.total).toFixed(2), paypalCustomId: payload.purchase_units?.[0]?.custom_id, paypalStatus: payload.status, captureStatus: capture?.status, currency: amount?.currency_code, paidAmount: amount?.value, existingCaptureId: order.paypalCaptureId, captureId: capture?.id });
  if (integrityError) { req.log.error({ orderId: order.id, paypalOrderId: id, integrityError }, "PayPal payment integrity check failed"); res.status(409).json({ error: "Payment verification failed" }); return; }
  await confirmOrder(order.id, { paypalOrderId: id, captureId: capture.id, amount: amount.value, paidAt: new Date(capture.create_time ?? Date.now()) });
  res.json({ completed: true, orderId: order.id });
});

router.post("/paypal/webhook", async (req, res): Promise<void> => {
  if (!process.env.PAYPAL_WEBHOOK_ID) { res.status(503).end(); return; }
  const verify = await paypal("/v1/notifications/verify-webhook-signature", { method: "POST", body: JSON.stringify({ auth_algo: req.get("paypal-auth-algo"), cert_url: req.get("paypal-cert-url"), transmission_id: req.get("paypal-transmission-id"), transmission_sig: req.get("paypal-transmission-sig"), transmission_time: req.get("paypal-transmission-time"), webhook_id: process.env.PAYPAL_WEBHOOK_ID, webhook_event: req.body }) });
  const verification = await verify.json() as { verification_status?: string };
  if (!verify.ok || verification.verification_status !== "SUCCESS") { res.status(400).json({ error: "Invalid PayPal webhook signature" }); return; }
  const event = req.body as any; const capture = event.resource; const paypalOrderId = capture?.supplementary_data?.related_ids?.order_id;
  if (!paypalOrderId) { res.status(204).end(); return; }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.paypalOrderId, paypalOrderId)).limit(1);
  if (!order) { res.status(204).end(); return; }
  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED" && capture.status === "COMPLETED" && capture.amount?.currency_code === "USD" && capture.amount?.value === Number(order.total).toFixed(2)) await confirmOrder(order.id, { paypalOrderId, captureId: capture.id, amount: capture.amount.value, paidAt: new Date(capture.create_time ?? Date.now()) });
  if (["PAYMENT.CAPTURE.DENIED", "PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"].includes(event.event_type)) await db.transaction(async tx => { const [locked] = await tx.select().from(ordersTable).where(eq(ordersTable.id, order.id)).for("update"); if (!locked || locked.status === "cancelled") return; await tx.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, order.id)); await tx.update(cashbackTransactionsTable).set({ status: "voided" }).where(and(eq(cashbackTransactionsTable.orderId, order.id), eq(cashbackTransactionsTable.type, "credit"), inArray(cashbackTransactionsTable.status, ["pending", "available"]))); await tx.update(cashbackTransactionsTable).set({ status: "reversed" }).where(and(eq(cashbackTransactionsTable.orderId, order.id), eq(cashbackTransactionsTable.type, "debit"), eq(cashbackTransactionsTable.status, "redeemed"))); });
  res.status(204).end();
});

export default router;
