/** Vive el hoy · apple-pay-ingest · lógica pura (inyectable para pruebas).
 *  Autenticación: token portador `vhap_…` (256 bits) cuyo SHA-256 se guarda en apple_pay_links.
 *  Idempotencia: (link_id, event_id). Límite de tasa: eventos por vínculo y fallos por origen.
 *  Errores: respuesta genérica al cliente; detalle solo en logs del servidor (sin importes ni comercios). */
export const LIMITS = { bodyBytes: 16384, perLinkPerMinute: 30, badAuthPerMinute: 20 };
const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const respond = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify({ version: 'apple-pay-v3', ...body }), { status, headers: { ...HEADERS, ...extra } });
const safeText = (v, max = 140) => typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '';
function amountValue(v) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v >= 1e9) return null;
  const cents = Math.round(v * 100);
  return Math.abs(cents / 100 - v) < 1e-8 ? cents / 100 : null;
}
function iso(v) {
  if (typeof v !== 'string' || v.length > 60 || !v.trim()) return null;
  const d = new Date(v); return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
export async function sha256Hex(v) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const failures = new Map(); // origen -> [marcas de tiempo]; mejor esfuerzo por instancia
function tooManyFailures(ip, now) {
  const list = (failures.get(ip) || []).filter(t => now - t < 60000);
  failures.set(ip, list);
  return list.length >= LIMITS.badAuthPerMinute;
}
function noteFailure(ip, now) { const l = failures.get(ip) || []; l.push(now); failures.set(ip, l); }
export function resetFailures() { failures.clear(); }

/** deps: { admin (cliente Supabase), now(): ms, log(code, meta) } */
export async function handle(request, deps) {
  const now = deps.now ? deps.now() : Date.now();
  const log = deps.log || (() => {});
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
    if (request.method !== 'POST') return respond({ ok: false, saved: false, code: 'method_not_allowed' }, 405);
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'desconocido';
    if (tooManyFailures(ip, now)) return respond({ ok: false, saved: false, code: 'rate_limited' }, 429, { 'Retry-After': '60' });
    const token = request.headers.get('x-vive-token')?.trim() || '';
    if (!/^vhap_[a-f0-9]{64}$/.test(token)) { noteFailure(ip, now); return respond({ ok: false, saved: false, code: 'unauthorized' }, 401); }
    if (Number(request.headers.get('content-length') || '0') > LIMITS.bodyBytes) return respond({ ok: false, saved: false, code: 'body_too_large' }, 413);
    let body;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > LIMITS.bodyBytes) return respond({ ok: false, saved: false, code: 'body_too_large' }, 413);
      const value = JSON.parse(raw);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('invalid_body');
      body = value;
    } catch { return respond({ ok: false, saved: false, code: 'invalid_json' }, 400); }
    const admin = deps.admin;
    const hash = await sha256Hex(token);
    const lookup = await admin.from('apple_pay_links').select('id,user_id,instrument_id,currency,active').eq('token_hash', hash).eq('active', true).limit(1).maybeSingle();
    if (lookup.error) { log('link_lookup_failed', { db: lookup.error.code }); return respond({ ok: false, saved: false, code: 'internal_error' }, 500); }
    const link = lookup.data;
    if (!link) { noteFailure(ip, now); return respond({ ok: false, saved: false, code: 'unauthorized' }, 401); }
    // Límite por vínculo: evita inundar la bandeja si se filtra un token.
    const since = new Date(now - 60000).toISOString();
    const recent = await admin.from('apple_pay_events').select('id', { count: 'exact', head: true }).eq('link_id', link.id).gte('received_at', since);
    if (!recent.error && (recent.count ?? 0) >= LIMITS.perLinkPerMinute)
      return respond({ ok: false, saved: false, code: 'rate_limited' }, 429, { 'Retry-After': '60' });

    const amount = amountValue(body.amount), merchant = safeText(body.merchant, 140), currency = safeText(body.currency, 8).toUpperCase();
    const dryRun = body.dry_run === true || body.dry_run === 1 || body.dry_run === 'true';
    if (amount === null || !merchant || !currency)
      return respond({ ok: false, linked: true, saved: false, code: 'invalid_fields', missing: [...(amount === null ? ['amount'] : []), ...(!merchant ? ['merchant'] : []), ...(!currency ? ['currency'] : [])] }, 422);
    if (!['DOP', 'USD'].includes(currency) || currency !== link.currency)
      return respond({ ok: false, linked: true, saved: false, code: 'currency_mismatch', expected_currency: link.currency }, 422);
    const supplied = safeText(body.event_id, 150);
    if (dryRun) return respond({ ok: true, linked: true, dry_run: true, saved: false, amount, merchant, currency, event_id: supplied || 'dry-run-no-event' });
    if (!/^[\w:.-]{1,150}$/.test(supplied)) return respond({ ok: false, linked: true, saved: false, code: 'missing_event_id' }, 422);

    const sameEvent = async () => admin.from('apple_pay_events').select('id,status,amount,currency,merchant').eq('link_id', link.id).eq('event_id', supplied).limit(1).maybeSingle();
    const answerExisting = (row) => (Number(row.amount) !== amount || row.currency !== currency || row.merchant !== merchant)
      ? respond({ ok: false, saved: false, code: 'event_id_conflict' }, 409)
      : respond({ ok: true, saved: true, duplicate: true, id: row.id, status: row.status, event_id: supplied, amount, currency, merchant });
    const prior = await sameEvent();
    if (prior.error) { log('event_lookup_failed', { db: prior.error.code }); return respond({ ok: false, saved: false, code: 'internal_error' }, 500); }
    if (prior.data) return answerExisting(prior.data);

    const transactionTime = iso(body.transaction_time);
    if (body.transaction_time && !transactionTime) return respond({ ok: false, saved: false, code: 'invalid_transaction_time' }, 422);
    const inserted = await admin.from('apple_pay_events').insert({
      user_id: link.user_id, link_id: link.id, instrument_type: 'card', instrument_id: link.instrument_id,
      event_id: supplied, merchant, amount, currency, status: 'pending', ...(transactionTime ? { transaction_time: transactionTime } : {}),
    }).select('id,status,received_at').single();
    if (inserted.error) {
      if (inserted.error.code === '23505') { const raced = await sameEvent(); if (raced.data) return answerExisting(raced.data); }
      log('event_insert_failed', { db: inserted.error.code });
      return respond({ ok: false, saved: false, code: 'internal_error' }, 500);
    }
    return respond({ ok: true, saved: true, duplicate: false, id: inserted.data.id, status: inserted.data.status, received_at: inserted.data.received_at, event_id: supplied, amount, merchant, currency });
  } catch (error) {
    log('unhandled', { name: error?.name || 'Error' });
    return respond({ ok: false, saved: false, code: 'internal_error' }, 500);
  }
}
