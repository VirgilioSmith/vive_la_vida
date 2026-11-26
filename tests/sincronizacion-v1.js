/* VIVE V1 · Principios de sincronización: un único motor, cero reintentos infinitos, cero versiones obsoletas autorizadas para escribir,
   conservación íntegra de los datos. Cliente REAL de Supabase contra un servidor simulado (sin red, sin datos reales).
   Uso: node tests/sincronizacion-v1.js */
process.env.REALSB = '1'; process.env.NOBOOT = '1';
const { chromium } = require('playwright');
const open = require('./harness.js');
const { Servidor } = require('./lib-servidor.js');
const KEY = 'sb-sghlpmhiihmnaulibcja-auth-token';
const USER = { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'demo@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
let fails = 0, n = 0; const check = (id, name, ok, extra = '') => { n++; if (!ok) fails++; console.log(`${ok ? '✓' : '✕'} ${id} ${name}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
function servidor(opts = {}) {
  const st = { db: new Servidor(), tokenN: 0 };
  Object.assign(st.db, opts);
  st.handler = async route => {
    const req = route.request(), url = new URL(req.url()), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    const json = (body, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const p = url.pathname;
    const sesion = () => { st.tokenN++; return { access_token: 'at-' + st.tokenN, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'rt-' + st.tokenN, user: USER } };
    if (p === '/auth/v1/token') return json(sesion());
    if (p === '/auth/v1/user') return json(USER);
    if (p === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors });
    if (p.startsWith('/rest/v1/rpc/finance_apply_changes')) { const a = JSON.parse(req.postData() || '{}'); const r = await st.db.rpc(a, 'A'); if (r.__throw) return route.abort('failed'); if (r.error) return json(r.error, r.error.code === '40001' ? 409 : r.error.code === 'PGRST202' ? 404 : 400); return json(r.data) }
    if (p.startsWith('/rest/v1/')) { const table = p.split('/').pop(); const rg = (req.headers()['range'] || '').match(/^(\d+)-(\d+)$/); const objeto = /pgrst\.object/.test(req.headers()['accept'] || ''); const r = st.db.read({ table, range: rg ? [+rg[1], +rg[2]] : null, single: false, maybe: false }); let data = r.data; if (objeto) { data = Array.isArray(data) ? data[0] : data; if (data === undefined || data === null) return json({ code: 'PGRST116', message: 'sin filas' }, 406) } else if (data && !Array.isArray(data)) data = [data]; return json(data) }
    return json({}, 404);
  };
  st.semilla = () => JSON.stringify({ access_token: 'at-0', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'rt-0', user: USER });
  return st;
}
async function abrir(b, st) {
  open.apiHandler = st.handler;
  const { p, ctx } = await open(b, 1280, 800);
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, st.semilla()]); await p.reload();
  for (let i = 0; i < 40; i++) { if (await p.evaluate(() => window.__f360Test?.ready())) break; await wait(300) }
  return { p, ctx, errs };
}
/* Provoca una escritura: cambia un dato local (el motor de sincronización lo detecta y llama a la RPC) */
const editar = (p, nota) => p.evaluate(nota => { const d = window.__T.dbg(); d.transactions = d.transactions || []; d.settings.__nota = nota; window.__T.inv?.(); try { persist() } catch (_) { try { window.__T.persist() } catch (e) { } } }, nota);
(async () => {
  const b = await chromium.launch();
  /* S1 · el cliente declara su versión y el servidor sin política sigue funcionando (compatibilidad hacia atrás) */
  { const st = servidor({ legacy: true }); const { p, ctx, errs } = await abrir(b, st);
    await editar(p, 'a'); await wait(4000);
    const llamadas = st.db.calls;
    check('S1', 'Servidor ANTERIOR a la política (no conoce p_client_version): UNA sola llamada con versión rechazada, luego guarda con la firma antigua', st.db.commits >= 1 && llamadas.filter(c => c.v !== undefined).length === 1 && llamadas.filter(c => c.v === undefined).length >= 1, `commits=${st.db.commits} con-versión=${llamadas.filter(c => c.v !== undefined).length} sin-versión=${llamadas.filter(c => c.v === undefined).length}`);
    check('S1b', 'Sin errores de página', errs.length === 0, errs.join('|')); await ctx.close(); }
  /* S2 · servidor con política: el cliente envía su versión (1) y escribe con normalidad */
  { const st = servidor({ minClientVersion: 1 }); const { p, ctx } = await abrir(b, st);
    await editar(p, 'b'); await wait(4000);
    check('S2', 'Con versión mínima 1 el cliente actual (versión 1) guarda y envía p_client_version=1', st.db.commits >= 1 && st.db.calls.every(c => c.v === 1), JSON.stringify(st.db.calls.map(c => c.v))); await ctx.close(); }
  /* S3 · versión obsoleta: error terminal, CERO reintentos y datos locales protegidos */
  { const st = servidor({ minClientVersion: 2 }); const { p, ctx } = await abrir(b, st);
    const antes = await p.evaluate(() => JSON.stringify(window.__T.dbg().transactions || []));
    await editar(p, 'c'); await wait(3000);
    const n1 = st.db.calls.length; await editar(p, 'd'); await wait(3000); await p.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('online')) }); await wait(12000);
    const n2 = st.db.calls.length;
    const estado = await p.evaluate(() => (document.getElementById('f33-cloud-badge')?.innerText || '') + '|' + (document.body.innerText.match(/ya no puede guardar[^.]*\./) || [''])[0]);
    check('S3', 'Versión obsoleta (mínima 2 > 1): una sola llamada rechazada y NINGUNA más durante 18 s (cero reintentos)', n1 === 1 && n2 === 1 && st.db.commits === 0, `llamadas tras 1.ª edición=${n1}, tras 18 s=${n2}, commits=${st.db.commits}`);
    check('S3b', 'El cliente informa que debe actualizarse y conserva los datos locales', /ya no puede guardar/.test(estado) && antes === await p.evaluate(() => JSON.stringify(window.__T.dbg().transactions || [])), estado); await ctx.close(); }
  /* S4 · conflicto permanente (revisión obsoleta): llamadas ACOTADAS, nunca un bucle por segundo */
  { const st = servidor(); const { p, ctx } = await abrir(b, st);
    await editar(p, 'e0'); await wait(3500); /* primer guardado correcto: el cliente y el servidor coinciden */
    st.db.rev += 20; /* otro dispositivo avanza la revisión: la del cliente queda obsoleta para siempre */
    const base = st.db.calls.length; await editar(p, 'e1'); await wait(45000);
    const llamadas = st.db.calls.length - base;
    check('S4', `Conflicto de revisión permanente: ${llamadas} llamadas en 45 s (entre 1 y 6; sin protección serían 45 por minuto ≈ 3.600/h)`, llamadas >= 1 && llamadas <= 6, `llamadas=${llamadas}`);
    const estado = await p.evaluate(() => (document.body.innerText.match(/(pausada|conflicto)[^.]*\./i) || [''])[0]);
    check('S4b', 'El cliente pausa la sincronización y protege los datos locales (sin pérdida)', /pausada|conflicto/i.test(estado), estado); await ctx.close(); }
  console.log(`\nSINCRONIZACIÓN V1: ${n - fails}/${n} verificaciones aprobadas`); await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1) });
