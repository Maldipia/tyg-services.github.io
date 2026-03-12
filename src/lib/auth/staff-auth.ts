// ============================================================
// TYG POS — Staff PIN Authentication
//
// ARCHITECTURE RULE: bcrypt cost 12 with per-user random salt.
// NEVER use bare SHA-256 for PINs — it's trivially reversible.
// ============================================================

import bcrypt from 'bcryptjs';
import { createServiceClient } from '@/lib/supabase/client';
import type { Staff, StaffSession, StaffRole } from '@/types';

const BCRYPT_COST = 12;
const SESSION_TTL_HOURS = 8; // staff sessions expire after an 8-hour shift

// ── Hash a PIN (use when creating/updating a staff member) ───
export async function hashPin(pin: string): Promise<string> {
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error('PIN must be 4–8 digits');
  }
  // bcrypt generates a unique random salt per call — no need to manage salt separately
  return bcrypt.hash(pin, BCRYPT_COST);
}

// ── Verify a PIN against stored hash ────────────────────────
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

// ── Authenticate staff by tenant + PIN ──────────────────────
// Returns the staff record on success, null on failure.
// Caller is responsible for rate-limiting before calling this.
export async function authenticateStaff(
  tenantId: string,
  displayName: string,
  pin: string
): Promise<Staff | null> {
  const db = createServiceClient();

  const { data: staff, error } = await db
    .from('staff')
    .select('*')
    .eq('tenant_id', tenantId)
    .ilike('display_name', displayName)   // case-insensitive — 'pia' matches 'Pia'
    .eq('is_active', true)
    .single();

  if (error || !staff) return null;

  const valid = await verifyPin(pin, staff.pin_hash);
  if (!valid) return null;

  // Update last_login (fire-and-forget)
  await db
    .from('staff')
    .update({ last_login: new Date().toISOString() })
    .eq('id', staff.id);

  return staff as Staff;
}

// ── Create a staff session token ────────────────────────────
// Returns the RAW token (send to client), stores only the hash.
export async function createStaffSession(
  staff: Staff,
  ipAddress: string,
  userAgent: string
): Promise<string> {
  const db = createServiceClient();
  const crypto = await import('crypto');

  // Generate 32-byte cryptographically random token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { error } = await db.from('staff_sessions').insert({
    tenant_id: staff.tenant_id,
    staff_id: staff.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  if (error) throw new Error(`Failed to create staff session: ${error.message}`);

  return rawToken;
}

// ── Validate a staff session token ──────────────────────────
// Returns full StaffSession or null if invalid/expired/revoked.
export async function validateStaffSession(rawToken: string): Promise<StaffSession | null> {
  const db = createServiceClient();
  const crypto = await import('crypto');

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const { data: session, error } = await db
    .from('staff_sessions')
    .select(`
      *,
      staff:staff_id (
        id, tenant_id, role, branch_id, display_name, is_active
      )
    `)
    .eq('token_hash', tokenHash)
    .eq('is_revoked', false)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !session || !session.staff) return null;
  const staffData = session.staff as {
    id: string;
    tenant_id: string;
    role: StaffRole;
    branch_id: string | null;
    display_name: string;
    is_active: boolean;
  };
  if (!staffData.is_active) return null;

  return {
    staffId: staffData.id,
    tenantId: staffData.tenant_id,
    role: staffData.role,
    branchId: staffData.branch_id,
    displayName: staffData.display_name,
    expiresAt: session.expires_at as string,
  };
}

// ── Revoke a session (logout or force-logout from dashboard) ─
export async function revokeStaffSession(rawToken: string): Promise<void> {
  const db = createServiceClient();
  const crypto = await import('crypto');

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await db
    .from('staff_sessions')
    .update({ is_revoked: true })
    .eq('token_hash', tokenHash);
}

// ── Revoke all sessions for a staff member (role change, deactivate) ─
export async function revokeAllStaffSessions(staffId: string): Promise<void> {
  const db = createServiceClient();
  await db
    .from('staff_sessions')
    .update({ is_revoked: true })
    .eq('staff_id', staffId);
}
