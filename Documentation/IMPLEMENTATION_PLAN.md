# Implementation Plan: Homepage Audit Demo

> Forked from `corzen-li-authority-builder-agent-try-it` to demo the `audit-homepage` agent from `corzen-build`.
> Created 2026-05-10.

## Goal

Adapt the LinkedIn Authority Builder demo into a free public demo of the `audit-homepage` agent
([skill source](/Users/ckinross/.copilot/skills/skills/homepage-audit/SKILL.md), generation config
in `corzen-build/api/agents/registry.ts:4617`). Push to
`https://github.com/ZenlyPawZen/corzen-optimize-homepage-agent-try-it.git` once finished.

## Decisions

- **Intake collects URL, plus optional screenshot upload, plus optional pasted text/HTML.**
  At least one of the three is required (matches the skill's Context Loading Gates). Other intake
  questions: business type, target customer, conversion goal.
- **Always run `standard` mode.** Hardcoded — no mode picker.
- **Same Supabase project** (`ydynjmhkprkwhehvhhey`). New table `homepage_audit_sessions`. New
  edge function `beehiiv-homepage-demo-sync` with `utm_source=homepage-agent-demo`,
  `utm_campaign="Homepage agent demo"`.
- **Notion brand-voice import: kept.** If a brand voice was imported, it must be applied to all
  recommended replacement copy in the audit — headline rewrites, alternate headlines, and any
  rewritten copy inside Priority Matrix fixes or Do-This-Week items.
- **Report viewer**: react-markdown + custom Headline Rewrite before/after card.
- **Email policy**: required for access, unique per-agent (each email can run each demo once),
  but the same email works across all CorZen agent demos. The existing table-scoped
  `UNIQUE(email)` constraint achieves this naturally because every agent has its own table.
  No global/cross-agent dedup.
- **Repo URL**: `https://github.com/ZenlyPawZen/corzen-optimize-homepage-agent-try-it.git`.

## Steps

### 1. Copy the project

```
cp -R /Users/ckinross/corzen-li-authority-builder-agent-try-it /Users/ckinross/corzen-optimize-homepage-agent-try-it
```

Then in the new directory: remove `.git`, `.next`, `node_modules`, `.tsbuildinfo`. Keep `.env`
(re-point variables — manually verify keys before deploy).

### 2. Update `package.json`

Rename `"name"` → `"corzen-optimize-homepage-agent-try-it"`. Same dependencies — homepage audit
doesn't need new packages. `@anthropic-ai/sdk` already supports vision input via image content
blocks.

### 3. Replace skill content — `lib/skill.ts`

Rewrite all exports for homepage audit:

- **`INTAKE_SYSTEM_PROMPT`**: Conduct chat intake collecting business type, target customer,
  primary conversion goal. The intake prompt does NOT collect the URL/screenshot/paste in chat —
  those are captured in a pre-chat form (see step 5). Intake starts with the page-input form
  already submitted, and Claude can reference what was provided. Same `[INTAKE_COMPLETE]` signal
  once the 3 chat questions are answered.
- **`SKILL_CONTENT`**: homepage-audit skill body (modes, scoring rubrics, output structure).
- **`HUMANIZE_RULES`**: kept.
- **`TASK_INSTRUCTION`**: corzen-build's `audit-homepage` task instruction
  (registry.ts:4624–4632), hardcoded to standard mode.
- **`buildGenerationSystemPrompt(brandVoiceContext)`**:
  - Opening: "You are a conversion expert auditing a homepage…"
  - Output skeleton: 5-Second Test / Section Scores / Headline Rewrite / Priority Matrix /
    Do This Week / This Month / Self-Critique.
  - Add explicit instruction: "When a Brand Voice Guide is provided below, apply it to ALL
    rewritten/recommended copy — the Headline Rewrite (current → rewritten + alternate), every
    concrete copy fix in the Priority Matrix, and the action wording in Do-This-Week items.
    Match documented tone/role and signature phrases. Never produce generic copy that ignores
    the brand voice when one is provided."
- **`buildGenerationUserMessage(intakeHistory, pageInputs)`**: signature accepts a `pageInputs`
  object: `{ url?, fetchedPageText?, fetchedPageError?, pastedContent?, hasScreenshot }`. Returns:
  - `## Discovery Q&A` (chat history)
  - `## Page Inputs Provided` — lists which inputs the user gave (URL / screenshot / pasted copy)
  - `## Page Content` — concatenates fetched URL text and pasted text/HTML in clearly labeled way.
    If only a screenshot was provided, this section says so and instructs Claude to rely on the image.
  - `TASK_INSTRUCTION` last.

### 4. Server-side URL fetch + screenshot vision input — `app/api/generate/route.ts`

- Read `homepage_url`, `pasted_content`, `screenshot_path` from the saved session.
- If `homepage_url` set: fetch with 10s timeout, strip `<script>`/`<style>`, extract text,
  cap ~30k chars. On failure, store the reason in `fetchedPageError`.
- If `pasted_content` set: pass through as-is (already capped at intake time).
- If `screenshot_path` set: download bytes from Supabase Storage and base64-encode. Build the
  Anthropic message with multi-part user content: text block + image block. Verify the model
  supports vision; switch generation calls to a vision-capable model if not.
- Pass everything to `buildGenerationUserMessage()`.

### 5. Pre-chat page-input form — new step in `app/chat/page.tsx`

Before the existing card-based chat intake renders, show a single form step:

- **URL field** (text input, optional).
- **Screenshot upload** (file input, image/png + image/jpeg, max ~5 MB, optional). On submit,
  upload to Supabase Storage bucket `homepage-audit-screenshots/{session_id}/{filename}`. Store
  the storage path in the session row.
- **Pasted content** (textarea, optional, "paste your homepage HTML or copy here", cap ~30k chars).
- **Validation: at least one of the three must be provided** before the form can submit.
- New API: `POST /api/session/save-page-inputs` (or fold into existing `save-intake`).

### 6. Supabase Storage bucket

- Create bucket `homepage-audit-screenshots` (private). Service role read/write; no public access.
- Document the bucket creation step in the migrations folder as a comment.

### 7. UI copy — landing + intake

- **Landing page** `app/page.tsx`: tagline replacement; deliverables bullets (6-section weighted
  score, before/after headline rewrite, priority matrix, this-week action plan); existing-email
  branch copy: *"You've already used this demo. Your homepage audit is saved in your CorZen
  account. **You can use this same email to try our other free demos.**"*
- **Layout** `app/layout.tsx`: title "Homepage Audit | CorZen".
- **Hardcoded greeting** in `app/api/chat/route.ts` (~lines 46–49): replace with a homepage-audit
  greeting that acknowledges what the user already provided in the page-input form.
- `stripMarkdown()` stays.

### 8. Report viewer — `app/report/[id]/ReportClient.tsx`

- Remove PostCard, calendar parser, CSV builder.
- Add `extractHeadlineRewrite()` parser → styled before/after card.
- Render rest of markdown via `ReactMarkdown` + `remarkGfm`.
- Heading: "Homepage Audit Report".

### 9. Supabase migrations — `migrations/`

New file `001_create_homepage_audit_sessions.sql` (inlines the email_opt_in and tools columns):

```sql
CREATE TABLE homepage_audit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  beehiiv_tag TEXT NOT NULL DEFAULT 'Homepage audit demo',
  email_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  homepage_url TEXT,
  pasted_content TEXT,
  screenshot_path TEXT,
  intake_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  brand_voice_context TEXT,
  tools TEXT[],
  report_content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The `UNIQUE(email)` constraint is **scoped to this table only** — no global/cross-agent dedup.

Update DB references from `li_demo_sessions` → `homepage_audit_sessions` everywhere.
Update `sessionStorage` key `li_demo_session` → `homepage_audit_session`.

### 10. Edge function

Copy + rename `supabase/functions/beehiiv-li-demo-sync/` → `supabase/functions/beehiiv-homepage-demo-sync/`.
Update `utm_source: 'homepage-agent-demo'` and `utm_campaign: 'Homepage agent demo'`. Update the
URL referenced in `app/api/session/route.ts`.

### 11. Update `docs/agent-setup.md`

Document new input contract (URL + screenshot + paste, at least one required), pre-chat form
pattern, Supabase Storage bucket setup, vision-capable model requirement, brand voice → applied
to all rewritten copy, email policy.

### 12. `.env.example`

Add comment about the storage bucket name. No new secrets required.

### 13. Local verification

`npm install` → run migrations → create the storage bucket → deploy edge function → `npm run dev`.

Test matrix:
- URL only / Screenshot only / Pasted text only / All three / None (blocked).
- With and without Notion brand voice.
- Same email twice on this demo → 409 with "try our other demos" message.
- Same email here AND on the LI demo → both succeed independently.

### 14. Commit + push

`git init`, single initial commit, push to `main`.

## Risks / open considerations

- **Vision model cost/availability**: screenshots use ~1–2k tokens per image. Confirm the chosen
  model supports vision.
- **Screenshot file size**: cap at 5 MB client-side.
- **Pasted HTML safety**: pasted content goes into the prompt only, not rendered as HTML
  anywhere — no XSS risk.
- **Brand voice + audit alignment**: voice shapes recommended copy, not the auditor's analytical
  voice. System prompt reflects this.
- **URL fetch reliability**: marketing sites block server fetches sometimes. Self-Critique flags
  weak fetches.
