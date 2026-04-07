// ============================================================
// TYG POS — Online Order Cart (client-side state)
// No auth required. Cart stored in memory + sessionStorage.
// idempotency_key generated once per page load.
// ============================================================

export interface CartItem {
  itemId: string;
  itemName: string;
  sizeId?: string | null;
  sizeLabel?: string | null;
  unitPrice: number;
  qty: number;
  addonTotal: number;
  notes?: string;
  sugarLevel?: string;
  hasSugarLevel?: boolean;
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((s, i) => s + (i.unitPrice + i.addonTotal) * i.qty, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.qty, 0);
}

export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2,11)}`;
}

export function saveCart(tenantSlug: string, items: CartItem[]): void {
  try { sessionStorage.setItem(`tyg_cart_${tenantSlug}`, JSON.stringify(items)); } catch { /**/ }
}

export function loadCart(tenantSlug: string): CartItem[] {
  try {
    const raw = sessionStorage.getItem(`tyg_cart_${tenantSlug}`);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch { return []; }
}

export function clearCart(tenantSlug: string): void {
  try { sessionStorage.removeItem(`tyg_cart_${tenantSlug}`); } catch { /**/ }
}
