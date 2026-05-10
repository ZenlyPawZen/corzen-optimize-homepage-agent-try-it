'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ─── Headline Rewrite parsing ────────────────────────────────────────────────

type HeadlineRewrite = {
  current?: string;
  whyWeak?: string;
  rewritten?: string;
  whyStronger?: string;
  alternate?: string;
  raw: string;
};

function extractBlock(section: string, label: string): string | undefined {
  // Match **Label:** then capture until the next **Label:** marker or end.
  const pattern = new RegExp(
    `\\*\\*${label}:?\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*[A-Z][A-Za-z ]+:?\\*\\*|$)`,
    'i'
  );
  const match = section.match(pattern);
  if (!match) return undefined;
  return match[1].trim();
}

function stripQuoteMarkers(text: string | undefined): string | undefined {
  if (!text) return text;
  return text
    .split('\n')
    .map((line) => line.replace(/^>\s?/, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/^["""']+|["""']+$/g, '')
    .trim();
}

function extractHeadlineRewrite(report: string): HeadlineRewrite | null {
  const sectionMatch = report.match(
    /###\s*Headline Rewrite[^\n]*\n([\s\S]*?)(?=\n###|\n##|$)/i
  );
  if (!sectionMatch) return null;
  const section = sectionMatch[1];

  return {
    current: stripQuoteMarkers(extractBlock(section, 'Current')),
    whyWeak: extractBlock(section, "Why it'?s weak") || extractBlock(section, 'Why weak'),
    rewritten: stripQuoteMarkers(extractBlock(section, 'Rewritten')),
    whyStronger:
      extractBlock(section, "Why it'?s stronger") || extractBlock(section, 'Why stronger'),
    alternate: stripQuoteMarkers(extractBlock(section, 'Alternate version') || extractBlock(section, 'Alternate')),
    raw: section,
  };
}

// Strip the Headline Rewrite section out of the markdown so it doesn't render twice.
function stripHeadlineRewriteSection(report: string): string {
  return report.replace(
    /(\n|^)###\s*Headline Rewrite[^\n]*\n[\s\S]*?(?=\n###|\n##|$)/i,
    '\n'
  );
}

// ─── Headline Rewrite card ───────────────────────────────────────────────────

function HeadlineRewriteCard({ data }: { data: HeadlineRewrite }) {
  return (
    <section className="my-10">
      <h3 className="text-lg font-semibold text-corzen-purple mt-6 mb-4">Headline Rewrite</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current */}
        <div className="rounded-2xl border border-red-200 p-5" style={{ background: '#FEF2F2' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#B91C1C' }}>
            Current
          </p>
          {data.current ? (
            <p className="text-lg font-semibold leading-snug mb-3" style={{ color: '#111827' }}>
              "{data.current}"
            </p>
          ) : (
            <p className="text-sm italic mb-3" style={{ color: '#9CA3AF' }}>
              Headline not found in audit output.
            </p>
          )}
          {data.whyWeak && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#B91C1C' }}>
                Why it's weak
              </p>
              <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>
                {data.whyWeak}
              </p>
            </div>
          )}
        </div>

        {/* Rewritten */}
        <div className="rounded-2xl border border-green-200 p-5" style={{ background: '#F0FDF4' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#15803D' }}>
            Rewritten
          </p>
          {data.rewritten ? (
            <p className="text-lg font-semibold leading-snug mb-3" style={{ color: '#111827' }}>
              "{data.rewritten}"
            </p>
          ) : (
            <p className="text-sm italic mb-3" style={{ color: '#9CA3AF' }}>
              Rewrite not found in audit output.
            </p>
          )}
          {data.whyStronger && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#15803D' }}>
                Why it's stronger
              </p>
              <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>
                {data.whyStronger}
              </p>
            </div>
          )}
        </div>
      </div>

      {data.alternate && (
        <div
          className="mt-4 rounded-2xl border p-5"
          style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#1B56D6' }}>
            Alternate version
          </p>
          <p className="text-base font-medium leading-snug" style={{ color: '#111827' }}>
            "{data.alternate}"
          </p>
        </div>
      )}
    </section>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ReportClient({
  report,
  createdAt,
  homepageUrl,
}: {
  report: string;
  createdAt: string;
  homepageUrl?: string | null;
}) {
  const headlineRewrite = extractHeadlineRewrite(report);
  const reportWithoutHeadline = headlineRewrite
    ? stripHeadlineRewriteSection(report)
    : report;

  function handleDownload() {
    window.print();
  }

  const date = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="no-print border-b border-slate-100 px-6 py-4 sticky top-0 bg-white z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/corzen_logo_grey.png"
              alt="CorZen"
              className="w-5 h-5 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <span className="text-base font-bold" style={{ color: '#111827' }}>
              CorZen
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{date}</span>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              style={{ background: '#1B56D6' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download PDF
            </button>
          </div>
        </div>
      </header>

      {/* Report content */}
      <main className="print-content px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <div className="hidden print:flex items-center gap-2 mb-8 pb-4 border-b border-slate-200">
            <span className="text-lg font-bold text-slate-900">CorZen</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500 text-sm">Homepage Audit</span>
            <span className="ml-auto text-xs text-slate-400">{date}</span>
          </div>

          <div className="mb-2">
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#111827' }}>
              Homepage Audit Report
            </h1>
            {homepageUrl && (
              <p className="text-sm mt-1" style={{ color: '#4B5563' }}>
                <a
                  href={homepageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  style={{ color: '#1B56D6' }}
                >
                  {homepageUrl}
                </a>
              </p>
            )}
          </div>

          <div className="report-prose">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({ children }) => (
                  <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3 border-b border-slate-100 pb-2">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-semibold text-corzen-purple mt-6 mb-2">{children}</h3>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full border-collapse text-sm">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="bg-corzen-purple-light text-corzen-purple font-semibold text-left px-3 py-2 border border-slate-200">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 border border-slate-200 text-slate-700 align-top">{children}</td>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-corzen-purple pl-4 italic text-slate-600 my-4">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {reportWithoutHeadline}
            </ReactMarkdown>
          </div>

          {headlineRewrite && <HeadlineRewriteCard data={headlineRewrite} />}
        </div>
      </main>

      {/* CTA */}
      <aside
        className="no-print border-t border-slate-100 px-6 py-8 mt-8"
        style={{ background: '#EFF6FF' }}
      >
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div>
            <p className="font-semibold mb-1" style={{ color: '#111827' }}>
              Want to track these fixes and re-audit in 30 days?
            </p>
            <p className="text-sm" style={{ color: '#4B5563' }}>
              Create a free CorZen account to save this audit, track progress on each fix, and run a follow-up.
            </p>
          </div>
          <a
            href="https://app.corzenhub.com/login"
            className="flex-shrink-0 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
            style={{ background: '#1B56D6' }}
          >
            Create Free Account →
          </a>
        </div>
      </aside>

      <p className="no-print text-center text-xs text-slate-400 py-4">
        Your audit is saved securely. No account needed to download.
      </p>
    </div>
  );
}
