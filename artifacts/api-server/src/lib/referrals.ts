import { createHash } from "node:crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import {
  cashbackTransactionsTable,
  customerProfilesTable,
  db,
  ordersTable,
} from "@workspace/db";

export function referralCodeFor(customerId: string): string {
  return `KTP${createHash("sha256").update(customerId).digest("hex").slice(0, 10).toUpperCase()}`;
}

const completedOrderStatuses = ["confirmed", "fulfilled"] as const;

/**
 * Repairs referral credits for completed referred orders. The status update
 * route creates these credits during the normal flow, while this reconciliation
 * also covers an order completed by an older deployment or before the referrer
 * profile was available.
 */
export async function reconcileReferralRewards(customerId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [profile] = await tx.select().from(customerProfilesTable)
      .where(eq(customerProfilesTable.customerId, customerId))
      .limit(1);
    if (!profile) return;

    const referredOrders = await tx.select().from(ordersTable)
      .where(and(
        eq(ordersTable.referralCode, profile.referralCode),
        inArray(ordersTable.status, [...completedOrderStatuses]),
        ne(ordersTable.customerId, customerId),
      ));

    for (const order of referredOrders) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`referral:first-paid:${order.customerId}`}))`);

      const [priorPaidOrder] = await tx.select({ id: ordersTable.id }).from(ordersTable)
        .where(and(
          eq(ordersTable.customerId, order.customerId),
          inArray(ordersTable.status, [...completedOrderStatuses]),
          ne(ordersTable.id, order.id),
        ))
        .limit(1);
      if (priorPaidOrder) continue;

      // A referral reward is permanently tied to the referred customer's
      // first successful purchase. Keep later orders ineligible even if the
      // original order was subsequently cancelled and its reward was voided.
      const [priorReferralReward] = await tx
        .select({ id: cashbackTransactionsTable.id })
        .from(cashbackTransactionsTable)
        .innerJoin(ordersTable, eq(ordersTable.id, cashbackTransactionsTable.orderId))
        .where(and(
          eq(cashbackTransactionsTable.type, "credit"),
          eq(cashbackTransactionsTable.source, "referral"),
          eq(ordersTable.customerId, order.customerId),
          ne(ordersTable.id, order.id),
        ))
        .limit(1);
      if (priorReferralReward) continue;

      const [existingReward] = await tx.select().from(cashbackTransactionsTable)
        .where(and(
          eq(cashbackTransactionsTable.orderId, order.id),
          eq(cashbackTransactionsTable.customerId, customerId),
          eq(cashbackTransactionsTable.type, "credit"),
          eq(cashbackTransactionsTable.source, "referral"),
        ))
        .limit(1);

      if (!existingReward) {
        await tx.insert(cashbackTransactionsTable).values({
          customerId,
          orderId: order.id,
          type: "credit",
          status: "pending",
          currency: "EGP",
          amount: "50",
          source: "referral",
        }).onConflictDoNothing({
          target: [
            cashbackTransactionsTable.orderId,
            cashbackTransactionsTable.type,
            cashbackTransactionsTable.customerId,
          ],
        });
      } else if (existingReward.status === "voided") {
        await tx.update(cashbackTransactionsTable)
          .set({ status: "pending", amount: "50", currency: "EGP", source: "referral", approvedAt: null })
          .where(eq(cashbackTransactionsTable.id, existingReward.id));
      }
    }
  });
}
