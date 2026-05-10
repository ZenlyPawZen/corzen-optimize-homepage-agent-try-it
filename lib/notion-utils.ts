// Ported from corzen-build: api/_lib/notion-utils.ts

export const NOTION_VERSION = '2022-06-28';
export const RATE_LIMIT_DELAY_MS = 350;
export const MAX_CONTEXT_CHARS = 8000;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function blockToText(block: any, notionToken: string, depth: number): Promise<string> {
  const blockType: string = block.type;
  const blockData = block[blockType] || {};
  const extractRichText = (richText: any[]): string =>
    (richText || []).map((rt: any) => rt.plain_text || '').join('');

  let text = '';
  switch (blockType) {
    case 'paragraph':
    case 'quote':
    case 'callout':
      text = extractRichText(blockData.rich_text) + '\n\n';
      break;
    case 'heading_1': text = '# ' + extractRichText(blockData.rich_text) + '\n\n'; break;
    case 'heading_2': text = '## ' + extractRichText(blockData.rich_text) + '\n\n'; break;
    case 'heading_3': text = '### ' + extractRichText(blockData.rich_text) + '\n\n'; break;
    case 'bulleted_list_item':
    case 'numbered_list_item':
      text = '• ' + extractRichText(blockData.rich_text) + '\n';
      break;
    case 'to_do':
      text = (blockData.checked ? '[x] ' : '[ ] ') + extractRichText(blockData.rich_text) + '\n';
      break;
    case 'toggle': text = extractRichText(blockData.rich_text) + '\n'; break;
    case 'code': text = extractRichText(blockData.rich_text) + '\n\n'; break;
    case 'divider': text = '---\n\n'; break;
    case 'table_row':
      const cells = (blockData.cells || []).map((cell: any[]) =>
        cell.map((rt: any) => rt.plain_text || '').join('')
      );
      text = cells.join('\t') + '\n';
      break;
    case 'child_page':
      if (depth < 2) text = '## ' + (blockData.title || 'Untitled') + '\n\n';
      break;
    default: return '';
  }

  const childrenTypes = ['toggle', 'bulleted_list_item', 'numbered_list_item', 'quote', 'callout', 'column_list', 'column', 'table', 'child_page'];
  if (block.has_children && childrenTypes.includes(blockType) && depth < 2) {
    await sleep(RATE_LIMIT_DELAY_MS);
    const childText = await fetchPageText(block.id, notionToken, depth + 1);
    text += childText;
  }
  return text;
}

export async function fetchPageText(pageId: string, notionToken: string, depth = 0): Promise<string> {
  let cursor: string | undefined;
  let hasMore = true;
  let fullText = '';

  while (hasMore) {
    const url = cursor
      ? `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100&start_cursor=${cursor}`
      : `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`;

    let response = await fetch(url, {
      headers: { Authorization: `Bearer ${notionToken}`, 'Notion-Version': NOTION_VERSION },
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
      await sleep(retryAfter * 1000);
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${notionToken}`, 'Notion-Version': NOTION_VERSION },
      });
      if (response.status === 429) throw new Error('RATE_LIMIT_EXCEEDED');
    }
    if (!response.ok) break;

    const data = await response.json() as any;
    for (const block of data.results || []) {
      fullText += await blockToText(block, notionToken, depth);
      await sleep(RATE_LIMIT_DELAY_MS);
    }
    hasMore = data.has_more === true;
    cursor = data.next_cursor || undefined;
  }
  return fullText;
}

export function truncateText(text: string, maxChars = MAX_CONTEXT_CHARS): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastNewline = slice.lastIndexOf('\n');
  return lastNewline > 0 ? text.slice(0, lastNewline) + '\n[Content truncated]' : slice + '\n[Content truncated]';
}
