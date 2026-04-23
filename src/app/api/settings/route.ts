export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { logEvent } from '@/lib/logger';

const UpdateSettingsSchema = z.object({
  name: z.string().min(1).max(120).trim().optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(300).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  birTin: z.string().max(20).nullable().optional(),
  birAtpSeries: z.string().max(30).nullable().optional(),
  logo_url: z.string().max(500).nullable().optional(),
  industry: z.enum(['cafe','restaurant','bar','retail','bakery','cloud_kitchen','other']).optional(),
  settings: z.object({
    orderingEnabled: z.boolean().optional(),
    requireCustomerName: z.boolean().optional(),
    requireCustomerPhone: z.boolean().optional(),
    vatEnabled: z.boolean().optional(),
    vatRate: z.number().min(0).max(30).optional(),
    serviceChargeEnabled: z.boolean().optional(),
    serviceChargeRate: z.number().min(0).max(1).optional(),
    avgPrepMins: z.number().min(1).max(120).optional(),
    pwdSeniorDiscountEnabled: z.boolean().optional(),
    receiptFooter: z.string().max(300).optional(),
    smsEnabled: z.boolean().optional(),
    ownRiderEnabled: z.boolean().optional(),
    ownRiderName: z.string().max(60).optional(),
    ownRiderPhone: z.string().max(20).optional(),
    ownRiderFee: z.number().min(0).max(9999).optional(),
    gcashNumber: z.string().max(20).nullable().optional(),
    gcashName: z.string().max(80).nullable().optional(),
    mayaNumber: z.string().max(20).nullable().optional(),
    paymentNote: z.string().max(200).nullable().optional(),
  }).optional(),
});  // removed .strict() — was silently rejecting valid fields like logo_url

export function OPTIONS() { return new Response(null,{status:204}); }

export async function GET(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (_, ctx) => {
    const db = createServiceClient();
    const { data, error } = await db.from('tenants')
      .select('id, name, slug, phone, address, primary_color, accent_color, settings, plan_tier, plan_status, trial_ends_at, owner_email, bir_tin, bir_atp_series, logo_url, payment_qr_url, industry, onboarding_completed_at')
      .eq('id', ctx.tenantId).single();
    if (error || !data) return apiError('Tenant not found', 404);
    return apiSuccess(data);
  }, ['OWNER', 'ADMIN']);
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }
    const parsed = UpdateSettingsSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);
    const db = createServiceClient();
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.name !== undefined) updatePayload['name'] = parsed.data.name;
    if (parsed.data.phone !== undefined) updatePayload['phone'] = parsed.data.phone;
    if (parsed.data.address !== undefined) updatePayload['address'] = parsed.data.address;
    if (parsed.data.primaryColor !== undefined) updatePayload['primary_color'] = parsed.data.primaryColor;
    if (parsed.data.accentColor !== undefined) updatePayload['accent_color'] = parsed.data.accentColor;
    if (parsed.data.birTin !== undefined) updatePayload['bir_tin'] = parsed.data.birTin;
    if (parsed.data.birAtpSeries !== undefined) updatePayload['bir_atp_series'] = parsed.data.birAtpSeries;
    if (parsed.data.industry !== undefined) updatePayload['industry'] = parsed.data.industry;
    if (parsed.data.logo_url !== undefined) updatePayload['logo_url'] = parsed.data.logo_url;
    if (parsed.data.settings !== undefined) {
      // Merge settings JSONB — don't overwrite existing keys
      const { data: existing } = await db.from('tenants').select('settings').eq('id', ctx.tenantId).single();
      updatePayload['settings'] = { ...(existing?.settings ?? {}), ...parsed.data.settings };
    }
    const { data, error } = await db.from('tenants')
      .update(updatePayload).eq('id', ctx.tenantId)
      .select('id, name, phone, address, primary_color, accent_color, settings').single();
    if (error) return apiError('Failed to save settings', 500);
    void logEvent({
      eventType: 'SETTINGS_UPDATED',
      entityType: 'SETTINGS',
      entityId: ctx.tenantId,
      tenantId: ctx.tenantId,
      userId: ctx.staffId,
      userName: ctx.displayName ?? undefined,
      source: 'ADMIN',
      details: { updatedFields: Object.keys(updatePayload).filter(k => k !== 'updated_at') },
    });
    return apiSuccess(data);
  }, ['OWNER', 'ADMIN']);
}
