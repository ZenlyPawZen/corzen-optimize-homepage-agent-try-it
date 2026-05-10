import { NextRequest, NextResponse } from 'next/server';

const NOTION_VERSION = '2022-06-28';
const MAX_PAGES = 200;

function extractTitle(page: any): string {
  const titleProp = page.properties?.title || page.properties?.Name;
  if (titleProp?.title?.[0]?.plain_text) return titleProp.title[0].plain_text;
  if (page.title?.[0]?.plain_text) return page.title[0].plain_text;
  return 'Untitled';
}

export async function POST(req: NextRequest) {
  try {
    const { notionToken } = await req.json() as { notionToken: string };

    if (!notionToken?.trim()) {
      return NextResponse.json({ error: 'notionToken is required' }, { status: 400 });
    }

    const pages: { id: string; title: string; icon: string | null; last_edited_time: string }[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore && pages.length < MAX_PAGES) {
      const body: any = { filter: { value: 'page', property: 'object' }, page_size: 100 };
      if (cursor) body.start_cursor = cursor;

      const res = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${notionToken.trim()}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('[notion/pages] error:', res.status, err);
        return NextResponse.json({ error: 'Failed to connect to Notion — check your token' }, { status: 502 });
      }

      const data = await res.json() as any;
      for (const result of data.results || []) {
        pages.push({
          id: result.id,
          title: extractTitle(result),
          icon: result.icon?.emoji || null,
          last_edited_time: result.last_edited_time,
        });
      }
      hasMore = data.has_more === true;
      cursor = data.next_cursor || undefined;
    }

    return NextResponse.json(pages);
  } catch (err) {
    console.error('[notion/pages] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
