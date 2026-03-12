'use client';

import { useState, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, Shield, User,
  ChefHat, CreditCard, BarChart3, Key
} from 'lucide-react';
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

const ROLE_CONFIG: Record<StaffRole, { label: string; color: string; bg: string; icon: AnyIcon; desc: string }> = {
  OWNER:   { label: 'Owner',   color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  icon: Crown,   desc: 'Full access to everything' },
  ADMIN:   { label: 'Admin',   color: '#c084fc', bg: 'rgba(192,132,252,0.12)', icon: Shield,  desc: 'Manage staff, menu, settings' },
  MANAGER: { label: 'Manager', color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  icon: BarChart3,desc: 'Orders + analytics' },
  CASHIER: { label: 'Cashier', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   icon: CreditCard,desc: 'Process orders + payments' },
  KITCHEN: { label: 'Kitchen', color: '#f97316', bg: 'rgba(249,115,22,0.12)', icon: ChefHat, desc: 'Kitchen display only' },
};

function Crown(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={props.size ?? 16} height={props.size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 20h20M5 20V10l7-6 7 6v10"/>
    </svg>
  );
}

const MOCK_STAFF: StaffMember[] = [
  { id: '1', name: 'Maria Santos',  display_name: 'Owner',  role: 'OWNER',   branch_id: null, is_active: true, last_login: '2024-12-18T08:30:00Z' },
  { id: '2', name: 'Jose Cruz',     display_name: 'Jose',   role: 'CASHIER', branch_id: null, is_active: true, last_login: '2024-12-18T09:00:00Z' },
  { id: '3', name: 'Ana Reyes',     display_name: 'Ana',    role: 'KITCHEN', branch_id: null, is_active: true, last_login: '2024-12-17T14:20:00Z' },
  { id: '4', name: 'Pedro Gomez',   display_name: 'Pedro',  role: 'CASHIER', branch_id: null, is_active: false, last_login: '2024-12-10T10:00:00Z' },
];

