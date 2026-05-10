import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchPageText, truncateText, sleep, NOTION_VERSION, RATE_LIMIT_DELAY_MS } from '@/lib/notion-utils';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { sessionId, notionToken, pageIds } = await req.json() as {
      sessionId: string;
      notionToken: string;
      pageIds: string[];
    };

    if (!sessionId || !notionToken?.trim() || !Array.isArray(pageIds) || pageIds.length === 0) {
      return NextResponse.json({ error: 'sessionId, notionToken, and pageIds are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify session exists
    const { data: session } = await supabase
      .from('homepage_audit_sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    let combinedText = '';
    const pageResults: { id: string; title: string }[] = [];

    for (const pageId of pageIds) {
      let pageTitle = 'Untitled';
      try {
        const pageRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
          headers: { Authorization: `Bearer ${notionToken.trim()}`, 'Notion-Version': NOTION_VERSION },
        });
        if (pageRes.ok) {
          const pageData = await pageRes.json() as any;
          const titleProp = pageData.properties?.title || pageData.properties?.Name;
          if (titleProp?.title?.[0]?.plain_text) pageTitle = titleProp.title[0].plain_text;
        }
      } catch { /* non-fatal */ }

      pageResults.push({ id: pageId, title: pageTitle });

      try {
        await sleep(RATE_LIMIT_DELAY_MS);
        const pageText = await fetchPageText(pageId, notionToken.trim(), 0);
        if (pageText.trim()) combinedText += `## ${pageTitle}\n\n${pageText}\n\n`;
      } catch (err: any) {
        if (err.message === 'RATE_LIMIT_EXCEEDED') {
          return NextResponse.json({ error: 'Notion rate limit exceeded — please wait a moment and try again' }, { status: 429 });
        }
        console.error(`[notion/extract] error fetching page ${pageId}:`, err);
      }
    }

    const voiceContext = truncateText(combinedText.trim());

    await supabase
      .from('homepage_audit_sessions')
      .update({ brand_voice_context: voiceContext, updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return NextResponse.json({ pages: pageResults, charCount: voiceContext.length });
  } catch (err) {
    console.error('[notion/extract] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
