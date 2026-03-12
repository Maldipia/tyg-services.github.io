export const dynamic = 'force-dynamic';

// ============================================================
// TYG POS — GET /api/payments
// Returns payments for the tenant. Requires staff auth.
// Uses service client — bypasses RLS safely server-side.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';

export function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'PENDING_VERIFICATION' | 'VERIFIED' | 'FAILED' | null
    const limit  = Math.min(parseInt(searchParams.get('limit') ?? '100'), 200);

    const db = createServiceClient();

    let query = db
      .from('payments')
      .select(`
        id, order_id, method, status, amount,
        reference_number, proof_url, notes, created_at,
        orders(order_number, customer_name, customer_phone, customer_email, total_amount, status)
      `)
      .eq('tenant_id', ctx.tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) return apiError('Failed to fetch payments', 500);
    return apiSuccess(data ?? []);
  }, ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER']);
}