const inputStyle = {
  width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '11px 14px', color: 'var(--text)', fontSize: 14, outline: 'none',
};
const labelStyle = {
  display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 as const,
  marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' as const,
};

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>(MOCK_STAFF);
  const [showForm, setShowForm] = useState(false);
  const [editStaff, setEditStaff] = useState<StaffMember | null>(null);
  const [resetPinId, setResetPinId] = useState<string | null>(null);

  const toggleActive = (id: string) => {
    setStaff(prev => prev.map(s => s.id === id ? { ...s, is_active: !s.is_active } : s));
  };

  return (
    <div style={{ color: 'var(--text)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {staff.filter(s => s.is_active).length} active · {staff.length} total
          </p>
        </div>
        <button
          onClick={() => { setEditStaff(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white' }}
        >
          <Plus size={15} /> Add Staff
        </button>
      </div>

      {/* Role info cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {(Object.entries(ROLE_CONFIG) as [StaffRole, typeof ROLE_CONFIG[StaffRole]][]).map(([role, cfg]) => (
          <div key={role} className="p-3 rounded-xl text-center"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-2"
              style={{ background: cfg.bg }}>
              <cfg.icon size={14} style={{ color: cfg.color }} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 12, color: cfg.color }}>{cfg.label}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2, lineHeight: 1.4 }}>{cfg.desc}</div>
          </div>
        ))}
      </div>

      {/* Staff list */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 700, fontSize: 15 }}>Staff Members</h3>
        </div>
        <div>
          {staff.map((member, i) => {
            const rc = ROLE_CONFIG[member.role];
            return (
              <div
                key={member.id}
                className="flex items-center gap-4 px-5 py-4 transition-all"
                style={{
                  borderBottom: i < staff.length - 1 ? '1px solid var(--border)' : undefined,
                  opacity: member.is_active ? 1 : 0.5,
                }}
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: rc.bg, color: rc.color }}
                >
                  {member.name.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{member.name}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                      PIN: {member.display_name}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                    Last login: {member.last_login
                      ? new Date(member.last_login).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : 'Never'}
                  </div>
                </div>

                {/* Role badge */}
                <span
                  className="px-3 py-1 rounded-lg text-xs font-bold flex-shrink-0"
                  style={{ background: rc.bg, color: rc.color }}
                >
                  {rc.label}
                </span>

                {/* Status */}
                <span
                  className="px-2 py-1 rounded-lg text-xs font-semibold flex-shrink-0"
                  style={{
                    background: member.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)',
                    color: member.is_active ? '#22c55e' : '#6b7280',
                  }}
                >
                  {member.is_active ? 'Active' : 'Inactive'}
                </span>

                {/* Actions */}
                {member.role !== 'OWNER' && (
                  <div className="flex items-center gap-1">
                    <button
                      title="Reset PIN"
                      onClick={() => setResetPinId(member.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                    >
                      <Key size={13} />
                    </button>
                    <button
                      title="Edit"
                      onClick={() => { setEditStaff(member); setShowForm(true); }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      title={member.is_active ? 'Deactivate' : 'Activate'}
                      onClick={() => toggleActive(member.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Staff Form Modal */}
      {showForm && (
        <StaffFormModal
          staff={editStaff}
          onClose={() => { setShowForm(false); setEditStaff(null); }}
          onSave={(s) => {
            if (editStaff) {
              setStaff(prev => prev.map(m => m.id === s.id ? s : m));
            } else {
              setStaff(prev => [...prev, { ...s, id: Date.now().toString(), is_active: true, last_login: null }]);
            }
            setShowForm(false);
          }}
        />
      )}

      {/* Reset PIN Modal */}
      {resetPinId && (
        <ResetPinModal
          staffName={staff.find(s => s.id === resetPinId)?.name ?? ''}
          onClose={() => setResetPinId(null)}
          onReset={async (newPin) => {
            await new Promise(r => setTimeout(r, 500));
            setResetPinId(null);
            alert(`PIN reset for staff member. New PIN: ${newPin}`);
          }}
        />
      )}
    </div>
  );
}

function StaffFormModal({
  staff, onClose, onSave,
}: {
  staff: StaffMember | null;
  onClose: () => void;
  onSave: (s: StaffMember) => void;
}) {
  const [name, setName] = useState(staff?.name ?? '');
  const [displayName, setDisplayName] = useState(staff?.display_name ?? '');
  const [role, setRole] = useState<StaffRole>(staff?.role ?? 'CASHIER');
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !displayName || (!staff && !pin)) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setSaving(false);
    onSave({
      id: staff?.id ?? '',
      name, display_name: displayName, role,
      branch_id: null, is_active: true, last_login: null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>
            {staff ? 'Edit Staff' : 'Add Staff Member'}
          </h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: 22 }}>×</button>
        </div>
        <div className="p-6 space-y-4">
          <div><label style={labelStyle}>Full Name</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Maria Santos" /></div>
          <div><label style={labelStyle}>Display Name (shown on PIN screen)</label>
            <input style={inputStyle} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Maria" /></div>
          {!staff && (
            <div><label style={labelStyle}>PIN (4–8 digits)</label>
              <input style={inputStyle} type="password" inputMode="numeric" maxLength={8}
                value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" /></div>
          )}
          <div>
            <label style={labelStyle}>Role</label>
            <div className="grid grid-cols-2 gap-2">
              {(['CASHIER', 'KITCHEN', 'MANAGER', 'ADMIN'] as StaffRole[]).map(r => {
                const rc = ROLE_CONFIG[r];
                return (
                  <button key={r} onClick={() => setRole(r)}
                    className="p-3 rounded-xl text-left transition-all"
                    style={role === r
                      ? { background: rc.bg, border: `1px solid ${rc.color}50` }
                      : { background: 'var(--surface-2)', border: '1px solid var(--border)' }
                    }>
                    <div style={{ fontWeight: 600, fontSize: 13, color: role === r ? rc.color : 'var(--text)' }}>{rc.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{rc.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-5" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !name || !displayName}
            className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white' }}>
            {saving ? 'Saving...' : staff ? 'Save Changes' : 'Add Staff'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPinModal({
  staffName, onClose, onReset,
}: { staffName: string; onClose: () => void; onReset: (pin: string) => Promise<void> }) {
  const [newPin, setNewPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const valid = newPin.length >= 4 && newPin === confirm;

  const handleReset = async () => {
    if (!valid) return;
    setSaving(true);
    await onReset(newPin);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Reset PIN — {staffName}</h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: 22 }}>×</button>
        </div>
        <div className="p-6 space-y-4">
          <div><label style={labelStyle}>New PIN</label>
            <input style={inputStyle} type="password" inputMode="numeric" maxLength={8}
              value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="4–8 digits" /></div>
          <div><label style={labelStyle}>Confirm PIN</label>
            <input style={inputStyle} type="password" inputMode="numeric" maxLength={8}
              value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g, ''))} placeholder="Repeat PIN" /></div>
          {newPin && confirm && newPin !== confirm && (
            <p style={{ color: '#ef4444', fontSize: 12 }}>PINs do not match</p>
          )}
        </div>
        <div className="flex gap-3 px-6 py-5" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Cancel</button>
          <button onClick={handleReset} disabled={!valid || saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: valid ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'var(--surface-3)', color: valid ? 'white' : 'var(--text-muted)' }}>
            {saving ? 'Resetting...' : 'Reset PIN'}
          </button>
        </div>
      </div>
    </div>
  );
}
