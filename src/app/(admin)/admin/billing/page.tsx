'use client';
import React from 'react';

import { useState } from 'react';
import { Check, Zap, Building2, Crown, Rocket, ExternalLink, CreditCard, Calendar, ChevronRight, AlertTriangle } from 'lucide-react';

type PlanTier = 'TRIAL' | 'STARTER' | 'BUSINESS' | 'PRO' | 'ENTERPRISE';
type Cycle = 'monthly' | 'annual';

interface Plan {
  tier: PlanTier;
  name: string;
  price: { monthly: number; annual: number };
  color: string;
  gradient: string;
  icon: typeof Zap;
  desc: string;
  features: string[];
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    tier: 'STARTER',
    name: 'Starter',
    price: { monthly: 599, annual: 499 },
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    icon: Zap,
    desc: 'Perfect for single-location cafés just getting started',
    features: [
      'QR ordering for up to 20 tables',
      'Kitchen display screen (KDS)',
      'Basic analytics dashboard',
      'Staff management (up to 5)',
      'Email receipts',
      'Supabase Realtime (no polling)',
    ],
  },
  {
    tier: 'BUSINESS',
    name: 'Business',
    price: { monthly: 1299, annual: 1082 },
    color: '#22c55e',
    gradient: 'linear-gradient(135deg, #22c55e, #16a34a)',
    icon: Building2,
    desc: 'Built for busy cafés that need SMS and deeper insights',
    features: [
      'Everything in Starter',
      'SMS order notifications (Semaphore)',
      'Hourly heatmap analytics',
      'Unlimited staff accounts',
      'Branch add-ons (₱299/branch)',
      'Priority email support',
    ],
    highlight: true,
  },
  {
    tier: 'PRO',
    name: 'Pro',
    price: { monthly: 2499, annual: 2082 },
    color: '#c084fc',
    gradient: 'linear-gradient(135deg, #a855f7, #7c3aed)',
    icon: Crown,
    desc: 'Multi-branch operations + BIR compliance',
    features: [
      'Everything in Business',
      'Multi-branch management',
      'BIR Official Receipt (PRO+)',
      'PWD / Senior discount tracking',
      'Advanced export (CSV, XLSX)',
      'TV status board display',
    ],
  },
  {
    tier: 'ENTERPRISE',
    name: 'Enterprise',
    price: { monthly: 0, annual: 0 },
    color: '#fbbf24',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    icon: Rocket,
    desc: 'White-label + full API access for chains and food parks',
    features: [
      'Everything in Pro',
      'Custom domain (white-label)',
      'REST API + webhook access',
      'Dedicated Slack support',
      'Custom onboarding',
      'SLA guarantee',
    ],
  },
];

const INVOICES = [
  { id: 'INV-2024-12', date: 'Dec 1, 2024', amount: 1299, status: 'Paid', plan: 'Business' },
  { id: 'INV-2024-11', date: 'Nov 1, 2024', amount: 1299, status: 'Paid', plan: 'Business' },
  { id: 'INV-2024-10', date: 'Oct 1, 2024', amount: 599,  status: 'Paid', plan: 'Starter' },
];

