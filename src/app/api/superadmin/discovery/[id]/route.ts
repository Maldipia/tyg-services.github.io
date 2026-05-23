export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin, superAdminUnauthorized } from '@/lib/auth/superadmin';
import { createServiceClient } from '@/lib/supabase/client';

const VALID_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'not_a_fit'] as const;
type ValidStatus = typeof VALID_STATUSES[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  if (!await verifySuperAdmin(req)) return superAdminUnauthorized();

  const { id } = params;

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const updates: Record<string, string> = {};

  if ('status' in body) {
    const s = String(body.status ?? '');
    if (!VALID_STATUSES.includes(s as ValidStatus)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }
    updates.status = s;
  }

  if ('internal_assessment' in body) {
    updates.internal_assessment = String(body.internal_assessment ?? '').slice(0, 2000);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const db = createServiceClient();
  const { error } = await db
    .from('discovery_responses')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
