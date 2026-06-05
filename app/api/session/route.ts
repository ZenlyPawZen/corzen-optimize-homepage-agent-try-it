import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendMagicLink } from '@/lib/email';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

// Validate an existing sessionId — called by /chat on load.
// Only returns valid:true for active (email-verified) sessions.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { data } = await getSupabaseAdmin()
    .from('homepage_audit_sessions')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();

  if (!data || data.status !== 'active') {
    return NextResponse.json({ error: 'Invalid session' }, { status: 404 });
  }
  return NextResponse.json({ valid: true });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders();

  try {
    const { email, emailOptIn } = await req.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400, headers });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const supabase = getSupabaseAdmin();

    // Fire the Beehiiv sync for every valid email, before any duplicate
    // check, so the utm_source-driven automation in Beehiiv re-applies the
    // demo's tag on repeat attempts. Beehiiv treats duplicate subscribes
    // safely (reactivate_existing: true).
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      waitUntil(
        fetch(`${supabaseUrl}/functions/v1/beehiiv-homepage-demo-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ record: { email: normalizedEmail, tag: 'Homepage audit demo' } }),
        }).catch((err) => console.error('[session] beehiiv sync error:', err))
      );
    }

    // Check for an existing session for this email.
    const { data: existing } = await supabase
      .from('homepage_audit_sessions')
      .select('id, status')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) {
      // Already completed the demo — show the "already used" screen.
      if (existing.status === 'active') {
        return NextResponse.json({ error: 'email_exists' }, { status: 409, headers });
      }

      // Still pending (email not yet clicked) — refresh the expiry and resend.
      await supabase
        .from('homepage_audit_sessions')
        .update({ expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() })
        .eq('id', existing.id);

      waitUntil(
        sendMagicLink(normalizedEmail, existing.id).catch((err) =>
          console.error('[session] resend magic link error:', err)
        )
      );

      return NextResponse.json({ pending: true, resent: true }, { headers });
    }

    // Email uniqueness is per-table — same email can be used on other CorZen
    // agent demos (each has its own sessions table). Within this demo, the
    // UNIQUE(email) constraint enforces one audit per email.
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { data: session, error } = await supabase
      .from('homepage_audit_sessions')
      .insert({
        email: normalizedEmail,
        beehiiv_tag: 'Homepage audit demo',
        intake_history: [],
        email_opt_in: emailOptIn === true,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (error || !session) {
      console.error('[session] insert error:', error);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500, headers });
    }

    waitUntil(
      sendMagicLink(normalizedEmail, session.id).catch((err) =>
        console.error('[session] send magic link error:', err)
      )
    );

    return NextResponse.json({ pending: true }, { headers });
  } catch (err) {
    console.error('[session] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers });
  }
}
