-- ============================================================
-- TYG POS SaaS — Migration 005
-- Payments, Analytics materialized views
-- ============================================================

-- ── Payments ─────────────────────────────────────────────────
CREATE TABLE payments (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  method            payment_method NOT NULL,
  amount            NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reference_number  TEXT,           -- GCash/Maya ref, PayMongo payment intent ID
  proof_url         TEXT,           -- Supabase Storage path to screenshot

  status            payment_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
  verified_by       UUID REFERENCES staff(id),
  verified_at       TIMESTAMPTZ,
  failure_reason    TEXT,

  -- PayMongo automated
  paymongo_payment_intent_id TEXT,
  paymongo_payload  JSONB          -- raw webhook payload for audit
);

CREATE INDEX payments_order_idx ON payments(order_id);
CREATE INDEX payments_tenant_idx ON payments(tenant_id);
CREATE INDEX payments_status_idx ON payments(tenant_id, status);

CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_insert_anon" ON payments FOR INSERT WITH CHECK (true);
CREATE POLICY "payments_select_anon" ON payments FOR SELECT USING (true);

-- ── Daily Sales Summary (Materialized) ──────────────────────
-- Refreshed at midnight PH time via Vercel Cron
-- Excludes is_test=true orders always
CREATE MATERIALIZED VIEW daily_sales_summary AS
SELECT
  tenant_id,
  branch_id,
  DATE(created_at AT TIME ZONE 'Asia/Manila') AS sale_date,
  COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_orders,
  COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_orders,
  SUM(total_amount) FILTER (WHERE status = 'COMPLETED') AS gross_sales,
  SUM(discount_amount) FILTER (WHERE status = 'COMPLETED') AS total_discounts,
  SUM(vat_amount) FILTER (WHERE status = 'COMPLETED') AS total_vat,
  SUM(total_amount - discount_amount) FILTER (WHERE status = 'COMPLETED') AS net_sales
FROM orders
WHERE is_test = false
GROUP BY tenant_id, branch_id, DATE(created_at AT TIME ZONE 'Asia/Manila');

CREATE UNIQUE INDEX daily_sales_summary_idx
  ON daily_sales_summary (tenant_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), sale_date);

-- ── Top Items Summary (Materialized) ────────────────────────
CREATE MATERIALIZED VIEW top_items_summary AS
SELECT
  oi.tenant_id,
  oi.item_id,
  mi.name AS item_name,
  SUM(oi.qty) AS total_qty_sold,
  SUM(oi.line_total + oi.addon_total) AS total_revenue,
  DATE(o.created_at AT TIME ZONE 'Asia/Manila') AS sale_date
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN menu_items mi ON mi.id = oi.item_id
WHERE o.status = 'COMPLETED' AND o.is_test = false
GROUP BY oi.tenant_id, oi.item_id, mi.name, DATE(o.created_at AT TIME ZONE 'Asia/Manila');

CREATE UNIQUE INDEX top_items_summary_idx
  ON top_items_summary (tenant_id, item_id, sale_date);

-- ── Hourly Sales (for heatmap analytics) ────────────────────
CREATE MATERIALIZED VIEW hourly_sales_summary AS
SELECT
  tenant_id,
  branch_id,
  EXTRACT(DOW FROM created_at AT TIME ZONE 'Asia/Manila') AS day_of_week,
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Manila') AS hour_of_day,
  COUNT(*) AS order_count,
  SUM(total_amount) AS total_revenue
FROM orders
WHERE status = 'COMPLETED' AND is_test = false
GROUP BY tenant_id, branch_id,
  EXTRACT(DOW FROM created_at AT TIME ZONE 'Asia/Manila'),
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Manila');
