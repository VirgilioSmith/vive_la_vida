/* ARRANQUE (incidente «VIVE se queda cargando»). Cliente REAL de Supabase contra un servidor simulado. La app debe abrir (o mostrar login / recuperación)
   en un tiempo acotado: con sesión guardada, con restos de versiones antiguas, con Supabase caído, colgado o lento, en móvil y escritorio grande.
   Uso: node tests/arranque.js   (ROOT=<carpeta> para probar otro commit).
   [base heredada: Sesión de acceso con el CLIENTE REAL de Supabase (vendor/supabase.js) contra un servidor de autenticación simulado.
   Comprueba que la sesión sobrevive a cerrar/reabrir, renovar el token, bloquear/desbloquear, cambiar de app, entrar y salir de Ajustes,
   caídas de red y errores 5xx; y que solo termina por cierre voluntario o revocación real. Uso: node tests/auth-sesion.js] */
process.env.REALSB = '1'; process.env.NOBOOT = '1';
const chromium = require('playwright')[process.env.ARRANQUE_BROWSER || 'chromium'];
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

/* Estado de la pantalla de carga: lo único que importa a la persona es que desaparezca. */
const pantalla = p => p.evaluate(() => { const g = document.getElementById('f33-gate'); const visible = g && !g.hidden && getComputedStyle(g).display !== 'none' && getComputedStyle(g).visibility !== 'hidden'; return { fase: window.__f360Test?.phase(), gateVisible: !!visible, gate: visible ? g.innerText.replace(/\s+/g, ' ').slice(0, 140) : '', app: (document.getElementById('app')?.children.length || 0), polvo: document.querySelectorAll('.v980-dust').length }; });
async function hastaEstable(p, ms) { const t = Date.now(); let e; while (Date.now() - t < ms) { e = await pantalla(p); if (!e.gateVisible && e.app > 0) return { ...e, ms: Date.now() - t }; if (e.gateVisible && /(Reintentar|Volver a iniciar|Entrar a vive)/i.test(e.gate)) return { ...e, ms: Date.now() - t, salida: true }; await wait(250) } return { ...e, ms: Date.now() - t, colgado: true }; }
(async () => {
  /* Si el navegador (p. ej. WebKit en CI) se cuelga, falla con diagnóstico en minutos en lugar de agotar el límite del trabajo. */
  const guardia = setTimeout(() => { console.log('✕ TIMEOUT global de 4 min: el navegador o un escenario no respondió; último paso: ' + (global.__paso || 'lanzar navegador')); process.exit(1) }, 240000);
  global.__paso = 'lanzar navegador'; const b = await chromium.launch({ timeout: 60000 }); console.log('navegador listo:', process.env.ARRANQUE_BROWSER || 'chromium');
  const caso = async (id, nombre, { w = 390, h = 844, semilla = true, prep, tope = 14000, init }, evalua) => {
    global.__paso = id; const st = servidorAuth(); if (prep) prep(st);
    const { p, ctx, errs } = await abrir(b, st, null, { semilla: null, w, h }); if (init) await ctx.addInitScript(init);
    await p.evaluate(([k, v, s]) => { if (s) localStorage.setItem(k, v) }, [KEY, st.semilla(), semilla]);
    if (opcionesRestos) await p.evaluate(opcionesRestos, KEY); await p.reload();
    const e = await hastaEstable(p, tope); check(id, nombre, evalua(e, st, errs), JSON.stringify(e) + (errs.length ? ' errs=' + errs.slice(0, 2) : '')); await ctx.close(); opcionesRestos = null;
  };
  let opcionesRestos = null;
  await caso('B1', 'Sesión guardada, móvil: la pantalla de carga desaparece y la app queda montada', {}, e => !e.colgado && !e.gateVisible && e.app > 0 && e.polvo === 0 && e.fase === 'ready');
  await caso('B2', 'Sesión guardada, escritorio 2560×1440: la pantalla de carga desaparece y la app queda montada', { w: 2560, h: 1440 }, e => !e.colgado && !e.gateVisible && e.app > 0 && e.polvo === 0 && e.fase === 'ready');
  await caso('B3', 'Sin sesión: aparece el acceso (no una carga infinita)', { semilla: false }, e => !e.colgado && /Entrar a vive/i.test(e.gate));
  opcionesRestos = () => { localStorage.setItem('finanzas360.legacy.v300', '{"basura":true}'); localStorage.setItem('vive_version', '1'); sessionStorage.setItem('vive_reload', '5'); localStorage.setItem('sb-otro-auth-token', 'x') };
  await caso('B4', 'Restos de versiones antiguas en localStorage/sessionStorage: la app abre igual', {}, e => !e.colgado && !e.gateVisible && e.app > 0);
  opcionesRestos = K => { localStorage.setItem(K, '{"access_token":"undefined","refresh_token":"","user":null}') };
  await caso('B5', 'Sesión guardada dañada (token inválido): login o recuperación, nunca carga infinita', {}, e => !e.colgado);
  await caso('B6', 'Servidor de datos colgado (las lecturas nunca responden): recuperación visible en ≤ 60 s, no carga infinita', { tope: 60000, prep: st => { const h = st.handler; st.handler = async route => { if (/\/rest\/v1\//.test(route.request().url()) && !/rpc/.test(route.request().url())) return new Promise(() => { }); return h(route) } } }, e => !e.colgado && /(Reintentar|Volver a iniciar)/i.test(e.gate || ''));
  await caso('B7', 'Supabase completamente caído (red rechazada): pantalla de reintento, no carga infinita', { tope: 30000, prep: st => { st.caido = true } }, e => !e.colgado);
  await caso('B8', 'Supabase responde 500 en lecturas: mensaje de error con salida, no carga infinita', { tope: 45000, prep: st => { const h = st.handler; st.handler = async route => { if (/\/rest\/v1\//.test(route.request().url()) && !/rpc/.test(route.request().url())) return route.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: '{"message":"boom"}' }); return h(route) } } }, e => !e.colgado);
  /* B9 · pestaña en segundo plano / ahorro de energía de Safari: requestAnimationFrame no se ejecuta nunca. El arranque no puede depender de animaciones. */
  await caso('B9', 'requestAnimationFrame congelado (pestaña en segundo plano o ahorro de energía): la pantalla de carga igual desaparece', { init: 'window.requestAnimationFrame=function(){return 0};' }, e => !e.colgado && !e.gateVisible && e.app > 0 && e.polvo === 0 && e.fase === 'ready');
  global.__paso = 'B10: formulario de login';
  {
    const st=servidorAuth();const {p,ctx}=await abrir(b,st,null,{});
    await p.locator('#f33-email').fill('demo@example.com');
    await p.locator('#f33-password').fill('password-de-prueba');
    await p.locator('#f33-login-button').click();
    const e=await hastaEstable(p,45000);
    check('B10','Login manual desde una sesión vacía: monta la app',!e.colgado&&!e.gateVisible&&e.app>0&&e.fase==='ready',JSON.stringify(e));
    await ctx.close();
  }
  global.__paso='B11: Inicio sin restaurar vista';
  {
    const st=servidorAuth();const {p,ctx}=await abrir(b,st,null,{});
    await p.evaluate(([k,v])=>{localStorage.setItem(k,v);localStorage.setItem('finanzas360.resume.00000000-0000-0000-0000-000000000001',JSON.stringify({page:'wallet',at:Date.now()}))},[KEY,st.semilla()]);
    await p.goto('http://localhost:8765/index.html?safe=1');
    const e=await hastaEstable(p,45000);
    const page=await p.evaluate(()=>document.body.dataset.page);
    check('B11','Recuperación: abre Inicio sin restaurar la vista anterior',e.fase==='ready'&&!e.gateVisible&&page==='overview',JSON.stringify({e,page}));await ctx.close();
  }
  /* B12–B14 · Incidente real en iPhone (27-nov): una página de finance_values falla en Safari con «TypeError: Load failed» sin llegar al servidor,
     o la conexión queda colgada. Un fallo transitorio de UNA lectura no puede impedir abrir VIVE. */
  /* Servidor con documento existente (si no, el arranque no lee finance_values): primer arranque crea los datos; luego se arma el fallo y se recarga. */
  const conDatos = async (id, nombre, modo, cuantas, tope) => {
    global.__paso = id; const st = servidorAuth(); const { p, ctx, errs } = await abrir(b, st, null, { semilla: null });
    /* «cuerpo»: Safari recibe HTTP 200 y falla al descargar el cuerpo (TypeError: Load failed). Se reproduce sustituyendo fetch antes de early.js. */
    if (modo === 'cuerpo') await ctx.addInitScript(n => { const F = window.fetch; let quedan = +(sessionStorage.getItem('__cuerpo') || 0); sessionStorage.removeItem('__cuerpo'); window.fetch = async (u, o) => { const r = await F(u, o); const url = typeof u === 'string' ? u : u.url; if (quedan > 0 && /\/rest\/v1\/finance_values/.test(url) && (!o || !o.method || o.method === 'GET')) { quedan--; window.__cuerposRotos = (window.__cuerposRotos || 0) + 1; return new Response(new ReadableStream({ start(c) { c.error(new TypeError('Load failed')) } }), { status: 200, headers: r.headers }) } return r } }, cuantas);
    await p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, st.semilla()]); await p.reload(); await hastaEstable(p, 14000);
    const lecturasAntes = st.db.reads; const h = st.handler; let quedan = cuantas, armados = 0;
    st.handler = async route => { const u = route.request().url(); if (route.request().method() === 'GET' && /\/rest\/v1\/finance_values/.test(u) && quedan > 0) { quedan--; armados++; if (modo === 'cuelga') return new Promise(() => { }); return route.abort('failed') } return h(route) };
    open.apiHandler = st.handler; if (modo === 'cuerpo') { quedan = 0; await p.evaluate(k => sessionStorage.setItem('__cuerpo', k), cuantas) } await p.reload();
    const e = await hastaEstable(p, tope);
    if (modo === 'cuerpo') armados = await p.evaluate(() => window.__cuerposRotos || 0).catch(() => -1);
    check(id, nombre, armados === cuantas && !e.colgado && !e.gateVisible && e.app > 0 && e.fase === 'ready', JSON.stringify(e) + ' fallos inyectados=' + armados + ' lecturas=' + (st.db.reads - lecturasAntes) + (errs.length ? ' errs=' + errs.slice(0, 2) : '')); await ctx.close();
  };
  /* B12–B14 · Incidente real en iPhone (27-nov): una página de finance_values falla en Safari con «TypeError: Load failed» sin llegar al servidor,
     o la conexión queda colgada. Un fallo transitorio de UNA lectura no puede impedir abrir VIVE. */
  await conDatos('B12', 'Con datos existentes, una lectura falla una vez («Load failed» de Safari): VIVE abre igual', 'falla', 1, 30000);
  await conDatos('B13', 'Con datos existentes, dos lecturas seguidas fallan: VIVE abre igual', 'falla', 2, 30000);
  await conDatos('B15', 'Con datos existentes, Safari recibe 200 y falla al descargar el cuerpo («Load failed», caso exacto del iPhone): VIVE abre igual', 'cuerpo', 1, 30000);
  await conDatos('B16', 'Con datos existentes, la misma lectura queda colgada dos veces seguidas: los reintentos caben dentro del límite y VIVE abre', 'cuelga', 2, 60000);
  await conDatos('B14', 'Con datos existentes, una lectura queda colgada (conexión muerta de Safari tras dormir el iPhone): VIVE abre igual en ≤ 45 s', 'cuelga', 1, 45000);
  console.log(fails ? `\nFALLAN: ${fails} de ${n}` : `\nOK: ${n} comprobaciones superadas`); clearTimeout(guardia); await b.close(); process.exit(fails ? 1 : 0);
})();
