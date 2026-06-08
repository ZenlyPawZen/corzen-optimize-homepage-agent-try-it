import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  buildGenerationSystemPrompt,
  buildGenerationUserMessage,
  type PageInputs,
} from '@/lib/skill';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 120;

const SCREENSHOT_BUCKET = 'homepage-audit-screenshots';
const FETCH_TIMEOUT_MS = 10_000;
const FETCHED_TEXT_CAP = 30_000;

// Belt-and-suspenders enforcement of the em dash ban. The prompt instructs
// the model never to use em dashes, but LLMs occasionally slip; this strips
// any that survive before the report is stored. Em dashes (—) become commas;
// en dashes (–) are left alone since they are used for numeric ranges (1–5).
function sanitizeReportCopy(text: string): string {
  return text
    .replace(/\s*—\s*/g, ', ') // em dash → comma, collapsing surrounding spaces
    .replace(/,\s*,/g, ', ')    // collapse any double commas the swap created
    .replace(/[ \t]+,/g, ',');  // no space before a comma
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPageText(
  url: string
): Promise<{ text: string | null; error: string | null }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; CorZen-HomepageAudit/1.0; +https://corzenhub.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { text: null, error: `HTTP ${res.status}` };
    }
    const html = await res.text();
    const text = stripHtmlToText(html).slice(0, FETCHED_TEXT_CAP);
    if (!text) return { text: null, error: 'Page returned no readable text' };
    return { text, error: null };
  } catch (err: any) {
    const reason = err?.name === 'AbortError' ? 'timeout after 10s' : err?.message || 'unknown error';
    return { text: null, error: reason };
  }
}

type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

async function downloadScreenshot(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  path: string
): Promise<{ data: string; mediaType: ImageMediaType } | null> {
  const { data, error } = await supabase.storage.from(SCREENSHOT_BUCKET).download(path);
  if (error || !data) {
    console.error('[generate] screenshot download error:', error);
    return null;
  }
  const arrayBuffer = await data.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  const lower = path.toLowerCase();
  let mediaType: ImageMediaType = 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mediaType = 'image/jpeg';
  else if (lower.endsWith('.webp')) mediaType = 'image/webp';
  else if (lower.endsWith('.gif')) mediaType = 'image/gif';

  return { data: base64, mediaType };
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = (await req.json()) as { sessionId: string };

    if (!sessionId) {
      return new Response('Missing sessionId', { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: session, error } = await supabase
      .from('homepage_audit_sessions')
      .select(
        'intake_history, brand_voice_context, homepage_url, pasted_content, screenshot_path'
      )
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return new Response('Session not found', { status: 404 });
    }

    const pageInputs: PageInputs = {
      url: session.homepage_url || null,
      pastedContent: session.pasted_content || null,
      hasScreenshot: !!session.screenshot_path,
      fetchedPageText: null,
      fetchedPageError: null,
    };

    if (session.homepage_url) {
      const fetched = await fetchPageText(session.homepage_url);
      pageInputs.fetchedPageText = fetched.text;
      pageInputs.fetchedPageError = fetched.error;
    }

    let screenshotImage: { data: string; mediaType: ImageMediaType } | null = null;
    if (session.screenshot_path) {
      screenshotImage = await downloadScreenshot(supabase, session.screenshot_path);
      if (!screenshotImage) pageInputs.hasScreenshot = false;
    }

    const systemPrompt = buildGenerationSystemPrompt(session.brand_voice_context);
    const userMessageText = buildGenerationUserMessage(
      session.intake_history || [],
      pageInputs
    );

    const userContent: Anthropic.Messages.ContentBlockParam[] = [
      { type: 'text', text: userMessageText },
    ];
    if (screenshotImage) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: screenshotImage.mediaType,
          data: screenshotImage.data,
        },
      });
    }

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userContent }],
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        let fullText = '';

        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              fullText += chunk.delta.text;
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }

          await supabase
            .from('homepage_audit_sessions')
            .update({
              report_content: sanitizeReportCopy(fullText),
              updated_at: new Date().toISOString(),
            })
            .eq('id', sessionId);

          controller.enqueue(encoder.encode('\n\n[REPORT_SAVED]'));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Accel-Buffering': 'no' },
    });
  } catch (err) {
    console.error('[generate] error:', err);
    return new Response('Internal server error', { status: 500 });
  }
}
