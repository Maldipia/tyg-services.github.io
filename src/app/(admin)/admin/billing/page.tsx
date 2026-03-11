'use client';

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
    // In production: POST /api/billing/checkout → redirect to PayMongo checkout
    await new Promise(r => setTimeout(r, 800));
    setUpgrading(null);
    alert(`Redirecting to PayMongo checkout for ${tier} plan...`);
  };

  const annualSavings = (plan: Plan) =>
    Math.round((plan.price.monthly - plan.price.annual) * 12);

  return (
    <div style={{ color: 'var(--text)' }}>
      {/* Trial / Grace Banner */}
      {planStatus === 'TRIAL' && (
        <div
          className="flex items-center gap-4 p-4 rounded-2xl mb-6"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <div className="flex-1">
            <div style={{ fontWeight: 600, color: '#f59e0b', fontSize: 14 }}>
              3 days left on your free trial
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
              Upgrade now to keep your menu and order history. No data loss.
            </div>
          </div>
          <button
            className="px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0"
            style={{ background: '#f59e0b', color: 'white' }}
          >
            Upgrade Now
          </button>
        </div>
      )}

      {/* Current Plan Card */}
      <div
        className="rounded-2xl p-6 mb-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
              Current Plan
            </div>
            <div className="flex items-center gap-3 mb-1">
              <span style={{ fontWeight: 800, fontSize: 24 }}>Business</span>
              <span className="px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                ACTIVE
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              ₱1,299/month · Renews January 1, 2025
            </p>
          </div>

          <div className="flex gap-3">
            <button
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              <CreditCard size={14} />
              Update Payment
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}
            >
              Cancel Plan
            </button>
          </div>
        </div>

        {/* Usage bars */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
          {[
            { label: 'Orders this month', value: 187, max: '∞', pct: 0 },
            { label: 'Staff accounts', value: 3, max: '∞', pct: 0 },
            { label: 'Tables', value: 12, max: 20, pct: 60 },
          ].map(item => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-2">
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{item.label}</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  {item.value}{typeof item.max === 'number' ? `/${item.max}` : ''}
                </span>
              </div>
              {item.pct > 0 && (
                <div className="rounded-full overflow-hidden" style={{ height: 4, background: 'var(--surface-3)' }}>
                  <div className="h-full rounded-full" style={{
                    width: `${item.pct}%`,
                    background: item.pct > 80 ? '#ef4444' : '#22c55e',
                  }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Plan selector */}
      <div className="flex items-center justify-between mb-5">
        <h3 style={{ fontWeight: 700, fontSize: 16 }}>Available Plans</h3>
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {(['monthly', 'annual'] as Cycle[]).map(c => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize"
              style={cycle === c
                ? { background: '#22c55e', color: 'white' }
                : { color: 'var(--text-muted)' }
              }
            >
              {c}
              {c === 'annual' && (
                <span className="px-1.5 py-0.5 rounded-md text-xs"
                  style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: 10 }}>
                  2 months free
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {PLANS.map(plan => {
          const isCurrent = plan.tier === currentPlan;
          const price = plan.price[cycle];

          return (
            <div
              key={plan.tier}
              className="rounded-2xl flex flex-col overflow-hidden transition-all"
              style={{
                background: 'var(--surface)',
                border: isCurrent
                  ? `2px solid ${plan.color}`
                  : plan.highlight
                  ? `1px solid ${plan.color}40`
                  : '1px solid var(--border)',
                transform: plan.highlight ? 'scale(1.02)' : undefined,
              }}
            >
              {/* Plan header */}
              <div className="p-5" style={{ background: plan.highlight ? `${plan.color}08` : undefined }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: plan.gradient }}>
                      <plan.icon size={15} color="white" />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{plan.name}</span>
                  </div>
                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: `${plan.color}20`, color: plan.color }}>
                      Current
                    </span>
                  )}
                  {plan.highlight && !isCurrent && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: `${plan.color}20`, color: plan.color }}>
                      Popular
                    </span>
                  )}
                </div>

                {plan.tier === 'ENTERPRISE' ? (
                  <div style={{ fontWeight: 800, fontSize: 22 }}>Custom</div>
                ) : (
                  <div className="flex items-end gap-1">
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
              <div className="px-5 pb-5 flex-1">
                <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />
                <ul className="space-y-2.5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check size={13} style={{ color: plan.color, flexShrink: 0, marginTop: 1 }} />
                      <span style={{ color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.5 }}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <div className="px-5 pb-5">
                {isCurrent ? (
                  <div className="text-center py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: `${plan.color}15`, color: plan.color }}>
                    Your current plan
                  </div>
                ) : plan.tier === 'ENTERPRISE' ? (
                  <button
                    className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  >
                    Contact Sales
                    <ExternalLink size={12} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.tier)}
                    disabled={upgrading === plan.tier}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: plan.highlight ? plan.gradient : `${plan.color}15`,
                      color: plan.highlight ? 'white' : plan.color,
                    }}
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
        className="flex items-center gap-3 p-4 rounded-2xl mb-8 text-sm"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
      >
        <CreditCard size={16} style={{ flexShrink: 0 }} />
        All plans billed via <strong style={{ color: 'var(--text)' }}>PayMongo</strong>.
        Accepts GCash, Maya, credit/debit card, and bank transfer.
        Annual plan = pay 10 months, get 12.
      </div>

      {/* Invoice history */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 700, fontSize: 15 }}>Invoice History</h3>
        </div>
        <div>
          {INVOICES.map((inv, i) => (
            <div
              key={inv.id}
              className="flex items-center gap-4 px-6 py-4 transition-all hover:opacity-80"
              style={{ borderBottom: i < INVOICES.length - 1 ? '1px solid var(--border)' : undefined }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(34,197,94,0.1)' }}>
                <Calendar size={14} style={{ color: '#22c55e' }} />
              </div>
              <div className="flex-1">
                <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.id}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 1 }}>{inv.date} · {inv.plan} Plan</div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>₱{inv.amount.toLocaleString()}</div>
              <span className="px-2 py-1 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
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
