-- ============================================================
-- TYG POS SaaS — Migration 004
-- Orders, Order Items (GENERATED line_total), Order Events
-- ============================================================

-- ── Orders ───────────────────────────────────────────────────
CREATE TABLE orders (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id        UUID REFERENCES branches(id) ON DELETE RESTRICT,
  table_id         UUID REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Human-readable order number (per-tenant sequential, e.g. YGC-0042)
  order_number     TEXT NOT NULL,

  -- Customer info
  customer_name    TEXT NOT NULL,
  customer_phone   TEXT,
  customer_email   TEXT,
  pax              INT NOT NULL DEFAULT 1 CHECK (pax > 0),

  -- Status
  status           order_status NOT NULL DEFAULT 'PENDING',
  payment_status   payment_status NOT NULL DEFAULT 'UNPAID',

  -- Pricing (server-computed — NEVER from client)
  subtotal         NUMERIC(10,2) GENERATED ALWAYS AS (subtotal_override) STORED,
  subtotal_override NUMERIC(10,2) NOT NULL DEFAULT 0,  -- updated by API after pricing
  discount_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_type    TEXT,     -- 'PWD', 'SENIOR', 'PROMO', etc.
  vat_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- BIR (PRO+)
  or_number        TEXT,      -- Official Receipt number
  bir_printed      BOOLEAN NOT NULL DEFAULT false,

  -- Staff handling
  handled_by       UUID REFERENCES staff(id),

  -- Metadata
  notes            TEXT,      -- customer special requests
  is_test          BOOLEAN NOT NULL DEFAULT false,
  cancel_reason    TEXT,
  cancel_note      TEXT,      -- free text for "Other"

  CONSTRAINT order_number_tenant_unique UNIQUE (tenant_id, order_number)
);

CREATE INDEX orders_tenant_idx ON orders(tenant_id);
CREATE INDEX orders_status_idx ON orders(tenant_id, status);
CREATE INDEX orders_payment_status_idx ON orders(tenant_id, payment_status);
CREATE INDEX orders_created_at_idx ON orders(tenant_id, created_at DESC);
CREATE INDEX orders_table_idx ON orders(table_id);
CREATE INDEX orders_is_test_idx ON orders(tenant_id, is_test);

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- Customers create orders via anon key (tenant_id validated by API, not client)
CREATE POLICY "orders_insert_anon" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_select_anon" ON orders FOR SELECT USING (true);
-- Only service role updates orders (via API routes)

-- ── Order Items ──────────────────────────────────────────────
CREATE TABLE order_items (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id      UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  size_id      UUID REFERENCES menu_item_sizes(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  item_name    TEXT NOT NULL,   -- snapshot at order time (item name may change later)
  size_label   TEXT,            -- snapshot
  unit_price   NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),  -- server-fetched from DB
  qty          INT NOT NULL CHECK (qty > 0),
  -- GENERATED COLUMN — Postgres computes this. NEVER insert line_total explicitly.
  line_total   NUMERIC(10,2) GENERATED ALWAYS AS (unit_price * qty) STORED,
  addons       JSONB NOT NULL DEFAULT '[]',  -- [{label, price}]
  addon_total  NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes        TEXT
);

CREATE INDEX order_items_order_idx ON order_items(order_id);
CREATE INDEX order_items_tenant_idx ON order_items(tenant_id);
CREATE INDEX order_items_item_idx ON order_items(item_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_insert_anon" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "order_items_select_anon" ON order_items FOR SELECT USING (true);

-- ── Order Events (Audit Trail) ───────────────────────────────
CREATE TABLE order_events (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  event_type   TEXT NOT NULL,        -- 'status_change', 'payment_update', 'note_added', etc.
  from_status  order_status,
  to_status    order_status,
  from_payment payment_status,
  to_payment   payment_status,
  staff_id     UUID REFERENCES staff(id),
  metadata     JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX order_events_order_idx ON order_events(order_id);
CREATE INDEX order_events_tenant_idx ON order_events(tenant_id);

ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_events_insert_anon" ON order_events FOR INSERT WITH CHECK (true);
CREATE POLICY "order_events_select_anon" ON order_events FOR SELECT USING (true);

-- ── Order Number Sequence Function ───────────────────────────
-- Generates tenant-scoped sequential numbers like "YGC-0042"
CREATE OR REPLACE FUNCTION next_order_number(p_tenant_id UUID, p_prefix TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  next_seq BIGINT;
BEGIN
  -- Atomic counter per tenant using a dedicated sequence table
  INSERT INTO order_sequences (tenant_id, last_seq)
  VALUES (p_tenant_id, 1)
  ON CONFLICT (tenant_id) DO UPDATE
    SET last_seq = order_sequences.last_seq + 1
  RETURNING last_seq INTO next_seq;

  RETURN p_prefix || '-' || LPAD(next_seq::TEXT, 4, '0');
END; $$;

CREATE TABLE order_sequences (
  tenant_id  UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  last_seq   BIGINT NOT NULL DEFAULT 0
);
ALTER TABLE order_sequences ENABLE ROW LEVEL SECURITY;
