import test from 'node:test';
import assert from 'node:assert/strict';
import { handle, sha256Hex, resetFailures, LIMITS } from '../functions/apple-pay-ingest/handler.mjs';
import { fakeAdmin } from './fakedb.mjs';

const TOKEN = 'vhap_' + 'a'.repeat(64);
const logs = [];
const mk = async (seed = {}, opts = {}) => {
  const hash = await sha256Hex(TOKEN);
  const admin = fakeAdmin({ apple_pay_links: [{ id: 'L1', user_id: 'U1', instrument_id: 'C1', currency: 'DOP', active: true, token_hash: hash }], ...seed }, opts);
  return { admin, deps: { admin, now: () => Date.now(), log: (c, m) => logs.push([c, m]) } };
};
const req = (body, headers = {}, method = 'POST') => new Request('https://x.test/f', { method, headers: { 'content-type': 'application/json', ...headers }, body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined });
const good = { amount: 140.5, merchant: 'Comercio de prueba', currency: 'DOP', event_id: 'ev-1' };
const json = async (r) => ({ status: r.status, body: await r.json(), headers: r.headers });

test('sin token → 401 genérico, sin detalles', async () => {
  resetFailures(); const { deps } = await mk();
  const r = await json(await handle(req(good), deps));
  assert.equal(r.status, 401); assert.equal(r.body.code, 'unauthorized'); assert.equal(Object.keys(r.body).sort().join(), 'code,ok,saved,version');
});
test('token con formato válido pero desconocido → 401 igual que sin token', async () => {
  resetFailures(); const { deps } = await mk();
  const r = await json(await handle(req(good, { 'x-vive-token': 'vhap_' + 'b'.repeat(64) }), deps));
  assert.equal(r.status, 401); assert.equal(r.body.code, 'unauthorized');
});
test('vínculo revocado → 401 igual', async () => {
  resetFailures(); const { admin, deps } = await mk(); admin.tables.apple_pay_links[0].active = false;
  assert.equal((await handle(req(good, { 'x-vive-token': TOKEN }), deps)).status, 401);
});
test('firma válida → 200 y se guarda pendiente', async () => {
  resetFailures(); const { admin, deps } = await mk();
  const r = await json(await handle(req(good, { 'x-vive-token': TOKEN }), deps));
  assert.equal(r.status, 200); assert.equal(r.body.saved, true); assert.equal(r.body.duplicate, false);
  assert.equal(admin.tables.apple_pay_events.length, 1); assert.equal(admin.tables.apple_pay_events[0].status, 'pending');
});
test('misma compra dos veces → idempotente (1 sola fila, sin error)', async () => {
  resetFailures(); const { admin, deps } = await mk();
  await handle(req(good, { 'x-vive-token': TOKEN }), deps);
  const r = await json(await handle(req(good, { 'x-vive-token': TOKEN }), deps));
  assert.equal(r.status, 200); assert.equal(r.body.duplicate, true); assert.equal(admin.tables.apple_pay_events.length, 1);
});
test('mismo event_id con otro importe → 409', async () => {
  resetFailures(); const { deps } = await mk();
  await handle(req(good, { 'x-vive-token': TOKEN }), deps);
  assert.equal((await handle(req({ ...good, amount: 99 }, { 'x-vive-token': TOKEN }), deps)).status, 409);
});
test('carrera: dos envíos simultáneos no duplican', async () => {
  resetFailures(); const { admin, deps } = await mk();
  const rs = await Promise.all([handle(req(good, { 'x-vive-token': TOKEN }), deps), handle(req(good, { 'x-vive-token': TOKEN }), deps)]);
  assert.ok(rs.every(r => r.status === 200)); assert.equal(admin.tables.apple_pay_events.length, 1);
});
test('JSON malformado → 400', async () => {
  resetFailures(); const { deps } = await mk();
  assert.equal((await handle(req('{no es json', { 'x-vive-token': TOKEN }), deps)).status, 400);
});
test('cuerpo demasiado grande → 413', async () => {
  resetFailures(); const { deps } = await mk();
  assert.equal((await handle(req({ ...good, merchant: 'x'.repeat(20000) }, { 'x-vive-token': TOKEN }), deps)).status, 413);
});
test('entradas maliciosas: importes y campos inválidos → 422, nada se guarda', async () => {
  resetFailures(); const { admin, deps } = await mk();
  for (const bad of [{ ...good, amount: -5 }, { ...good, amount: 'DROP TABLE' }, { ...good, amount: 1.234 }, { ...good, amount: 1e12 }, { ...good, merchant: '' }, { ...good, currency: 'EUR' }, { ...good, event_id: "x'; drop table--" }, { ...good, transaction_time: 'no-fecha' }]) {
    const r = await handle(req(bad, { 'x-vive-token': TOKEN }), deps); assert.equal(r.status, 422, JSON.stringify(bad));
  }
  assert.equal(admin.tables.apple_pay_events.length, 0);
});
test('comercio con HTML se guarda como texto (el cliente lo escapa); no se ejecuta nada', async () => {
  resetFailures(); const { admin, deps } = await mk();
  const r = await handle(req({ ...good, event_id: 'xss-1', merchant: '<img src=x onerror=alert(1)>' }, { 'x-vive-token': TOKEN }), deps);
  assert.equal(r.status, 200); assert.equal(admin.tables.apple_pay_events[0].merchant, '<img src=x onerror=alert(1)>');
});
test('método distinto de POST → 405', async () => {
  resetFailures(); const { deps } = await mk();
  assert.equal((await handle(req(null, {}, 'GET'), deps)).status, 405);
});
test('límite de tasa por vínculo → 429', async () => {
  resetFailures(); const { admin, deps } = await mk();
  for (let i = 0; i < LIMITS.perLinkPerMinute; i++) admin.tables.apple_pay_events.push({ id: 'e' + i, link_id: 'L1', event_id: 'old' + i, received_at: new Date().toISOString(), amount: 1, currency: 'DOP', merchant: 'm' });
  const r = await json(await handle(req({ ...good, event_id: 'nuevo' }, { 'x-vive-token': TOKEN }), deps));
  assert.equal(r.status, 429); assert.equal(r.headers.get('retry-after'), '60');
});
test('fuerza bruta: muchos tokens falsos desde un origen → 429', async () => {
  resetFailures(); const { deps } = await mk(); let last;
  for (let i = 0; i < LIMITS.badAuthPerMinute + 2; i++) last = await handle(req(good, { 'x-vive-token': 'vhap_' + String(i).padStart(64, '0'), 'x-forwarded-for': '9.9.9.9' }), deps);
  assert.equal(last.status, 429);
});
test('fallo de base de datos → 500 genérico, sin filtrar el detalle', async () => {
  resetFailures(); const { deps } = await mk({}, { failOn: 'apple_pay_links' }); logs.length = 0;
  const r = await handle(req(good, { 'x-vive-token': TOKEN }), deps); const b = await r.json();
  assert.equal(r.status, 500); assert.equal(b.code, 'internal_error'); assert.ok(!JSON.stringify(b).includes('secreto'));
  assert.ok(!JSON.stringify(logs).includes('secreto'));
});
test('excepción inesperada → 500 JSON válido', async () => {
  resetFailures(); const r = await handle(req(good, { 'x-vive-token': TOKEN }), { admin: { from() { throw new Error('boom'); } }, log() {} });
  assert.equal(r.status, 500); assert.equal((await r.json()).code, 'internal_error');
});
test('cabeceras de respuesta: JSON, sin caché, nosniff y sin CORS abierto', async () => {
  resetFailures(); const { deps } = await mk(); const r = await handle(req(good, { 'x-vive-token': TOKEN }), deps);
  assert.match(r.headers.get('content-type'), /application\/json/); assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.equal(r.headers.get('access-control-allow-origin'), null);
});
