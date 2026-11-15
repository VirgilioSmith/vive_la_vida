/** Vive el hoy · Apple Pay v2: receptor definitivo autenticado e idempotente. (VERSIÓN 12 ORIGINAL, para reversión) */
import { createClient } from 'npm:@supabase/supabase-js@2';
const HEADERS = {
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type,x-vive-token',
  'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
};
const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify({ version: 'apple-pay-v2', ...body }), { headers: HEADERS, status });
function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try { const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}'); return typeof keys.default === 'string' ? keys.default : ''; }
  catch { return ''; }
}
async function digest(v: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2,'0')).join('');
}
const safeText = (v: unknown, max = 140) => typeof v === 'string' ? v.trim().replace(/\s+/g,' ').slice(0,max) : '';
function amountValue(v: unknown): number|null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v >= 1e9) return null;
  const cents = Math.round(v * 100);
  return Math.abs(cents / 100 - v) < 1e-8 ? cents / 100 : null;
}
function iso(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 60 || !v.trim()) return null;
  const date = new Date(v); return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (request.method !== 'POST') return respond({ ok:false, saved:false, code:'method_not_allowed' },405);
  const token = request.headers.get('x-vive-token')?.trim() || '';
  if (!/^vhap_[a-f0-9]{64}$/.test(token)) return respond({ ok:false, saved:false, code:'invalid_token' },401);
  if (Number(request.headers.get('content-length')||'0') > 16384) return respond({ ok:false, saved:false, code:'body_too_large' },413);
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 16384) return respond({ ok:false, saved:false, code:'body_too_large' },413);
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('invalid_body');
    body = value as Record<string, unknown>;
  } catch { return respond({ ok:false, saved:false, code:'invalid_json' },400); }
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = serviceKey();
  if (!url || !key) return respond({ok:false,saved:false,code:'server_config'},503);
  const admin = createClient(url, key, { auth: { persistSession:false, autoRefreshToken:false } });
  const hash = await digest(token);
  const lookup = await admin.from('apple_pay_links')
    .select('id,user_id,instrument_id,currency,active').eq('token_hash',hash).eq('active',true).limit(1).maybeSingle();
  if (lookup.error) return respond({ok:false,saved:false,code:'link_lookup_failed'},500);
  const link = lookup.data;
  if (!link) return respond({ok:false,saved:false,code:'link_revoked'},401);
  const amount = amountValue(body.amount);
  const merchant = safeText(body.merchant,140);
  const currency = safeText(body.currency,8).toUpperCase();
  const dryRun = body.dry_run === true || body.dry_run === 1 || body.dry_run === 'true';
  if (amount === null || !merchant || !currency)
    return respond({ok:false,linked:true,saved:false,code:'invalid_fields',missing:[...(amount===null?['amount']:[]),...(!merchant?['merchant']:[]),...(!currency?['currency']:[])]},422);
  if (!['DOP','USD'].includes(currency) || currency !== link.currency)
    return respond({ok:false,linked:true,saved:false,code:'currency_mismatch',expected_currency:link.currency},422);
  const supplied = safeText(body.event_id,150);
  if (dryRun) return respond({ok:true,linked:true,dry_run:true,saved:false,amount,merchant,currency,event_id:supplied||'dry-run-no-event'});
  if (!/^[\w:.-]{1,150}$/.test(supplied))
    return respond({ok:false,linked:true,saved:false,code:'missing_event_id'},422);
  const prior = await admin.from('apple_pay_events').select('id,status,amount,currency,merchant')
    .eq('link_id',link.id).eq('event_id',supplied).limit(1).maybeSingle();
  if (prior.error) return respond({ok:false,saved:false,code:'event_lookup_failed'},500);
  if (prior.data) {
    if (Number(prior.data.amount)!==amount || prior.data.currency!==currency || prior.data.merchant!==merchant)
      return respond({ok:false,saved:false,code:'event_id_conflict',error:'Este event_id ya pertenece a otra compra.'},409);
    return respond({ok:true,saved:true,duplicate:true,id:prior.data.id,status:prior.data.status,event_id:supplied,amount,currency,merchant});
  }
  const transactionTime = iso(body.transaction_time);
  if (body.transaction_time && !transactionTime) return respond({ok:false,saved:false,code:'invalid_transaction_time'},422);
  const inserted = await admin.from('apple_pay_events').insert({
    user_id:link.user_id, link_id:link.id, instrument_type:'card', instrument_id:link.instrument_id,
    event_id:supplied, merchant, amount, currency, status:'pending',
    ...(transactionTime?{transaction_time:transactionTime}:{}),
  }).select('id,status,received_at').single();
  if (inserted.error) {
    if (inserted.error.code==='23505') {
      const raced = await admin.from('apple_pay_events').select('id,status,amount,currency,merchant')
        .eq('link_id',link.id).eq('event_id',supplied).limit(1).maybeSingle();
      if (raced.data) {
        if (Number(raced.data.amount)!==amount || raced.data.currency!==currency || raced.data.merchant!==merchant)
          return respond({ok:false,saved:false,code:'event_id_conflict'},409);
        return respond({ok:true,saved:true,duplicate:true,id:raced.data.id,status:raced.data.status,event_id:supplied,amount,currency,merchant});
      }
    }
    console.error('apple_pay_insert_failed',{code:inserted.error.code,message:inserted.error.message});
    return respond({ok:false,saved:false,code:'event_insert_failed',db_code:inserted.error.code||null},500);
  }
  return respond({ok:true,saved:true,duplicate:false,id:inserted.data.id,status:inserted.data.status,
    received_at:inserted.data.received_at,event_id:supplied,amount,merchant,currency});
});
