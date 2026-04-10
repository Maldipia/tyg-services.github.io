export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const form = await req.formData();
    const file  = form.get('file') as File | null;
    const orderId = form.get('orderId') as string | null;
    const tenantSlug = form.get('tenantSlug') as string | null;

    if (!file || !orderId || !tenantSlug) {
      return NextResponse.json({ error: 'Missing file, orderId, or tenantSlug' }, { status: 400 });
    }

    // Validate file type
    const allowed = ['image/jpeg','image/png','image/webp','image/heic','image/gif'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPG, PNG, WebP, HEIC images allowed' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 });
    }

    const db = createServiceClient();

    // Verify order exists and belongs to this tenant
    const { data: order } = await db.from('orders')
      .select('id, tenant_id')
      .eq('id', orderId)
      .single();
    
    const { data: tenant } = await db.from('tenants').select('id').eq('slug', tenantSlug).single();
    if (!order || !tenant || order.tenant_id !== tenant.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Upload to Supabase Storage
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${tenantSlug}/${orderId}/proof-${Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await db.storage
      .from('payment-proofs')
      .upload(path, bytes, { contentType: file.type, upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = db.storage.from('payment-proofs').getPublicUrl(path);

    // Save URL on order + set payment status to PENDING_VERIFICATION
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
