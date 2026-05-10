# Corzen Demo Agent — Setup & Recreation Guide (Homepage Audit)

Written for Claude. Use this to recreate or fork this tool for a new CorZen agent.

This project is itself a fork of the [LinkedIn Authority Builder demo](https://github.com/ZenlyPawZen/corzen-li-authority-builder-agent-try-it).

---

## What this is

A Next.js demo tool that:
1. Collects user email → creates a Supabase session → syncs to beehiiv with UTM tracking
2. Captures a homepage page-input set (URL, optional screenshot, optional pasted copy/HTML) — at least one is required
3. Runs a card-based AI intake interview (3 questions: business type, target customer, conversion goal)
4. Streams a full AI-generated homepage audit (markdown)
5. Renders the audit with a custom Headline Rewrite before/after card and full markdown for the rest

**Stack:** Next.js (App Router) · Supabase (Postgres + Storage + Edge Functions) · Anthropic API (text + vision) · beehiiv · Vercel

---

## Key files

| File | Purpose |
|---|---|
| `app/page.tsx` | Email-gate landing |
| `app/chat/page.tsx` | 4-step flow: welcome → page inputs → intake chat → generate |
| `app/report/[id]/ReportClient.tsx` | Report rendering — Headline Rewrite card + markdown |
| `app/api/session/route.ts` | Creates session in Supabase, fires beehiiv sync |
| `app/api/session/save-page-inputs/route.ts` | Saves URL / pasted content / screenshot (multipart) |
| `app/api/session/save-intake/route.ts` | Saves intake history before generation |
| `app/api/chat/route.ts` | Streams intake responses from Claude with a dynamic greeting that acknowledges the user's page inputs |
| `app/api/generate/route.ts` | Fetches URL, downloads screenshot from Storage, sends multimodal message to Claude, streams the audit |
| `lib/skill.ts` | All prompts — `INTAKE_SYSTEM_PROMPT`, `buildGenerationSystemPrompt()`, `buildGenerationUserMessage()`, `PageInputs` type |
| `supabase/functions/beehiiv-homepage-demo-sync/index.ts` | Edge function that subscribes email to beehiiv with UTM params |
| `migrations/001_create_homepage_audit_sessions.sql` | Schema |

---

## How the flow works

```
User enters email
  → POST /api/session → creates row in homepage_audit_sessions → fires beehiiv edge function
  → /chat?s={id} loads
  → Step 1 page-inputs form: URL + optional screenshot + optional pasted copy/HTML
    → POST /api/session/save-page-inputs (multipart) → uploads screenshot to homepage-audit-screenshots bucket
  → Step 2 intake chat (3 Qs): POST /api/chat streams with a greeting that acknowledges the inputs
    → AI emits [INTAKE_COMPLETE] when business type, target customer, conversion goal are collected
  → Step 3 (optional Notion brand-voice import) → click Run My Audit
  → POST /api/generate
    → Server fetches the homepage URL (10s timeout, strips HTML to text, caps at 30k chars)
    → Server downloads the screenshot from Storage and base64-encodes it
    → Sends a multipart user message to Claude (text + image content blocks)
    → Streams markdown back, including a `### Headline Rewrite` block in a known format
  → [REPORT_SAVED] signal triggers redirect to /report/{id}
  → ReportClient.tsx pulls report_content + homepage_url from Supabase, parses out the Headline Rewrite section into a card, renders the rest as markdown
```

---

## Inputs contract

The audit needs at least one of these three to function:

1. **URL** — server-side fetched, HTML stripped to text, capped at 30k chars
2. **Screenshot** — PNG / JPEG / WebP, < 5 MB, sent to Claude as a vision content block
3. **Pasted page copy or HTML** — capped at 30k chars

The page-inputs form blocks submission unless at least one is provided. Application-side enforcement; the DB does not have a CHECK constraint for it.

---

## Brand voice handling

If the user imports a Brand Voice Guide via Notion (step 3), `brand_voice_context` is populated. `buildGenerationSystemPrompt()` then appends a strict instruction:

> Apply the brand voice to **all recommended/replacement copy** — every Headline Rewrite (current → rewritten + alternate), every concrete copy fix in the Priority Matrix, and the action wording in Do-This-Week and This-Month items. Do NOT let the brand voice change the analytical scoring narrative.

If no voice is imported, the audit produces standard CorZen-tone recommendations.

---

## Email policy

- Email is required to access the demo.
- Each email can run **this** demo once (per-table `UNIQUE(email)` constraint on `homepage_audit_sessions`).
- The same email is free to be reused on **other** CorZen agent demos because each agent has its own table (e.g. `li_demo_sessions`).
- The 409 response from `POST /api/session` shows the "you've already used this demo — try our other free demos with the same email" message.

---

## To fork for a new agent

### 1. Supabase table

Run `migrations/001_create_homepage_audit_sessions.sql` in the SQL editor. Rename the table for the new agent (e.g. `gtm_demo_sessions`). Update all references in:
- `app/api/session/route.ts`
- `app/api/session/save-page-inputs/route.ts`
- `app/api/session/save-intake/route.ts`
- `app/api/chat/route.ts`
- `app/api/generate/route.ts`
- `app/api/notion/extract/route.ts`
- `app/report/[id]/page.tsx` and `ReportClient.tsx`

### 2. Skill content — `lib/skill.ts`

This is the main thing to rewrite for a new agent. Contains:

- **`INTAKE_SYSTEM_PROMPT`** — instructs Claude how to conduct the intake. Defines the questions to collect. Keep the `[INTAKE_COMPLETE]` signal and the plain-text-only rule.
- **`buildGenerationSystemPrompt()`** — the system prompt for report generation. Skill framework + writing style + exact output format. Keep the brand-voice rule.
- **`buildGenerationUserMessage()`** — formats intake history + page inputs and appends `TASK_INSTRUCTION`.

### 3. UI copy — `app/page.tsx`, `app/chat/page.tsx`, `app/layout.tsx`

Update:
- Layout `<title>` and meta description
- Landing page tagline, CTA button text, deliverables list, existing-email message
- Welcome screen headline + bullets
- `app/api/chat/route.ts` greeting builder (it's a JS function, not an LLM-generated message)

### 4. Report rendering — `app/report/[id]/ReportClient.tsx`

The current renderer parses out the `### Headline Rewrite` markdown section and renders it as a custom before/after card. The rest of the markdown is rendered as-is via `react-markdown` with `remarkGfm`.

If the new agent's report has different distinctive sections that warrant custom UI, parse them out before passing the rest to `ReactMarkdown`.

### 5. beehiiv edge function

- Copy `supabase/functions/beehiiv-homepage-demo-sync/` to a new folder named for the agent
- Update `utm_source` and `utm_campaign` to slugs for the new agent
- Deploy: `supabase functions deploy beehiiv-{agent}-demo-sync --project-ref ydynjmhkprkwhehvhhey --workdir {project-dir}`
- Update `app/api/session/route.ts` to call the new edge function URL

**beehiiv segmentation note:** The beehiiv v2 tags API is broken. Use UTM parameters instead. In beehiiv: Audience → Segments → Create segment → filter by `utm_source = {agent-slug}`.

### 6. Storage bucket (only if the agent accepts uploads)

This demo uses a private bucket `homepage-audit-screenshots` for screenshots. Create it manually in the Supabase dashboard (Storage → Create bucket → private). The service role bypasses storage RLS so no extra policies are needed.

### 7. Environment variables

Set these in Vercel and locally in `.env.local`:

```
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=        # only if client-side Supabase calls are added
```

Set these in Supabase Edge Functions secrets (dashboard → Edge Functions → Manage secrets):

```
BEEHIIV_API_KEY=
BEEHIIV_PUB_ID=
```

### 8. Deploy checklist

- [ ] Run migrations in Supabase SQL editor
- [ ] Create the `homepage-audit-screenshots` storage bucket (private)
- [ ] Set Vercel env vars
- [ ] Set Supabase edge function secrets
- [ ] Deploy edge function via CLI
- [ ] Set `export const maxDuration = 120` on `/api/chat` and `/api/generate` routes (Vercel will timeout at 10s without this)
- [ ] Test all input combinations: URL only / screenshot only / pasted only / multiple
- [ ] Test with and without Notion brand voice
- [ ] Test 409 path (same email twice on this demo)
- [ ] Test cross-demo email reuse (same email on this demo + LI demo)

---

## Important UI constraints

- **Intake UI is card-based, not chat bubbles.** Show only the last assistant message as plain text. No history visible. Matches CorZen design system.
- **Strip markdown from intake messages** client-side via `stripMarkdown()` in `app/chat/page.tsx`.
- **Vision input requires a vision-capable model.** This project uses `claude-sonnet-4-6` for both chat and generation, which supports image content blocks. If you switch models, verify vision support.
- **URL fetch is best-effort.** Marketing sites sometimes block server fetches. The audit's Phase 6 Self-Critique flags weak fetches automatically.
- **Headline Rewrite must follow the exact markdown format** in `lib/skill.ts` for the parser in `ReportClient.tsx` to extract it. If you change the format, update the parser.
