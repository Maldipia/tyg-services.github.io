export const dynamic = 'force-dynamic';

// POST /api/menu/upload — upload menu item image to Supabase storage
import { NextRequest, NextResponse } from 'next/server';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';

import { validateImageFile } from '@/lib/utils/file-validation';

export async function POST(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (_, ctx) => {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) return apiError('No file provided', 400);

    // Validate with magic byte checking (not just MIME header)
    const validation = await validateImageFile(file, { maxSizeMb: 2, allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] });
    if (!validation.valid) return apiError(validation.error ?? 'Invalid file', 400);

    const db = createServiceClient();
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${ctx.tenantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const { error } = await db.storage
      .from('menu-images')
      .upload(path, uint8, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return apiError('Upload failed', 500);
    }

    const { data: urlData } = db.storage.from('menu-images').getPublicUrl(path);

    return apiSuccess({ url: urlData.publicUrl });
  }, ['OWNER', 'ADMIN', 'MANAGER']);
}
