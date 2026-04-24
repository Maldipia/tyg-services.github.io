'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Users, ShoppingBag, UtensilsCrossed, MapPin,
  Activity, Shield, ToggleLeft, ToggleRight, AlertTriangle,
  Lock, Unlock, RefreshCw, LogOut, ChevronDown, ChevronUp,
  TrendingUp, Zap
} from 'lucide-react';

interface Tenant360 {
  tenant: Record<string,unknown>;
  staff: Array<Record<string,unknown>>;
  menu: Array<Record<string,unknown>>;
  orders: Array<Record<string,unknown>>;
  features: Array<{ feature_key: string; enabled: boolean; note?: string }>;
  audit: Array<Record<string,unknown>>;
  tables: Array<Record<string,unknown>>;
  health: { score: number; label: string };
  onboarding_progress: number;
  revenue_chart: Array<{ date: string; amount: number }>;
}

const FEATURES = [
  { key: 'qr_ordering',   label: 'QR Ordering',   category: 'core' },
  { key: 'kitchen_display', label: 'Kitchen Display', category: 'core' },
  { key: 'analytics',     label: 'Analytics',     category: 'core' },
  { key: 'pos_enabled',   label: 'POS Enabled',   category: 'core' },
  { key: 'discounts',     label: 'Discounts',     category: 'core' },
  { key: 'payment_upload', label: 'Payment Upload', category: 'core' },
  { key: 'delivery',      label: 'Delivery',      category: 'advanced' },
  { key: 'inventory',     label: 'Inventory',     category: 'advanced' },
  { key: 'reservations',  label: 'Reservations',  category: 'advanced' },
  { key: 'sms_notify',    label: 'SMS Notify',    category: 'advanced' },
  { key: 'multi_branch',  label: 'Multi-Branch',  category: 'advanced' },
  { key: 'bir_receipts',  label: 'BIR Receipts',  category: 'advanced' },
];

const HEALTH_CONFIG = {
  healthy: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', emoji: '🟢' },
  at_risk: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', emoji: '🟡' },
  dead:    { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  emoji: '🔴' },
};

