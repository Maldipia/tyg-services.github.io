'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const SURFACE = '#161b27';
const SURFACE2 = '#1e2535';
const TEXT = '#e2e8f0';
const MUTED = '#64748b';
const BORDER = 'rgba(255,255,255,0.08)';
const BRAND = '#22c55e';

interface DiscoveryRow {
  id: string;
  business_name: string;
  business_type: string;
  branch_count: string;
  location: string;
  years_operating: string;
  current_pos: string;
  current_ordering: string;
  pain_points: string[];
  primary_goal: string;
  monthly_transaction_volume: string;
  budget_range: string;
  timeline: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  best_time_to_call: string;
  notes: string;
  status: string;
  internal_assessment: string | null;
  created_at: string;
}

const STATUS_C: Record<string, { bg: string; color: string; label: string }> = {
  new:        { bg: 'rgba(99,102,241,0.12)', color: '#818cf8', label: 'New' },
  contacted:  { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'Contacted' },
  qualified:  { bg: 'rgba(34,197,94,0.12)',  color: '#22c55e', label: 'Qualified' },
  converted:  { bg: 'rgba(168,85,247,0.12)', color: '#c084fc', label: 'Converted' },
  not_a_fit:  { bg: 'rgba(239,68,68,0.12)',  color: '#f87171', label: 'Not a Fit' },
};

const PLAN_MAP: Record<string, string> = {
  '₱300–₱600 / mo': 'STARTER',
  '₱600–₱1,000 / mo': 'STARTER/BUSINESS',
  '₱1,000–₱2,000 / mo': 'BUSINESS',
  '₱2,000+ / mo': 'PRO',
  'Flexible, depends on features': 'TBD',
};

