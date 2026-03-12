'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react';

export default function BillingSuccessPage() {
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

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #111827 100%)' }}>
      <div className="text-center max-w-md w-full">
        {/* Animated success ring */}
        <div className="relative inline-flex items-center justify-center mb-8">
          <div className="absolute w-32 h-32 rounded-full animate-ping opacity-20"
            style={{ background: color }} />
          <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl"
            style={{ background: `${color}20`, border: `2px solid ${color}` }}>
            <CheckCircle size={40} style={{ color }} />
          </div>
        </div>

        <h1 className="text-3xl font-black text-white mb-3">
          You&apos;re on {plan.charAt(0) + plan.slice(1).toLowerCase()}! 🎉
        </h1>
        <p className="text-gray-400 text-lg mb-8">
          Your subscription is now active. All features are unlocked.
        </p>

        <div className="rounded-2xl p-6 mb-8 text-left space-y-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">What&apos;s next</div>
          {[
            'Your plan is activated immediately',
            'Invoice sent to your registered email',
            'New features are available in your dashboard',
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              </div>
              <span className="text-gray-300 text-sm">{item}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => router.push('/admin/dashboard')}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-white transition-all hover:opacity-90"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
          <span>Go to Dashboard</span>
          <ArrowRight size={18} />
        </button>

        <p className="text-gray-600 text-sm mt-4">
          Redirecting automatically in {countdown}s...
        </p>
      </div>
    </div>
  );
}
