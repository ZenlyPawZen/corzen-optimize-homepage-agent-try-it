# Style and humanize refinements

> Notes on the styling and prompt changes made on 2026-05-10. Both the homepage-audit demo and the sister LinkedIn authority-builder demo (`/Users/ckinross/corzen-li-authority-builder-agent-try-it`) were updated together; keep them in sync.

## Why these changes happened

The first end-to-end run of the homepage-audit demo surfaced two distinct problems:

1. The email-gate page had grey body and supporting text that was too light to read on a white card.
2. The generated audit report still read as obviously AI-written. Em dashes everywhere, bolded labels with colons, title-case section headings, and a few words ("actually", "execution", "quietly") that cue readers to LLM authorship.

Investigation showed the humanize rule block at `lib/skill.ts` only banned a small set of vocabulary tells. It did not address punctuation or layout patterns. It also did not address the bigger problem: the rest of the prompt (output skeleton, task-instruction phases, headline-rewrite template) modeled the very patterns we wanted to ban. The model imitates worked examples in the prompt more reliably than it follows abstract rules, so the rules and the surrounding prompt were pulling in opposite directions.

## Email-gate readability

`app/page.tsx` used four grey shades for text on a white card. The user flagged the lighter shades as unreadable. Changes:

| Element | Old class | New class |
|---|---|---|
| Subtitle, e.g. "Homepage Audit, free demo" | `text-slate-500` | `text-slate-600` |
| Body paragraph | `text-slate-600` | `text-slate-700` |
| Checkbox label | `text-slate-500` | `text-slate-600` |
| Fine print under the submit button | `text-slate-400` | `text-slate-600` |

Default for new screens on a white background:

- Body text: `text-slate-700`
- Secondary or supporting text: `text-slate-600`
- Headings: `text-corzen-navy`
- Avoid `text-slate-400` and `text-slate-500` for any content the user is meant to read.

The same edits were mirrored to the LI demo at the same line numbers in its `app/page.tsx`. Keep the two demos in visual sync.

## Humanize rules expansion

`lib/skill.ts` exports `HUMANIZE_RULES`, a string that is concatenated into the audit-generation system prompt by `buildGenerationSystemPrompt()`. It is not applied to the intake chat (only the final report generation flow uses it). Two additions were made:

### New "Style and grammar" subsection

Bans the following patterns in addition to the original vocabulary list:

- Em dashes (use commas, periods, parentheses)
- Bolding key terms inside sentences
- Vertical lists where every bullet starts with a bold header followed by a colon
- Headings in title case (use sentence case, only the first word and proper nouns capitalized)
- Emojis in headings or bullets
- Curly quotes (use straight quotes only)
- The words "actually", "execution", "quietly"

### New "Scope" subsection

Codifies which rules apply to which output:

- Vocabulary bans and the em dash rule apply to all output, including recommended/replacement page copy (rewritten headlines, copy fixes inside the priority matrix, action wording in "Do this week" and "This month" items).
- The remaining rules (boldface, vertical lists, headings sentence case, emojis, quotation marks) are aimed primarily at the analytical narrative. Marketing copy may legitimately need different choices, e.g. a title-case headline.
- If a brand voice guide is appended to the prompt later, it overrides every rule above wherever the two conflict in user-facing copy. The humanize rules apply only where the brand voice is silent. See "Brand voice precedence" below.

## Prompt sweep

Adding rules without removing the patterns the prompt was modeling would have left the rules and the worked examples in conflict. The whole report-generation prompt was swept to bring it into alignment.

Specific patterns rewritten across `SKILL_CONTENT`, `TASK_INSTRUCTION`, the output skeleton inside `buildGenerationSystemPrompt`, the brand voice append, and `buildGenerationUserMessage`:

- Title-case section headings rewritten to sentence case. For example, `## Page-Type Classification & Scoring Weights` became `## Page-type classification and scoring weights`. `### E-Commerce` became `### E-commerce`.
- Bold-with-colon labels in the headline-rewrite template (`**Current:**`, `**Why it's weak:**`, `**Rewritten:**`, `**Why it's stronger:**`, `**Alternate version:**`) became small headings (`#### Current`, etc.).
- Bold meta labels in the output skeleton (`**Page Type:**`, `**Target Conversion:**`, `**Rating:**`) became plain non-bold lines.
- Phase markers in `TASK_INSTRUCTION` (`**Phase 1, Page-Type Classification**:`) became prose phrases (`Phase 1, page-type classification.`), no bold, no em dash.
- Em dashes inside prompt-supplied headings, anchors, and instructions were replaced with commas, periods, or parentheses.
- Bold inline emphasis on words like `**standard**` and `**outcome**` was removed.
- The category labels `**Do This Week**`, `**Schedule This Month**`, `**Deprioritize**` became unbolded sentence-case strings in quotes: `"Do this week"`, `"Schedule this month"`, `"Deprioritize"`.

The intake chat prompts (`INTAKE_SYSTEM_PROMPT` in both repos) were left untouched. The intake flow does not consume `HUMANIZE_RULES` and the user is focused on report content, not intake tone. If the intake bot's output ever needs a similar pass, it can be done later.

## Brand voice precedence

When a user has imported a brand voice guide from Notion (the optional `brandVoiceContext` argument to `buildGenerationSystemPrompt`), the brand voice should always win over the humanize rules where they conflict.

This is codified in two places per repo so the model cannot miss it:

1. The "Scope" subsection of `HUMANIZE_RULES` ends with a sentence telling the model that if a brand voice guide appears later in the prompt, it overrides every rule above wherever the two conflict in user-facing copy.
2. The `## Brand voice guide` append (only injected when `brandVoiceContext` is present) reasserts the precedence and explicitly calls out vocabulary, em dashes, and any other style decision.

There is one carve-out, in the homepage-audit repo only: the brand voice does not change the auditor's analytical scoring narrative. Voice shapes recommended copy, not the auditor's voice. The LI demo does not have this carve-out; its brand voice append says "apply it throughout" without exception. If the user later asks for the carve-out to be removed in the homepage demo, it is a one-line edit in the brand voice append.

## Files touched

In the homepage-audit repo:

- `app/page.tsx`: four grey shade bumps on the email-gate card
- `lib/skill.ts`: humanize expansion, prompt sweep, brand voice precedence

In the LI authority-builder repo (`/Users/ckinross/corzen-li-authority-builder-agent-try-it`):

- `app/page.tsx`: same four grey shade bumps
- `lib/skill.ts`: same humanize expansion, prompt sweep adapted to LI's content, brand voice precedence

## Maintenance notes

- Keep the two demos in sync. When humanize rules or visual styling change in one, mirror to the other.
- When you add a new heading, label, or worked example anywhere in a skill file, write it in sentence case and avoid em dashes and bold-with-colon. Otherwise the prompt teaches the opposite of what the rules say.
- The intake chat prompts (`INTAKE_SYSTEM_PROMPT`) still contain em dashes and bolded list labels. They are intentionally outside the humanize scope today. Revisit if the intake bot's tone becomes a concern.
- Memory entries that record this policy live at `/Users/ckinross/.claude/projects/-Users-ckinross-corzen-optimize-homepage-agent-try-it/memory/feedback_humanize_policy.md` and `feedback_grey_text_readability.md`. Future Claude sessions will pick these up automatically.
