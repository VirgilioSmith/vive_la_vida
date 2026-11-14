/** Vive el hoy · apple-pay-link · emitir/rotar token y revocar vínculos. Requiere el JWT del usuario. */
export const ALLOWED_ORIGINS = ['https://virgiliosmith.github.io'];
const BASE = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };
function corsFor(request) {
  const origin = request.headers.get?.('origin') || '';
  return ALLOWED_ORIGINS.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'authorization,apikey,x-client-info,content-type' } : {};
}
const mkReply = (request) => (body, status = 200) => new Response(JSON.stringify({ version: 'apple-pay-v3', ...body }), { status, headers: { ...BASE, ...corsFor(request) } });
const clean = (v, max = 120) => typeof v === 'string' ? v.trim().slice(0, max) : '';
export async function sha256(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
export function newToken() { const b = crypto.getRandomValues(new Uint8Array(32)); return 'vhap_' + [...b].map(x => x.toString(16).padStart(2, '0')).join(''); }
/** deps: { admin, origin (SUPABASE_URL), log } */
export async function handle(request, deps) {
  const reply = mkReply(request), log = deps.log || (() => {});
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...BASE, ...corsFor(request) } });
    if (!['POST', 'DELETE'].includes(request.method)) return reply({ ok: false, code: 'method_not_allowed' }, 405);
    const jwt = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '')?.[1];
    if (!jwt) return reply({ ok: false, code: 'unauthorized' }, 401);
    const admin = deps.admin;
    const { data: auth, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !auth?.user?.id) return reply({ ok: false, code: 'unauthorized' }, 401);
    const userId = auth.user.id;
    let body;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > 8192) return reply({ ok: false, code: 'body_too_large' }, 413);
      const parsed = JSON.parse(raw);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw Error('object_expected');
      body = parsed;
    } catch { return reply({ ok: false, code: 'invalid_json' }, 400); }
    if (request.method === 'DELETE') {
      const linkId = clean(body.link_id, 80);
      if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(linkId)) return reply({ ok: false, code: 'invalid_link_id' }, 422);
      const removed = await admin.rpc('apple_pay_remove_link', { p_user_id: userId, p_link_id: linkId });
      if (removed.error) { log('remove_link_failed', { db: removed.error.code }); return reply({ ok: false, code: 'internal_error' }, 500); }
      const row = Array.isArray(removed.data) ? removed.data[0] : removed.data;
      if (!row?.deleted) return reply({ ok: false, code: 'link_not_found' }, 404);
      return reply({ ok: true, deleted: true, revoked: true, retained_events: Number(row.retained_events || 0), message: 'Vínculo eliminado. Eventos y movimientos anteriores conservados.' });
    }
    const instrumentType = clean(body.instrument_type, 20), instrumentId = clean(body.instrument_id, 160);
    const currency = clean(body.currency, 10).toUpperCase(), label = clean(body.card_label, 120) || 'Tarjeta';
    if (instrumentType !== 'card' || !instrumentId || !['DOP', 'USD'].includes(currency)) return reply({ ok: false, code: 'invalid_card' }, 422);
    const owned = await admin.from('finance_items').select('record_id').eq('user_id', userId).eq('collection', 'cards').eq('record_id', instrumentId).maybeSingle();
    if (owned.error) { log('card_lookup_failed', { db: owned.error.code }); return reply({ ok: false, code: 'internal_error' }, 500); }
    if (!owned.data) return reply({ ok: false, code: 'forbidden' }, 403);
    const existing = await admin.from('apple_pay_links').select('id,active').eq('user_id', userId).eq('instrument_type', 'card').eq('instrument_id', instrumentId).eq('currency', currency).limit(2);
    if (existing.error) { log('link_lookup_failed', { db: existing.error.code }); return reply({ ok: false, code: 'internal_error' }, 500); }
    if ((existing.data || []).length > 1) return reply({ ok: false, code: 'duplicate_links_need_review' }, 409);
    const secret = newToken(), hash = await sha256(secret), now = new Date().toISOString();
    let id, reused = false;
    if (existing.data?.[0]) {
      const w = await admin.from('apple_pay_links').update({ active: true, token_hash: hash, card_label: label, updated_at: now }).eq('id', existing.data[0].id).eq('user_id', userId).select('id').single();
      if (w.error || !w.data) { log('link_rotation_failed', { db: w.error?.code }); return reply({ ok: false, code: 'internal_error' }, 500); }
      id = w.data.id; reused = true;
    } else {
      const w = await admin.from('apple_pay_links').insert({ user_id: userId, instrument_type: 'card', instrument_id: instrumentId, currency, card_label: label, token_hash: hash, active: true, created_at: now, updated_at: now }).select('id').single();
      if (w.error || !w.data) { log('link_create_failed', { db: w.error?.code }); return reply({ ok: false, code: 'internal_error' }, 500); }
      id = w.data.id;
    }
    const base = String(deps.origin || '').replace(/\/$/, '');
    return reply({ ok: true, linked: true, reused, link_id: id, token: secret, currency, instrument_id: instrumentId, webhook_url: base + '/functions/v1/apple-pay-ingest', shortcuts_url: base + '/functions/v1/apple-pay-shortcuts', message: 'Clave emitida una sola vez. Guárdala en el iPhone.' });
  } catch (error) {
    log('unhandled', { name: error?.name || 'Error' });
    return reply({ ok: false, code: 'internal_error' }, 500);
  }
}
