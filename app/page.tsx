'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Heart } from 'lucide-react';

export default function EmailGate() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, emailOptIn: optIn }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError('existing_email');
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      sessionStorage.setItem('homepage_audit_session', data.sessionId);
      router.push(`/chat?s=${data.sessionId}`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF5EE] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">

        {/* Logo + CorZen name */}
        <div className="text-center mb-6">
          <img
            src="/corzen_logo_grey.png"
            alt="CorZen"
            className="w-20 h-20 object-contain mx-auto mb-3"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <p className="text-4xl font-bold text-corzen-navy">CorZen</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 px-8 py-8">

          <h1 className="text-2xl font-bold text-corzen-navy text-center mb-1">
            Plan for success.
          </h1>
          <p className="text-base text-slate-700 text-center mb-6">
            Homepage Audit • Free demo
          </p>

          <p className="text-base text-slate-800 leading-relaxed text-left mb-6">
            Find what's losing you conversions in 60 seconds.<br />Get a 6-section weighted score, a headline rewrite, and your first 3 fixes.
          </p>

          {error === 'existing_email' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-left">
              <p className="text-lg font-semibold text-amber-950 mb-1">You&apos;ve already used this demo.</p>
              <p className="text-amber-950 text-base mb-4">
                Your homepage audit is saved. Create a free CorZen account to access it, track fixes, and re-audit later.
                You can use this same email to try our other free demos (LinkedIn Authority Builder and more).
              </p>
              <a
                href="https://app.corzenhub.com/login"
                className="inline-block bg-corzen-blue text-white font-semibold px-5 py-2.5 rounded-lg text-base hover:bg-corzen-blue-dark transition-colors"
              >
                Create Your CorZen Account →
              </a>
              <button
                onClick={() => { setError(null); setEmail(''); }}
                className="block mt-3 text-base text-amber-900 hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-lg focus:outline-none focus:ring-2 focus:ring-corzen-blue focus:border-transparent transition-all placeholder:text-slate-600"
              />

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  required
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-corzen-blue focus:ring-corzen-blue"
                />
                <span className="text-sm text-slate-700 leading-relaxed">
                  I agree to receive occasional updates from Zenly regarding CorZen.
                </span>
              </label>

              {error && error !== 'existing_email' && (
                <p className="text-red-800 text-base">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email || !optIn}
                className="w-full bg-corzen-blue text-white font-semibold py-3.5 rounded-xl text-lg hover:bg-corzen-blue-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Getting started…' : 'Audit My Homepage →'}
              </button>

              <p className="text-sm text-slate-600 text-center">
                You can demo each agent once per email.
              </p>
            </form>
          )}
        </div>

        {/* Trust bar */}
        <div className="flex items-center justify-center gap-8 mt-6 text-sm text-green-700">
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 fill-current" />
            <span>Results in 60s</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Heart className="w-4 h-4" />
            <span>14,200+ audits run</span>
          </div>
        </div>
      </div>
    </div>
  );
}
