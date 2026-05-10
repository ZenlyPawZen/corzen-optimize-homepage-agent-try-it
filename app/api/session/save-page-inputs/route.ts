import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const SCREENSHOT_BUCKET = 'homepage-audit-screenshots';
const PASTED_CHAR_CAP = 30_000;
const SCREENSHOT_BYTE_CAP = 5 * 1024 * 1024; // 5 MB

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const sessionId = formData.get('sessionId');
    const url = formData.get('url');
    const pastedContent = formData.get('pastedContent');
    const screenshot = formData.get('screenshot');

    if (typeof sessionId !== 'string' || !sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const cleanedUrl = typeof url === 'string' ? url.trim() : '';
    const cleanedPaste =
      typeof pastedContent === 'string' && pastedContent.trim()
        ? pastedContent.slice(0, PASTED_CHAR_CAP)
        : '';
    const hasScreenshot = screenshot instanceof File && screenshot.size > 0;

    if (!cleanedUrl && !cleanedPaste && !hasScreenshot) {
      return NextResponse.json(
        { error: 'Provide at least one: URL, screenshot, or pasted page copy/HTML.' },
        { status: 400 }
      );
    }

    if (cleanedUrl) {
      try {
        new URL(cleanedUrl);
      } catch {
        return NextResponse.json({ error: 'URL is not valid.' }, { status: 400 });
      }
    }

    const supabase = getSupabaseAdmin();

    const { data: session } = await supabase
      .from('homepage_audit_sessions')
      .select('id, screenshot_path')
      .eq('id', sessionId)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    let screenshotPath: string | null = session.screenshot_path ?? null;

    if (hasScreenshot) {
      const file = screenshot as File;
      if (file.size > SCREENSHOT_BYTE_CAP) {
        return NextResponse.json({ error: 'Screenshot must be under 5 MB.' }, { status: 400 });
      }
      const allowed = ['image/png', 'image/jpeg', 'image/webp'];
      if (!allowed.includes(file.type)) {
        return NextResponse.json({ error: 'Screenshot must be PNG, JPEG, or WebP.' }, { status: 400 });
      }

      const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png';
      const path = `${sessionId}/screenshot.${ext}`;
      const buffer = new Uint8Array(await file.arrayBuffer());

      const { error: upErr } = await supabase.storage
        .from(SCREENSHOT_BUCKET)
        .upload(path, buffer, { contentType: file.type, upsert: true });

      if (upErr) {
        console.error('[save-page-inputs] storage upload error:', upErr);
        return NextResponse.json({ error: 'Failed to save screenshot.' }, { status: 500 });
      }
      screenshotPath = path;
    }

    const { error } = await supabase
      .from('homepage_audit_sessions')
      .update({
        homepage_url: cleanedUrl || null,
        pasted_content: cleanedPaste || null,
        screenshot_path: screenshotPath,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      console.error('[save-page-inputs] update error:', error);
      return NextResponse.json({ error: 'Failed to save page inputs.' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      hasUrl: !!cleanedUrl,
      hasPaste: !!cleanedPaste,
      hasScreenshot: !!screenshotPath,
    });
  } catch (err) {
    console.error('[save-page-inputs] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
