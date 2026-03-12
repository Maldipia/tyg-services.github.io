export const dynamic = 'force-dynamic';

// ============================================================
// TYG POS — POST /api/payment/proof
// Customer uploads screenshot proof of GCash/Maya payment.
// Rate limited. Stored in Supabase Storage (tenant-scoped path).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';
import { resolveTenant, apiSuccess, apiError, getClientIp } from '@/lib/auth/middleware';
import { paymentUploadRateLimit } from '@/lib/redis/ratelimit';

const MAX_FILE_SIZE_MB = 5;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);
  const { success: rateLimitOk } = await paymentUploadRateLimit.limit(ip);
  if (!rateLimitOk) return apiError('Too many uploads. Please wait.', 429);

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return apiError('Invalid form data', 400);
  }

  const tenantSlug = formData.get('tenantSlug') as string | null;
  const orderId = formData.get('orderId') as string | null;
  const method = formData.get('method') as string | null;
  const referenceNumber = formData.get('referenceNumber') as string | null;
  const file = formData.get('proof') as File | null;

  if (!tenantSlug || !orderId || !method || !file) {
    return apiError('Missing required fields: tenantSlug, orderId, method, proof', 400);
  }

  // Validate tenant
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) return apiError('Tenant not found', 404);

  if (!ALLOWED_MIME.has(file.type)) {
    return apiError('Only JPEG, PNG, WebP, and HEIC images are accepted', 400, 'INVALID_FILE_TYPE');
  }

  const fileSizeMB = file.size / 1024 / 1024;
  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    return apiError(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB`, 400, 'FILE_TOO_LARGE');
  }

  const db = createServiceClient();

  // Verify order belongs to this tenant and is in UNPAID/PENDING state
  const { data: order } = await db
    .from('orders')
    .select('id, tenant_id, payment_status')
    .eq('id', orderId)
    .eq('tenant_id', tenant.tenantId)
    .single();

  if (!order) return apiError('Order not found', 404);
  if (order.payment_status === 'VERIFIED') {
    return apiError('Payment already verified', 400, 'ALREADY_VERIFIED');
  }

  // Determine extension for HEIC support
  const extMap: Record<string, string> = {
    'image/jpeg':  'jpg',
    'image/png':   'png',
    'image/webp':  'webp',
    'image/heic':  'heic',
    'image/heif':  'heif',
  };
  const ext = extMap[file.type] ?? 'jpg';
  const storagePath = `${tenant.tenantId}/payment-proofs/${orderId}-${Date.now()}.${ext}`;

  // Upload to Supabase Storage
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await db.storage
    .from('payment-proofs')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    return apiError('Failed to upload payment proof', 500);
  }

  // Create payment record
  const { data: payment, error: paymentError } = await db
    .from('payments')
    .insert({
      tenant_id: tenant.tenantId,
      order_id: orderId,
      method,
      amount: 0, // Will be reconciled when staff verifies
      reference_number: referenceNumber ?? null,
      proof_url: storagePath,
      status: 'PENDING_VERIFICATION',
    })
    .select('id')
    .single();

  if (paymentError || !payment) {
    // Clean up uploaded file on failure
    await db.storage.from('payment-proofs').remove([storagePath]);
    return apiError('Failed to record payment', 500);
  }

  // Update order payment status
  await db
    .from('orders')
    .update({ payment_status: 'PENDING_VERIFICATION' })
    .eq('id', orderId)
    .eq('tenant_id', tenant.tenantId);

  // Log event
  await db.from('order_events').insert({
    tenant_id: tenant.tenantId,
    order_id: orderId,
    event_type: 'payment_proof_uploaded',
    from_payment: 'UNPAID',
    to_payment: 'PENDING_VERIFICATION',
    metadata: { method, paymentId: payment.id },
  });

  return apiSuccess({ paymentId: payment.id, status: 'PENDING_VERIFICATION' }, 201);
}
