'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sparkles,
  CheckCircle2,
  Zap,
  Globe,
  ChevronLeft,
  Image as ImageIcon,
  X,
} from 'lucide-react';

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^#{1,6}\s+/gm, '');
}

// welcome (0) | page-inputs (1) | intake chat (2) | generate (3)
const TOTAL_STEPS = 4;
const PASTE_CHAR_CAP = 30_000;
const SCREENSHOT_BYTE_CAP = 5 * 1024 * 1024;

function NotionConnect({
  sessionId,
  onImported,
  onImportingChange,
}: {
  sessionId: string;
  onImported: (pages: { id: string; title: string }[]) => void;
  onImportingChange: (importing: boolean) => void;
}) {
  const [token, setToken] = useState('');
  const [pages, setPages] = useState<{ id: string; title: string; icon: string | null }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [step, setStep] = useState<'token' | 'pages' | 'done'>('token');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function loadPages() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/notion/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notionToken: token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to connect');
        return;
      }
      setPages(data);
      setStep('pages');
    } catch {
      setError('Failed to connect to Notion');
    } finally {
      setLoading(false);
    }
  }

  async function importPages() {
    setError(null);
    setLoading(true);
    setImporting(true);
    setImportProgress(0);
    onImportingChange(true);

    const start = Date.now();
    const timer = setInterval(() => {
      const pct = Math.min(85, ((Date.now() - start) / 30000) * 85);
      setImportProgress(pct);
    }, 200);

    try {
      const res = await fetch('/api/notion/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, notionToken: token, pageIds: selected }),
      });
      const data = await res.json();
      clearInterval(timer);
      if (!res.ok) {
        setError(data.error || 'Failed to extract pages');
        return;
      }
      setImportProgress(100);
      setTimeout(() => {
        setStep('done');
        onImported(data.pages);
      }, 400);
    } catch {
      clearInterval(timer);
      setError('Failed to import pages');
    } finally {
      setLoading(false);
      setImporting(false);
      onImportingChange(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
        <CheckCircle2 className="w-4 h-4" />
        Brand Voice Guide imported
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {step === 'token' && (
        <>
          <p style={{ fontSize: 15, color: '#4B5563' }}>
            Go to{' '}
            <a
              href="https://www.notion.so/profile/integrations"
              target="_blank"
              rel="noopener noreferrer"
              className="text-corzen-blue hover:underline"
            >
              notion.so/profile/integrations
            </a>
            , create an Internal Integration, copy the secret, and paste it here.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ntn_..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-corzen-blue"
            />
            <button
              onClick={loadPages}
              disabled={!token.trim() || loading}
              className="bg-corzen-blue text-white text-base px-4 py-2 rounded-lg hover:bg-corzen-blue-dark disabled:opacity-50 transition-colors"
            >
              {loading ? '…' : 'Connect'}
            </button>
          </div>
        </>
      )}
      {step === 'pages' && (
        <>
          <p style={{ fontSize: 15, color: '#4B5563' }}>
            Select the page(s) with your Brand Voice Guide:
          </p>
          {importing && (
            <div className="space-y-1">
              <div className="flex justify-between" style={{ fontSize: 13, color: '#4B5563' }}>
                <span>Importing…</span>
                <span>{Math.round(importProgress)}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${importProgress}%`, background: '#1B56D6' }}
                />
              </div>
            </div>
          )}
          <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {pages.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() =>
                    setSelected((s) =>
                      s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]
                    )
                  }
                  className="accent-corzen-blue"
                />
                <span className="text-base" style={{ color: '#111827' }}>
                  {p.icon ? `${p.icon} ` : ''}
                  {p.title}
                </span>
              </label>
            ))}
            {pages.length === 0 && (
              <p className="px-3 py-4 text-base text-center" style={{ color: '#111827' }}>
                No pages found.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={importPages}
              disabled={selected.length === 0 || loading}
              className="bg-corzen-blue text-white text-base px-4 py-2 rounded-lg hover:bg-corzen-blue-dark disabled:opacity-50 transition-colors"
            >
              {loading ? 'Importing…' : `Import ${selected.length} page${selected.length !== 1 ? 's' : ''}`}
            </button>
            <button
              onClick={() => setStep('token')}
              className="text-base"
              style={{ color: '#111827' }}
            >
              Back
            </button>
          </div>
        </>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('s') || '';

  // Flow
  const [step, setStep] = useState(0);
  const [validated, setValidated] = useState(false);

  // Page inputs
  const [pageUrl, setPageUrl] = useState('');
  const [pastedContent, setPastedContent] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [pageInputsSaved, setPageInputsSaved] = useState(false);
  const [savingPageInputs, setSavingPageInputs] = useState(false);
  const [pageInputsError, setPageInputsError] = useState<string | null>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  // Intake chat
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [aiThinking, setAiThinking] = useState(false);
  const [intakeComplete, setIntakeComplete] = useState(false);

  // Generate
  const [generating, setGenerating] = useState(false);
  const [, setGeneratingText] = useState('');
  const [showNotion, setShowNotion] = useState(false);
  const [voiceImported, setVoiceImported] = useState<{ id: string; title: string }[] | null>(null);
  const [notionImporting, setNotionImporting] = useState(false);
  const [genProgress, setGenProgress] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialMessageSent = useRef(false);

  // Session validation
  useEffect(() => {
    if (!sessionId) {
      router.replace('/');
      return;
    }
    fetch(`/api/session?id=${encodeURIComponent(sessionId)}`)
      .then((res) => {
        if (!res.ok) router.replace('/');
        else setValidated(true);
      })
      .catch(() => router.replace('/'));
  }, [sessionId, router]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiThinking]);

  // Trigger initial AI message when entering intake step (only after page inputs saved)
  useEffect(() => {
    if (step === 2 && !initialMessageSent.current && pageInputsSaved) {
      initialMessageSent.current = true;
      sendToAI([]);
    }
  }, [step, pageInputsSaved]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendToAI(currentMessages: { role: 'user' | 'assistant'; content: string }[]) {
    setAiThinking(true);
    let aiText = '';
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, messages: currentMessages }),
      });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiText += new TextDecoder().decode(value);
        const clean = aiText.replace('[INTAKE_COMPLETE]', '').trim();
        setMessages([...currentMessages, { role: 'assistant', content: clean }]);
      }
      if (aiText.includes('[INTAKE_COMPLETE]')) {
        setIntakeComplete(true);
      }
    } finally {
      setAiThinking(false);
    }
  }

  async function handleSend() {
    const text = inputValue.trim();
    if (!text || aiThinking) return;
    const userMsg = { role: 'user' as const, content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputValue('');
    await sendToAI(nextMessages);
  }

  async function handleSavePageInputs() {
    setPageInputsError(null);

    const hasUrl = !!pageUrl.trim();
    const hasPaste = !!pastedContent.trim();
    const hasShot = !!screenshotFile;

    if (!hasUrl && !hasPaste && !hasShot) {
      setPageInputsError('Provide at least one: URL, screenshot, or pasted page copy.');
      return;
    }

    if (hasUrl) {
      try {
        const u = pageUrl.trim();
        const withProto = /^https?:\/\//i.test(u) ? u : `https://${u}`;
        new URL(withProto);
        if (withProto !== pageUrl.trim()) setPageUrl(withProto);
      } catch {
        setPageInputsError('That URL doesn\'t look right. Include https:// at the start.');
        return;
      }
    }

    if (screenshotFile && screenshotFile.size > SCREENSHOT_BYTE_CAP) {
      setPageInputsError('Screenshot must be under 5 MB.');
      return;
    }

    setSavingPageInputs(true);
    try {
      const fd = new FormData();
      fd.append('sessionId', sessionId);
      if (hasUrl) {
        const u = pageUrl.trim();
        fd.append('url', /^https?:\/\//i.test(u) ? u : `https://${u}`);
      }
      if (hasPaste) fd.append('pastedContent', pastedContent.slice(0, PASTE_CHAR_CAP));
      if (hasShot) fd.append('screenshot', screenshotFile);

      const res = await fetch('/api/session/save-page-inputs', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setPageInputsError(data.error || 'Failed to save inputs.');
        return;
      }
      setPageInputsSaved(true);
      setStep((s) => s + 1);
    } catch {
      setPageInputsError('Failed to save inputs.');
    } finally {
      setSavingPageInputs(false);
    }
  }

  function handleScreenshotChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPageInputsError(null);
    if (file && file.size > SCREENSHOT_BYTE_CAP) {
      setPageInputsError('Screenshot must be under 5 MB.');
      return;
    }
    setScreenshotFile(file);
  }

  function clearScreenshot() {
    setScreenshotFile(null);
    if (screenshotInputRef.current) screenshotInputRef.current.value = '';
  }

  function handleNext() {
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  async function handleGenerate() {
    setGenerating(true);
    setGeneratingText('');

    try {
      await fetch('/api/session/save-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, intakeHistory: messages }),
      });
    } catch {
      /* non-fatal */
    }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok || !res.body) {
        setGenerating(false);
        return;
      }
      const reader = res.body.getReader();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = new TextDecoder().decode(value);
        if (chunk.includes('[REPORT_SAVED]')) {
          router.push(`/report/${sessionId}`);
          return;
        }
        text += chunk;
        setGeneratingText(text);
      }
    } catch {
      setGenerating(false);
    }
  }

  // Animate generating progress bar 0→90% over 50s
  useEffect(() => {
    if (!generating) {
      setGenProgress(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      setGenProgress(Math.min(90, ((Date.now() - start) / 50000) * 90));
    }, 200);
    return () => clearInterval(timer);
  }, [generating]);

  if (!validated && !sessionId) return null;

  // Generating screen
  if (generating) {
    return (
      <div className="min-h-screen flex items-start justify-center bg-gray-50 p-4 pt-[15vh] sm:pt-[12vh] md:pt-[15vh]">
        <div
          className="w-full max-w-[580px] bg-white rounded-lg shadow-lg flex flex-col items-center justify-center p-12 text-center"
          style={{ minHeight: 400 }}
        >
          <div className="flex justify-center gap-1.5 mb-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-corzen-blue"
                style={{ animation: `pulse-dot 1.4s ease-in-out ${i * 0.16}s infinite` }}
              />
            ))}
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: '#111827' }}>
            Auditing your homepage…
          </h2>
          <p className="text-base mb-8" style={{ color: '#111827' }}>
            This takes about 30–60 seconds.
          </p>
          <div className="w-full max-w-xs space-y-2">
            <div className="flex justify-between" style={{ fontSize: 13, color: '#4B5563' }}>
              <span>Generating…</span>
              <span>{Math.round(genProgress)}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{ width: `${genProgress}%`, background: '#1B56D6' }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const progressStep = Math.min(step, TOTAL_STEPS - 1);

  return (
    <div className="min-h-screen flex items-start justify-center bg-gray-50 p-4 pt-[15vh] sm:pt-[12vh] md:pt-[15vh]">
      <div
        className="relative w-full max-w-[580px] bg-white rounded-lg shadow-lg flex flex-col"
        style={{ minHeight: 580 }}
      >
        {/* Progress bar */}
        <div className="px-8 pt-6 pb-4">
          <div className="flex items-center gap-2">
            {[...Array(TOTAL_STEPS - 1)].map((_, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-sm transition-all duration-300"
                style={{ background: i < progressStep ? '#1B56D6' : '#E5E7EB' }}
              />
            ))}
          </div>
        </div>

        {/* Screen content */}
        <div className="flex-1 flex flex-col px-8 pb-8">
          {/* Welcome screen */}
          {step === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 text-center px-6">
              <div className="relative w-40 h-40 flex items-center justify-center mb-4">
                <div className="absolute inset-0 rounded-full" style={{ background: '#1B56D610' }} />
                <div
                  className="relative w-28 h-28 rounded-[2.5rem] flex items-center justify-center shadow-lg"
                  style={{ background: '#EFF6FF', color: '#1B56D6', boxShadow: '0 10px 25px #1B56D630' }}
                >
                  <Sparkles className="w-16 h-16" strokeWidth={1.5} />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">
                Audit your homepage
              </h1>
              <div className="mb-8 max-w-[400px] text-left">
                <p className="text-base leading-relaxed" style={{ color: '#111827' }}>
                  Share your page and a few details about your business and get a complete conversion audit including
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-base" style={{ color: '#111827' }}>
                  <li>6-section weighted scoring</li>
                  <li>before/after headline rewrite</li>
                  <li>impact × effort priority matrix</li>
                  <li>a Do-This-Week action plan</li>
                </ul>
              </div>
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-8 py-3.5 text-white text-base font-semibold rounded-xl transition-all shadow-md"
                style={{ background: '#1B56D6', boxShadow: '0 4px 14px #1B56D630' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1645B0')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#1B56D6')}
              >
                Get Started <span>→</span>
              </button>
            </div>
          )}

          {/* Page inputs screen */}
          {step === 1 && (
            <div className="flex flex-col justify-between flex-1">
              <div className="flex flex-col pt-2">
                <div className="text-center mb-5">
                  <p
                    className="text-xs font-semibold uppercase tracking-widest mb-1"
                    style={{ color: '#1B56D6' }}
                  >
                    The page
                  </p>
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
                    Tell us about the page
                  </h1>
                  <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
                    Provide at least one: URL, screenshot, or pasted page copy. More is better — they all feed the audit.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* URL */}
                  <div>
                    <label
                      className="flex items-center gap-2 text-sm font-semibold mb-1.5"
                      style={{ color: '#374151' }}
                    >
                      <Globe className="w-4 h-4" style={{ color: '#1B56D6' }} />
                      Page URL
                    </label>
                    <input
                      type="url"
                      value={pageUrl}
                      onChange={(e) => setPageUrl(e.target.value)}
                      placeholder="https://yourcompany.com"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-corzen-blue focus:border-transparent transition-all placeholder:text-gray-300"
                      style={{ color: '#111827' }}
                    />
                  </div>

                  {/* Screenshot */}
                  <div>
                    <label
                      className="flex items-center gap-2 text-sm font-semibold mb-1.5"
                      style={{ color: '#374151' }}
                    >
                      <ImageIcon className="w-4 h-4" style={{ color: '#1B56D6' }} />
                      Screenshot <span className="text-xs font-normal" style={{ color: '#6B7280' }}>(optional, PNG / JPEG / WebP, &lt; 5 MB)</span>
                    </label>
                    <input
                      ref={screenshotInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleScreenshotChange}
                      className="hidden"
                      id="screenshot-input"
                    />
                    {screenshotFile ? (
                      <div className="flex items-center gap-2 border border-gray-300 rounded-xl px-4 py-3">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#16A34A' }} />
                        <span className="text-sm flex-1 truncate" style={{ color: '#111827' }}>
                          {screenshotFile.name}
                        </span>
                        <span className="text-xs flex-shrink-0" style={{ color: '#6B7280' }}>
                          {(screenshotFile.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <button
                          type="button"
                          onClick={clearScreenshot}
                          className="text-gray-400 hover:text-gray-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor="screenshot-input"
                        className="flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-4 py-3 cursor-pointer hover:border-corzen-blue hover:bg-blue-50 transition-colors"
                      >
                        <span className="text-sm" style={{ color: '#6B7280' }}>
                          Click to upload an above-the-fold screenshot
                        </span>
                      </label>
                    )}
                  </div>

                  {/* Pasted content */}
                  <div>
                    <label
                      className="flex items-center gap-2 text-sm font-semibold mb-1.5"
                      style={{ color: '#374151' }}
                    >
                      Paste page copy or HTML <span className="text-xs font-normal" style={{ color: '#6B7280' }}>(optional)</span>
                    </label>
                    <textarea
                      value={pastedContent}
                      onChange={(e) => setPastedContent(e.target.value.slice(0, PASTE_CHAR_CAP))}
                      placeholder="Paste headline, subheadline, hero copy, or full HTML here…"
                      rows={4}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-corzen-blue focus:border-transparent transition-all placeholder:text-gray-300"
                      style={{ color: '#111827' }}
                    />
                    <p className="text-xs mt-1 text-right" style={{ color: '#9CA3AF' }}>
                      {pastedContent.length.toLocaleString()} / {PASTE_CHAR_CAP.toLocaleString()}
                    </p>
                  </div>

                  {pageInputsError && (
                    <p className="text-sm" style={{ color: '#DC2626' }}>
                      {pageInputsError}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 px-4 py-2.5 text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button>
                <button
                  onClick={handleSavePageInputs}
                  disabled={savingPageInputs}
                  className="flex items-center gap-2 px-8 py-3.5 text-white text-base font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#1B56D6', boxShadow: '0 4px 14px #1B56D630' }}
                  onMouseEnter={(e) => {
                    if (!savingPageInputs) e.currentTarget.style.background = '#1645B0';
                  }}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#1B56D6')}
                >
                  {savingPageInputs ? 'Saving…' : 'Continue →'}
                </button>
              </div>
            </div>
          )}

          {/* Intake — card style */}
          {step === 2 && (
            <div className="flex flex-col justify-between flex-1">
              <div className="flex flex-col pt-2">
                <div className="text-center mb-6">
                  <p
                    className="text-xs font-semibold uppercase tracking-widest mb-1"
                    style={{ color: '#1B56D6' }}
                  >
                    Discovery
                  </p>
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                    A few questions about your audience
                  </h1>
                </div>

                <div
                  className="text-base leading-relaxed mb-6"
                  style={{ color: '#111827', whiteSpace: 'pre-wrap', minHeight: 60 }}
                >
                  {aiThinking && messages.filter((m) => m.role === 'assistant').length === 0 ? (
                    <div className="flex gap-1.5 pt-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-gray-400"
                          style={{ animation: `pulse-dot 1.4s ease-in-out ${i * 0.16}s infinite` }}
                        />
                      ))}
                    </div>
                  ) : (
                    stripMarkdown(
                      [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? ''
                    )
                  )}
                  {aiThinking && messages.filter((m) => m.role === 'assistant').length > 0 && (
                    <span className="inline-flex gap-1 ml-2 align-middle">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"
                          style={{ animation: `pulse-dot 1.4s ease-in-out ${i * 0.16}s infinite` }}
                        />
                      ))}
                    </span>
                  )}
                </div>
              </div>

              {intakeComplete ? (
                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                  <p className="text-sm" style={{ color: '#4B5563' }}>
                    All set — ready to run your audit.
                  </p>
                  <button
                    onClick={handleNext}
                    className="flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-xl transition-all"
                    style={{ background: '#1B56D6', boxShadow: '0 4px 14px #1B56D630' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#1645B0')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#1B56D6')}
                  >
                    Continue →
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type your answer…"
                    rows={4}
                    disabled={aiThinking}
                    className="w-full border border-gray-400 rounded-xl px-4 py-3 text-base resize-none focus:outline-none focus:border-transparent leading-relaxed placeholder:text-gray-300 disabled:opacity-50 transition-all"
                    style={{ color: '#111827' }}
                    onFocus={(e) => (e.target.style.boxShadow = '0 0 0 2px #1B56D6')}
                    onBlur={(e) => (e.target.style.boxShadow = '')}
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleSend}
                      disabled={!inputValue.trim() || aiThinking}
                      className="flex items-center gap-2 px-8 py-3.5 text-white text-base font-semibold rounded-xl disabled:opacity-40 transition-all"
                      style={{ background: '#1B56D6', boxShadow: '0 4px 14px #1B56D630' }}
                      onMouseEnter={(e) => {
                        if (!aiThinking && inputValue.trim())
                          (e.currentTarget as HTMLButtonElement).style.background = '#1645B0';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = '#1B56D6';
                      }}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generate screen */}
          {step === 3 && (
            <div className="flex flex-col justify-between flex-1">
              <div className="flex flex-col items-center text-center pt-2">
                <div className="relative w-28 h-28 flex items-center justify-center mb-5">
                  <div className="absolute inset-0 rounded-full" style={{ background: '#1B56D610' }} />
                  <div
                    className="relative w-20 h-20 rounded-[1.75rem] flex items-center justify-center shadow-md"
                    style={{ background: '#EFF6FF', color: '#1B56D6', boxShadow: '0 6px 18px #1B56D625' }}
                  >
                    <Zap className="w-10 h-10" strokeWidth={1.5} />
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">
                  Almost there!
                </h1>
                <p
                  className="text-base leading-relaxed mb-6 max-w-[380px]"
                  style={{ color: '#111827' }}
                >
                  Have a Voice Guide? Import your file from Notion so the recommended copy in your audit sounds like you. (Optional).
                </p>

                {!showNotion && !voiceImported && (
                  <div className="flex gap-3 w-full max-w-xs">
                    <button
                      onClick={() => setShowNotion(true)}
                      className="flex-1 py-3 rounded-xl border-2 font-semibold text-base transition-all"
                      style={{ borderColor: '#1B56D6', color: '#1B56D6', background: '#fff' }}
                    >
                      Import
                    </button>
                    <button
                      onClick={handleGenerate}
                      className="flex-1 py-3 rounded-xl font-semibold text-base transition-all text-white"
                      style={{ background: '#1B56D6', boxShadow: '0 4px 14px #1B56D630' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#1645B0')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#1B56D6')}
                    >
                      Skip →
                    </button>
                  </div>
                )}

                {showNotion && !voiceImported && (
                  <div className="w-full border border-gray-200 rounded-xl p-4 text-left">
                    <NotionConnect
                      sessionId={sessionId}
                      onImported={(pages) => {
                        setVoiceImported(pages);
                        setShowNotion(false);
                      }}
                      onImportingChange={setNotionImporting}
                    />
                  </div>
                )}

                {voiceImported && (
                  <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Brand Voice Guide imported
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 px-4 py-2.5 text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button>
                {voiceImported && (
                  <button
                    onClick={handleGenerate}
                    disabled={notionImporting}
                    className="flex items-center gap-2 px-8 py-3.5 text-white text-base font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: '#1B56D6',
                      boxShadow: notionImporting ? 'none' : '0 4px 14px #1B56D630',
                    }}
                    onMouseEnter={(e) => {
                      if (!notionImporting) e.currentTarget.style.background = '#1645B0';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#1B56D6';
                    }}
                  >
                    <Zap className="w-5 h-5" />
                    {notionImporting ? 'Importing Notion…' : 'Run My Audit'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div
            className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#1B56D6', borderTopColor: 'transparent' }}
          />
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
