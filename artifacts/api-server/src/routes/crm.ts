import { randomUUID } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import { Router, type IRouter, type Request } from "express";
import { getAuth } from "@clerk/express";
import { and, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import {
  abandonedCartsTable,
  cashbackTransactionsTable,
  customerProfilesTable,
  db,
  orderItemsTable,
  ordersTable,
  productsTable,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();
const supportedCurrencies = new Set(["EGP", "USD"]);
const completedStatuses = ["confirmed", "fulfilled"] as const;
const abandonedAfterMs = 30 * 60 * 1000;

function authUserId(req: Request): string | null {
  return getAuth(req)?.userId ?? null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function clampText(value: unknown, max: number): string {
  return asString(value).slice(0, max);
}

function mapCart(cart: typeof abandonedCartsTable.$inferSelect) {
  return {
    id: cart.id,
    visitorId: cart.cartId,
    customerId: cart.customerId,
    customerName: cart.customerName,
    customerEmail: cart.customerEmail,
    customerPhone: cart.customerPhone,
    currency: cart.currency,
    total: Number(cart.subtotal),
    itemCount: cart.itemCount,
    items: cart.items,
    status: cart.status,
    lastSeenAt: cart.lastSeenAt.toISOString(),
    recoveredAt: cart.recoveredAt?.toISOString() ?? null,
    createdAt: cart.createdAt.toISOString(),
  };
}

function safeCartItems(raw: unknown): Array<{
  productId: number;
  productName: string;
  duration: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}> {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 50).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const productId = Number(candidate.productId);
    const quantity = Math.min(99, Math.max(1, Math.floor(Number(candidate.quantity))));
    const unitPrice = Number(candidate.unitPrice);
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isFinite(unitPrice)) return [];
    return [{
      productId,
      productName: clampText(candidate.productName, 160) || `Product ${productId}`,
      duration: clampText(candidate.duration, 80),
      quantity,
      unitPrice: Math.round(unitPrice * 100) / 100,
      lineTotal: Math.round(unitPrice * quantity * 100) / 100,
    }];
  });
}

