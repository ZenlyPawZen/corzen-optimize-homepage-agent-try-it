# Mirror Beehiiv sync fixes to the LI demo

Goal: apply the two Beehiiv sync fixes from the homepage-audit demo to the LinkedIn Authority Builder demo at `/Users/ckinross/corzen-li-authority-builder-agent-try-it`. After this, the LI demo will reliably tag subscribers in Beehiiv. The Beehiiv automation that branches on `UTM Source equals li-agent-demo` will start firing for every valid email submission, not just the rare ones that win Vercel's function-shutdown race.

## Context

The LI demo's `app/api/session/route.ts` has two bugs that the homepage demo had until today:

1. The Beehiiv sync fetch is fire-and-forget. No `await`, no `waitUntil`. Vercel terminates the serverless function as soon as the response is sent to the client, which usually kills the fetch before it leaves the network. The session row is inserted; Beehiiv never receives the subscriber.
2. The Beehiiv sync fetch is placed after the duplicate-email check. If the email already exists in `li_demo_sessions`, the function returns 409 and the Beehiiv call is skipped, so the LI tag is never re-applied on repeat attempts.

Both were fixed in the homepage repo in commits `d266574` (waitUntil) and `a35b255` (fire on every email). Mirror those changes to the LI repo.

The `beehiiv-li-demo-sync` edge function is already deployed (version 16, active). No Supabase deployment work needed.

## Verify state before changing anything

```sh
cd /Users/ckinross/corzen-li-authority-builder-agent-try-it
grep -n "waitUntil\|@vercel/functions" app/api/session/route.ts
grep -n "@vercel/functions" package.json
```

If `waitUntil` already appears in `app/api/session/route.ts` and `@vercel/functions` is in `package.json`, the work has already been done. Stop. Otherwise, proceed.

## Step 1: install @vercel/functions

```sh
cd /Users/ckinross/corzen-li-authority-builder-agent-try-it
npm install @vercel/functions
```

## Step 2: edit app/api/session/route.ts

Two edits in this one file.

### Edit A: add the import

Find:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
```

Replace with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
```

### Edit B: move the Beehiiv fetch and wrap it in waitUntil

Current flow inside the POST handler:

1. Email validation
2. Normalize email, get supabase client
3. Duplicate check, if exists return 409
4. Insert row, if error return 500
5. Fire-and-forget fetch to `${SUPABASE_URL}/functions/v1/beehiiv-li-demo-sync`
6. Return 200 with sessionId

New flow:

1. Email validation
2. Normalize email, get supabase client
3. `waitUntil(fetch(...))` to `${SUPABASE_URL}/functions/v1/beehiiv-li-demo-sync`
4. Duplicate check, if exists return 409
5. Insert row, if error return 500
6. Return 200 with sessionId

The fetch URL, headers, and body all stay the same. Only its position changes (now between step 2 and the existing duplicate check) and it gets wrapped in `waitUntil`.

The replacement block, with the exact pattern from the homepage repo, looks like this. Keep the LI repo's existing `tag` value verbatim (do not change it):

```ts
// Fire the Beehiiv sync for every valid email, before any duplicate
// check, so the utm_source-driven automation in Beehiiv re-applies the
// demo's tag on repeat attempts. Beehiiv treats duplicate subscribes
// safely (reactivate_existing: true).
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (supabaseUrl && serviceKey) {
  waitUntil(
    fetch(`${supabaseUrl}/functions/v1/beehiiv-li-demo-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ record: { email: normalizedEmail, tag: '<keep the existing tag string>' } }),
    }).catch((err) => console.error('[session] beehiiv sync error:', err))
  );
}
```

Place this block right after the line that gets the supabase client and right before the existing duplicate-check block. Delete the original Beehiiv block from its old location (after the insert) so it does not run twice.

## Step 3: type-check

```sh
cd /Users/ckinross/corzen-li-authority-builder-agent-try-it
npx tsc --noEmit -p .
```

Expect no output. If there are errors, fix them before committing.

## Step 4: commit and push

```sh
git add package.json package-lock.json app/api/session/route.ts
git commit -m "Mirror Beehiiv sync fixes from homepage demo: waitUntil + fire on every email"
git push origin main
```

## Step 5: verify after Vercel redeploys

1. Run the LI demo end to end with a fresh email. Open the Vercel runtime log for the `POST /api/session` request. The External APIs section should now show three entries: the duplicate-check GET to `li_demo_sessions`, the insert POST to `li_demo_sessions`, and a POST to `.../functions/v1/beehiiv-li-demo-sync` returning 200.
2. In Beehiiv, open the automation that branches on `UTM Source equals li-agent-demo`. The True-branch subscriber count should grow.
3. Re-run the demo with the same email. The POST should return 409, but the Vercel log should still show the POST to `beehiiv-li-demo-sync`. The Beehiiv automation True branch should still register the new entry.

## Troubleshooting

If the Beehiiv POST in the Vercel log returns 500, the `BEEHIIV_API_KEY` or `BEEHIIV_PUB_ID` secret is missing on the Supabase project. Set with:

```sh
cd /Users/ckinross/corzen-li-authority-builder-agent-try-it
supabase secrets set BEEHIIV_API_KEY=your_beehiiv_api_key
supabase secrets set BEEHIIV_PUB_ID=your_beehiiv_publication_id
```

If `supabase secrets set` or any `supabase` CLI command reports `Using workdir /Users/ckinross`, run `supabase init` inside the LI repo to create a local `supabase/config.toml`, then re-run.

## Reference

The two corresponding commits in the homepage repo, in case you want to diff:

- `d266574`: Wrap Beehiiv sync fetch in waitUntil so it survives function return
- `a35b255`: Fire Beehiiv sync on every valid email, not just new ones

Both on `main` of `/Users/ckinross/corzen-optimize-homepage-agent-try-it`.
