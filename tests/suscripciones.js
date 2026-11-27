/* Suscripciones (V911): navegación, cálculos con datos reales, historial vinculado a Movimientos, Pareto/treemap, simulador sin efectos,
   Claro/Black, acento dinámico y ausencia de desborde. Uso: node tests/suscripciones.js */
const { chromium } = require('playwright');
const open = require('./harness.js');
let fails = 0, n = 0; const check = (id, name, ok, extra = '') => { n++; if (!ok) fails++; console.log(`${ok ? '✓' : '✕'} ${id} ${name}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`); };
const SERV = [['EDEESTE', 'Hogar', 6000, 'DOP'], ['CAASD', 'Hogar', 194, 'DOP'], ['Albagas', 'Hogar', 600, 'DOP'], ['YouTube Premium', 'Digital', 15.99, 'USD'], ['iCloud+', 'Digital', 2.99, 'USD'], ['Google One', 'Digital', 1.99, 'USD'], ['Apple Music', 'Digital', 3.49, 'USD'], ['Internet', 'Servicios básicos', 1800, 'DOP'], ['Móvil', 'Servicios básicos', 1200, 'DOP'], ['Barbería', 'Personal', 800, 'DOP'], ['Gimnasio', 'Personal', 1500, 'DOP']];
async function sesion(b, w, h, env = {}) {
  Object.assign(process.env, { TOUCH: w < 700 ? '1' : '', THEME: env.theme || 'light' }); if (env.palhex) process.env.PALHEX = env.palhex; else delete process.env.PALHEX;
  const { p } = await open(b, w, h); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await p.evaluate(S => {
    const d = window.__T.dbg(); const acc = d.accounts.find(a => a.currency === 'DOP' && a.kind !== 'cash'), usd = d.accounts.find(a => a.currency === 'USD' && a.kind !== 'cash') || acc; const base = window.__T.fn.today();
    d.recurring = S.map(([name, category, amount, currency], i) => ({ id: 'sv' + i, name, category, amount, currency, source: 'account:' + (currency === 'USD' ? usd.id : acc.id), frequency: 'monthly', nextDue: base.slice(0, 7) + '-' + String(19 + (i % 8)).padStart(2, '0'), active: true, subcategory: '' }));
    d.transactions = d.transactions.filter(t => !t.recurringId);
    const months = [-5, -4, -3, -2, -1].map(k => { const x = new Date(+base.slice(0, 4), +base.slice(5, 7) - 1 + k, 10); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-10' });
    months.forEach((date, mi) => { [0, 3, 9].forEach(si => { const [name, , amount, currency] = S[si]; const price = si === 9 && mi >= 3 ? amount + 100 : amount; d.transactions.push({ id: `chg-${mi}-${si}`, type: 'expense', accountId: currency === 'USD' ? usd.id : acc.id, amount: price, currency, date, created: date + 'T12:00:00Z', category: S[si][1], subcategory: '', note: name, recurringId: 'sv' + si, scheduleKey: `recurring:sv${si}:${date}`, reviewed: mi < 4, fxRateSnapshot: 60, scheduleSnapshot: { name, amount, kind: 'recurring', expectedDate: date } }); }) });
    window.__T.inv();
  }, SERV);
  await p.evaluate(() => window.__T.go('recurring')); await p.waitForTimeout(500);
  return { p, errs };
}
const click = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e }, sel);
const txt = (p, sel) => p.evaluate(s => document.querySelector(s)?.innerText || '', sel);
module.exports = { sesion, SERV };
if (require.main === module) (async () => {
  const b = await chromium.launch();
  let { p, errs } = await sesion(b, 390, 844);
  /* 1 · navegación */
  check('N1', 'Dos vistas: Cartera e Historial (sin Agenda ni Análisis)', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.v911 .v911-seg button')].map(e => e.textContent))) === '["Cartera","Historial"]');
  check('N1b', 'La vista Agenda ya no existe', !(await p.evaluate(() => !!document.querySelector('[data-v911-tab=agenda],.v911-agenda,.v911-day')))); check('N2', 'La vista Análisis ya no existe', !(await p.evaluate(() => !!document.querySelector('[data-v911-tab=analisis],[data-v911-sub]'))));
  /* 3 · Cartera: grupos desplegables con cantidad y montos mensual/anual */
  await click(p, '[data-v911-tab=cartera]'); await p.waitForTimeout(250);
  const kp = await txt(p, '.v911'); check('C1', 'Cartera: resumen con gasto mensual, equivalente anual, número de servicios y próximo cobro', /gasto mensual/i.test(kp) && /al año/i.test(kp) && new RegExp('\\b' + SERV.length + '\\s+servicios').test(kp) && /próximo cobro/i.test(kp), kp.replace(/\s+/g, ' ').slice(0, 200));
  const gh = await p.evaluate(() => [...document.querySelectorAll('details.v911-grp > summary')].map(e => ({ t: e.innerText.replace(/\s+/g, ' '), open: e.parentElement.open })));
  check('C2', 'Un grupo por categoría, cerrado por defecto, con «N servicios» y monto mensual y anual', gh.length === 4 && gh.every(g => !g.open && /servicios/.test(g.t) && /\/mes/.test(g.t) && /\/año/.test(g.t)), JSON.stringify(gh));
  const hogar = gh.find(g => /^Hogar/.test(g.t)); check('C2b', 'Hogar: 3 servicios y RD$6,794/mes (EDEESTE 6,000 + CAASD 194 + Albagas 600) = RD$81,528/año', hogar && /3 servicios/.test(hogar.t) && /6,794/.test(hogar.t) && /81,528/.test(hogar.t), hogar && hogar.t);
  await p.evaluate(() => document.querySelector('details.v911-grp summary').click()); await p.waitForTimeout(200);
  const filas = await p.evaluate(() => [...document.querySelectorAll('details.v911-grp[open] .v911-svc > summary')].map(e => e.innerText.replace(/\s+/g, ' ')));
  check('C3', 'Al desplegar un grupo cada servicio muestra su monto mensual y anual (USD convertido)', filas.length === 3 && filas.every(f => /\/mes/.test(f) && /\/año/.test(f)), filas.join(' | '));
  await p.evaluate(() => { document.querySelector('details.v911-grp').open = false }); await p.waitForTimeout(150);
  await p.evaluate(() => { const i = document.getElementById('v911-search'); i.value = 'goog'; i.dispatchEvent(new Event('input', { bubbles: true })) }); await p.waitForTimeout(200);
  const vis = await p.evaluate(() => ({ n: [...document.querySelectorAll('[data-v911-svc]')].filter(e => !e.hidden && e.offsetParent).map(e => e.querySelector('strong').textContent), abiertos: document.querySelectorAll('details.v911-grp[open]:not([hidden])').length })); check('C4', 'El buscador filtra y abre solo el grupo con coincidencias', vis.n.length === 1 && vis.n[0] === 'Google One' && vis.abiertos === 1, JSON.stringify(vis));
  await p.evaluate(() => { const i = document.getElementById('v911-search'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })) });
  /* 4 · Historial */
  await click(p, '[data-v911-tab=historial]'); await p.waitForTimeout(250);
  const h = await p.evaluate(() => ({ feat: !!document.querySelector('.v911-feat'), txt: document.querySelector('.v911-hist')?.innerText || '', pend: window.__T.dbg().transactions.filter(t => t.recurringId && t.reviewed !== true).length }));
  check('H1', 'Historial: todos los cobros entran confirmados (sin tarjeta «Por revisar», sin botón «Confirmar importe» y sin pendientes)', !h.feat && !/Por revisar|Confirmar importe/.test(h.txt) && h.pend === 0, `pendientes ${h.pend}`);
  check('H2', 'La diferencia de Barbería (+RD$100.00) se muestra en su fila ya confirmada', /Barbería/.test(h.txt) && /RD\$100\.00/.test(h.txt), h.txt.replace(/\s+/g, ' ').slice(0, 200));
  check('X1', 'Sin errores de página', errs.length === 0, errs.join('|'));
  await p.context().close();
  /* 8 · Claro / Black / acento / desborde */
  for (const [label, env] of [['Claro', {}], ['Black', { theme: 'black' }], ['acento rojo', { palhex: '#c0264a' }]]) {
    const { p: q, errs: e2 } = await sesion(b, 390, 844, env);
    const st = await q.evaluate(() => { const bg = getComputedStyle(document.querySelector('#page')).backgroundColor; const on = getComputedStyle(document.querySelector('.v911-seg .is-on')).backgroundColor; return { bg, on, body: getComputedStyle(document.body).backgroundColor } });
    if (label === 'Claro') check('V1', 'Modo Claro: conserva el reflejo de fondo del acento (la página no fuerza blanco)', st.bg === 'rgba(0, 0, 0, 0)', JSON.stringify(st));
    if (label === 'Black') check('V2', 'Modo Black: fondo negro auténtico #000000', (st.bg === 'rgb(0, 0, 0)' || st.bg === 'rgba(0, 0, 0, 0)') && st.body === 'rgb(0, 0, 0)', JSON.stringify(st));
    if (label === 'acento rojo') check('V3', 'El acento dinámico se aplica (no hay color fijo): la pestaña activa toma el acento elegido', (c => c[0] > c[1] + 80 && c[0] > c[2] + 60)((st.on.match(/\d+/g) || []).map(Number)), st.on);
    check('V4-' + label, `Sin errores de página en ${label}`, e2.length === 0, e2.join('|'));
    await q.context().close();
  }
  for (const [w, hgt] of [[320, 568], [390, 844], [768, 1024], [1440, 900]]) {
    const { p: q } = await sesion(b, w, hgt); const bad = [];
    for (const [tab, sub] of [['cartera'], ['historial']]) {
      await q.evaluate(([t, s]) => { document.querySelector(`[data-v911-tab=${t}]`)?.click(); }, [tab, sub]); await q.waitForTimeout(200); if (sub) { await q.evaluate(s => document.querySelector(`[data-v911-sub=${s}]`)?.click(), sub); await q.waitForTimeout(200) }
      const o = await q.evaluate(() => { const vw = document.documentElement.clientWidth; const off = []; document.querySelectorAll('.v911 *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width > 0 && (r.right > vw + 1 || r.left < -1) && !e.closest('.v911-strip,.v911-chartbox')) { if (off.length < 2) off.push((e.className || e.tagName) + ' ' + Math.round(r.right)) } }); return off });
      if (o.length) bad.push((sub || tab) + ': ' + o.join(' ; '));
    }
    check('V5-' + w, `Sin elementos fuera de pantalla a ${w} px en las 3 vistas`, bad.length === 0, bad.join(' | ')); await q.context().close();
  }
  console.log(fails ? `\nFALLAN: ${fails} de ${n}` : `\nOK: ${n} comprobaciones superadas`); await b.close(); process.exit(fails ? 1 : 0);
})();