router.post("/cart/activity", async (req, res): Promise<void> => {
  const visitorId = clampText(req.body?.visitorId, 96) || `visitor-${randomUUID()}`;
  const cartKey = clampText(req.body?.cartKey, 120);
  const status = req.body?.status === "recovered" ? "recovered" : "active";
  const customerId = authUserId(req);
  if (!cartKey) {
    res.status(400).json({ error: "A cart key is required" });
    return;
  }

  if (status === "recovered") {
    const orderId = Number(req.body?.orderId);
    await db.update(abandonedCartsTable)
      .set({
        status: "recovered",
        recoveredAt: new Date(),
        lastSeenAt: new Date(),
      })
      .where(and(
        eq(abandonedCartsTable.cartId, cartKey),
        ...(customerId ? [eq(abandonedCartsTable.customerId, customerId)] : [eq(abandonedCartsTable.cartId, cartKey)]),
      ));
    res.json({ ok: true });
    return;
  }

  const items = safeCartItems(req.body?.items);
  const currency = asString(req.body?.currency);
  if (!items.length || !supportedCurrencies.has(currency)) {
    res.json({ ok: true, tracked: false });
    return;
  }
  const total = Math.round(items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
  const customerEmail = clampText(req.body?.customerEmail, 320).toLowerCase() || null;
  await db.insert(abandonedCartsTable).values({
    cartId: cartKey,
    customerId,
    customerName: null,
    customerEmail,
    customerPhone: null,
    currency,
    subtotal: String(total),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    items: items.map(({ lineTotal: _lineTotal, ...item }) => item),
    status: "open",
    lastSeenAt: new Date(),
  }).onConflictDoUpdate({
    target: abandonedCartsTable.cartId,
    set: {
      customerId,
      customerEmail,
      customerName: null,
      customerPhone: null,
      currency,
      subtotal: String(total),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      items: items.map(({ lineTotal: _lineTotal, ...item }) => item),
      status: "open",
      recoveredAt: null,
      lastSeenAt: new Date(),
    },
  });
  res.json({ ok: true, tracked: true });
});

router.get("/admin/abandoned-carts", requireAdmin, async (req, res): Promise<void> => {
  const status = asString(req.query.status, "abandoned");
  const search = clampText(req.query.search, 120);
  const cutoff = new Date(Date.now() - abandonedAfterMs);
  const conditions = [];
  if (status === "abandoned") {
    conditions.push(eq(abandonedCartsTable.status, "open"), lt(abandonedCartsTable.lastSeenAt, cutoff));
  } else if (status === "active") {
    conditions.push(eq(abandonedCartsTable.status, "open"));
  } else if (status === "recovered") {
    conditions.push(eq(abandonedCartsTable.status, "recovered"));
  }
  if (search) {
    conditions.push(or(
      ilike(abandonedCartsTable.customerEmail, `%${search}%`),
      ilike(abandonedCartsTable.cartId, `%${search}%`),
    ));
  }
  const carts = await db.select().from(abandonedCartsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(abandonedCartsTable.lastSeenAt))
    .limit(250);
  const allActive = await db.select({
    currency: abandonedCartsTable.currency,
    total: abandonedCartsTable.subtotal,
  }).from(abandonedCartsTable).where(and(
    eq(abandonedCartsTable.status, "open"),
    lt(abandonedCartsTable.lastSeenAt, cutoff),
  ));
  const recoveredCount = await db.select({ count: sql<number>`count(*)` })
    .from(abandonedCartsTable)
    .where(eq(abandonedCartsTable.status, "recovered"));
  const totals = { EGP: 0, USD: 0 };
  for (const cart of allActive) {
    if (cart.currency === "EGP" || cart.currency === "USD") totals[cart.currency] += Number(cart.total);
  }
  res.json({
    summary: {
      abandonedCount: allActive.length,
      abandonedTotal: {
        EGP: Math.round(totals.EGP * 100) / 100,
        USD: Math.round(totals.USD * 100) / 100,
      },
      recoveredCount: Number(recoveredCount[0]?.count ?? 0),
      inactivityMinutes: 30,
    },
    items: carts.map(mapCart),
  });
});

router.get("/admin/referrals", requireAdmin, async (req, res): Promise<void> => {
  const search = clampText(req.query.search, 120).toLowerCase();
  const profiles = await db.select().from(customerProfilesTable);
  const profileByCode = new Map(profiles.map((profile) => [profile.referralCode, profile]));
  const referredOrders = await db.select().from(ordersTable)
    .where(sql`${ordersTable.referralCode} IS NOT NULL`)
    .orderBy(desc(ordersTable.createdAt))
    .limit(1000);
  const referredCustomerIds = Array.from(new Set(referredOrders.map((order) => order.customerId)));
  const referredProfiles = referredCustomerIds.length
    ? await db.select().from(customerProfilesTable).where(inArray(customerProfilesTable.customerId, referredCustomerIds))
    : [];
  const referredProfileById = new Map(referredProfiles.map((profile) => [profile.customerId, profile]));
  const rewardRows = referredOrders.length
    ? await db.select().from(cashbackTransactionsTable).where(and(
      eq(cashbackTransactionsTable.source, "referral"),
      inArray(cashbackTransactionsTable.orderId, referredOrders.map((order) => order.id)),
    ))
    : [];
  const rewardByOrder = new Map(rewardRows.map((reward) => [reward.orderId, reward]));
  const items = referredOrders.flatMap((order) => {
    const referrer = order.referralCode ? profileByCode.get(order.referralCode) : undefined;
    if (!referrer || referrer.customerId === order.customerId) return [];
    const referred = referredProfileById.get(order.customerId);
    const reward = rewardByOrder.get(order.id);
    const haystack = [
      referrer.name, referrer.email, referrer.referralCode,
      referred?.name, referred?.email, order.customerName, order.customerEmail,
    ].filter(Boolean).join(" ").toLowerCase();
    if (search && !haystack.includes(search)) return [];
    return [{
      id: order.id,
      referralCode: referrer.referralCode,
      referrerId: referrer.customerId,
      referrerName: referrer.name || "Customer",
      referrerEmail: referrer.email || "",
      referredCustomerId: order.customerId,
      referredName: referred?.name || order.customerName,
      referredEmail: referred?.email || order.customerEmail,
      orderNumber: /^\d+$/.test(order.orderNumber) ? Number(order.orderNumber) : order.orderNumber,
      orderStatus: order.status,
      rewardStatus: reward?.status ?? (completedStatuses.includes(order.status as typeof completedStatuses[number]) ? "not_created" : "waiting"),
      rewardAmount: reward ? Number(reward.amount) : completedStatuses.includes(order.status as typeof completedStatuses[number]) ? 50 : 0,
      rewardCurrency: reward?.currency ?? "EGP",
      createdAt: order.createdAt.toISOString(),
    }];
  });
  const summary = {
    referredOrders: items.length,
    converted: items.filter((item) => completedStatuses.includes(item.orderStatus as typeof completedStatuses[number])).length,
    pendingRewards: items.filter((item) => item.rewardStatus === "pending").length,
    rewardedAmount: items.filter((item) => item.rewardStatus === "available" || item.rewardStatus === "redeemed")
      .reduce((sum, item) => sum + item.rewardAmount, 0),
  };
  res.json({ summary, items });
});

function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(files: Array<{ name: string; content: string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const raw = Buffer.from(file.content);
    const compressed = deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30 + name.length + compressed.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    compressed.copy(local, 30 + name.length);
    localParts.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    offset += local.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function makeWorkbook(rows: Array<Record<string, unknown>>): Buffer {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const header = `<row>${columns.map((column) => `<c t="inlineStr" s="1"><is><t>${xmlEscape(column)}</t></is></c>`).join("")}</row>`;
  const body = rows.map((row) => `<row>${columns.map((column) => {
    const value = row[column];
    if (typeof value === "number" && Number.isFinite(value)) return `<c><v>${value}</v></c>`;
    return `<c t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${header}${body}</sheetData></worksheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const workbookFileRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellXfs count="2"><xf/><xf applyFont="1" applyFill="1"><fontId>0</fontId><fillId>1</fillId></xf></cellXfs></styleSheet>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  return makeZip([
    { name: "[Content_Types].xml", content: contentTypes },
    { name: "_rels/.rels", content: workbookRels },
    { name: "xl/workbook.xml", content: workbook },
    { name: "xl/_rels/workbook.xml.rels", content: workbookFileRels },
    { name: "xl/styles.xml", content: styles },
    { name: "xl/worksheets/sheet1.xml", content: sheet },
  ]);
}

router.get("/admin/reports/:type", requireAdmin, async (req, res): Promise<void> => {
  const type = asString(req.params.type);
  const allowed = new Set(["orders", "referrals", "abandoned", "products"]);
  if (!allowed.has(type)) {
    res.status(400).json({ error: "Unsupported report type" });
    return;
  }
  const startDate = asString(req.query.startDate);
  const endDate = asString(req.query.endDate);
  const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    res.status(400).json({ error: "Invalid date range" });
    return;
  }

  let rows: Array<Record<string, unknown>> = [];
  if (type === "orders") {
    const orders = await db.select().from(ordersTable).where(and(gte(ordersTable.createdAt, start), lt(ordersTable.createdAt, new Date(end.getTime() + 1)))).orderBy(desc(ordersTable.createdAt));
    rows = orders.map((order) => ({
      orderNumber: order.orderNumber,
      customer: order.customerName,
      email: order.customerEmail,
      currency: order.currency,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      total: Number(order.total),
      status: order.status,
      promoCode: order.promoCode ?? "",
      referralCode: order.referralCode ?? "",
      createdAt: order.createdAt.toISOString(),
    }));
  } else if (type === "products") {
    const products = await db.select().from(productsTable).orderBy(desc(productsTable.soldCount));
    rows = products.map((product) => ({
      product: product.name,
      category: product.category ?? "",
      published: product.published ? "Yes" : "No",
      availability: product.availability,
      sold: product.soldCount,
      createdAt: product.createdAt.toISOString(),
    }));
  } else if (type === "abandoned") {
    const carts = await db.select().from(abandonedCartsTable).where(and(gte(abandonedCartsTable.lastSeenAt, start), lt(abandonedCartsTable.lastSeenAt, new Date(end.getTime() + 1)))).orderBy(desc(abandonedCartsTable.lastSeenAt));
    rows = carts.map((cart) => ({
      customerEmail: cart.customerEmail ?? "",
      visitorId: cart.cartId,
      currency: cart.currency,
      total: Number(cart.subtotal),
      itemCount: cart.itemCount,
      status: cart.status,
      lastSeenAt: cart.lastSeenAt.toISOString(),
    }));
  } else {
    const profiles = await db.select().from(customerProfilesTable);
    const profileByCode = new Map(profiles.map((profile) => [profile.referralCode, profile]));
    const orders = await db.select().from(ordersTable).where(and(
      gte(ordersTable.createdAt, start),
      lt(ordersTable.createdAt, new Date(end.getTime() + 1)),
      sql`${ordersTable.referralCode} IS NOT NULL`,
    )).orderBy(desc(ordersTable.createdAt));
    const rewards = orders.length ? await db.select().from(cashbackTransactionsTable).where(and(
      eq(cashbackTransactionsTable.source, "referral"),
      inArray(cashbackTransactionsTable.orderId, orders.map((order) => order.id)),
    )) : [];
    const rewardByOrder = new Map(rewards.map((reward) => [reward.orderId, reward]));
    rows = orders.map((order) => {
      const referrer = profileByCode.get(order.referralCode ?? "");
      const reward = rewardByOrder.get(order.id);
      return {
        referralCode: order.referralCode ?? "",
        referrerEmail: referrer?.email ?? "",
        referredCustomer: order.customerName,
        referredEmail: order.customerEmail,
        orderNumber: order.orderNumber,
        orderStatus: order.status,
        rewardStatus: reward?.status ?? "not_created",
        rewardAmount: reward ? Number(reward.amount) : 50,
        rewardCurrency: reward?.currency ?? "EGP",
        createdAt: order.createdAt.toISOString(),
      };
    });
  }

  const workbook = makeWorkbook(rows);
  res.status(200)
    .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .setHeader("Content-Disposition", `attachment; filename="keytopia-${type}-report.xlsx"`)
    .send(workbook);
});

export default router;