export const dynamic = 'force-dynamic';
// POST /api/orders/feedback — public endpoint for post-order star rating
// Customer submits 1-5 stars + optional comment from tracking page

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';

const FeedbackSchema = z.object({
  orderId:      z.string().uuid(),
  rating:       z.number().int().min(1).max(5),
  feedbackText: z.string().max(500).optional(),
});

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await req.json(); } catch { return apiError('Invalid JSON', 400); }
  const parsed = FeedbackSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);

  const db = createServiceClient();

  // Verify order exists and is completed (no gaming the rating)
  const { data: order } = await db.from('orders')
    .select('id, status, rating')
    .eq('id', parsed.data.orderId)
    .single();

  if (!order) return apiError('Order not found', 404);
  if (!['COMPLETED'].includes(order.status)) return apiError('Feedback only allowed for completed orders', 400);
  if (order.rating !== null) return apiError('Feedback already submitted for this order', 409);

  const { error } = await db.from('orders').update({
    rating:        parsed.data.rating,
    feedback_text: parsed.data.feedbackText ?? null,
    feedback_at:   new Date().toISOString(),
  }).eq('id', parsed.data.orderId);

  if (error) return apiError('Failed to save feedback', 500);
  return apiSuccess({ submitted: true, rating: parsed.data.rating });
}
