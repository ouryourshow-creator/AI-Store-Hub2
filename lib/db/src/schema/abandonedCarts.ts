import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";

export type AbandonedCartItem = {
  productId: number;
  productName: string;
  duration: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export const abandonedCartsTable = pgTable("abandoned_carts", {
  id: serial("id").primaryKey(),
  cartKey: text("cart_key").notNull().unique(),
  visitorId: text("visitor_id").notNull(),
  customerId: text("customer_id"),
  customerEmail: text("customer_email"),
  currency: text("currency").notNull(),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  itemCount: integer("item_count").notNull(),
  items: jsonb("items").$type<AbandonedCartItem[]>().notNull(),
  status: text("status").notNull().default("active"),
  recoveredOrderId: integer("recovered_order_id").references(() => ordersTable.id, { onDelete: "set null" }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  recoveredAt: timestamp("recovered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  visitorLastSeenIdx: index("abandoned_carts_visitor_last_seen_idx").on(table.visitorId, table.lastSeenAt),
  statusLastSeenIdx: index("abandoned_carts_status_last_seen_idx").on(table.status, table.lastSeenAt),
  customerLastSeenIdx: index("abandoned_carts_customer_last_seen_idx").on(table.customerId, table.lastSeenAt),
}));

export type AbandonedCart = typeof abandonedCartsTable.$inferSelect;