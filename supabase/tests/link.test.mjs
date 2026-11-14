import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../functions/apple-pay-link/handler.mjs';
import { fakeAdmin } from './fakedb.mjs';
const mk = (user = 'U1', cards = [{ user_id: 'U1', collection: 'cards', record_id: 'C1' }]) => {
  const db = fakeAdmin({ finance_items: cards });
  db.auth = { getUser: async (jwt) => jwt === 'bueno' ? { data: { user: { id: user } }, error: null } : { data: null, error: { message: 'x' } } };
  db.rpc = async () => ({ data: [{ deleted: true, retained_events: 2 }], error: null });
  return db;
};
const req = (m, body, jwt, origin) => new Request('https://x.test/l', { method: m, headers: { 'content-type': 'application/json', ...(jwt ? { authorization: 'Bearer ' + jwt } : {}), ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });
const D = (admin) => ({ admin, origin: 'https://p.supabase.co', log() {} });
const card = { instrument_type: 'card', instrument_id: 'C1', currency: 'DOP' };
test('sin JWT o JWT inválido → 401 genérico', async () => {
  for (const jwt of [null, 'malo']) { const r = await handle(req('POST', card, jwt), D(mk())); assert.equal(r.status, 401); assert.equal((await r.json()).code, 'unauthorized'); }
});
test('tarjeta de otro usuario → 403', async () => {
  const r = await handle(req('POST', card, 'bueno'), D(mk('U2'))); assert.equal(r.status, 403);
});
test('tarjeta propia → emite token una vez y solo guarda su hash', async () => {
  const db = mk(); const r = await handle(req('POST', card, 'bueno'), D(db)); const b = await r.json();
  assert.equal(r.status, 200); assert.match(b.token, /^vhap_[a-f0-9]{64}$/);
  assert.equal(db.tables.apple_pay_links.length, 1); assert.ok(!JSON.stringify(db.tables.apple_pay_links).includes(b.token));
});
test('entradas inválidas y cuerpo grande', async () => {
  assert.equal((await handle(req('POST', { ...card, currency: 'EUR' }, 'bueno'), D(mk()))).status, 422);
  assert.equal((await handle(req('POST', { ...card, instrument_id: 'x'.repeat(9000) }, 'bueno'), D(mk()))).status, 413);
  assert.equal((await handle(req('DELETE', { link_id: 'no-uuid' }, 'bueno'), D(mk()))).status, 422);
});
test('CORS: solo el origen permitido', async () => {
  const ok = await handle(req('OPTIONS', null, null, 'https://virgiliosmith.github.io'), D(mk()));
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://virgiliosmith.github.io');
  const mal = await handle(req('OPTIONS', null, null, 'https://evil.example'), D(mk()));
  assert.equal(mal.headers.get('access-control-allow-origin'), null);
});
test('error interno de BD → 500 genérico sin detalle', async () => {
  const db = mk(); db.from = () => { throw new Error('detalle interno secreto'); };
  const r = await handle(req('POST', card, 'bueno'), D(db)); const t = await r.text();
  assert.equal(r.status, 500); assert.ok(!t.includes('secreto'));
});
