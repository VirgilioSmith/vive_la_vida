import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../functions/apple-pay-shortcuts/handler.mjs';
const TOKEN = 'vhap_' + 'c'.repeat(64);
const req = (body, headers = {}) => new Request('https://x.test/f', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const okFetch = (status = 200, payload = { ok: true, saved: true }) => async () => new Response(JSON.stringify(payload), { status });
const base = { origin: 'https://p.supabase.co', log() {} };
test('sin token → 401 genérico', async () => { const r = await handle(req({}), { ...base, fetch: okFetch() }); assert.equal(r.status, 401); assert.equal((await r.json()).code, 'unauthorized'); });
test('importes de Wallet: formatos válidos se normalizan', async () => {
  for (const [raw, amt] of [['RD$1,400.00', 1400], ['US$ 14.50', 14.5], ['DOP 1.400,00', 1400], ['140,00', 140]]) {
    let sent; const r = await handle(req({ amount: raw, merchant: 'Tienda', currency: raw.startsWith('US') ? 'USD' : 'DOP', event_id: 'e1' }, { 'x-vive-token': TOKEN }), { ...base, fetch: async (u, o) => { sent = JSON.parse(o.body); return new Response('{"ok":true}', { status: 200 }); } });
    assert.equal(r.status, 200, raw); assert.equal(sent.amount, amt, raw);
  }
});
test('importe inválido → 422 sin llamar al upstream', async () => {
  let called = false; const r = await handle(req({ amount: 'abc', merchant: 'T', currency: 'DOP', event_id: 'e' }, { 'x-vive-token': TOKEN }), { ...base, fetch: async () => { called = true; return new Response('{}'); } });
  assert.equal(r.status, 422); assert.equal(called, false);
});
test('JSON malformado → 400; sin content-type JSON → 415', async () => {
  assert.equal((await handle(req('{mal', { 'x-vive-token': TOKEN }), { ...base, fetch: okFetch() })).status, 400);
  assert.equal((await handle(new Request('https://x.test', { method: 'POST', headers: { 'x-vive-token': TOKEN, 'content-type': 'text/plain' }, body: '{}' }), { ...base, fetch: okFetch() })).status, 415);
});
test('upstream caído → 502 JSON con instrucción de reintento', async () => {
  const r = await handle(req({ amount: 5, currency: 'DOP', merchant: 'T', event_id: 'e' }, { 'x-vive-token': TOKEN }), { ...base, fetch: async () => { throw new Error('ECONNRESET'); } });
  assert.equal(r.status, 502); assert.equal((await r.json()).code, 'ingest_unreachable');
});
test('upstream responde HTML o 500 → 502/500 JSON válido', async () => {
  const html = await handle(req({ amount: 5, currency: 'DOP', merchant: 'T', event_id: 'e' }, { 'x-vive-token': TOKEN }), { ...base, fetch: async () => new Response('<html>', { status: 200 }) });
  assert.equal(html.status, 502); await html.json();
  const e500 = await handle(req({ amount: 5, currency: 'DOP', merchant: 'T', event_id: 'e' }, { 'x-vive-token': TOKEN }), { ...base, fetch: okFetch(500, { ok: false, code: 'internal_error' }) });
  assert.equal(e500.status, 500); assert.equal((await e500.json()).code, 'internal_error');
});
test('origen mal configurado → 503 genérico', async () => {
  const r = await handle(req({ amount: 5, currency: 'DOP', merchant: 'T', event_id: 'e' }, { 'x-vive-token': TOKEN }), { origin: '', fetch: okFetch(), log() {} });
  assert.equal(r.status, 503);
});
test('excepción inesperada → 500 JSON', async () => {
  const bad = { get method() { throw new Error('x'); }, headers: new Headers() };
  const r = await handle(bad, { ...base, fetch: okFetch() }); assert.equal(r.status, 500); await r.json();
});
test('sin CORS abierto', async () => { const r = await handle(req({}, { 'x-vive-token': TOKEN }), { ...base, fetch: okFetch() }); assert.equal(r.headers.get('access-control-allow-origin'), null); });
