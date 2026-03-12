'use client';
import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Shield, ChefHat, CreditCard, BarChart3, Key, RefreshCw, CheckCircle } from 'lucide-react';
import type { StaffRole } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyIcon = any;

interface StaffMember {
  id: string;
  name: string;
  display_name: string;
  role: StaffRole;
  branch_id: string | null;
  is_active: boolean;
  last_login: string | null;
}

function Crown(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={props.size ?? 16} height={props.size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 20h20M5 20V10l7-6 7 6v10"/>
    </svg>
  );
}

const ROLE_CONFIG: Record<StaffRole, { label: string; color: string; bg: string; icon: AnyIcon; desc: string }> = {
  OWNER:   { label: 'Owner',   color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  icon: Crown,      desc: 'Full access to everything' },
  ADMIN:   { label: 'Admin',   color: '#c084fc', bg: 'rgba(192,132,252,0.12)', icon: Shield,     desc: 'Manage staff, menu, settings' },
  MANAGER: { label: 'Manager', color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  icon: BarChart3,  desc: 'Orders + analytics' },
  CASHIER: { label: 'Cashier', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   icon: CreditCard, desc: 'Process orders + payments' },
  KITCHEN: { label: 'Kitchen', color: '#f97316', bg: 'rgba(249,115,22,0.12)',  icon: ChefHat,    desc: 'Kitchen display only' },
};

const inputStyle = {
  width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '11px 14px', color: 'var(--text)', fontSize: 14, outline: 'none',
  fontFamily: 'inherit',
};
const labelStyle = {
  display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 as const,
  marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' as const,
};

export default function StaffPage() {
  const [staff, setStaff]         = useState<StaffMember[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editStaff, setEditStaff] = useState<StaffMember | null>(null);
  const [resetPinId, setResetPinId] = useState<string | null>(null);
  const [toast, setToast]         = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadStaff = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/staff', { credentials: 'include' });
      if (r.ok) {
        const d = await r.json() as { data?: StaffMember[] };
        setStaff(d.data ?? []);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { void loadStaff(); }, []);

  const toggleActive = async (member: StaffMember) => {
    await fetch('/api/staff/' + member.id, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !member.is_active }),
    });
    showToast((!member.is_active ? 'Activated' : 'Deactivated') + ' ' + member.name);
    void loadStaff();
  };

  return (
    <div style={{ color: 'var(--text)' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', borderRadius: 12, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
          color: '#22c55e', fontSize: 13, fontWeight: 500 }}>
          <CheckCircle size={14} /> {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          {staff.filter(s => s.is_active).length} active · {staff.length} total
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadStaff}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9,
              background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)',
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <RefreshCw size={12} /> Refresh
          </button>
          <button onClick={() => { setEditStaff(null); setShowForm(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9,
              background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}>
            <Plus size={14} /> Add Staff
          </button>
        </div>
      </div>

      {/* Role cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        {(Object.entries(ROLE_CONFIG) as [StaffRole, typeof ROLE_CONFIG[StaffRole]][]).map(([role, cfg]) => (
          <div key={role} style={{ padding: '12px 10px', borderRadius: 14, textAlign: 'center',
            background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: cfg.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
              <cfg.icon size={14} style={{ color: cfg.color }} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 11, color: cfg.color }}>{cfg.label}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 3, lineHeight: 1.4 }}>{cfg.desc}</div>
          </div>
        ))}
      </div>

      {/* Staff list */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 700, fontSize: 15 }}>Staff Members</h3>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading staff...</div>
        ) : staff.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No staff found</div>
        ) : (
          staff.map((member, i) => {
            const rc = ROLE_CONFIG[member.role];
            return (
              <div key={member.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                borderBottom: i < staff.length - 1 ? '1px solid var(--border)' : undefined,
                opacity: member.is_active ? 1 : 0.5, transition: 'opacity 0.2s',
              }}>
                {/* Avatar */}
                <div style={{ width: 40, height: 40, borderRadius: 12, background: rc.bg, color: rc.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                  {member.name.charAt(0).toUpperCase()}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{member.name}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6,
                      background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                      @{member.display_name}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                    Last login: {member.last_login
                      ? new Date(member.last_login).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : 'Never'}
                  </div>
                </div>
                {/* Role */}
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
                  background: rc.bg, color: rc.color, flexShrink: 0 }}>
                  {rc.label}
                </span>
                {/* Status */}
                <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8, flexShrink: 0,
                  background: member.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)',
                  color: member.is_active ? '#22c55e' : '#6b7280' }}>
                  {member.is_active ? 'Active' : 'Inactive'}
                </span>
                {/* Actions */}
                {member.role !== 'OWNER' && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button title="Reset PIN" onClick={() => setResetPinId(member.id)}
                      style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
                        background: 'var(--surface-2)', color: 'var(--text-muted)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Key size={13} />
                    </button>
                    <button title="Edit" onClick={() => { setEditStaff(member); setShowForm(true); }}
                      style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
                        background: 'var(--surface-2)', color: 'var(--text-muted)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Pencil size={13} />
                    </button>
                    <button title={member.is_active ? 'Deactivate' : 'Activate'} onClick={() => void toggleActive(member)}
                      style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)',
                        background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <StaffFormModal
          staff={editStaff}
          onClose={() => { setShowForm(false); setEditStaff(null); }}
          onSaved={() => { setShowForm(false); setEditStaff(null); showToast(editStaff ? 'Staff updated!' : 'Staff added!'); void loadStaff(); }}
        />
      )}
      {resetPinId && (
        <ResetPinModal
          staffId={resetPinId}
          staffName={staff.find(s => s.id === resetPinId)?.name ?? ''}
          onClose={() => setResetPinId(null)}
          onReset={() => { setResetPinId(null); showToast('PIN reset successfully!'); void loadStaff(); }}
        />
      )}
    </div>
  );
}

