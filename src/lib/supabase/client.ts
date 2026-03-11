// ============================================================
// TYG POS — Supabase Clients
// FIX: Moved env var validation inside functions (lazy check)
// so Next.js build doesn't crash when env vars aren't set yet.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Server (Service Role) ────────────────────────────────────
// CRITICAL: Never expose this to the client bundle.
// Import only from server-side API route files.
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set — server-only operation');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Browser (Anon Key) ───────────────────────────────────────
// Safe to use in client components. Respects RLS policies.
let browserClient: SupabaseClient | null = null;

export function createBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // During SSR/build with missing env vars, return a no-op client
    // The real client is created client-side where env vars are available
    if (typeof window === 'undefined') {
      return createClient('https://placeholder.supabase.co', 'placeholder') as SupabaseClient;
    }
    throw new Error('Missing Supabase environment variables');
  }
  if (browserClient) return browserClient;
  browserClient = createClient(url, key, {
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
