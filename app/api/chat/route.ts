import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { INTAKE_SYSTEM_PROMPT } from '@/lib/skill';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 120;

function describeInputs(session: {
  homepage_url?: string | null;
  pasted_content?: string | null;
  screenshot_path?: string | null;
}): string {
  const parts: string[] = [];
  if (session.homepage_url) parts.push(`URL: ${session.homepage_url}`);
  if (session.screenshot_path) parts.push('a screenshot');
  if (session.pasted_content) parts.push('pasted page copy/HTML');
  if (parts.length === 0) return 'no page inputs (the user has not provided URL, screenshot, or pasted content yet)';
  return parts.join(' + ');
}

function buildGreeting(session: {
  homepage_url?: string | null;
  pasted_content?: string | null;
  screenshot_path?: string | null;
}): string {
  const ack: string[] = [];
  if (session.homepage_url) ack.push(`URL (${session.homepage_url})`);
  if (session.screenshot_path) ack.push('your screenshot');
  if (session.pasted_content) ack.push('your pasted page copy');

  const ackText =
    ack.length === 0
      ? "I don't see a URL, screenshot, or pasted copy yet, but"
      : ack.length === 1
      ? `Got it. I have ${ack[0]}.`
      : `Got it. I have ${ack.slice(0, -1).join(', ')} and ${ack[ack.length - 1]}.`;

  return `${ackText} To run a useful audit I need three quick things from you.

First, what kind of business is this? Software (SaaS), a service business (agency, consulting, freelance), or e-commerce?`;
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, messages } = (await req.json()) as {
      sessionId: string;
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    if (!sessionId) {
      return new Response('Missing sessionId', { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: session } = await supabase
      .from('homepage_audit_sessions')
      .select('homepage_url, pasted_content, screenshot_path')
      .eq('id', sessionId)
      .maybeSingle();

    const inputsLine = describeInputs(session || {});
    const systemText = `${INTAKE_SYSTEM_PROMPT}\n\n## Page inputs already provided by the user\n\nThe user has provided: ${inputsLine}.`;

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: systemText,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: messages.length > 0 ? messages : [{ role: 'user', content: '__start__' }],
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        let fullText = '';

        try {
          // Hardcoded, deterministic greeting tailored to which inputs were provided.
          if (messages.length === 0) {
            const greeting = buildGreeting(session || {});
            controller.enqueue(encoder.encode(greeting));
            fullText = greeting;

            await supabase
              .from('homepage_audit_sessions')
              .update({
                intake_history: [{ role: 'assistant', content: greeting }],
                updated_at: new Date().toISOString(),
              })
              .eq('id', sessionId);

            controller.close();
            return;
          }

          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              fullText += chunk.delta.text;
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }

          const updatedMessages = [...messages, { role: 'assistant' as const, content: fullText }];
          await supabase
            .from('homepage_audit_sessions')
            .update({ intake_history: updatedMessages, updated_at: new Date().toISOString() })
            .eq('id', sessionId);

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
    console.error('[chat] error:', err);
    return new Response('Internal server error', { status: 500 });
  }
}
