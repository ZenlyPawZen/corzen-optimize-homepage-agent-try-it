import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const BEEHIIV_API_KEY = Deno.env.get('BEEHIIV_API_KEY');
const BEEHIIV_PUB_ID = Deno.env.get('BEEHIIV_PUB_ID');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 });
    }

    const body = await req.text();
    const parsed = JSON.parse(body);
    const email = parsed?.record?.email;

    console.log('[beehiiv] email:', email);

    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400 });
    }

    if (!BEEHIIV_API_KEY || !BEEHIIV_PUB_ID) {
      console.error('[beehiiv] Missing BEEHIIV_API_KEY or BEEHIIV_PUB_ID');
      return new Response(JSON.stringify({ error: 'Beehiiv not configured' }), { status: 500 });
    }

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${BEEHIIV_API_KEY}` };

    const subRes = await fetch(`https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/subscriptions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        reactivate_existing: true,
        send_welcome_email: false,
        utm_source: 'homepage-agent-demo',
        utm_campaign: 'Homepage agent demo',
      }),
    });
    const subText = await subRes.text();
    console.log('[beehiiv] subscribe status:', subRes.status, 'body:', subText);

    if (!subRes.ok) {
      return new Response(
        JSON.stringify({ error: 'beehiiv_subscribe_error', status: subRes.status, beehiiv: subText }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const subData = JSON.parse(subText);

    // Enroll the subscriber in the homepage demo automation via the journeys API.
    // utm_source on an existing subscriber is locked at acquisition, so the
    // UTM-trigger version of the automation never re-fires on second-demo
    // emails. The automation must have an "Add by API" trigger configured.
    const HOMEPAGE_AUTOMATION_ID = 'aut_18294f4d-e18e-4176-bddf-ca586372f141';
    const journeyRes = await fetch(
      `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/automations/${HOMEPAGE_AUTOMATION_ID}/journeys`,
      { method: 'POST', headers, body: JSON.stringify({ email }) }
    );
    const journeyText = await journeyRes.text();
    console.log('[beehiiv] journey status:', journeyRes.status, 'body:', journeyText);

    return new Response(
      JSON.stringify({
        status: 'synced',
        subscriberId: subData?.data?.id,
        journeyStatus: journeyRes.status,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[beehiiv] unhandled error:', error.message, error.stack);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
