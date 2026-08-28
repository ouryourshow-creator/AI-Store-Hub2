CREATE SEQUENCE "public"."order_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1;--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"category" text,
	"brand" text,
	"cover_image_url" text,
	"price" numeric(10, 2) NOT NULL,
	"sale_price" numeric(10, 2),
	"pricing_options" jsonb,
	"price_usd" numeric(10, 2),
	"sale_price_usd" numeric(10, 2),
	"duration" text NOT NULL,
	"delivery_time" text,
	"activation_type" text,
	"on_customer_account" boolean DEFAULT false,
	"invitation_link" text,
	"license_key" text,
	"shared_account" boolean DEFAULT false,
	"description" text,
	"features" text[],
	"warranty_duration" text,
	"customer_info_required" text[],
	"after_purchase_instructions" text,
	"sold_count" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"availability" text DEFAULT 'in_stock' NOT NULL,
	"badges" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"percentage" integer NOT NULL,
	"applicable_product_ids" integer[],
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "analytics_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"path" text NOT NULL,
	"product_id" integer,
	"country_code" text DEFAULT 'UNKNOWN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"cover_image_url" text,
	"duration" text NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"line_total" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"customer_id" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"promo_code" text,
	"payment_method" text,
	"referral_code" text,
	"status" text DEFAULT 'awaiting_payment' NOT NULL,
	"counted_as_sold" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "orders_customer_idempotency_key_unique" UNIQUE("customer_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "cashback_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"order_id" integer,
	"type" text DEFAULT 'credit' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"source" text DEFAULT 'purchase' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	CONSTRAINT "cashback_transactions_order_type_customer_unique" UNIQUE("order_id","type","customer_id")
);
--> statement-breakpoint
CREATE TABLE "customer_profiles" (
	"customer_id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"referral_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_profiles_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"reviewer_name" text NOT NULL,
	"review_date" date NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashback_transactions" ADD CONSTRAINT "cashback_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_visits_created_idx" ON "analytics_visits" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analytics_visits_product_created_idx" ON "analytics_visits" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_visits_country_created_idx" ON "analytics_visits" USING btree ("country_code","created_at");--> statement-breakpoint
CREATE INDEX "orders_customer_created_idx" ON "orders" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_status_created_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reviews_review_date_idx" ON "reviews" USING btree ("review_date");