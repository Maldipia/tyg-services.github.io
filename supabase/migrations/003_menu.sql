-- ============================================================
-- TYG POS SaaS — Migration 003
-- Menu Tables: categories, items, sizes, addons
-- ============================================================

-- ── Menu Categories ─────────────────────────────────────────
CREATE TABLE menu_categories (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id    UUID REFERENCES branches(id) ON DELETE CASCADE,  -- NULL = all branches
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  name         TEXT NOT NULL,
  description  TEXT,
  image_url    TEXT,
  sort_order   INT NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT category_name_tenant_unique UNIQUE (tenant_id, branch_id, name)
);

CREATE INDEX menu_categories_tenant_idx ON menu_categories(tenant_id);
CREATE INDEX menu_categories_branch_idx ON menu_categories(branch_id);
CREATE TRIGGER menu_categories_updated_at BEFORE UPDATE ON menu_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
-- Public SELECT (customers viewing menu via QR — tenant_id passed as param)
CREATE POLICY "menu_categories_public_select"
  ON menu_categories FOR SELECT USING (true);

CREATE POLICY "menu_categories_owner_modify"
  ON menu_categories FOR ALL
  USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );

-- ── Menu Items ───────────────────────────────────────────────
CREATE TABLE menu_items (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id     UUID NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
  branch_id       UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  name            TEXT NOT NULL,
  description     TEXT,
  image_url       TEXT,
  base_price      NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  status          item_status NOT NULL DEFAULT 'AVAILABLE',
  sort_order      INT NOT NULL DEFAULT 0,
  is_featured     BOOLEAN NOT NULL DEFAULT false,
  tags            TEXT[] NOT NULL DEFAULT '{}',  -- e.g. ['bestseller', 'spicy']

  -- Nutritional / compliance metadata (optional)
  metadata        JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX menu_items_tenant_idx ON menu_items(tenant_id);
CREATE INDEX menu_items_category_idx ON menu_items(category_id);
CREATE INDEX menu_items_status_idx ON menu_items(status);
CREATE INDEX menu_items_name_search ON menu_items USING GIN (name gin_trgm_ops);
CREATE TRIGGER menu_items_updated_at BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu_items_public_select" ON menu_items FOR SELECT USING (true);
CREATE POLICY "menu_items_owner_modify" ON menu_items FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid()));

-- ── Menu Item Sizes ──────────────────────────────────────────
-- e.g. Small ₱89, Medium ₱109, Large ₱129
CREATE TABLE menu_item_sizes (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id      UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  label        TEXT NOT NULL,                    -- "Small", "Medium", "Large", "Solo", "Sharing"
  price        NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  sort_order   INT NOT NULL DEFAULT 0,
  is_default   BOOLEAN NOT NULL DEFAULT false,
  is_available BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX menu_sizes_item_idx ON menu_item_sizes(item_id);
CREATE INDEX menu_sizes_tenant_idx ON menu_item_sizes(tenant_id);

ALTER TABLE menu_item_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu_sizes_public_select" ON menu_item_sizes FOR SELECT USING (true);
CREATE POLICY "menu_sizes_owner_modify" ON menu_item_sizes FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid()));

-- ── Menu Item Addons ─────────────────────────────────────────
-- e.g. Extra Shot +₱30, No Sugar, Extra Spicy
CREATE TABLE menu_item_addons (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id      UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  label        TEXT NOT NULL,
  price        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  sort_order   INT NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX menu_addons_item_idx ON menu_item_addons(item_id);
CREATE INDEX menu_addons_tenant_idx ON menu_item_addons(tenant_id);

ALTER TABLE menu_item_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu_addons_public_select" ON menu_item_addons FOR SELECT USING (true);
CREATE POLICY "menu_addons_owner_modify" ON menu_item_addons FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid()));

-- ── Tables / QR Codes ────────────────────────────────────────
CREATE TABLE restaurant_tables (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id    UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  label        TEXT NOT NULL,              -- "Table 1", "Counter", "Garden A"
  qr_token     TEXT NOT NULL UNIQUE,       -- random 12-char token in QR URL
  capacity     INT NOT NULL DEFAULT 4,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INT NOT NULL DEFAULT 0,

  CONSTRAINT table_label_tenant_unique UNIQUE (tenant_id, branch_id, label)
);

CREATE INDEX tables_tenant_idx ON restaurant_tables(tenant_id);
CREATE INDEX tables_qr_token_idx ON restaurant_tables(qr_token);
CREATE TRIGGER tables_updated_at BEFORE UPDATE ON restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tables_public_select" ON restaurant_tables FOR SELECT USING (true);
CREATE POLICY "tables_owner_modify" ON restaurant_tables FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid()));
