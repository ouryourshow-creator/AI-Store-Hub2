CREATE TABLE "abandoned_carts" (
	"id" serial PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"customer_id" text,
	"customer_name" text,
	"customer_email" text,
	"customer_phone" text,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"items" jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recovered_at" timestamp with time zone,
	CONSTRAINT "abandoned_carts_cart_id_unique" UNIQUE("cart_id")
);
--> statement-breakpoint
CREATE INDEX "abandoned_carts_status_last_seen_idx" ON "abandoned_carts" USING btree ("status","last_seen_at");