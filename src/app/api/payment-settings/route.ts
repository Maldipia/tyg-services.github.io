export const dynamic = 'force-dynamic';
// GET/PATCH /api/payment-settings
// Manages the active payment QR image for a tenant.

import { NextRequest, NextResponse } from 'next/server';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';

// GET — fetch active payment setting
export async function GET(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (_, ctx) => {
    const db = createServiceClient();
    const { data, error } = await db
      .from('payment_settings')
      .select('id, label, qr_image_url, is_active, sort_order')
      .eq('tenant_id', ctx.tenantId)
      .eq('is_active', true)
      .order('sort_order')
      .limit(1)
      .maybeSingle();

    if (error) return apiError('Failed to fetch payment settings', 500);
    return apiSuccess(data ?? null);
  }, ['OWNER', 'ADMIN', 'MANAGER']);
}

// POST — upload image and save URL (auto-save, no separate save button)
export async function POST(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    const db = createServiceClient();

    let formData: FormData;
    try { formData = await request.formData(); }
    catch { return apiError('Invalid form data', 400); }

    const file = formData.get('file') as File | null;
    if (!file) return apiError('No file provided', 400);
    if (!file.type.startsWith('image/')) return apiError('File must be an image', 400);
    if (file.size > 5 * 1024 * 1024) return apiError('File too large (max 5MB)', 400);

    // Upload to Supabase storage
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${ctx.tenantId}/payment-qr-${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadErr } = await db.storage
      .from('tenant-assets')
      .upload(path, arrayBuffer, { contentType: file.type, upsert: true });

    if (uploadErr) return apiError(`Upload failed: ${uploadErr.message}`, 500);

    const { data: { publicUrl } } = db.storage
      .from('tenant-assets')
      .getPublicUrl(path);

    // Upsert into payment_settings — deactivate old, insert new active row
    const { error: oldErr } = await db
      .from('payment_settings')
      .update({ is_active: false })
      .eq('tenant_id', ctx.tenantId)
      .eq('is_active', true);

    if (oldErr) return apiError('Failed to update settings', 500);

    const { data: newRow, error: insertErr } = await db
      .from('payment_settings')
      .insert({
        tenant_id: ctx.tenantId,
        label: 'Payment',
        qr_image_url: publicUrl,
        is_active: true,
        sort_order: 0,
      })
      .select('id, qr_image_url, is_active')
      .single();

    if (insertErr) return apiError('Failed to save settings', 500);

    // Also update legacy payment_qr_url on tenants for backward compat
    await db.from('tenants')
      .update({ payment_qr_url: publicUrl })
      .eq('id', ctx.tenantId);

    return apiSuccess({ url: publicUrl, row: newRow });
  }, ['OWNER', 'ADMIN', 'MANAGER']);
}

// DELETE — remove payment image
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (_, ctx) => {
    const db = createServiceClient();
    const { error } = await db
      .from('payment_settings')
      .update({ is_active: false, qr_image_url: null })
      .eq('tenant_id', ctx.tenantId)
      .eq('is_active', true);

    if (error) return apiError('Failed to remove payment image', 500);

    await db.from('tenants')
      .update({ payment_qr_url: null })
      .eq('id', ctx.tenantId);

    return apiSuccess({ removed: true });
  }, ['OWNER', 'ADMIN']);
}
