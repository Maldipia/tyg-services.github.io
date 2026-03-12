'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  TrendingUp, ShoppingBag, CheckCircle, XCircle, Clock,
  ArrowRight, RefreshCw, Banknote, ChevronDown, ChevronUp,
  AlertTriangle, Zap, ChefHat, BarChart3, Printer,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────
interface DashStats {
  todaySales: number; completedOrders: number; pendingOrders: number;
  cancelledOrders: number; todayOrders: number; avgOrderValue: number;
}
interface LiveOrder {
  id: string; order_number: string; status: string;
  total_amount: number; customer_name: string; created_at: string; pax: number;
}
interface TableRow { id: string; name: string; is_active: boolean; qr_token: string; }

// ─── Design tokens ────────────────────────────────────────────
const C = {
  bg: '#0c1018', surface: '#111722', surface2: '#171f2e', surface3: '#1d2538',
  border: 'rgba(255,255,255,0.06)', border2: 'rgba(255,255,255,0.10)',
  text: '#e8eaf0', muted: '#5a6a82', dim: '#8494a8',
  brand: '#22c55e', amber: '#f59e0b', red: '#ef4444',
  violet: '#7c3aed', blue: '#3b82f6', orange: '#f97316',
};

const STATUS: Record<string, { color: string; bg: string; label: string; next: string | null; nextLabel: string | null }> = {
  PENDING:   { color: C.amber,  bg: 'rgba(245,158,11,0.12)',  label: 'Pending',   next: 'CONFIRMED', nextLabel: 'Confirm' },
  CONFIRMED: { color: C.blue,   bg: 'rgba(59,130,246,0.12)',  label: 'Confirmed', next: 'PREPARING', nextLabel: 'Start Prep' },
  PREPARING: { color: C.orange, bg: 'rgba(249,115,22,0.12)',  label: 'Preparing', next: 'READY',     nextLabel: 'Mark Ready' },
  READY:     { color: C.brand,  bg: 'rgba(34,197,94,0.12)',   label: 'Ready',     next: 'COMPLETED', nextLabel: 'Complete' },
  COMPLETED: { color: '#10b981',bg: 'rgba(16,185,129,0.12)', label: 'Completed', next: null,        nextLabel: null },
  CANCELLED: { color: C.red,    bg: 'rgba(239,68,68,0.12)',   label: 'Cancelled', next: null,        nextLabel: null },
};

// ─── Sub-components ───────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, trend, loading }:
  { label: string; value: string; sub: string; icon: React.ElementType; color: string; trend?: number; loading?: boolean }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: color + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} style={{ color }} />
        </div>
        {trend !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
            color: trend >= 0 ? C.brand : C.red,
            background: trend >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4 }}>
        {loading ? <span style={{ color: C.muted }}>—</span> : value}
      </div>
      <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// ─── Inline Order Card with status bump ───────────────────────
