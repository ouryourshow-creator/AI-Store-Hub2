ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paypal_order_id" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paypal_capture_id" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paypal_paid_amount" numeric(12,2);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone;
CREATE UNIQUE INDEX IF NOT EXISTS "orders_paypal_order_id_unique" ON "orders" ("paypal_order_id") WHERE "paypal_order_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "orders_paypal_capture_id_unique" ON "orders" ("paypal_capture_id") WHERE "paypal_capture_id" IS NOT NULL;
