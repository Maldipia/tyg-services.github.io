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

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing environment variable: ${key}`);
  return val;
}

// ── Server (Service Role) ────────────────────────────────────
export function createServiceClient(): SupabaseClient {
  return createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Browser (Anon Key) ───────────────────────────────────────
let browserClient: SupabaseClient | null = null;

export function createBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Return a placeholder during SSR without env vars (replaced at runtime in browser)
  if (!url || !anonKey) {
    return createClient('https://placeholder.supabase.co', 'placeholder', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  browserClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
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
