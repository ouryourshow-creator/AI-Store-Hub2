import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { cashbackTransactionsTable, customerProfilesTable, db, orderItemsTable, ordersTable, productsTable } from "@workspace/db";

/** The single idempotent confirmed-order transition used by admins and payment providers. */
export async function confirmOrder(orderId: number, payment?: { paypalOrderId: string; captureId: string; amount: string; paidAt: Date }) {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(ordersTable).where(eq(ordersTable.id, orderId)).for("update");
    if (!current) return null;
    if (payment && current.paypalCaptureId && current.paypalCaptureId !== payment.captureId) throw new Error("Order was paid by a different capture");
    const items = await tx.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
    const firstCompletion = !["confirmed", "fulfilled"].includes(current.status);
    const shouldCount = !current.countedAsSold;
    const [order] = await tx.update(ordersTable).set({
      status: "confirmed", countedAsSold: true,
      ...(payment ? { paypalOrderId: payment.paypalOrderId, paypalCaptureId: payment.captureId, paypalPaidAmount: payment.amount, paidAt: payment.paidAt } : {}),
    }).where(eq(ordersTable.id, orderId)).returning();
    if (shouldCount) for (const item of items) await tx.update(productsTable)
      .set({ soldCount: sql`${productsTable.soldCount} + ${item.quantity}` }).where(eq(productsTable.id, item.productId));
    if (Number(order.total) > 0) {
      await tx.insert(cashbackTransactionsTable).values({ customerId: order.customerId, orderId, type: "credit", status: "pending", currency: order.currency, amount: String(Math.round(Number(order.total) * 5) / 100), source: "purchase" })
        .onConflictDoNothing({ target: [cashbackTransactionsTable.orderId, cashbackTransactionsTable.type, cashbackTransactionsTable.customerId] });
      if (order.referralCode) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`referral:first-paid:${order.customerId}`}))`);
        const [referrer] = await tx.select().from(customerProfilesTable).where(eq(customerProfilesTable.referralCode, order.referralCode)).limit(1);
        const [prior] = await tx.select({ id: ordersTable.id }).from(ordersTable).where(and(eq(ordersTable.customerId, order.customerId), inArray(ordersTable.status, ["confirmed", "fulfilled"]), ne(ordersTable.id, orderId))).limit(1);
        if (referrer && referrer.customerId !== order.customerId && !prior) await tx.insert(cashbackTransactionsTable).values({ customerId: referrer.customerId, orderId, type: "credit", status: "pending", currency: "EGP", amount: "50", source: "referral" })
          .onConflictDoNothing({ target: [cashbackTransactionsTable.orderId, cashbackTransactionsTable.type, cashbackTransactionsTable.customerId] });
      }
    }
    return { order, items, firstCompletion };
  });
}
