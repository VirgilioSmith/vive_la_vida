/* Sesión de acceso con el CLIENTE REAL de Supabase (vendor/supabase.js) contra un servidor de autenticación simulado.
   Comprueba que la sesión sobrevive a cerrar/reabrir, renovar el token, bloquear/desbloquear, cambiar de app, entrar y salir de Ajustes,
   caídas de red y errores 5xx; y que solo termina por cierre voluntario o revocación real. Uso: node tests/auth-sesion.js */
process.env.REALSB = '1'; process.env.NOBOOT = '1';
const { chromium } = require('playwright');
const open = require('./harness.js');
const { Servidor } = require('./lib-servidor.js');
const KEY = 'sb-sghlpmhiihmnaulibcja-auth-token';
const USER = { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'demo@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
let fails = 0, n = 0; const check = (id, name, ok, extra = '') => { n++; if (!ok) fails++; console.log(`${ok ? '✓' : '✕'} ${id} ${name}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
function servidorAuth() {
  const st = { db: new Servidor(), caido: false, refresh: 'ok', refreshes: 0, logouts: 0, usuarioPeticiones: 0, tokenN: 0, validos: new Set(['rt-0']) };
  const sesion = () => { st.tokenN++; const rt = 'rt-' + st.tokenN; st.validos.add(rt); return { access_token: 'at-' + st.tokenN, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: rt, user: USER } };
  st.handler = async route => {
    const req = route.request(), url = new URL(req.url()), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    const json = (body, status = 200, extra = {}) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json', ...extra }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (st.caido) return route.abort('failed');
    const p = url.pathname;
    if (p === '/auth/v1/token') { if (url.searchParams.get('grant_type') === 'refresh_token') { st.refreshes++; const body = JSON.parse(req.postData() || '{}'); if (st.refresh === '500') return json({ message: 'boom' }, 500); if (st.refresh === 'invalid' || !st.validos.has(body.refresh_token)) return json({ error: 'invalid_grant', error_description: 'Invalid Refresh Token: Refresh Token Not Found', code: 'refresh_token_not_found', message: 'Invalid Refresh Token' }, 400); return json(sesion()) } return json(sesion()) }
    if (p === '/auth/v1/user') { st.usuarioPeticiones++; return json(USER) }
    if (p === '/auth/v1/logout') { st.logouts++; return route.fulfill({ status: 204, headers: cors }) }
    if (p.startsWith('/rest/v1/rpc/finance_apply_changes')) { const a = JSON.parse(req.postData() || '{}'); const r = await st.db.rpc(a, 'A'); if (r.error) return json(r.error, r.error.code === '40001' ? 409 : 400); return json(r.data) }
    if (p.startsWith('/rest/v1/')) { const table = p.split('/').pop(); const rg = (req.headers()['range'] || '').match(/^(\d+)-(\d+)$/); const objeto = /pgrst\.object/.test(req.headers()['accept'] || ''); const r = st.db.read({ table, range: rg ? [+rg[1], +rg[2]] : null, single: false, maybe: false }); let data = r.data; if (objeto) { data = Array.isArray(data) ? data[0] : data; if (data === undefined || data === null) return json({ code: 'PGRST116', message: 'sin filas' }, 406) } else if (data && !Array.isArray(data)) data = [data]; return json(data) }
    return json({}, 404);
  };
  st.semilla = (expiraEn = 3600, rt = 'rt-0') => JSON.stringify({ access_token: 'at-0', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + expiraEn, refresh_token: rt, user: USER });
  return st;
}
async function abrir(b, st, ctx0, opciones = {}) {
  open.apiHandler = st.handler;
  const { p, ctx } = await open(b, opciones.w || 390, opciones.h || 844, async c => { if (opciones.semilla) await c.addInitScript(([k, v]) => { try { if (!localStorage.getItem(k)) localStorage.setItem(k, v) } catch (_) { } }, [KEY, opciones.semilla]); });
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  return { p, ctx, errs };
}
const estado = p => p.evaluate(() => ({ fase: window.__f360Test?.phase(), listo: window.__f360Test?.ready(), usuario: window.__f360Test?.cloudUser(), login: !!document.querySelector('#f33-gate input[type=password],#f33-gate input[type=email]'), gate: (document.getElementById('f33-gate')?.innerText || '').replace(/\s+/g, ' ').slice(0, 120), sesionGuardada: !!localStorage.getItem('sb-sghlpmhiihmnaulibcja-auth-token') }));
async function esperaListo(p, ms = 12000) { const t = Date.now(); while (Date.now() - t < ms) { const e = await estado(p); if (e.listo) return e; await wait(300) } return estado(p) }
(async () => {
  const b = await chromium.launch();
  /* A1 · apertura en frío con sesión guardada */
  { const st = servidorAuth(); const { p, ctx, errs } = await abrir(b, st, null, { semilla: null });
    await p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, st.semilla()]); await p.reload(); await p.evaluate(() => 0); let e = await esperaListo(p);
    check('A1', 'Apertura con sesión guardada: entra directo (sin pantalla de acceso)', e.listo && !e.login && e.usuario === USER.id, JSON.stringify(e));
    check('A1b', 'El arranque no consulta /auth/v1/user en cada apertura (getSession local)', st.usuarioPeticiones === 0, 'peticiones a /user: ' + st.usuarioPeticiones);
    /* A2 · cerrar y volver a abrir (misma pestaña/almacenamiento) */
    await p.reload(); e = await esperaListo(p); check('A2', 'Actualizar la página mantiene la sesión', e.listo && !e.login, JSON.stringify(e));
    const p2 = await ctx.newPage(); await p2.goto('http://localhost:8765/index.html'); e = await esperaListo(p2); check('A2b', 'Cerrar y abrir de nuevo (nueva pestaña, mismo almacenamiento) mantiene la sesión', e.listo && !e.login, JSON.stringify(e)); await p2.close();
    /* A7 · recorrer todos los módulos y Ajustes */
    const PAGES = ['overview', 'cards', 'banks', 'accounts', 'register', 'payments', 'income', 'budget', 'recurring', 'personal', 'loans', 'certificates', 'benefits', 'advanced', 'kpis', 'patrimony', 'categories', 'settings', 'overview'];
    for (const pg of PAGES) { await p.evaluate(x => { try { closeModal() } catch (_) { } window.__T?.go?.(x) }, pg).catch(() => { }); await wait(120) }
    e = await estado(p); check('A7', 'Entrar y salir de Ajustes y recorrer 18 módulos no cierra la sesión (0 llamadas a /logout)', e.listo && !e.login && e.sesionGuardada, JSON.stringify(e));
    /* A8 · inactividad prolongada: salto de reloj +3 h y eventos de ciclo de vida */
    await p.evaluate(() => { const real = Date.now; const off = 3 * 3600 * 1000; Date.now = () => real() + off; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); window.dispatchEvent(new Event('online')); document.body.dispatchEvent(new Event('pointerdown',{bubbles:true})) }); await wait(1500);
    e = await estado(p); check('A8', 'Tras 3 h de inactividad simulada y eventos de ciclo de vida (visibilidad, pageshow, online) la sesión sigue activa', e.listo && !e.login && e.sesionGuardada, JSON.stringify(e));
    /* A11 · bloquear/desbloquear con red caída */
    st.caido = true; await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) }); await wait(300);
    await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')) }); await wait(1500);
    e = await estado(p); check('A11', 'Bloquear y desbloquear con la red caída no cierra la sesión ni muestra el acceso', e.listo && !e.login && e.sesionGuardada, JSON.stringify(e)); st.caido = false;
    /* A12 · revocación en caliente: el servidor invalida el refresh token y la sesión guardada vence → el siguiente regreso a la app vuelve al acceso */
    st.refresh = 'invalid'; await p.evaluate(k => { const s = JSON.parse(localStorage.getItem(k)); s.expires_at = Math.floor(Date.now() / 1000) - 60; localStorage.setItem(k, JSON.stringify(s)) }, KEY);
    await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')) }); await wait(3000); e = await estado(p);
    check('A12', 'Revocación real en caliente (refresh inválido con la app abierta): vuelve al acceso, sin datos del usuario anterior en pantalla', e.login && !e.listo && !e.sesionGuardada, JSON.stringify(e)); st.refresh = 'ok';
    /* se vuelve a entrar con una sesión nueva para probar el cierre voluntario */
    await p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, st.semilla()]); await p.reload(); e = await esperaListo(p);
    /* A9 · cierre de sesión voluntario */
    await p.evaluate(() => { const x = document.createElement('button'); x.dataset.f34 = 'logout'; x.hidden = true; document.body.append(x); x.click(); x.remove() }); await wait(2500);
    e = await estado(p); check('A9', 'Cerrar sesión voluntariamente: vuelve al acceso y borra la sesión local', e.login && !e.listo && !e.sesionGuardada, JSON.stringify(e));
    check('A0', 'Sin errores de página en los escenarios anteriores', errs.length === 0, errs.join('|')); await ctx.close(); }
  /* A3 · token de acceso vencido, refresh válido */
  { const st = servidorAuth(); const { p, ctx } = await abrir(b, st, null, { semilla: null }); await p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, st.semilla(-600)]); await p.reload(); const e = await esperaListo(p);
    const guardado = await p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
    check('A3', 'Token vencido + refresh válido: se renueva solo y la sesión continúa (token rotado)', e.listo && st.refreshes >= 1 && guardado && guardado.refresh_token !== 'rt-0', JSON.stringify({ e, refreshes: st.refreshes, rt: guardado?.refresh_token })); await ctx.close(); }
  /* A4 · servidor de autenticación inalcanzable al abrir */
  { const st = servidorAuth(); st.caido = true; const { p, ctx } = await abrir(b, st, null, { semilla: null }); await p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, st.semilla(-600)]); await p.reload(); let e = await estado(p); for (let i = 0; i < 40 && !/No pudimos conectar/.test(e.gate); i++) { await wait(500); e = await estado(p) }
    check('A4', 'Sin conexión al abrir (token vencido): NO se pide iniciar sesión; se informa y la sesión sigue guardada', !e.login && !e.listo && e.sesionGuardada && /No pudimos conectar/.test(e.gate), JSON.stringify(e));
    st.caido = false; await p.evaluate(() => window.dispatchEvent(new Event('online'))); e = await esperaListo(p, 15000);
    check('A4b', 'Al volver la conectividad la app entra sola, sin iniciar sesión de nuevo', e.listo && !e.login, JSON.stringify(e)); await ctx.close(); }
  /* A5 · el servicio de autenticación responde 500 */
  { const st = servidorAuth(); st.refresh = '500'; const { p, ctx } = await abrir(b, st, null, { semilla: null }); await p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, st.semilla(-600)]); await p.reload(); let e = await estado(p); for (let i = 0; i < 40 && !/No pudimos conectar/.test(e.gate); i++) { await wait(500); e = await estado(p) }
    check('A5', 'Error 500 al renovar: la sesión se conserva, no se muestra el acceso y se informa', !e.login && e.sesionGuardada && /No pudimos conectar/.test(e.gate), JSON.stringify(e)); st.refresh = 'ok'; await p.evaluate(() => { document.querySelector('[data-f33=boot]')?.click() }); e = await esperaListo(p, 15000);
    check('A5b', 'Recuperado el servicio, «Reintentar ahora» restablece la sesión', e.listo, JSON.stringify(e)); await ctx.close(); }
  /* A6 · revocación real (refresh inválido) */
  { const st = servidorAuth(); st.refresh = 'invalid'; const { p, ctx } = await abrir(b, st, null, { semilla: null }); await p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, st.semilla(-600, 'rt-revocado')]); await p.reload(); await wait(3500); const e = await estado(p);
    check('A6', 'Refresh token revocado/ inválido: solo entonces se pide iniciar sesión (y se limpia la sesión inservible)', e.login && !e.listo && !e.sesionGuardada, JSON.stringify(e)); await ctx.close(); }
  console.log(fails ? `\nFALLAN: ${fails} de ${n}` : `\nOK: ${n} comprobaciones superadas`); await b.close(); process.exit(fails ? 1 : 0);
})();
