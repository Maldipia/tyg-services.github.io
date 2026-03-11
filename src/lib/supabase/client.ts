// ============================================================
// TYG POS — Supabase Clients
//
// SERVER client (service role) — bypasses RLS
//   → Only used inside /api/** route handlers
//   → NEVER import in components or client code
//
// BROWSER client (anon key) — respects RLS
//   → Used in client components and public pages
// ============================================================

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

// ── Server (Service Role) ────────────────────────────────────
// CRITICAL: Never expose this to the client bundle.
// Import only from server-side API route files.
export function createServiceClient(): SupabaseClient {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set — server-only operation');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ── Browser (Anon Key) ───────────────────────────────────────
// Safe to use in client components. Respects RLS policies.
let browserClient: SupabaseClient | null = null;

export function createBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;
  browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return browserClient;
}

// ── Supabase Storage Helpers ─────────────────────────────────
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = createBrowserClient().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export function getStoragePath(tenantId: string, folder: string, fileName: string): string {
  return `${tenantId}/${folder}/${fileName}`;
}
