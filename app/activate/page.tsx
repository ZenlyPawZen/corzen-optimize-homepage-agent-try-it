import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ s?: string }>;
}

export default async function ActivatePage({ searchParams }: Props) {
  const { s: sessionId } = await searchParams;

  if (!sessionId) {
    return <ErrorScreen message="This link is invalid." />;
  }

  const supabase = getSupabaseAdmin();

  const { data: session } = await supabase
    .from('homepage_audit_sessions')
    .select('id, status, expires_at')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) {
    return <ErrorScreen message="This link is invalid or has already been used." />;
  }

  // Already active — just let them back into the demo.
  if (session.status === 'active') {
    redirect(`/chat?s=${sessionId}`);
  }

  // Check expiry.
  if (new Date(session.expires_at) < new Date()) {
    return (
      <ErrorScreen
        message="This link has expired."
        detail="Magic links are valid for 48 hours. Return to the demo page and enter your email again to get a fresh link."
        ctaLabel="Back to demo"
        ctaHref="/"
      />
    );
  }

  // Activate the session.
  const { error } = await supabase
    .from('homepage_audit_sessions')
    .update({ status: 'active' })
    .eq('id', sessionId);

  if (error) {
    console.error('[activate] update error:', error);
    return <ErrorScreen message="Something went wrong. Please try again." />;
  }

  redirect(`/chat?s=${sessionId}`);
}

function ErrorScreen({
  message,
  detail,
  ctaLabel,
  ctaHref,
}: {
  message: string;
  detail?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="min-h-screen bg-[#1A2B4A] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 px-8 py-10 text-center">
        <p className="text-4xl font-bold text-corzen-navy mb-6">CorZen</p>
        <h1 className="text-xl font-bold text-slate-900 mb-3">{message}</h1>
        {detail && <p className="text-base text-slate-600 leading-relaxed mb-6">{detail}</p>}
        {ctaLabel && ctaHref && (
          <a
            href={ctaHref}
            className="inline-block bg-corzen-blue text-white font-semibold px-6 py-3 rounded-xl text-base hover:bg-corzen-blue-dark transition-colors"
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </div>
  );
}
