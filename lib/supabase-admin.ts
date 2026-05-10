import { createClient } from '@supabase/supabase-js';

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function getSupabaseAdmin() {
  return createClient(
    getEnv('SUPABASE_URL'),
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } }
  );
}

export interface DemoSession {
  id: string;
  email: string;
  beehiiv_tag: string;
  intake_history: Array<{ role: 'user' | 'assistant'; content: string }>;
  brand_voice_context: string | null;
  report_content: string | null;
  created_at: string;
  updated_at: string;
}
