export const dynamic = 'force-dynamic';
// GET /api/analytics/staff-performance?tenantSlug=yani&range=7d
// Returns per-staff order stats for admin analytics tab

import { NextRequest, NextResponse } from 'next/server';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function GET(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const range  = searchParams.get('range') ?? '7d';
    const days   = range === '30d' ? 30 : range === '14d' ? 14 : 7;
    const fromTs = new Date(Date.now() - days * 86400_000).toISOString();
    const db     = createServiceClient();

    // Orders bumped through status changes — actor tracked via staff_id on status_change events
    const { data: events } = await db.from('order_events')
      .select('staff_id, event_type, to_status, created_at, order:orders!order_id(total_amount)')
      .eq('tenant_id', ctx.tenantId)
      .eq('event_type', 'status_change')
      .not('staff_id', 'is', null)
      .gte('created_at', fromTs)
      .in('to_status', ['CONFIRMED','COMPLETED']);

    // Staff list
    const { data: staffList } = await db.from('staff')
      .select('id, name, display_name, role')
      .eq('tenant_id', ctx.tenantId)
      .eq('is_active', true);

    type EventRow = typeof events extends (infer T)[] | null ? T : never;
    const staffMap = new Map<string, {
      staffId: string; name: string; displayName: string; role: string;
      ordersConfirmed: number; ordersCompleted: number; paymentsVerified: number;
      totalRevenue: number;
    }>();

    for (const s of (staffList ?? [])) {
      staffMap.set(s.id, {
        staffId: s.id, name: s.name, displayName: s.display_name, role: s.role,
        ordersConfirmed: 0, ordersCompleted: 0, paymentsVerified: 0, totalRevenue: 0,
      });
    }

    for (const e of (events ?? [])) {
      const ev = e as EventRow;
      if (!ev.staff_id) continue;
      const entry = staffMap.get(ev.staff_id);
      if (!entry) continue;
      const toSt = (ev as unknown as Record<string,unknown>)['to_status'] as string | undefined;
      if (toSt === 'CONFIRMED') entry.ordersConfirmed++;
      if (toSt === 'COMPLETED') { entry.ordersCompleted++; entry.totalRevenue += Number((ev.order as {total_amount?: number})?.total_amount ?? 0); }
    }

    const result = Array.from(staffMap.values())
      .sort((a, b) => b.ordersCompleted - a.ordersCompleted);

    return apiSuccess({ range, days, staff: result });
  }, ['OWNER', 'ADMIN', 'MANAGER']);
}
