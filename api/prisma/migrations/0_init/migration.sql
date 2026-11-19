-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "venue" TEXT,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "banner_url" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "gate_markup_percent" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "fees" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_categories" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "early_bird_price" INTEGER,
    "early_bird_discount_percent" DECIMAL(5,2),
    "early_bird_ends_at" TIMESTAMPTZ(6),
    "early_bird_days_before" INTEGER,
    "early_bird_quota" INTEGER,
    "allow_installments" BOOLEAN NOT NULL DEFAULT false,
    "min_deposit" INTEGER NOT NULL DEFAULT 0,
    "installment_deadline" TIMESTAMPTZ(6),
    "sales_open" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "ref" TEXT NOT NULL,
    "event_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "buyer_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "subtotal" INTEGER,
    "fees_amount" INTEGER NOT NULL DEFAULT 0,
    "fee_breakdown" JSONB NOT NULL DEFAULT '[]',
    "total_amount" INTEGER NOT NULL,
    "amount_paid" INTEGER NOT NULL DEFAULT 0,
    "is_early_bird" BOOLEAN NOT NULL DEFAULT false,
    "payment_plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sale_channel" TEXT NOT NULL DEFAULT 'ONLINE',
    "gate_markup_percent" DECIMAL(5,2),
    "sold_by" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER,
    "account_ref" TEXT,
    "channel" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "phone" TEXT,
    "merchant_request_id" TEXT,
    "checkout_request_id" TEXT,
    "mpesa_receipt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result_desc" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "holder_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "checked_in_at" TIMESTAMPTZ(6),
    "checked_in_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_log" (
    "id" SERIAL NOT NULL,
    "code" TEXT,
    "ticket_id" INTEGER,
    "result" TEXT NOT NULL,
    "gate" TEXT,
    "scanned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "orders_ref_key" ON "orders"("ref");

-- CreateIndex
CREATE INDEX "orders_event_idx" ON "orders"("event_id", "status");

-- CreateIndex
CREATE INDEX "orders_phone_idx" ON "orders"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "payments_checkout_request_id_key" ON "payments"("checkout_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_mpesa_receipt_key" ON "payments"("mpesa_receipt");

-- CreateIndex
CREATE INDEX "payments_order_idx" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_code_key" ON "tickets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_order_id_seq_key" ON "tickets"("order_id", "seq");

-- AddForeignKey
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scan_log" ADD CONSTRAINT "scan_log_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;


-- Same integrity checks as v1 (Prisma doesn't model CHECK constraints)
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_price_check" CHECK ("price" >= 0);
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_capacity_check" CHECK ("capacity" >= 0);
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_early_bird_price_check" CHECK ("early_bird_price" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_quantity_check" CHECK ("quantity" BETWEEN 1 AND 20);
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_plan_check" CHECK ("payment_plan" IN ('FULL','INSTALLMENT'));
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check" CHECK ("status" IN ('PENDING','PARTIAL','PAID','EXPIRED','CANCELLED'));
ALTER TABLE "payments" ADD CONSTRAINT "payments_channel_check" CHECK ("channel" IN ('STK','C2B','MANUAL'));
ALTER TABLE "payments" ADD CONSTRAINT "payments_status_check" CHECK ("status" IN ('PENDING','SUCCESS','FAILED'));
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_status_check" CHECK ("status" IN ('VALID','CHECKED_IN','VOID'));
