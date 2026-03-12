export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { fireSheetsWebhook } from '@/lib/sheets/webhook';
import type { AuthContext } from '@/types';

export function POST(req: NextRequest) {
  return withStaffAuth(req, handleWebhook, ['OWNER', 'ADMIN', 'MANAGER']);
}

async function handleWebhook(req: NextRequest, _ctx: AuthContext): Promise<NextResponse> {
  const { action, data } = await req.json() as { action: string; data: Record<string, unknown> };
  if (!action) return apiError('action is required', 400);

  void fireSheetsWebhook(action as never, data ?? {});
  return apiSuccess({ queued: true, action });
}

