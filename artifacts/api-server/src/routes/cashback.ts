import { Router, type IRouter, type Request } from "express";
import { getAuth } from "@clerk/express";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  cashbackTransactionsTable,
  customerProfilesTable,
  db,
  ordersTable,
} from "@workspace/db";
import {
  ApproveCashbackParams,
  ApproveCashbackResponse,
  GetMyCashbackResponse,
  ListPendingCashbackResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireAdmin";
import { reconcileReferralRewards, referralCodeFor } from "../lib/referrals";

const router: IRouter = Router();
const CASHBACK_CURRENCIES = ["EGP", "USD"] as const;

function authUserId(req: Request): string | null {
  return getAuth(req)?.userId ?? null;
}

function orderNumberValue(orderNumber: string | null | undefined): string | number | null {
  if (!orderNumber) return null;
  return /^\d+$/.test(orderNumber) ? Number(orderNumber) : orderNumber;
}

function mapTransaction(
  transaction: typeof cashbackTransactionsTable.$inferSelect,
  orderNumber?: string | null,
) {
  return {
    id: transaction.id,
    orderId: transaction.orderId,
    orderNumber: orderNumberValue(orderNumber),
    type: transaction.type,
    status: transaction.status,
    currency: transaction.currency,
    amount: Number(transaction.amount),
    createdAt: transaction.createdAt.toISOString(),
    approvedAt: transaction.approvedAt?.toISOString() ?? null,
  };
}

function buildBalances(
  transactions: Array<typeof cashbackTransactionsTable.$inferSelect>,
) {
  return CASHBACK_CURRENCIES.map((currency) => {
    let pending = 0;
    let available = 0;
    for (const transaction of transactions) {
      if (transaction.currency !== currency) continue;
      const amount = Number(transaction.amount);
      if (transaction.type === "credit" && transaction.status === "pending") pending += amount;
      if (transaction.type === "credit" && transaction.status === "available") available += amount;
      if (transaction.type === "debit" && transaction.status === "redeemed") available -= amount;
    }
    return {
      currency,
      pending: Math.round(pending * 100) / 100,
      available: Math.max(0, Math.round(available * 100) / 100),
    };
  });
}

router.get("/cashback/me", async (req, res): Promise<void> => {
  const customerId = authUserId(req);
  if (!customerId) {
    res.status(401).json({ error: "Sign in is required" });
    return;
  }

  await reconcileReferralRewards(customerId);

  const rows = await db
    .select({ transaction: cashbackTransactionsTable, orderNumber: ordersTable.orderNumber })
    .from(cashbackTransactionsTable)
    .leftJoin(ordersTable, eq(ordersTable.id, cashbackTransactionsTable.orderId))
    .where(eq(cashbackTransactionsTable.customerId, customerId))
    .orderBy(desc(cashbackTransactionsTable.createdAt));
  const transactions = rows.map((row) => mapTransaction(row.transaction, row.orderNumber));
  res.json(GetMyCashbackResponse.parse({
    balances: buildBalances(rows.map((row) => row.transaction)),
    transactions,
  }));
});

router.get("/referral/me", async (req, res): Promise<void> => {
  const customerId = authUserId(req);
  if (!customerId) { res.status(401).json({ error: "Sign in is required" }); return; }
  const [profile] = await db.select().from(customerProfilesTable)
    .where(eq(customerProfilesTable.customerId, customerId)).limit(1);
  const referralCode = profile?.referralCode ?? referralCodeFor(customerId);
  if (!profile) {
    await db.insert(customerProfilesTable).values({ customerId, referralCode }).onConflictDoNothing();
  }
  await reconcileReferralRewards(customerId);
  const rewards = await db.select().from(cashbackTransactionsTable).where(and(
    eq(cashbackTransactionsTable.customerId, customerId),
    eq(cashbackTransactionsTable.source, "referral"),
    inArray(cashbackTransactionsTable.status, ["pending", "available"]),
  ));
  res.json({ referralCode, referralCount: new Set(rewards.map((reward) => reward.orderId)).size });
});

router.get("/admin/users", requireAdmin, async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
  const profiles = await db.select().from(customerProfilesTable);
  const customerIds = Array.from(new Set([...orders.map((order) => order.customerId), ...profiles.map((profile) => profile.customerId)]));
  const transactions = customerIds.length
    ? await db.select().from(cashbackTransactionsTable).where(inArray(cashbackTransactionsTable.customerId, customerIds))
    : [];
  const profileById = new Map(profiles.map((profile) => [profile.customerId, profile]));
  const latestOrderByCustomer = new Map<string, typeof ordersTable.$inferSelect>();
  const orderCountByCustomer = new Map<string, number>();
  const ledgerByCustomer = new Map<string, Array<typeof cashbackTransactionsTable.$inferSelect>>();
  for (const order of orders) {
    if (!latestOrderByCustomer.has(order.customerId)) latestOrderByCustomer.set(order.customerId, order);
    orderCountByCustomer.set(order.customerId, (orderCountByCustomer.get(order.customerId) ?? 0) + 1);
  }
  for (const transaction of transactions) {
    const ledger = ledgerByCustomer.get(transaction.customerId) ?? [];
    ledger.push(transaction); ledgerByCustomer.set(transaction.customerId, ledger);
  }
  res.json(customerIds.map((customerId) => {
    const latestOrder = latestOrderByCustomer.get(customerId);
    const ledger = ledgerByCustomer.get(customerId) ?? [];
    return {
      customerId,
      name: profileById.get(customerId)?.name ?? latestOrder?.customerName ?? "Customer",
      email: profileById.get(customerId)?.email ?? latestOrder?.customerEmail ?? "",
      referralCode: profileById.get(customerId)?.referralCode ?? null,
      balances: buildBalances(ledger),
      orderCount: orderCountByCustomer.get(customerId) ?? 0,
    };
  }));
});

