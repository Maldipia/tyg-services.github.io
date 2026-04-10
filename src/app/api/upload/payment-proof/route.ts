export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif'];

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const orderId = formData.get('orderId') as string | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId))
      return NextResponse.json({ error: 'Valid orderId required' }, { status: 400 });
    if (file.size > MAX_SIZE)
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    if (!ALLOWED.includes(file.type.toLowerCase()))
      return NextResponse.json({ error: 'JPG, PNG, WebP, or HEIC only' }, { status: 400 });

    const db = createServiceClient();
    const { data: order } = await db.from('orders').select('id, tenant_id').eq('id', orderId).single();
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const ext = file.type.includes('png') ? 'png' : file.type.includes('webp') ? 'webp' : 'jpg';
    const path = `${order.tenant_id as string}/${orderId}-${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await db.storage
      .from('payment-proofs')
      .upload(path, new Uint8Array(arrayBuffer), { contentType: file.type, upsert: true });

    if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 });

    const { data: urlData } = db.storage.from('payment-proofs').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    await db.from('orders').update({
      payment_proof_url: publicUrl,
      payment_proof_uploaded_at: new Date().toISOString(),
      payment_status: 'PENDING_VERIFICATION',
    }).eq('id', orderId);

    return NextResponse.json({ data: { url: publicUrl } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
