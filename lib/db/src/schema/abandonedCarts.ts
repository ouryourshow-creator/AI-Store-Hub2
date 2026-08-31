import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export type AbandonedCartItem = {
  productId: number;
  productName: string;
  duration: string;
  quantity: number;
  unitPrice: number;
};

export const abandonedCartsTable = pgTable("abandoned_carts", {
  id: serial("id").primaryKey(),
  cartId: text("cart_id").notNull(),
  customerId: text("customer_id"),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  currency: text("currency").notNull().default("EGP"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  itemCount: integer("item_count").notNull().default(0),
  items: jsonb("items").$type<AbandonedCartItem[]>().notNull(),
  status: text("status").notNull().default("open"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  recoveredAt: timestamp("recovered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  cartIdUnique: unique("abandoned_carts_cart_id_unique").on(table.cartId),
  statusLastSeenIdx: index("abandoned_carts_status_last_seen_idx").on(table.status, table.lastSeenAt),
}));

export type AbandonedCart = typeof abandonedCartsTable.$inferSelect;