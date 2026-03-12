// ============================================================
// TYG POS — Resend Email Service
// Receipts, trial reminders, subscription alerts
// ============================================================

import { Resend } from 'resend';
import type { Order } from '@/types';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@tygpos.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tygpos.com';

// ── Send order receipt ───────────────────────────────────────
export async function sendOrderReceipt(
  order: Order & { items: NonNullable<Order['items']> },
  tenantName: string,
  receiptFooter: string
): Promise<void> {
  if (!order.customer_email) return;

  const itemRows = order.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 0;color:#374151">
            ×${item.qty} ${item.item_name}
            ${item.size_label ? `<span style="color:#9ca3af"> (${item.size_label})</span>` : ''}
          </td>
          <td style="padding:8px 0;text-align:right;color:#374151;font-weight:600">
            ₱${((Number(item.line_total ?? 0) + Number(item.addon_total ?? 0) * item.qty)).toFixed(2)}
          </td>
        </tr>`
    )
    .join('');

  await resend.emails.send({
    from: FROM,
    to: order.customer_email,
    subject: `Order Confirmed — ${tenantName} #${order.order_number}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Receipt — ${tenantName}</title></head>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.1)">
    <!-- Header -->
    <div style="background:#16a34a;padding:24px;text-align:center">
      <h1 style="color:white;margin:0;font-size:20px">${tenantName}</h1>
      <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px">Order #${order.order_number}</p>
    </div>

    <!-- Body -->
    <div style="padding:24px">
      <p style="color:#374151;margin:0 0 4px">Hi <strong>${order.customer_name}</strong>,</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px">Your order has been received!</p>

      <!-- Items -->
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb">
        ${itemRows}
      </table>

      <!-- Totals -->
      <div style="border-top:2px solid #e5e7eb;margin-top:16px;padding-top:16px">
        <div style="display:flex;justify-content:space-between;color:#6b7280;font-size:14px;margin-bottom:4px">
          <span>Subtotal</span>
          <span>₱${(order.subtotal_override ?? 0).toFixed(2)}</span>
        </div>
        ${order.vat_amount > 0 ? `
        <div style="display:flex;justify-content:space-between;color:#6b7280;font-size:14px;margin-bottom:4px">
          <span>VAT (12%)</span>
          <span>₱${order.vat_amount.toFixed(2)}</span>
        </div>
        ` : ''}
        ${order.discount_amount > 0 ? `
        <div style="display:flex;justify-content:space-between;color:#dc2626;font-size:14px;margin-bottom:4px">
          <span>Discount (${order.discount_type ?? ''})</span>
          <span>-₱${order.discount_amount.toFixed(2)}</span>
        </div>
        ` : ''}
        <div style="display:flex;justify-content:space-between;color:#111827;font-size:18px;font-weight:700;margin-top:8px">
          <span>Total</span>
          <span>₱${order.total_amount.toFixed(2)}</span>
        </div>
      </div>

      ${order.or_number ? `
      <div style="background:#f3f4f6;border-radius:8px;padding:12px;margin-top:16px;font-size:12px;color:#6b7280">
        OR No: <strong>${order.or_number}</strong>
      </div>
      ` : ''}
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:12px;margin:0">${receiptFooter}</p>
      <p style="color:#d1d5db;font-size:10px;margin:8px 0 0">
        Powered by <a href="${APP_URL}" style="color:#16a34a;text-decoration:none">TYG POS</a>
      </p>
    </div>
  </div>
</body>
</html>
    `,
  });
}

// ── Trial reminder emails ────────────────────────────────────
export async function sendTrialReminderEmail(
  email: string,
  businessName: string,
  daysLeft: number
): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left on your TYG POS trial`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#111827">Your trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</h2>
        <p>Hi! Your TYG POS trial for <strong>${businessName}</strong> ${daysLeft === 1 ? 'ends tomorrow' : `ends in ${daysLeft} days`}.</p>
        <p>Don't lose access to your orders and menu — upgrade now to keep everything running.</p>
        <a href="${APP_URL}/billing"
           style="display:inline-block;background:#16a34a;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">
          Upgrade Plan — From ₱599/mo
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:32px">TYG POS — Built for PH F&amp;B</p>
      </div>
    `,
  });
}

// ── Payment verification notification ───────────────────────
export async function sendPaymentVerifiedEmail(
  email: string,
  customerName: string,
  orderNumber: string,
  amount: number,
  tenantName: string
): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Payment Confirmed — ${tenantName} #${orderNumber}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="background:#16a34a;color:white;border-radius:12px;padding:24px;text-align:center">
          <div style="font-size:40px;margin-bottom:8px">✅</div>
          <h2 style="margin:0">Payment Confirmed!</h2>
        </div>
        <div style="padding:24px 0">
          <p>Hi <strong>${customerName}</strong>,</p>
          <p>Your payment of <strong>₱${amount.toFixed(2)}</strong> for order #${orderNumber} at <strong>${tenantName}</strong> has been verified.</p>
        </div>
      </div>
    `,
  });
}
