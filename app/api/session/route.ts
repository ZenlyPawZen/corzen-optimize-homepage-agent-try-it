import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

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

// Validate an existing sessionId — called by /chat on load
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { data } = await getSupabaseAdmin()
    .from('homepage_audit_sessions')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: 'Invalid session' }, { status: 404 });
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

    // Email uniqueness is per-table — same email can be used on other CorZen
    // agent demos (each has its own sessions table). Within this demo, the
    // UNIQUE(email) constraint enforces one audit per email.
    const { data: existing } = await supabase
      .from('homepage_audit_sessions')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'email_exists' }, { status: 409, headers });
    }

    const { data: session, error } = await supabase
      .from('homepage_audit_sessions')
      .insert({
        email: normalizedEmail,
        beehiiv_tag: 'Homepage audit demo',
        intake_history: [],
        email_opt_in: emailOptIn === true,
      })
      .select('id')
      .single();

    if (error || !session) {
      console.error('[session] insert error:', error);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500, headers });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      fetch(`${supabaseUrl}/functions/v1/beehiiv-homepage-demo-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ record: { email: normalizedEmail, tag: 'Homepage audit demo' } }),
      }).catch((err) => console.error('[session] beehiiv sync error:', err));
    }

    return NextResponse.json({ sessionId: session.id }, { headers });
  } catch (err) {
    console.error('[session] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers });
  }
}
