export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';

export async function POST(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (session) => {
    const db = createServiceClient();
    const { error } = await db.from('tenants')
      .update({ onboarding_completed_at: new Date().toISOString(), onboarding_step: 4 })
      .eq('id', session.tenantId);
    if (error) return apiError('Failed to update onboarding status', 500);
    return apiSuccess({ completed: true });
  });
}
