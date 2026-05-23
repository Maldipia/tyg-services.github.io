export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin, superAdminUnauthorized } from '@/lib/auth/superadmin';
import { createServiceClient } from '@/lib/supabase/client';

const VALID_STATUSES = new Set(['new', 'contacted', 'qualified', 'converted', 'not_a_fit']);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  if (!await verifySuperAdmin(req)) return superAdminUnauthorized();

  const { id } = params;
  if (!id || typeof id !== 'string' || id.length > 100) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const body = await req.json();

  const updates: Record<string, string> = {};

  // status: must be one of the valid enum values
  if ('status' in body) {
    if (!VALID_STATUSES.has(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}` },
        { status: 400 }
      );
    }
    updates.status = body.status;
  }

  // internal_assessment: free text, capped at 2000 chars
  if ('internal_assessment' in body) {
    updates.internal_assessment = String(body.internal_assessment ?? '').trim().slice(0, 2000);
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