export default function BillingPage() {
  const [currentPlan] = useState<PlanTier>('BUSINESS');
  const [planStatus] = useState<'TRIAL' | 'ACTIVE' | 'GRACE'>('ACTIVE');
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [upgrading, setUpgrading] = useState<PlanTier | null>(null);

  const handleUpgrade = async (tier: PlanTier) => {
    setUpgrading(tier);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planTier: tier, billingCycle: cycle }),
      });
      const json = await res.json() as { data?: { checkoutUrl?: string }; error?: string };
      if (!res.ok || json.error) {
        alert(json.error ?? 'Checkout failed. Please try again.');
        return;
      }
      if (json.data?.checkoutUrl) {
        window.location.href = json.data.checkoutUrl;
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setUpgrading(null);
    }
  };

  const annualSavings = (plan: Plan) =>
    Math.round((plan.price.monthly - plan.price.annual) * 12);

  return (
    <div style={{ color: 'var(--text)' }}>
      {/* Trial / Grace Banner */}
      {planStatus === 'TRIAL' && (
        <div
          style={{ display:"flex", alignItems:"center", gap:16, padding:16, borderRadius:20, marginBottom:24, background:'rgba(245, 158, 11, 0.1)', border:'1px solid rgba(245, 158, 11, 0.25)' }}
        >
          <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <div style={{ flex:1 }}>
            <div style={{ fontWeight: 600, color: '#f59e0b', fontSize: 14 }}>
              3 days left on your free trial
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
              Upgrade now to keep your menu and order history. No data loss.
            </div>
          </div>
          <button
            style={{ padding:"8px 16px", borderRadius:12, fontSize:13, fontWeight:600, flexShrink:0, border:"none", cursor:"pointer", background: '#f59e0b', color: 'white' }}
          >
            Upgrade Now
          </button>
        </div>
      )}

      {/* Current Plan Card */}
      <div
        style={{ borderRadius:20, padding:24, marginBottom:24, background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
              Current Plan
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:4 }}>
              <span style={{ fontWeight: 800, fontSize: 24 }}>Business</span>
              <span style={{ padding:"4px 12px", borderRadius:999, fontSize:11, fontWeight:700, background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                ACTIVE
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              ₱1,299/month · Renews January 1, 2025
            </p>
          </div>

          <div style={{ display:"flex", gap:12, flexShrink:0 }}>
            <button
              style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px", borderRadius:12, fontSize:13, fontWeight:600, cursor:"pointer", background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              <CreditCard size={14} />
              Update Payment
            </button>
            <button
              style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px", borderRadius:12, fontSize:13, fontWeight:600, cursor:"pointer", background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.15)' }}
            >
              Cancel Plan
            </button>
          </div>
        </div>

        {/* Usage bars */}         <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:16, marginTop:24, paddingTop:24, borderTop: '1px solid var(--border)' }}>
          {[
            { label: 'Orders this month', value: 187, max: '∞', pct: 0 },
            { label: 'Staff accounts', value: 3, max: '∞', pct: 0 },
            { label: 'Tables', value: 12, max: 20, pct: 60 },
          ].map(item => (
            <div key={item.label}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{item.label}</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  {item.value}{typeof item.max === 'number' ? `/${item.max}` : ''}
                </span>
              </div>
              {item.pct > 0 && (                 <div style={{ borderRadius:999, overflow:"hidden", height: 4, background: 'var(--surface-3)' }}>
                  <div style={{ height:"100%", borderRadius:999, width: `${item.pct}%`, background: item.pct > 80 ? '#ef4444' : '#22c55e' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Plan selector */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <h3 style={{ fontWeight: 700, fontSize: 16 }}>Available Plans</h3>
        <div
          style={{ display:"flex", gap:4, padding:4, borderRadius:12, background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {(['monthly', 'annual'] as Cycle[]).map(c => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 16px", borderRadius:8, fontSize:13, fontWeight:600, textTransform:"capitalize", cursor:"pointer", border:"none", ...(cycle === c ? { background: '#22c55e', color: 'white' } : { color: 'var(--text-muted)' }) }}
            >
              {c}
              {c === 'annual' && (
                <span style={{ padding:"2px 6px", borderRadius:6, fontSize:10, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
                  2 months free
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plan Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:16, marginBottom:32 }}>
        {PLANS.map(plan => {
          const isCurrent = plan.tier === currentPlan;
          const price = plan.price[cycle];

          return (
            <div
              key={plan.tier}
              style={{ borderRadius:20, display:"flex", flexDirection:"column", overflow:"hidden", background: 'var(--surface)', border: isCurrent
                  ? `2px solid ${plan.color}`
                  : plan.highlight
                  ? `1px solid ${plan.color}40`
                  : '1px solid var(--border)', transform: plan.highlight ? 'scale(1.02)' : undefined }}
            >
              {/* Plan header */}               <div style={{ padding:20, background: plan.highlight ? `${plan.color}08` : undefined }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:32, height:32, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", background: plan.gradient }}>
                      <plan.icon size={15} color="white" />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{plan.name}</span>
                  </div>
                  {isCurrent && (
                    <span style={{ padding:"2px 8px", borderRadius:999, fontSize:11, fontWeight:700, background: `${plan.color}20`, color: plan.color }}>
                      Current
                    </span>
                  )}
                  {plan.highlight && !isCurrent && (
                    <span style={{ padding:"2px 8px", borderRadius:999, fontSize:11, fontWeight:700, background: `${plan.color}20`, color: plan.color }}>
                      Popular
                    </span>
                  )}
                </div>

                {plan.tier === 'ENTERPRISE' ? (
                  <div style={{ fontWeight: 800, fontSize: 22 }}>Custom</div>
                ) : (
                  <div style={{ display:"flex", alignItems:"flex-end", gap:4 }}>
                    <span style={{ fontWeight: 800, fontSize: 26, lineHeight: 1 }}>
                      ₱{price.toLocaleString()}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 3 }}>/mo</span>
                  </div>
                )}

                {cycle === 'annual' && plan.tier !== 'ENTERPRISE' && (
                  <p style={{ color: '#f59e0b', fontSize: 11, marginTop: 2 }}>
                    Save ₱{annualSavings(plan).toLocaleString()} per year
                  </p>
                )}

                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
                  {plan.desc}
                </p>
              </div>

              {/* Features */}
              <div style={{ padding:"0 20px 20px", flex:1 }}>
                <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />
                <ul style={{ listStyle:"none", margin:0, padding:0, display:"flex", flexDirection:"column", gap:10 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                      <Check size={13} style={{ color: plan.color, flexShrink: 0, marginTop: 1 }} />
                      <span style={{ color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.5 }}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <div style={{ padding:"0 20px 20px" }}>
                {isCurrent ? (
                  <div style={{ textAlign:"center", padding:"10px 0", borderRadius:12, fontSize:13, fontWeight:600, background: `${plan.color}15`, color: plan.color }}>
                    Your current plan
                  </div>
                ) : plan.tier === 'ENTERPRISE' ? (
                  <button
                    style={{ width:"100%", padding:"10px 0", borderRadius:12, fontSize:13, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:8, cursor:"pointer", background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  >
                    Contact Sales
                    <ExternalLink size={12} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.tier)}
                    disabled={upgrading === plan.tier}
                    style={{ width:"100%", padding:"10px 0", borderRadius:12, fontSize:13, fontWeight:600, cursor:"pointer", border:"none", background: plan.highlight ? plan.gradient : `${plan.color}15`, color: plan.highlight ? 'white' : plan.color }}
                  >
                    {upgrading === plan.tier ? 'Redirecting...' : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment info */}
      <div
        style={{ display:"flex", alignItems:"center", gap:12, padding:16, borderRadius:20, marginBottom:32, fontSize:13, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
      >
        <CreditCard size={16} style={{ flexShrink: 0 }} />
        All plans billed via <strong style={{ color: 'var(--text)' }}>PayMongo</strong>.
        Accepts GCash, Maya, credit/debit card, and bank transfer.
        Annual plan = pay 10 months, get 12.
      </div>

      {/* Invoice history */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>         <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 24px", borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 700, fontSize: 15 }}>Invoice History</h3>
        </div>
        <div>
          {INVOICES.map((inv, i) => (
            <div
              key={inv.id}
              style={{ display:"flex", alignItems:"center", gap:16, padding:"16px 24px", borderBottom: i < INVOICES.length - 1 ? '1px solid var(--border)' : undefined }}
            >
              <div style={{ width:36, height:36, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", background: 'rgba(34, 197, 94, 0.1)' }}>
                <Calendar size={14} style={{ color: '#22c55e' }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.id}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 1 }}>{inv.date} · {inv.plan} Plan</div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>₱{inv.amount.toLocaleString()}</div>
              <span style={{ padding:"4px 8px", borderRadius:8, fontSize:11, fontWeight:600, background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e' }}>
                {inv.status}
              </span>
              <button style={{ color: 'var(--text-muted)' }}>
                <ChevronRight size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