export default function Tenant360Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Tenant360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');

  const load = async () => {
    const r = await fetch(`/api/superadmin/tenants/${id}`);
    const d = await r.json() as { data: Tenant360 };
    setData(d.data);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [id]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const doAction = async (action: string, body?: Record<string,unknown>) => {
    setSaving(true);
    await fetch(`/api/superadmin/tenants/${id}/controls`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force_action: action, ...body }),
    });
    setSaving(false);
    showToast(`✅ ${action.replace(/_/g, ' ')} done`);
    void load();
  };

  const toggleFeature = async (key: string, current: boolean) => {
    setSaving(true);
    await fetch(`/api/superadmin/tenants/${id}/controls`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features: { [key]: !current } }),
    });
    setSaving(false);
    showToast(`✅ ${key} ${!current ? 'enabled' : 'disabled'}`);
    void load();
  };

  const updateLimit = async (field: string, value: number) => {
    await fetch(`/api/superadmin/tenants/${id}/controls`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    showToast(`✅ ${field} updated`);
    void load();
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: '#64748b' }}>
      Loading tenant data…
    </div>
  );

  if (!data) return <div>Tenant not found</div>;

  const { tenant, staff, menu, orders, features, audit, health, onboarding_progress, revenue_chart } = data;
  const featureMap: Record<string, boolean> = {};
  features.forEach(f => { featureMap[f.feature_key] = f.enabled; });
  const hc = HEALTH_CONFIG[health.label as keyof typeof HEALTH_CONFIG] ?? HEALTH_CONFIG.dead;
  const maxRevenue = Math.max(...revenue_chart.map(r => r.amount), 1);

  const Section = ({ id: sid, title, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
      <button onClick={() => setExpandedSection(s => s === sid ? null : sid)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
          {icon}{title}
        </div>
        {expandedSection === sid ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
      </button>
      {expandedSection === sid && (
        <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--border)' }}>
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 900 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, padding: '10px 18px', borderRadius: 10, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', fontWeight: 600, fontSize: 13 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push('/superadmin/tenants')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
          <ArrowLeft size={14} /> Back
        </button>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 20 }}>{tenant.name as string}</h1>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>/{tenant.slug as string} · {tenant.owner_email as string}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: hc.bg, border: `1px solid ${hc.border}`, color: hc.color }}>
            {hc.emoji} {health.label?.replace('_', ' ').toUpperCase()} · {health.score}/100
          </span>
          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>
            {tenant.plan_tier as string} · {tenant.plan_status as string}
          </span>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Onboarding', value: `${onboarding_progress}%`, sub: onboarding_progress === 100 ? '✅ Complete' : '⏳ In progress', color: '#6366f1' },
          { label: 'Menu Items', value: String(menu.length), sub: 'total items', color: '#22c55e' },
          { label: 'Staff', value: String(staff.length), sub: 'members', color: '#3b82f6' },
          { label: 'Orders', value: String(orders.length), sub: 'recent 20', color: '#f59e0b' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Onboarding progress bar */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Zap size={16} style={{ color: '#6366f1', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
            <span>Onboarding Progress</span><span style={{ color: '#6366f1' }}>{onboarding_progress}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${onboarding_progress}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: 99, transition: 'width 0.4s' }} />
          </div>
        </div>
        {onboarding_progress < 100 && (
          <button onClick={() => doAction('reset_onboarding')} disabled={saving}
            style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Reset & Re-trigger
          </button>
        )}
      </div>

      {/* Revenue mini chart */}
      {revenue_chart.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TrendingUp size={14} style={{ color: '#22c55e' }} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Revenue (last 30 days)</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: '#22c55e' }}>
              ₱{revenue_chart.reduce((s, r) => s + r.amount, 0).toLocaleString()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 48 }}>
            {revenue_chart.slice(-30).map(r => (
              <div key={r.date} style={{ flex: 1, background: '#22c55e', borderRadius: '2px 2px 0 0', height: `${Math.max((r.amount / maxRevenue) * 100, 4)}%`, opacity: 0.7 }} title={`${r.date}: ₱${r.amount}`} />
            ))}
          </div>
        </div>
      )}

      {/* Force Actions */}
      <Section id="actions" title="Force Actions" icon={<Shield size={14} style={{ color: '#ef4444' }} />}>
        <div style={{ paddingTop: 14, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {[
            { action: 'force_logout', label: '⏏ Force Logout All Staff', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)' },
            { action: 'lock_pos',    label: '🔒 Lock POS',               color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' },
            { action: 'unlock_pos',  label: '🔓 Unlock POS',             color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.25)' },
            { action: 'reset_onboarding', label: '↺ Reset Onboarding',  color: '#6366f1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.25)' },
          ].map(a => (
            <button key={a.action} onClick={() => doAction(a.action)} disabled={saving}
              style={{ padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', color: a.color, background: a.bg, border: `1px solid ${a.border}` }}>
              {a.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Feature Toggles */}
      <Section id="features" title="Feature Toggles" icon={<Activity size={14} style={{ color: '#6366f1' }} />}>
        <div style={{ paddingTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {FEATURES.map(f => {
            const on = featureMap[f.key] !== false; // default on
            return (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 9, background: on ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)', border: `1px solid ${on ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{f.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.category}</div>
                </div>
                <button onClick={() => toggleFeature(f.key, on)} disabled={saving}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: on ? '#22c55e' : '#94a3b8' }}>
                  {on ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                </button>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Limits */}
      <Section id="limits" title="Limit Controls" icon={<AlertTriangle size={14} style={{ color: '#f59e0b' }} />}>
        <div style={{ paddingTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[
            { field: 'max_products', label: 'Max Products', current: tenant.max_products as number ?? 500 },
            { field: 'max_staff',    label: 'Max Staff',    current: tenant.max_staff    as number ?? 20 },
            { field: 'max_branches', label: 'Max Branches', current: tenant.max_branches as number ?? 1 },
          ].map(l => (
            <div key={l.field} style={{ background: 'var(--surface-2)', borderRadius: 9, padding: '12px 14px' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{l.label}</label>
              <input type="number" defaultValue={l.current} min={0} max={9999}
                style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 14, fontWeight: 700, color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }}
                onBlur={e => updateLimit(l.field, parseInt(e.target.value) || 0)} />
            </div>
          ))}
        </div>
      </Section>

      {/* Staff */}
      <Section id="staff" title={`Staff (${staff.length})`} icon={<Users size={14} />}>
        <div style={{ paddingTop: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Name','Role','Active','Last Login'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {(staff as Array<Record<string,unknown>>).map(s => (
                <tr key={s.id as string} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 8px', fontWeight: 600 }}>{s.display_name as string}</td>
                  <td style={{ padding: '8px 8px', color: 'var(--text-muted)' }}>{s.role as string}</td>
                  <td style={{ padding: '8px 8px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: s.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: s.is_active ? '#22c55e' : '#ef4444' }}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ padding: '8px 8px', color: 'var(--text-muted)' }}>{s.last_login ? new Date(s.last_login as string).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Recent Orders */}
      <Section id="orders" title={`Recent Orders (${orders.length})`} icon={<ShoppingBag size={14} />}>
        <div style={{ paddingTop: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Order#','Customer','Status','Amount','Date'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {(orders as Array<Record<string,unknown>>).map(o => (
                <tr key={o.id as string} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '7px 8px', fontWeight: 600, fontFamily: 'monospace', fontSize: 11 }}>{o.order_number as string}</td>
                  <td style={{ padding: '7px 8px' }}>{(o.customer_name as string) || '—'}</td>
                  <td style={{ padding: '7px 8px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'var(--surface-2)', color: 'var(--text-muted)' }}>{o.status as string}</span></td>
                  <td style={{ padding: '7px 8px', fontWeight: 700, color: '#22c55e' }}>₱{Number(o.total_amount).toLocaleString()}</td>
                  <td style={{ padding: '7px 8px', color: 'var(--text-muted)', fontSize: 11 }}>{new Date(o.created_at as string).toLocaleDateString()}</td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={5} style={{ padding: '20px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>No orders yet</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Activity Log */}
      <Section id="audit" title="Activity Log" icon={<Activity size={14} />}>
        <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(audit as Array<Record<string,unknown>>).length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13, paddingTop: 4 }}>No activity logged yet.</div>}
          {(audit as Array<Record<string,unknown>>).map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(a.created_at as string).toLocaleDateString()}</span>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{a.action as string}</span>
              <span style={{ color: 'var(--text-muted)' }}>{a.note as string}</span>
              {a.new_value && <span style={{ marginLeft: 'auto', color: '#22c55e', fontWeight: 600 }}>→ {a.new_value as string}</span>}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
