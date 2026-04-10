// ============================================================
// TYG POS — Core TypeScript Types
// Maps 1:1 to DB schema. No 'any'. Strict mode.
// ============================================================

export type PlanTier = 'TRIAL' | 'STARTER' | 'BUSINESS' | 'PRO' | 'ENTERPRISE';
export type PlanStatus = 'TRIAL' | 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'CANCELLED';
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'GCASH' | 'MAYA' | 'BPI' | 'BDO' | 'UNIONBANK' | 'CASH' | 'PAYMONGO' | 'OTHER';
export type StaffRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'CASHIER' | 'KITCHEN';
export type ItemStatus = 'AVAILABLE' | 'SOLD_OUT' | 'HIDDEN';

// ── Tenant Settings (JSONB) ─────────────────────────────────
export interface TenantSettings {
  orderingEnabled: boolean;
  requireCustomerName: boolean;
  requireCustomerPhone: boolean;
  vatEnabled: boolean;
  vatRate: number;
  pwdSeniorDiscountEnabled: boolean;
  receiptFooter: string;
  kitchenPrintEnabled: boolean;
  smsEnabled: boolean;
  maxTablesPerBranch: number;
}

// ── Tenant ───────────────────────────────────────────────────
export interface Tenant {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  slug: string;
  owner_email: string;
  owner_user_id: string;
  phone: string | null;
  address: string | null;
  timezone: string;
  currency: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  plan_tier: PlanTier;
  plan_status: PlanStatus;
  trial_ends_at: string | null;
  plan_period_end: string | null;
  paymongo_customer_id: string | null;
  paymongo_sub_id: string | null;
  settings: TenantSettings;
  bir_tin: string | null;
  bir_atp_series: string | null;
  bir_or_counter: number;
  api_key_hash: string | null;
  webhook_url: string | null;
}

// ── Branch ───────────────────────────────────────────────────
export interface Branch {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  sort_order: number;
}

// ── Staff ────────────────────────────────────────────────────
export interface Staff {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
  name: string;
  display_name: string;
  pin_hash: string;
  role: StaffRole;
  is_active: boolean;
  last_login: string | null;
}

// ── Staff Session (auth context after PIN login) ─────────────
export interface StaffSession {
  staffId: string;
  tenantId: string;
  role: StaffRole;
  branchId: string | null;
  displayName: string;
  expiresAt: string;
}

// ── Menu Category ────────────────────────────────────────────
export interface MenuCategory {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

// ── Menu Item Size ────────────────────────────────────────────
export interface MenuItemSize {
  id: string;
  tenant_id: string;
  item_id: string;
  created_at: string;
  label: string;
  price: number;
  sort_order: number;
  is_default: boolean;
  is_available: boolean;
}

// ── Menu Item Addon ───────────────────────────────────────────
export interface MenuItemAddon {
  id: string;
  tenant_id: string;
  item_id: string;
  created_at: string;
  label: string;
  price: number;
  sort_order: number;
  is_available: boolean;
}

// ── Menu Item ─────────────────────────────────────────────────
export interface MenuItem {
  id: string;
  tenant_id: string;
  category_id: string;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
  name: string;
  description: string | null;
  image_url: string | null;
  base_price: number;
  status: ItemStatus;
  sort_order: number;
  is_featured: boolean;
  tags: string[];
  metadata: Record<string, unknown>;
  stock_count: number | null;
  low_stock_threshold: number;
  has_sugar_level: boolean;
  // joined
  sizes?: MenuItemSize[];
  addons?: MenuItemAddon[];
}

// ── Restaurant Table ──────────────────────────────────────────
export interface RestaurantTable {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
  label: string;
  qr_token: string;
  capacity: number;
  is_active: boolean;
  sort_order: number;
}

// ── Cart (client-side only) ───────────────────────────────────
export interface CartItem {
  itemId: string;
  itemName: string;
  sizeId: string | null;
  sizeLabel: string | null;
  unitPrice: number;
  qty: number;
  addons: Array<{ label: string; price: number }>;
  addonTotal: number;
  notes: string;
  sugarLevel?: 'GROUNDED' | 'YANI' | 'COMFORT' | 'FULL_SWEET' | null;
  hasSugarLevel?: boolean;
}

// ── Order Item ────────────────────────────────────────────────
export interface OrderItem {
  id: string;
  tenant_id: string;
  order_id: string;
  item_id: string;
  size_id: string | null;
  created_at: string;
  item_name: string;
  size_label: string | null;
  unit_price: number;
  qty: number;
  line_total: number;   // GENERATED in DB
  addons: Array<{ label: string; price: number }>;
  addon_total: number;
  notes: string | null;
  prepared?: boolean;
  sugar_level?: string | null;
}

// ── Order ─────────────────────────────────────────────────────
export interface Order {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  table_id: string | null;
  created_at: string;
  updated_at: string;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  pax: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal_override: number;
  discount_amount: number;
  discount_type: string | null;
  vat_amount: number;
  total_amount: number;
  or_number: string | null;
  bir_printed: boolean;
  handled_by: string | null;
  notes: string | null;
  is_test: boolean;
  cancel_reason: string | null;
  cancel_note: string | null;
  // joined
  items?: OrderItem[];
  table?: RestaurantTable;
}

// ── Payment ───────────────────────────────────────────────────
export interface Payment {
  id: string;
  tenant_id: string;
  order_id: string;
  created_at: string;
  updated_at: string;
  method: PaymentMethod;
  amount: number;
  reference_number: string | null;
  proof_url: string | null;
  status: PaymentStatus;
  verified_by: string | null;
  verified_at: string | null;
  failure_reason: string | null;
  paymongo_payment_intent_id: string | null;
}

// ── API Response Envelope ─────────────────────────────────────
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  code?: string;
}

// ── Tenant Context (injected by middleware) ───────────────────
export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  planTier: PlanTier;
  planStatus: PlanStatus;
  isTrialActive: boolean;
  isOrderingEnabled: boolean;
  graceEndsAt: string | null;   // UTC ISO — null if not in GRACE or not set
}

// ── Auth Context (injected by middleware for staff routes) ────
export interface AuthContext extends TenantContext {
  staffId: string;
  role: StaffRole;
  branchId: string | null;
  displayName: string;
}
