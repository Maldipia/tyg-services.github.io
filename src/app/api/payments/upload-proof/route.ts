export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

const MAGIC: Record<string, number[][]> = {
  'image/jpeg': [[0xFF,0xD8,0xFF]],
  'image/png':  [[0x89,0x50,0x4E,0x47]],
  'image/gif':  [[0x47,0x49,0x46,0x38]],
  'image/webp': [[0x52,0x49,0x46,0x46]], // RIFF (check offset 8 for WEBP)
  'image/heic': [[0x00,0x00,0x00]], // HEIC varies — skip magic check, allow by type
};

function checkMagicBytes(buf: Uint8Array, mime: string): boolean {
  if (mime === 'image/heic') return true; // HEIC header varies
  const sigs = MAGIC[mime];
  if (!sigs) return false;
  return sigs.some(sig => sig.every((byte, i) => buf[i] === byte));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const form = await req.formData();
    const file      = form.get('file') as File | null;
    const orderId   = form.get('orderId') as string | null;
    const tenantSlug = form.get('tenantSlug') as string | null;

    if (!file || !orderId || !tenantSlug)
      return NextResponse.json({ error: 'Missing file, orderId, or tenantSlug' }, { status: 400 });

    // 1. Content-Type header check
    const allowed = ['image/jpeg','image/png','image/webp','image/heic','image/gif'];
    if (!allowed.includes(file.type))
      return NextResponse.json({ error: 'Only JPG, PNG, WebP, HEIC images allowed' }, { status: 400 });

    if (file.size > 10 * 1024 * 1024)
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 });

    // 2. Magic bytes check (prevents disguised files)
    const bytes = await file.arrayBuffer();
    const buf = new Uint8Array(bytes);
    if (!checkMagicBytes(buf, file.type))
      return NextResponse.json({ error: 'File content does not match declared type' }, { status: 400 });

    const db = createServiceClient();

    // 3. Verify order belongs to tenant
    const { data: order } = await db.from('orders').select('id, tenant_id').eq('id', orderId).single();
    const { data: tenant } = await db.from('tenants').select('id').eq('slug', tenantSlug).single();
    if (!order || !tenant || order.tenant_id !== tenant.id)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // 4. Upload — randomized path to prevent enumeration
    const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
    const rand = Math.random().toString(36).slice(2, 10);
    const path = `${tenantSlug}/${orderId}/${rand}-${Date.now()}.${ext}`;

    const { error: uploadError } = await db.storage
      .from('payment-proofs')
      .upload(path, bytes, { contentType: file.type, upsert: false });

    if (uploadError)
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });

    const { data: { publicUrl } } = db.storage.from('payment-proofs').getPublicUrl(path);

    // 5. Save on order
    await db.from('orders').update({
      payment_proof_url: publicUrl,
      payment_status: 'PENDING_VERIFICATION',
    }).eq('id', orderId);

    return NextResponse.json({ data: { url: publicUrl } });
  } catch (err) {
    console.error('[upload-proof]', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
