import { Router, type IRouter } from "express";
import { desc, eq, lt } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { abandonedCartsTable, db } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();
const currencies = new Set(["EGP", "USD"]);

function validCartId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{12,100}$/.test(value);
}

function mapCart(cart: typeof abandonedCartsTable.$inferSelect) {
  return {
    id: cart.id,
    cartId: cart.cartId,
    customerId: cart.customerId,
    customerName: cart.customerName,
    customerEmail: cart.customerEmail,
    customerPhone: cart.customerPhone,
    currency: cart.currency,
    subtotal: Number(cart.subtotal),
    itemCount: cart.itemCount,
    items: cart.items,
    status: cart.status,
    lastSeenAt: cart.lastSeenAt.toISOString(),
    createdAt: cart.createdAt.toISOString(),
    recoveredAt: cart.recoveredAt?.toISOString() ?? null,
  };
}

router.post("/cart-abandonment", async (req, res): Promise<void> => {
  const body = req.body as {
    cartId?: unknown;
    currency?: unknown;
    subtotal?: unknown;
    itemCount?: unknown;
    items?: unknown;
  };
  const subtotal = Number(body.subtotal);
  const itemCount = Number(body.itemCount);
  if (
    !validCartId(body.cartId)
    || typeof body.currency !== "string"
    || !currencies.has(body.currency)
    || !Number.isFinite(subtotal)
    || subtotal < 0
    || !Number.isInteger(itemCount)
    || itemCount < 1
    || itemCount > 100
    || !Array.isArray(body.items)
    || body.items.length < 1
    || body.items.length > 50
  ) {
    res.status(400).json({ error: "A valid cart snapshot is required" });
    return;
  }

  const items = body.items
    .map((item) => {
      const candidate = item as Record<string, unknown>;
      const productId = Number(candidate.productId);
      const quantity = Number(candidate.quantity);
      const unitPrice = Number(candidate.unitPrice);
      if (
        !Number.isInteger(productId)
        || productId <= 0
        || typeof candidate.productName !== "string"
        || !candidate.productName.trim()
        || typeof candidate.duration !== "string"
        || !candidate.duration.trim()
        || !Number.isInteger(quantity)
        || quantity < 1
        || quantity > 100
        || !Number.isFinite(unitPrice)
        || unitPrice < 0
      ) return null;
      return {
        productId,
        productName: candidate.productName.trim().slice(0, 200),
        duration: candidate.duration.trim().slice(0, 100),
        quantity,
        unitPrice: Math.round(unitPrice * 100) / 100,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (items.length !== body.items.length) {
    res.status(400).json({ error: "The cart contains an invalid item" });
    return;
  }

  const customerId = getAuth(req)?.userId ?? null;
  const [cart] = await db
    .insert(abandonedCartsTable)
    .values({
      cartId: body.cartId,
      customerId,
      currency: body.currency,
      subtotal: String(Math.round(subtotal * 100) / 100),
      itemCount,
      items,
      status: "open",
      lastSeenAt: new Date(),
      recoveredAt: null,
    })
    .onConflictDoUpdate({
      target: abandonedCartsTable.cartId,
      set: {
        customerId,
        currency: body.currency,
        subtotal: String(Math.round(subtotal * 100) / 100),
        itemCount,
        items,
        status: "open",
        lastSeenAt: new Date(),
        recoveredAt: null,
      },
    })
    .returning();

  res.status(200).json(mapCart(cart));
});

router.post("/cart-abandonment/:cartId/recover", async (req, res): Promise<void> => {
  const cartIdParam = req.params.cartId;
  const cartId = Array.isArray(cartIdParam) ? cartIdParam[0] : cartIdParam;
  if (!validCartId(cartId)) {
    res.status(400).json({ error: "Invalid cart id" });
    return;
  }

  const [cart] = await db
    .update(abandonedCartsTable)
    .set({ status: "recovered", recoveredAt: new Date(), lastSeenAt: new Date() })
    .where(eq(abandonedCartsTable.cartId, cartId))
    .returning();
  res.json({ ok: Boolean(cart) });
});

router.get("/admin/abandoned-carts", requireAdmin, async (_req, res): Promise<void> => {
  const inactiveBefore = new Date(Date.now() - 60 * 60 * 1000);
  const carts = await db
    .select()
    .from(abandonedCartsTable)
    .where(lt(abandonedCartsTable.lastSeenAt, inactiveBefore))
    .orderBy(desc(abandonedCartsTable.lastSeenAt))
    .limit(200);
  res.json(carts.filter((cart) => cart.status === "open").map(mapCart));
});

export default router;