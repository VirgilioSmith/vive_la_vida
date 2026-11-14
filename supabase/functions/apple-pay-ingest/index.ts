/** Vive el hoy · apple-pay-ingest v3 (cableado Deno; la lógica vive en handler.mjs). */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle } from './handler.mjs';
function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if (legacy) return legacy;
  try { const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}'); return typeof keys.default === 'string' ? keys.default : ''; } catch { return ''; }
}
Deno.serve(async (request: Request) => {
  const url = Deno.env.get('SUPABASE_URL') || '', key = serviceKey();
  if (!url || !key) return new Response(JSON.stringify({ ok: false, saved: false, code: 'internal_error' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return handle(request, { admin, now: () => Date.now(), log: (code, meta) => console.error('apple_pay_ingest', code, JSON.stringify(meta || {})) });
});
