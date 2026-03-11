-- ============================================================
-- TYG POS SaaS — Migration 001
-- Core enums, tenant table, RLS bootstrap
-- ============================================================

-- ── Enable required extensions ──────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for menu search

-- ── Enums ───────────────────────────────────────────────────
CREATE TYPE plan_tier AS ENUM ('TRIAL', 'STARTER', 'BUSINESS', 'PRO', 'ENTERPRISE');
CREATE TYPE plan_status AS ENUM ('TRIAL', 'ACTIVE', 'GRACE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE order_status AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED');
CREATE TYPE payment_status AS ENUM ('UNPAID', 'PENDING_VERIFICATION', 'VERIFIED', 'FAILED', 'REFUNDED');
CREATE TYPE payment_method AS ENUM ('GCASH', 'MAYA', 'BPI', 'BDO', 'UNIONBANK', 'CASH', 'PAYMONGO', 'OTHER');
CREATE TYPE staff_role AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN');
CREATE TYPE item_status AS ENUM ('AVAILABLE', 'SOLD_OUT', 'HIDDEN');

-- ── Tenants ─────────────────────────────────────────────────
CREATE TABLE tenants (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Identity
  name                 TEXT NOT NULL,
  slug                 TEXT NOT NULL UNIQUE,                      -- subdomain: slug.tygpos.com
  owner_email          TEXT NOT NULL UNIQUE,
  owner_user_id        UUID NOT NULL,                             -- Supabase Auth user ID
  phone                TEXT,
  address              TEXT,
  timezone             TEXT NOT NULL DEFAULT 'Asia/Manila',
  currency             TEXT NOT NULL DEFAULT 'PHP',

  -- Branding
  logo_url             TEXT,
  primary_color        TEXT NOT NULL DEFAULT '#16a34a',
  accent_color         TEXT NOT NULL DEFAULT '#f59e0b',

  -- Plan
  plan_tier            plan_tier NOT NULL DEFAULT 'TRIAL',
  plan_status          plan_status NOT NULL DEFAULT 'TRIAL',
  trial_ends_at        TIMESTAMPTZ,
  plan_period_end      TIMESTAMPTZ,
  paymongo_customer_id TEXT,
  paymongo_sub_id      TEXT,

  -- Settings (JSON blob — avoids ALTER TABLE for minor settings)
  settings             JSONB NOT NULL DEFAULT '{
    "orderingEnabled": true,
    "requireCustomerName": true,
    "requireCustomerPhone": false,
    "vatEnabled": true,
    "vatRate": 0.12,
    "pwdSeniorDiscountEnabled": true,
    "receiptFooter": "Thank you for dining with us!",
    "kitchenPrintEnabled": false,
    "smsEnabled": false,
    "maxTablesPerBranch": 20
  }'::jsonb,

  -- BIR (PRO+)
  bir_tin              TEXT,
  bir_atp_series       TEXT,
  bir_or_counter       BIGINT NOT NULL DEFAULT 1,

  -- API (ENTERPRISE)
  api_key_hash         TEXT,
  webhook_url          TEXT,

  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9-]{3,50}$')
);

-- Trigger: keep updated_at fresh
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS: tenants ────────────────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Owner can read/update their own tenant row
CREATE POLICY "tenant_owner_select"
  ON tenants FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "tenant_owner_update"
  ON tenants FOR UPDATE
  USING (owner_user_id = auth.uid());

-- Service role (bypasses RLS) handles inserts during onboarding