export default function DiscoveryAdminPage() {
  const router = useRouter();
  const [rows, setRows] = useState<DiscoveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/superadmin/auth', { method: 'GET' }).then(r => {
      if (r.status === 401) router.push('/superadmin/login');
    }).catch(() => {});

    fetch('/api/superadmin/discovery')
      .then(r => { if (r.status === 401) { router.push('/superadmin/login'); return null; } return r.json(); })
      .then((d: { data?: DiscoveryRow[] } | null) => { if (d?.data) setRows(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [router]);

  const filtered = rows.filter(r => {
    const matchSearch = !search || [r.business_name, r.contact_name, r.contact_email, r.location].some(v =>
      v?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = filterStatus === 'ALL' || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    await fetch(`/api/superadmin/discovery/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => {});
    setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    setUpdating(null);
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila',
  });

  const counts = Object.fromEntries(
    Object.keys(STATUS_C).map(s => [s, rows.filter(r => r.status === s).length])
  );

  return (
    <div style={{ color: TEXT, fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Link href="/superadmin" style={{ color: MUTED, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              <ArrowLeft size={13} /> Back
            </Link>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', marginBottom: 4 }}>Discovery Responses</h1>
          <p style={{ fontSize: 13, color: MUTED }}>{rows.length} total submissions</p>
        </div>
        {/* New badge */}
        {counts.new > 0 && (
          <div style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 99, padding: '6px 16px', fontSize: 13, color: '#818cf8', fontWeight: 700 }}>
            {counts.new} new
          </div>
        )}
      </div>

      {/* Status summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_C).map(([key, c]) => (
          <div key={key} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 16px', minWidth: 90 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{counts[key] || 0}</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: MUTED }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by business, contact, email…"
            style={{ width: '100%', paddingLeft: 34, paddingRight: 14, height: 38, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['ALL', ...Object.keys(STATUS_C)].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: filterStatus === s ? BRAND : BORDER, background: filterStatus === s ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)', color: filterStatus === s ? BRAND : MUTED }}>
              {s === 'ALL' ? 'All' : STATUS_C[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: MUTED }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: MUTED }}>
          {rows.length === 0 ? 'No submissions yet. Share tygservices.com/discovery to start collecting leads.' : 'No results match your filter.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(row => {
            const sc = STATUS_C[row.status] || STATUS_C.new;
            const isOpen = expanded === row.id;
            const suggestedPlan = PLAN_MAP[row.budget_range] || '—';

            return (
              <div key={row.id} style={{ background: SURFACE, border: `1px solid ${isOpen ? 'rgba(34,197,94,0.2)' : BORDER}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                {/* Row summary */}
                <div
                  onClick={() => setExpanded(isOpen ? null : row.id)}
                  style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  {/* Business & contact */}
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.business_name}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>{row.contact_name} · {row.location}</div>
                  </div>
                  {/* Type */}
                  <div style={{ flex: '0 0 120px', fontSize: 12, color: MUTED, display: 'none' }}>{row.business_type}</div>
                  {/* Suggested plan */}
                  <div style={{ flex: '0 0 110px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: BRAND, background: 'rgba(34,197,94,0.1)', borderRadius: 6, padding: '3px 8px' }}>
                      {suggestedPlan}
                    </span>
                  </div>
                  {/* Budget */}
                  <div style={{ flex: '0 0 160px', fontSize: 12, color: TEXT }}>{row.budget_range || '—'}</div>
                  {/* Date */}
                  <div style={{ flex: '0 0 130px', fontSize: 11, color: MUTED }}>{fmtDate(row.created_at)}</div>
                  {/* Status pill + changer */}
                  <div onClick={e => e.stopPropagation()} style={{ flex: '0 0 130px' }}>
                    <select
                      value={row.status}
                      onChange={e => updateStatus(row.id, e.target.value)}
                      disabled={updating === row.id}
                      style={{
                        background: sc.bg, color: sc.color, border: `1px solid ${sc.color}40`,
                        borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700,
                        cursor: 'pointer', outline: 'none', appearance: 'none', fontFamily: 'inherit',
                      }}>
                      {Object.entries(STATUS_C).map(([k, c]) => (
                        <option key={k} value={k}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  {/* Expand toggle */}
                  <div style={{ color: MUTED }}>
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${BORDER}` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20, marginTop: 20 }}>
                      {/* Business Info */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: BRAND, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Business Info</div>
                        {[
                          ['Type', row.business_type],
                          ['Branches', row.branch_count],
                          ['Years Operating', row.years_operating],
                          ['Current POS', row.current_pos],
                          ['Current Ordering', row.current_ordering],
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13 }}>
                            <span style={{ color: MUTED, minWidth: 130 }}>{k}</span>
                            <span style={{ color: TEXT }}>{v || '—'}</span>
                          </div>
                        ))}
                      </div>
                      {/* Goals */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Goals & Budget</div>
                        {[
                          ['Primary Goal', row.primary_goal],
                          ['Monthly Volume', row.monthly_transaction_volume],
                          ['Budget', row.budget_range],
                          ['Timeline', row.timeline],
                          ['Suggested Plan', suggestedPlan],
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13 }}>
                            <span style={{ color: MUTED, minWidth: 130 }}>{k}</span>
                            <span style={{ color: TEXT }}>{v || '—'}</span>
                          </div>
                        ))}
                      </div>
                      {/* Contact */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Contact</div>
                        {[
                          ['Name', row.contact_name],
                          ['Email', row.contact_email],
                          ['Phone', row.contact_phone],
                          ['Best Time', row.best_time_to_call],
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13 }}>
                            <span style={{ color: MUTED, minWidth: 130 }}>{k}</span>
                            <span style={{ color: TEXT }}>{v || '—'}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <a href={`mailto:${row.contact_email}`} style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 8, padding: '6px 14px', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>Email</a>
                          <a href={`tel:${row.contact_phone}`} style={{ background: 'rgba(34,197,94,0.1)', border: `1px solid rgba(34,197,94,0.3)`, color: BRAND, borderRadius: 8, padding: '6px 14px', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>Call</a>
                        </div>
                      </div>
                    </div>

                    {/* Pain Points */}
                    {row.pain_points?.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>Pain Points</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {row.pain_points.map(p => (
                            <span key={p} style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, color: TEXT }}>{p}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {row.notes && (
                      <div style={{ marginTop: 16, background: SURFACE2, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: TEXT, lineHeight: 1.6, borderLeft: `3px solid ${BRAND}` }}>
                        <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>Notes from client</div>
                        {row.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
