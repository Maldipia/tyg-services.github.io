// ============================================================
// TYG POS — Semaphore SMS (Philippine Carrier)
// BUSINESS+ tier only — gated by plan check before calling.
// ============================================================

interface SemaphoreResponse {
  message_id: string;
  user_id: string;
  user: string;
  account_status: string;
  sendername: string;
  network: string;
  mobile_number: string;
  status: string;
  message: string;
  code: string;
  timestamp: string;
}

const SEMAPHORE_API = 'https://api.semaphore.co/api/v4/messages';

export async function sendSMS(
  mobileNumber: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.SEMAPHORE_API_KEY;
  const senderName = process.env.SEMAPHORE_SENDER_NAME ?? 'TYGPOS';

  if (!apiKey) {
    console.error('SEMAPHORE_API_KEY not set');
    return { success: false, error: 'SMS not configured' };
  }

  // Normalize PH mobile numbers to 09xxxxxxxxx format
  const normalized = normalizePHNumber(mobileNumber);
  if (!normalized) {
    return { success: false, error: 'Invalid Philippine mobile number' };
  }

  try {
    const params = new URLSearchParams({
      apikey: apiKey,
      number: normalized,
      message,
      sendername: senderName,
    });

    const res = await fetch(SEMAPHORE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Semaphore API error:', text);
      return { success: false, error: 'SMS delivery failed' };
    }

    const data = await res.json() as SemaphoreResponse[];
    const first = data[0];
    if (first?.status?.toLowerCase() === 'success' || first?.status?.toLowerCase() === 'queued') {
      return { success: true };
    }

    return { success: false, error: first?.status ?? 'Unknown SMS error' };
  } catch (err) {
    console.error('Semaphore fetch error:', err);
    return { success: false, error: 'SMS service unavailable' };
  }
}

// ── SMS Templates ────────────────────────────────────────────

export function orderReadySMS(orderNumber: string, businessName: string): string {
  return `${businessName}: Order #${orderNumber} is READY! Please proceed to the counter to get your order. - TYG POS`;
}

export function orderConfirmedSMS(orderNumber: string, businessName: string): string {
  return `${businessName}: Order #${orderNumber} has been confirmed. We're preparing it now. - TYG POS`;
}

// ── PH Number Normalization ──────────────────────────────────
function normalizePHNumber(raw: string): string | null {
  // Remove spaces, dashes, parens
  const cleaned = raw.replace(/[\s\-()]/g, '');

  if (/^09\d{9}$/.test(cleaned)) return cleaned;           // 09xxxxxxxxx
  if (/^\+639\d{9}$/.test(cleaned)) return '0' + cleaned.slice(3); // +639xxxxxxxxx
  if (/^639\d{9}$/.test(cleaned)) return '0' + cleaned.slice(2);   // 639xxxxxxxxx

  return null;
}