// ─── Staff Form Modal ────────────────────────────────────────
function StaffFormModal({ staff, onClose, onSaved }: {
  staff: StaffMember | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName]               = useState(staff?.name ?? '');
  const [displayName, setDisplayName] = useState(staff?.display_name ?? '');
  const [role, setRole]               = useState<StaffRole>(staff?.role ?? 'CASHIER');
  const [pin, setPin]                 = useState('');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const handleSave = async () => {
    if (!name.trim() || !displayName.trim()) { setError('Name and display name are required'); return; }
    if (!staff && (pin.length < 4 || pin.length > 8)) { setError('PIN must be 4–8 digits'); return; }
    setSaving(true); setError('');
    try {
      const url  = staff ? '/api/staff/' + staff.id : '/api/staff';
      const body = staff
        ? { name: name.trim(), displayName: displayName.trim(), role }
        : { name: name.trim(), displayName: displayName.trim(), role, pin };
      const r = await fetch(url, {
        method: staff ? 'PATCH' : 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json() as { error?: string };
      if (!r.ok) { setError(d.error ?? 'Failed to save'); setSaving(false); return; }
      onSaved();
    } catch { setError('Network error'); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '100%', maxWidth: 440, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 700, fontSize: 17 }}>{staff ? 'Edit Staff' : 'Add Staff Member'}</h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: 22, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Full Name</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Maria Santos" />
          </div>
          <div>
            <label style={labelStyle}>Display Name (shown on login screen)</label>
            <input style={inputStyle} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Maria" />
          </div>
          {!staff && (
            <div>
              <label style={labelStyle}>PIN (4–8 digits)</label>
              <input style={inputStyle} type="password" inputMode="numeric" maxLength={8}
                value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
            </div>
          )}
          <div>
            <label style={labelStyle}>Role</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(['CASHIER', 'KITCHEN', 'MANAGER', 'ADMIN'] as StaffRole[]).map(r => {
                const rc = ROLE_CONFIG[r];
                return (
                  <button key={r} onClick={() => setRole(r)}
                    style={{ padding: '12px', borderRadius: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s',
                      background: role === r ? rc.bg : 'var(--surface-2)',
                      border: role === r ? '1px solid ' + rc.color + '50' : '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: role === r ? rc.color : 'var(--text)' }}>{rc.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{rc.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
          {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'var(--surface-2)', color: 'var(--text-muted)',
              border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>Cancel</button>
          <button onClick={() => void handleSave()} disabled={saving || !name || !displayName}
            style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              opacity: saving || !name || !displayName ? 0.6 : 1 }}>
            {saving ? 'Saving...' : staff ? 'Save Changes' : 'Add Staff'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reset PIN Modal ─────────────────────────────────────────
function ResetPinModal({ staffId, staffName, onClose, onReset }: {
  staffId: string; staffName: string;
  onClose: () => void; onReset: () => void;
}) {
  const [newPin, setNewPin]   = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const valid = newPin.length >= 4 && newPin === confirm;

  const handleReset = async () => {
    if (!valid) return;
    setSaving(true); setError('');
    try {
      const r = await fetch('/api/staff/' + staffId, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPin }),
      });
      const d = await r.json() as { error?: string };
      if (!r.ok) { setError(d.error ?? 'Failed to reset PIN'); setSaving(false); return; }
      onReset();
    } catch { setError('Network error'); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '100%', maxWidth: 360, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 700, fontSize: 16 }}>Reset PIN — {staffName}</h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: 22, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>New PIN (4–8 digits)</label>
            <input style={inputStyle} type="password" inputMode="numeric" maxLength={8}
              value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="Enter new PIN" />
          </div>
          <div>
            <label style={labelStyle}>Confirm PIN</label>
            <input style={inputStyle} type="password" inputMode="numeric" maxLength={8}
              value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g, ''))} placeholder="Repeat PIN" />
          </div>
          {newPin && confirm && newPin !== confirm && (
            <p style={{ color: '#ef4444', fontSize: 12 }}>PINs do not match</p>
          )}
          {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'var(--surface-2)', color: 'var(--text-muted)',
              border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>Cancel</button>
          <button onClick={() => void handleReset()} disabled={!valid || saving}
            style={{ flex: 1, padding: '12px', borderRadius: 12,
              background: valid ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'var(--surface-3)',
              color: valid ? 'white' : 'var(--text-muted)', border: 'none', cursor: valid ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
            {saving ? 'Resetting...' : 'Reset PIN'}
          </button>
        </div>
      </div>
    </div>
  );
}