function OrderCard({ order, onStatusChange }: { order: LiveOrder; onStatusChange: (id: string, status: string) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false);
  const [bumping, setBumping] = useState(false);
  const s = STATUS[order.status] ?? STATUS.PENDING;
  const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const isLate = elapsed > 15 && !['COMPLETED','CANCELLED'].includes(order.status);

  const handleNext = async () => {
    if (!s.next) return;
    setBumping(true);
    await onStatusChange(order.id, s.next);
    setBumping(false);
  };
  const handleCancel = async () => {
    setBumping(true);
    await onStatusChange(order.id, 'CANCELLED');
    setBumping(false);
  };

  return (
    <div style={{ background: expanded ? C.surface2 : 'transparent',
      border: `1px solid ${expanded ? C.border2 : C.border}`,
      borderLeft: `3px solid ${s.color}`,
      borderRadius: 11, padding: '12px 14px', marginBottom: 6,
      transition: 'all 0.15s', cursor: 'pointer' }}
      onClick={() => setExpanded(p => !p)}>

      {/* Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>#{order.order_number}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
              letterSpacing: '0.05em', background: s.bg, color: s.color }}>{s.label}</span>
            {isLate && (
              <span style={{ fontSize: 10, fontWeight: 700, color: C.red,
                background: 'rgba(239,68,68,0.12)', padding: '2px 7px', borderRadius: 99 }}>
                ⚠ {elapsed}min
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>{order.customer_name} · {order.pax} pax</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>₱{Number(order.total_amount).toFixed(2)}</div>
          <div style={{ fontSize: 10, color: C.muted }}>{elapsed}m ago</div>
        </div>
        <div style={{ color: C.muted, flexShrink: 0, marginLeft: 4 }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Expanded actions */}
      {expanded && (
        <div onClick={e => e.stopPropagation()}
          style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 6 }}>
          {s.next && s.nextLabel && (
            <button disabled={bumping} onClick={handleNext}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: `linear-gradient(135deg, ${s.color}22, ${s.color}11)`,
                border: `1px solid ${s.color}44`, color: s.color,
                opacity: bumping ? 0.6 : 1, cursor: bumping ? 'not-allowed' : 'pointer' }}>
              {bumping ? '…' : `→ ${s.nextLabel}`}
            </button>
          )}
          <Link href={`/admin/orders`}
            style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: C.surface3, border: `1px solid ${C.border}`, color: C.dim,
              display: 'flex', alignItems: 'center', gap: 4 }}>
            Details
          </Link>
          {!['COMPLETED','CANCELLED'].includes(order.status) && (
            <button disabled={bumping} onClick={handleCancel}
              style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                color: C.red, cursor: bumping ? 'not-allowed' : 'pointer' }}>
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Floor Plan widget ────────────────────────────────────────
function FloorPlan({ tables, activeOrders }: { tables: TableRow[]; activeOrders: LiveOrder[] }) {
  const occupiedIds = new Set(activeOrders.map(() => ''));

  // Map order status to table display (simplified — shows any occupied table)
  const tableStatus = (table: TableRow) => {
    // For demo: alternate a few tables — in production would match table_id on orders
    return null as string | null;
  };

  if (tables.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>
        No tables set up yet.{' '}
        <Link href="/admin/tables" style={{ color: C.brand }}>Add tables →</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 6, padding: '12px 14px' }}>
      {tables.slice(0, 12).map(table => (
        <div key={table.id}
          style={{ background: C.surface3, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '8px 6px', textAlign: 'center', cursor: 'pointer' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.dim,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {table.name}
          </div>
          <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>Empty</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function DashboardPage() {
  const [stats, setStats] = useState<DashStats>({ todaySales: 0, completedOrders: 0, pendingOrders: 0, cancelledOrders: 0, todayOrders: 0, avgOrderValue: 0 });
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [role, setRole] = useState('OWNER');
  const [planTier, setPlanTier] = useState('TRIAL');
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const supabase = createBrowserClient();
  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Load session info
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('tyg_session') ?? '{}') as { tenantSlug?: string; tenantId?: string; role?: string };
      const t = JSON.parse(localStorage.getItem('tyg_tenant') ?? '{}') as { plan?: string; trialEndsAt?: string };
      setTenantSlug(s.tenantSlug ?? '');
      setTenantId(s.tenantId ?? '');
      setRole(s.role ?? 'OWNER');
      setPlanTier(t.plan ?? 'TRIAL');
      if (t.trialEndsAt) {
        const days = Math.ceil((new Date(t.trialEndsAt).getTime() - Date.now()) / 86_400_000);
        setTrialDaysLeft(days > 0 ? days : 0);
      }
    } catch { /* */ }
  }, []);

  // Derive stats from live orders
  const buildStats = useCallback((orders: LiveOrder[]) => {
    const completed = orders.filter(o => o.status === 'COMPLETED');
    const sales = completed.reduce((s, o) => s + Number(o.total_amount), 0);
    setStats({
      todaySales: sales,
      completedOrders: completed.length,
      pendingOrders: orders.filter(o => ['PENDING','CONFIRMED','PREPARING','READY'].includes(o.status)).length,
      cancelledOrders: orders.filter(o => o.status === 'CANCELLED').length,
      todayOrders: orders.length,
      avgOrderValue: completed.length > 0 ? sales / completed.length : 0,
    });
  }, []);

  // Load orders from API
  const loadOrders = useCallback(async (slug: string) => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/orders?tenantSlug=${slug}&limit=30`, { credentials: 'include' });
      if (!res.ok) return;
      const j = await res.json() as { data?: LiveOrder[] };
      const orders = j.data ?? [];
      setLiveOrders(orders.filter(o => !['COMPLETED','CANCELLED'].includes(o.status)).slice(0, 8));
      buildStats(orders);
    } catch { /* */ } finally { setLoading(false); setRefreshing(false); }
  }, [buildStats]);

  // Load tables
  const loadTables = useCallback(async (tid: string) => {
    if (!tid) return;
    try {
      const { data } = await supabase.from('restaurant_tables')
        .select('id, name, is_active, qr_token')
        .eq('tenant_id', tid).eq('is_active', true).order('name').limit(12);
      setTables((data ?? []) as TableRow[]);
    } catch { /* */ }
  }, [supabase]);

  useEffect(() => {
    if (tenantSlug) { void loadOrders(tenantSlug); }
    if (tenantId) { void loadTables(tenantId); }
  }, [tenantSlug, tenantId, loadOrders, loadTables]);

  // Realtime
  useEffect(() => {
    if (!tenantId || !tenantSlug) return;
    const ch = supabase.channel('dash-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` },
        () => { void loadOrders(tenantSlug); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [tenantId, tenantSlug, loadOrders, supabase]);

  // Inline status bump
  const handleStatusChange = useCallback(async (orderId: string, newStatus: string) => {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, cancelReason: newStatus === 'CANCELLED' ? 'Customer changed mind' : undefined }),
    });
    if (res.ok && tenantSlug) { void loadOrders(tenantSlug); }
  }, [tenantSlug, loadOrders]);

  // Hourly chart data (mock — replace with real analytics)
  const hourlyBars = [5,15,22,18,35,55,90,85,70,48,62,58];

  const isOwnerOrAdmin = ['OWNER','ADMIN','MANAGER'].includes(role);
  const showTrialBanner = planTier === 'TRIAL' && trialDaysLeft !== null && trialDaysLeft > 3 && trialDaysLeft <= 7;

  return (
    <div style={{ color: C.text, fontFamily: "'Sora','Inter',system-ui,sans-serif", maxWidth: 1400 }}>
      <style>{`
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .spin-slow { animation: spin-slow 1.2s linear infinite; }
        .pulse-dot { animation: pulse-dot 2s ease infinite; }
        .bar-hover:hover { filter: brightness(1.3); }
        a { text-decoration: none; color: inherit; }
      `}</style>

      {/* ── Softer trial warning (5-7 days) ── */}
      {showTrialBanner && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={14} style={{ color: C.amber, flexShrink: 0 }} />
            <span style={{ fontSize: 13 }}>
              <strong style={{ color: C.amber }}>Free trial: {trialDaysLeft} days remaining.</strong>
              {' '}Upgrade before it expires to avoid any interruption.
            </span>
          </div>
          <Link href="/admin/billing" style={{ fontSize: 12, fontWeight: 700, color: C.amber,
            background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
            padding: '6px 14px', borderRadius: 8, flexShrink: 0 }}>
            View Plans
          </Link>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>Dashboard</h2>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: C.muted }}>{today}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => { setRefreshing(true); void loadOrders(tenantSlug); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 10, background: C.surface2, border: `1px solid ${C.border}`,
              color: C.muted, fontSize: 13, fontWeight: 500 }}>
            <RefreshCw size={13} className={refreshing ? 'spin-slow' : ''} />
            Refresh
          </button>
          <Link href="/admin/orders" style={{ display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10,
            background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: 'white',
            fontSize: 13, fontWeight: 700, boxShadow: '0 4px 14px rgba(34,197,94,0.25)' }}>
            All Orders <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="Today's Revenue" value={`₱${stats.todaySales.toLocaleString('en-PH',{minimumFractionDigits:2})}`}
          sub={`${stats.completedOrders} completed`} icon={Banknote} color={C.brand} loading={loading} />
        <StatCard label="Active Orders" value={String(stats.pendingOrders)}
          sub="Pending + preparing" icon={Clock} color={C.amber} loading={loading} />
        <StatCard label="Total Today" value={String(stats.todayOrders)}
          sub="Since midnight" icon={ShoppingBag} color={C.blue} loading={loading} />
        <StatCard label="Avg Order" value={`₱${Math.round(stats.avgOrderValue).toLocaleString('en-PH')}`}
          sub="Per completed order" icon={TrendingUp} color={C.violet} loading={loading} />
      </div>

      {/* ── Main grid: 2 columns ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: 16, marginBottom: 16 }}>

        {/* ── Live Orders — command center ── */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Live Orders</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.brand }}>
                <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: '50%',
                  background: C.brand, display: 'inline-block' }} />
                Realtime
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Link href="/admin/orders" style={{ fontSize: 12, color: C.muted }}>View all →</Link>
            </div>
          </div>

          {/* Hint */}
          <div style={{ padding: '8px 18px 0' }}>
            <p style={{ margin: 0, fontSize: 11, color: C.muted }}>
              Tap any order to see actions — confirm, advance, or cancel without leaving this page.
            </p>
          </div>

          <div style={{ padding: '8px 14px 14px' }}>
            {loading ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: C.muted }}>Loading…</div>
            ) : liveOrders.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <CheckCircle size={32} style={{ color: C.muted, display: 'block', margin: '0 auto 10px' }} />
                <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>All caught up — no active orders</p>
              </div>
            ) : (
              liveOrders.map(order => (
                <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
              ))
            )}
          </div>
        </div>

        {/* ── Right column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Today's Summary */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14 }}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${C.border}`,
              fontWeight: 700, fontSize: 13 }}>Today's Summary</div>
            <div style={{ padding: '14px 16px' }}>
              {[
                { label: 'Completed', value: stats.completedOrders, color: C.brand, icon: CheckCircle },
                { label: 'Active',    value: stats.pendingOrders,   color: C.amber, icon: Clock },
                { label: 'Cancelled', value: stats.cancelledOrders, color: C.red,   icon: XCircle },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <item.icon size={14} style={{ color: item.color }} />
                    <span style={{ fontSize: 13, color: C.dim }}>{item.label}</span>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 15, color: item.color }}>{item.value}</span>
                </div>
              ))}

              {/* Completion bar */}
              <div style={{ height: 1, background: C.border, margin: '4px 0 12px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: 11, color: C.muted }}>Completion Rate</span>
                <span style={{ fontWeight: 700, fontSize: 12 }}>
                  {stats.todayOrders > 0 ? Math.round((stats.completedOrders / stats.todayOrders) * 100) : 0}%
                </span>
              </div>
              <div style={{ height: 5, background: C.surface3, borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99,
                  background: 'linear-gradient(90deg,#22c55e,#16a34a)',
                  width: `${stats.todayOrders > 0 ? (stats.completedOrders / stats.todayOrders) * 100 : 0}%`,
                  transition: 'width 0.6s ease' }} />
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14 }}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${C.border}`,
              fontWeight: 700, fontSize: 13 }}>Quick Actions</div>
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Link href="/kitchen" style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 9,
                background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
                color: C.orange, fontSize: 12, fontWeight: 700 }}>
                <ChefHat size={14} />
                <span style={{ flex: 1 }}>Open Kitchen Display</span>
                <ArrowRight size={12} />
              </Link>
              {isOwnerOrAdmin && (
                <Link href="/admin/analytics" style={{ display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 9,
                  background: C.surface2, border: `1px solid ${C.border}`,
                  color: C.dim, fontSize: 12, fontWeight: 600 }}>
                  <BarChart3 size={14} />
                  <span style={{ flex: 1 }}>View Analytics</span>
                  <ArrowRight size={12} />
                </Link>
              )}
              <Link href="/admin/tables" style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 9,
                background: C.surface2, border: `1px solid ${C.border}`,
                color: C.dim, fontSize: 12, fontWeight: 600 }}>
                <Printer size={14} />
                <span style={{ flex: 1 }}>Print QR Codes</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row: Floor Plan + Hourly chart ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Floor Plan */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 18px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Floor Plan</span>
            <Link href="/admin/tables" style={{ fontSize: 11, color: C.muted }}>Manage →</Link>
          </div>
          <FloorPlan tables={tables} activeOrders={liveOrders} />
        </div>

        {/* Hourly revenue chart */}
        {isOwnerOrAdmin && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '13px 18px', borderBottom: `1px solid ${C.border}` }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Revenue Today</span>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Hourly estimate</div>
              </div>
              <Link href="/admin/analytics" style={{ fontSize: 11, color: C.muted }}>Full report →</Link>
            </div>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 70 }}>
                {hourlyBars.map((h, i) => (
                  <div key={i} className="bar-hover" style={{ flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                    <div style={{ width: '100%', height: `${(h / 100) * 60}px`, borderRadius: '4px 4px 0 0',
                      background: i === new Date().getHours() - 9 ? C.brand : C.brand + '35',
                      transition: 'all 0.2s', minHeight: 3 }} />
                    <div style={{ fontSize: 9, color: C.muted, whiteSpace: 'nowrap' }}>
                      {((9 + i) % 12) || 12}{i + 9 < 12 ? 'am' : 'pm'}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: C.muted }}>Peak hour: 6pm</span>
                <Link href="/admin/analytics" style={{ fontSize: 11, fontWeight: 700, color: C.brand }}>
                  Detailed breakdown →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