router.post("/admin/users/:customerId/cashback", requireAdmin, async (req, res): Promise<void> => {
  const customerIdParam = req.params.customerId;
  const customerId = Array.isArray(customerIdParam)
    ? customerIdParam[0]
    : customerIdParam;
  const amount = Math.round(Number(req.body?.amount) * 100) / 100;
  const currency = req.body?.currency;
  const operation = req.body?.operation;
  if (!customerId || !Number.isFinite(amount) || amount <= 0 || !CASHBACK_CURRENCIES.includes(currency) || !["add", "deduct"].includes(operation)) {
    res.status(400).json({ error: "A positive amount, valid currency, and operation are required" }); return;
  }
  const transaction = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${customerId}:${currency}:cashback`}))`);
    if (operation === "deduct") {
      const ledger = await tx.select().from(cashbackTransactionsTable).where(and(
        eq(cashbackTransactionsTable.customerId, customerId),
        eq(cashbackTransactionsTable.currency, currency),
        or(
          and(eq(cashbackTransactionsTable.type, "credit"), eq(cashbackTransactionsTable.status, "available")),
          and(eq(cashbackTransactionsTable.type, "debit"), eq(cashbackTransactionsTable.status, "redeemed")),
        ),
      )).for("update");
      const available = ledger.reduce((sum, item) => sum + (item.type === "credit" ? Number(item.amount) : -Number(item.amount)), 0);
      if (amount > available + 0.001) return null;
    }
    const [created] = await tx.insert(cashbackTransactionsTable).values({
      customerId, orderId: null, type: operation === "add" ? "credit" : "debit",
      status: operation === "add" ? "available" : "redeemed", currency,
      amount: String(amount), source: "admin_adjustment", approvedAt: operation === "add" ? new Date() : null,
    }).returning();
    return created;
  });
  if (!transaction) { res.status(409).json({ error: "Adjustment exceeds the available balance" }); return; }
  res.status(201).json(mapTransaction(transaction));
});

router.get("/admin/cashback/pending", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      transaction: cashbackTransactionsTable,
      orderNumber: ordersTable.orderNumber,
      customerName: ordersTable.customerName,
      customerEmail: ordersTable.customerEmail,
    })
    .from(cashbackTransactionsTable)
    .innerJoin(ordersTable, eq(ordersTable.id, cashbackTransactionsTable.orderId))
    .where(and(
      eq(cashbackTransactionsTable.type, "credit"),
      eq(cashbackTransactionsTable.status, "pending"),
    ))
    .orderBy(desc(cashbackTransactionsTable.createdAt));

  const customerIds = Array.from(new Set(rows.map((row) => row.transaction.customerId)));
  const profiles = customerIds.length ? await db.select().from(customerProfilesTable)
    .where(inArray(customerProfilesTable.customerId, customerIds)) : [];
  const profilesById = new Map(profiles.map((profile) => [profile.customerId, profile]));
  res.json(ListPendingCashbackResponse.parse(rows.map((row) => ({
    ...mapTransaction(row.transaction, row.orderNumber),
    customerName: profilesById.get(row.transaction.customerId)?.name ?? row.customerName,
    customerEmail: profilesById.get(row.transaction.customerId)?.email ?? row.customerEmail,
  }))));
});

router.post("/admin/cashback/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const params = ApproveCashbackParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid cashback transaction" });
    return;
  }

  const approved = await db.transaction(async (tx) => {
    const [candidate] = await tx
      .select()
      .from(cashbackTransactionsTable)
      .where(eq(cashbackTransactionsTable.id, params.data.id))
      .limit(1);
    if (!candidate || candidate.orderId == null) return null;

    const [order] = await tx
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, candidate.orderId))
      .for("update");
    if (!order || !["confirmed", "fulfilled"].includes(order.status)) return null;

    const [current] = await tx
      .select()
      .from(cashbackTransactionsTable)
      .where(and(
        eq(cashbackTransactionsTable.id, params.data.id),
        eq(cashbackTransactionsTable.type, "credit"),
        eq(cashbackTransactionsTable.status, "pending"),
      ))
      .for("update");
    if (!current) return null;

    const [transaction] = await tx
      .update(cashbackTransactionsTable)
      .set({ status: "available", approvedAt: new Date() })
      .where(eq(cashbackTransactionsTable.id, current.id))
      .returning();
    const [profile] = await tx.select().from(customerProfilesTable)
      .where(eq(customerProfilesTable.customerId, transaction.customerId)).limit(1);
    return {
      ...mapTransaction(transaction, order.orderNumber),
      customerName: profile?.name ?? order.customerName,
      customerEmail: profile?.email ?? order.customerEmail,
    };
  });

  if (!approved) {
    res.status(404).json({ error: "Pending cashback transaction not found" });
    return;
  }
  res.json(ApproveCashbackResponse.parse(approved));
});

export default router;
