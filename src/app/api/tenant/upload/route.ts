export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';
import { validateImageFile } from '@/lib/utils/file-validation';

// POST /api/tenant/upload?type=logo|payment_qr
export async function POST(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    const type = new URL(request.url).searchParams.get('type');
    if (!type || !['logo', 'payment_qr'].includes(type)) {
      return apiError('type must be logo or payment_qr', 400);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return apiError('No file provided', 400);

    const validation = await validateImageFile(file, {
      maxSizeMb: 5,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (!validation.valid) return apiError(validation.error ?? 'Invalid file', 400);

    const db = createServiceClient();
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const bucket = type === 'logo' ? 'tenant-assets' : 'tenant-assets';
    const folder = type === 'logo' ? 'logos' : 'payment-qr';
    const path = `${folder}/${ctx.tenantId}-${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await db.storage
      .from(bucket)
      .upload(path, new Uint8Array(arrayBuffer), {
        contentType: file.type,
        upsert: true,
      });
    if (uploadError) return apiError(`Upload failed: ${uploadError.message}`, 500);

    const { data: urlData } = db.storage.from(bucket).getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    // Save to tenants table
    const column = type === 'logo' ? 'logo_url' : 'payment_qr_url';
    const { error: updateError } = await db.from('tenants')
      .update({ [column]: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', ctx.tenantId);
    if (updateError) return apiError('Failed to save URL', 500);

    return apiSuccess({ url: publicUrl, type });
  }, ['OWNER', 'ADMIN']);
}

// DELETE /api/tenant/upload?type=logo|payment_qr
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    const type = new URL(request.url).searchParams.get('type');
    if (!type || !['logo', 'payment_qr'].includes(type)) return apiError('Invalid type', 400);
    const db = createServiceClient();
    const column = type === 'logo' ? 'logo_url' : 'payment_qr_url';
    await db.from('tenants').update({ [column]: null, updated_at: new Date().toISOString() }).eq('id', ctx.tenantId);
    return apiSuccess({ removed: true });
  }, ['OWNER', 'ADMIN']);
}
