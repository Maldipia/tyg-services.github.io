-- ============================================================
-- TYG POS SaaS — Migration 002
-- Branches, Staff, Staff Sessions
-- ============================================================

-- ── Branches ────────────────────────────────────────────────
CREATE TABLE branches (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  name         TEXT NOT NULL,
  address      TEXT,
  phone        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INT NOT NULL DEFAULT 0
);

CREATE INDEX branches_tenant_idx ON branches(tenant_id);
CREATE TRIGGER branches_updated_at BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branches_tenant_select"
  ON branches FOR SELECT
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "branches_tenant_modify"
  ON branches FOR ALL
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    )
  );

-- ── Staff ────────────────────────────────────────────────────
CREATE TABLE staff (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id    UUID REFERENCES branches(id) ON DELETE SET NULL,  -- NULL = all branches
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  name         TEXT NOT NULL,
  display_name TEXT NOT NULL,
  pin_hash     TEXT NOT NULL,    -- bcrypt cost 12, per-user salt — NEVER bare SHA-256
  role         staff_role NOT NULL DEFAULT 'CASHIER',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  last_login   TIMESTAMPTZ,

  CONSTRAINT staff_name_tenant_unique UNIQUE (tenant_id, display_name)
);

CREATE INDEX staff_tenant_idx ON staff(tenant_id);
CREATE INDEX staff_branch_idx ON staff(branch_id);
CREATE TRIGGER staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Staff rows managed by tenant owner via service role in API routes
-- Anon/JWT access controlled purely via API — no direct Supabase client calls

-- ── Staff Sessions ───────────────────────────────────────────
-- Custom session tokens for PIN-auth (not Supabase Auth users)
CREATE TABLE staff_sessions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id     UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,    -- SHA-256 of the raw session token
  ip_address   INET,
  user_agent   TEXT,
  is_revoked   BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX staff_sessions_token_idx ON staff_sessions(token_hash);
CREATE INDEX staff_sessions_staff_idx ON staff_sessions(staff_id);
CREATE INDEX staff_sessions_tenant_idx ON staff_sessions(tenant_id);

-- TTL cleanup: sessions older than 24h auto-expire (Vercel Cron handles hard deletes)
ALTER TABLE staff_sessions ENABLE ROW LEVEL SECURITY;

-- All access via service role in API routes only
