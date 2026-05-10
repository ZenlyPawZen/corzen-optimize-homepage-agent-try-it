import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, intakeHistory } = await req.json();
    if (!sessionId || !Array.isArray(intakeHistory)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin()
      .from('homepage_audit_sessions')
      .update({
        intake_history: intakeHistory,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      console.error('[save-intake] error:', error);
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[save-intake] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
