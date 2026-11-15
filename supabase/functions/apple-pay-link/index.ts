/** Vive el hoy · apple-pay-link v9 (cableado Deno). */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle } from './handler.mjs';
function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if (legacy) return legacy;
  try { const k = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}'); return typeof k.default === 'string' ? k.default : ''; } catch { return ''; }
}
Deno.serve((request: Request) => {
  const url = Deno.env.get('SUPABASE_URL') || '', key = serviceKey();
  if (!url || !key) return new Response(JSON.stringify({ ok: false, code: 'internal_error' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return handle(request, { admin, origin: url, log: (c, m) => console.error('apple_pay_link', c, JSON.stringify(m || {})) });
});
