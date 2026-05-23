'use client';
import React from 'react';
// ============================================================
// TYG POS — Landing Page (/)
// ============================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';

const BRAND = '#22c55e';
const BG = '#0f1117';
const SURFACE = '#161b27';
const SURFACE2 = '#1e2535';
const TEXT = '#e8eaf0';
const MUTED = '#6b7280';
const BORDER = 'rgba(255,255,255,0.07)';

const FEATURES = [
  { icon: '📱', title: 'QR Table Ordering', desc: 'Customers scan, order, and pay from their phone — no app needed.' },
  { icon: '🍳', title: 'Live Kitchen Display', desc: 'Real-time order stream for your kitchen staff. No printed tickets.' },
  { icon: '💳', title: 'GCash / Card Payments', desc: 'Integrated PayMongo — accept all major PH payment methods.' },
  { icon: '📊', title: 'Sales Analytics', desc: 'Daily summaries, top items, hourly heatmap — synced to Google Sheets.' },
  { icon: '👥', title: 'Staff Management', desc: 'Role-based PIN login — Owner, Manager, Cashier, Kitchen Staff.' },
  { icon: '🏪', title: 'Multi-Branch Ready', desc: 'Scale to multiple locations under one account.' },
];

const PLANS = [
  { name: 'STARTER', price: '₱599', color: '#3b82f6', features: ['QR ordering', 'Kitchen display', 'Basic analytics', 'Staff management', '1 branch'], cta: 'Start Free Trial' },
  { name: 'BUSINESS', price: '₱1,299', color: '#8b5cf6', popular: true, features: ['Everything in Starter', 'SMS notifications', 'Hourly sales heatmap', 'Priority support'], cta: 'Start Free Trial' },
  { name: 'PRO', price: '₱2,499', color: '#f59e0b', features: ['Everything in Business', 'Multi-branch', 'BIR OR generation', 'API access'], cta: 'Start Free Trial' },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [metrics, setMetrics] = useState({ tenants: 10, orders: 500, revenue: 500000, uptime: 99.9 });

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    fetch('/api/metrics').then(r => r.json()).then((d: typeof metrics) => setMetrics(d)).catch(()=>{});
  }, []);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: 'system-ui,sans-serif', minHeight: '100vh' }}>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: scrolled ? 'rgba(15,17,23,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? `1px solid ${BORDER}` : '1px solid transparent',
        padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'all 0.3s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: BRAND, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#000', fontSize: 16 }}>T</div>
          <span style={{ fontWeight: 800, fontSize: 18 }}>TYG<span style={{ color: BRAND }}> POS</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/login?fresh=1" style={{ color: MUTED, textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>Sign In</Link>
          <Link href="/discovery" style={{ color: TEXT, textDecoration: 'none', fontSize: 14, fontWeight: 600, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 16px' }}>Get a Demo</Link>
          <Link href="/signup" style={{ background: BRAND, color: '#000', borderRadius: 8, padding: '8px 20px', textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
            Start Free Trial
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '96px 24px 80px', maxWidth: 780, margin: '0 auto' }}>
        <div style={{ display: 'inline-block', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 99, padding: '6px 18px', fontSize: 13, color: BRAND, fontWeight: 600, marginBottom: 28 }}>
          🇵🇭 Built for Philippine F&amp;B Businesses
        </div>
        <h1 style={{ fontSize: 'clamp(36px,6vw,64px)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 24px', letterSpacing: -1 }}>
          QR-Based POS System<br /><span style={{ color: BRAND }}>for Philippine Restaurants</span>
        </h1>
        <p style={{ fontSize: 18, color: MUTED, maxWidth: 540, margin: '0 auto 40px', lineHeight: 1.6 }}>
          Let your customers order from their table. Manage your kitchen, payments, and analytics — all in one place. No hardware needed.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/signup" style={{ background: BRAND, color: '#000', borderRadius: 12, padding: '14px 36px', textDecoration: 'none', fontWeight: 800, fontSize: 16, boxShadow: '0 0 32px rgba(34,197,94,0.3)' }}>
            Start 14-Day Free Trial →
          </Link>
          <Link href="/order?tenant=yani" style={{ background: SURFACE, color: TEXT, borderRadius: 12, padding: '14px 28px', textDecoration: 'none', fontWeight: 600, fontSize: 16, border: `1px solid ${BORDER}` }}>
            See Live Demo
          </Link>
        </div>
        <p style={{ marginTop: 20, color: MUTED, fontSize: 13 }}>No credit card required · 14-day free trial · Cancel anytime</p>
      </section>

      {/* Stats */}
      <section style={{ textAlign: 'center', padding: '0 24px 64px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap' }}>
          {[
            [`${metrics.tenants}+`, 'Active Stores'],
            [`₱${(metrics.revenue / 1000).toFixed(0)}K+`, 'Orders Processed'],
            [`${metrics.uptime}%`, 'Uptime'],
            ['4.9★', 'Rating'],
          ].map(([val, label]) => (
            <div key={label}><div style={{ fontSize: 28, fontWeight: 900, color: BRAND }}>{val}</div><div style={{ fontSize: 12, color: MUTED }}>{label}</div></div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 24px', background: SURFACE }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 12px' }}>Everything you need to run your restaurant</h2>
            <p style={{ color: MUTED, fontSize: 16, margin: 0 }}>From QR ordering to kitchen display to daily reports — one platform.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ background: SURFACE2, borderRadius: 16, padding: 28, border: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 36, marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>{f.title}</h3>
                <p style={{ color: MUTED, margin: 0, fontSize: 14, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 12px' }}>Up and running in 30 minutes</h2>
          <p style={{ color: MUTED, fontSize: 16, margin: '0 0 56px' }}>No hardware, no installation, no hassle.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 32 }}>
            {[
              { icon: '📋', title: 'Set up your menu', desc: 'Add items, sizes, and add-ons in the admin panel.' },
              { icon: '🖨️', title: 'Print QR codes', desc: 'One QR per table — stick them on and go live.' },
              { icon: '📱', title: 'Customers order', desc: 'Scan → browse → add to cart → place order.' },
              { icon: '🍳', title: 'Kitchen fulfills', desc: 'Orders appear on Kitchen Display instantly.' },
            ].map((s) => (
              <div key={s.title} style={{ textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.3)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{s.icon}</div>
                <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700 }}>{s.title}</h4>
                <p style={{ color: MUTED, margin: 0, fontSize: 13, lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section style={{ padding: '0 24px 80px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 40, borderLeft: `4px solid ${BRAND}` }}>
            <p style={{ fontSize: 18, lineHeight: 1.7, color: TEXT, margin: '0 0 20px', fontStyle: 'italic' }}>
              &ldquo;Nabawasan ng 40% ang aming waiting time. Mas maayos na ang orders namin mula nang gamitin ang TYG POS.&rdquo;
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#000', fontSize: 18 }}>P</div>
              <div>
                <div style={{ fontWeight: 700, color: TEXT }}>Pia Ambrosio</div>
                <div style={{ fontSize: 13, color: MUTED }}>Owner, YANI Garden Café — Amadeo, Cavite</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: '80px 24px', background: SURFACE }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 12px' }}>Simple, transparent pricing</h2>
            <p style={{ color: MUTED, fontSize: 16, margin: 0 }}>14-day free trial. No credit card required.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
            {PLANS.map((plan) => (
              <div key={plan.name} style={{ background: SURFACE2, borderRadius: 20, padding: 32, border: plan.popular ? `2px solid ${plan.color}` : `1px solid ${BORDER}`, position: 'relative', boxShadow: plan.popular ? `0 0 40px ${plan.color}22` : 'none' }}>
                {plan.popular && <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: plan.color, color: '#fff', borderRadius: 99, padding: '4px 16px', fontSize: 12, fontWeight: 700 }}>Most Popular</div>}
                <div style={{ color: plan.color, fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 24 }}>
                  <span style={{ fontSize: 40, fontWeight: 900, color: TEXT }}>{plan.price}</span>
                  <span style={{ color: MUTED }}>/mo</span>
                </div>
                <div style={{ marginBottom: 28 }}>
                  {plan.features.map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, color: TEXT, fontSize: 14 }}>
                      <span style={{ color: BRAND, flexShrink: 0 }}>✓</span> {f}
                    </div>
                  ))}
                </div>
                <Link href="/signup" style={{ display: 'block', textAlign: 'center', background: plan.popular ? plan.color : 'transparent', color: plan.popular ? '#fff' : plan.color, border: `2px solid ${plan.color}`, borderRadius: 12, padding: '12px 0', textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '96px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: 40, fontWeight: 900, margin: '0 0 16px', lineHeight: 1.1 }}>Ready to modernize your restaurant?</h2>
          <p style={{ color: MUTED, fontSize: 16, margin: '0 0 36px' }}>Join PH F&amp;B businesses using TYG POS to serve customers faster and smarter.</p>
          <Link href="/signup" style={{ display: 'inline-block', background: BRAND, color: '#000', borderRadius: 14, padding: '16px 48px', textDecoration: 'none', fontWeight: 800, fontSize: 18, boxShadow: '0 0 40px rgba(34,197,94,0.35)' }}>
            Get Started Free →
          </Link>
          <p style={{ marginTop: 16, color: MUTED, fontSize: 13 }}>14-day trial · No credit card · Setup in 30 minutes</p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: '32px 24px', textAlign: 'center', color: MUTED, fontSize: 13 }}>
        <div style={{ marginBottom: 12 }}>
          {([['Staff Login', '/login?fresh=1'], ['Sign Up', '/signup'], ['Live Demo', '/order?tenant=yani']] as [string, string][]).map(([label, href]) => (
            <Link key={label} href={href} style={{ color: MUTED, textDecoration: 'none', margin: '0 16px' }}>{label}</Link>
          ))}
        </div>
        <p style={{ margin: 0 }}>© 2026 TYG Services. Built with ❤️ for Philippine F&amp;B businesses.</p>
      </footer>
    </div>
  );
}
