-- ============================================================
-- TYG POS SaaS — Migration 006
-- Analytics refresh procedure + Realtime enable
-- ============================================================

-- ── Refresh all analytics materialized views ─────────────────
-- Called by Vercel Cron at midnight PH time
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY top_items_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY hourly_sales_summary;
END; $$;

-- ── Enable Supabase Realtime on key tables ───────────────────
-- These tables use LISTEN/NOTIFY — never polling
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;

-- ── Utility: Check if tenant ordering is blocked ─────────────
CREATE OR REPLACE FUNCTION is_tenant_ordering_allowed(p_tenant_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_plan_status TEXT;
  v_trial_ends TIMESTAMPTZ;
  v_ordering_enabled BOOLEAN;
BEGIN
  SELECT plan_status, trial_ends_at,
    (settings->>'orderingEnabled')::boolean
  INTO v_plan_status, v_trial_ends, v_ordering_enabled
  FROM tenants
  WHERE id = p_tenant_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF NOT COALESCE(v_ordering_enabled, true) THEN RETURN FALSE; END IF;
  IF v_plan_status IN ('SUSPENDED', 'CANCELLED') THEN RETURN FALSE; END IF;
  IF v_plan_status = 'TRIAL' AND v_trial_ends < NOW() THEN RETURN FALSE; END IF;

  RETURN TRUE;
END; $$;

-- ── Index: improve QR token lookups ─────────────────────────
CREATE INDEX IF NOT EXISTS orders_table_status_idx
  ON orders(table_id, status)
  WHERE status NOT IN ('COMPLETED', 'CANCELLED');

-- ── Trigger: auto-update orders.subtotal_override ────────────
-- When order items are inserted, recalculate order totals
CREATE OR REPLACE FUNCTION recalculate_order_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_subtotal NUMERIC(10,2);
  v_vat_rate NUMERIC(5,4);
  v_vat_enabled BOOLEAN;
  v_vat_amount NUMERIC(10,2);
BEGIN
  -- Sum all line items for this order
  SELECT COALESCE(SUM(line_total + addon_total * qty), 0)
  INTO v_subtotal
  FROM order_items
  WHERE order_id = COALESCE(NEW.order_id, OLD.order_id);

  -- Get VAT settings for this tenant
  SELECT
    (settings->>'vatEnabled')::boolean,
    (settings->>'vatRate')::numeric
  INTO v_vat_enabled, v_vat_rate
  FROM tenants t
  JOIN orders o ON o.tenant_id = t.id
  WHERE o.id = COALESCE(NEW.order_id, OLD.order_id);

  v_vat_amount := CASE WHEN v_vat_enabled THEN
    ROUND(v_subtotal * COALESCE(v_vat_rate, 0.12), 2)
  ELSE 0 END;

  UPDATE orders
  SET
    subtotal_override = v_subtotal,
    vat_amount = v_vat_amount,
    total_amount = v_subtotal + v_vat_amount
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);

  RETURN NEW;
END; $$;

CREATE TRIGGER order_items_recalculate
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION recalculate_order_totals();
