'use client';
import React from 'react';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, ArrowRight } from 'lucide-react';

function BillingSuccessContent() {
  const params = useSearchParams();
  const router = useRouter();
  const plan = params.get('plan') ?? 'STARTER';
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const t = setInterval(() => setCountdown(c => {
      if (c <= 1) { clearInterval(t); router.push('/admin/dashboard'); }
      return c - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [router]);

  const planColors: Record<string, string> = {
    STARTER: '#6366f1', BUSINESS: '#22c55e', PRO: '#f59e0b', ENTERPRISE: '#ec4899',
  };
  const color = planColors[plan] ?? '#22c55e';
  const planDisplay = plan.charAt(0) + plan.slice(1).toLowerCase();

  return (
    <div style={{ textAlign:'center', maxWidth:448, width:'100%' }}>
      <div style={{ position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:32 }}>
        <div style={{ position:'absolute', width:128, height:128, borderRadius:'50%', opacity:0.2, background: color, animation:'ping 1.5s ease-out infinite' }} />
        <div style={{ width:96, height:96, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 40px rgba(0,0,0,0.4)', background: `${color}20`, border: `2px solid ${color}` }}>
          <CheckCircle size={40} style={{ color }} />
        </div>
      </div>
      <h1 style={{ fontSize:30, fontWeight:900, color:'white', marginBottom:12 }}>
        You&apos;re on {planDisplay}! 🎉
      </h1>
      <p style={{ color:'#9ca3af', fontSize:18, marginBottom:32 }}>
        Your subscription is now active. All features are unlocked.
      </p>
      <div style={{ borderRadius:20, padding:24, marginBottom:32, textAlign:'left', display:'flex', flexDirection:'column', gap:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>What&apos;s next</div>
        {[
          'Your plan is activated immediately',
          'Invoice sent to your registered email',
          'New features are available in your dashboard',
        ].map((item, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:20, height:20, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:`${color}20`, border:`1px solid ${color}40` }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background: color }} />
            </div>
            <span style={{ color:'#d1d5db', fontSize:14 }}>{item}</span>
          </div>
        ))}
      </div>
      <button
        onClick={() => router.push('/admin/dashboard')}
        style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:12, padding:'16px 0', borderRadius:20, fontWeight:700, color:'white', border:'none', cursor:'pointer', fontSize:15, background:`linear-gradient(135deg, ${color}, ${color}cc)` }}>
        <span>Go to Dashboard</span>
        <ArrowRight size={18} />
      </button>
      <p style={{ color:'#6b7280', fontSize:14, marginTop:16 }}>Redirecting in {countdown}s...</p>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'linear-gradient(135deg, #0a0f1e 0%, #111827 100%)' }}>
      <Suspense fallback={
        <div style={{ color:'white', textAlign:'center' }}>
          <div style={{ width:64, height:64, borderRadius:'50%', border:'2px solid #22c55e', borderTopColor:'transparent', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }} />
          <p style={{ color:'#9ca3af' }}>Loading...</p>
        </div>
      }>
        <BillingSuccessContent />
      </Suspense>
    </div>
  );
}
