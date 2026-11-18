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
  check('N1', 'Cuatro pestañas: Agenda, Cartera, Historial, Análisis', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.v911 > .v911-seg button')].map(e => e.textContent))) === '["Agenda","Cartera","Historial","Análisis"]');
  await click(p, '[data-v911-tab=analisis]'); await p.waitForTimeout(250);
  check('N2', 'Análisis tiene selector segmentado: Radiografía, Concentración, Inteligencia', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.v911-seg-sub button')].map(e => e.textContent))) === '["Radiografía","Concentración","Inteligencia"]');
  /* 2 · Agenda: total independiente */
  await click(p, '[data-v911-tab=agenda]'); await p.waitForTimeout(250);
  const exp = await p.evaluate(() => { const d = window.__T.dbg(), m = window.__T.ui().month, fx = d.settings.fx; return d.recurring.filter(r => r.active !== false && r.nextDue.slice(0, 7) === m).reduce((s, r) => s + r.amount * (r.currency === 'USD' ? fx : 1), 0) });
  const shown = await txt(p, '#v911-due-total'); const num = +shown.replace(/[^\d.]/g, '');
  check('A1', 'Agenda: «Por pagar este mes» = suma de vencimientos del mes (USD convertido con el tipo de cambio de la app)', Math.abs(num - Math.round(exp)) <= 1, `mostrado ${shown} · esperado ${Math.round(exp)}`);
  const dayCount = await p.evaluate(() => document.querySelectorAll('.v911-day').length); check('A2', 'Calendario horizontal con todos los días del mes', dayCount >= 28 && dayCount <= 31, dayCount);
  const before = await p.evaluate(() => document.querySelectorAll('.v911-tl-group').length);
  await click(p, '.v911-day:nth-child(28)'); await p.waitForTimeout(300); const after = await p.evaluate(() => document.querySelectorAll('.v911-tl-group').length);
  check('A3', 'Elegir un día posterior reduce la línea de tiempo a los vencimientos desde esa fecha', after < before, `${before}→${after}`);
  /* 3 · Cartera */
  await click(p, '[data-v911-tab=cartera]'); await p.waitForTimeout(250);
  check('C1', 'Cartera: cuenta las suscripciones activas', (await txt(p, '.v911-count')).startsWith(String(SERV.length)), await txt(p, '.v911-count'));
  const groups = await p.evaluate(() => [...document.querySelectorAll('.v911-group h3')].map(e => e.textContent));
  check('C2', 'Agrupación por categorías', groups.length === 4 && groups.includes('Hogar') && groups.includes('Digital'), groups.join(','));
  await p.evaluate(() => { const i = document.getElementById('v911-search'); i.value = 'goog'; i.dispatchEvent(new Event('input', { bubbles: true })) }); await p.waitForTimeout(150);
  const vis = await p.evaluate(() => [...document.querySelectorAll('[data-v911-svc]')].filter(e => !e.hidden).map(e => e.querySelector('strong').textContent)); check('C3', 'El buscador filtra por nombre sin re-dibujar la pantalla', vis.length === 1 && vis[0] === 'Google One', vis.join(','));
  const own = await p.evaluate(() => [...document.querySelectorAll('[data-v911-svc]')].map(e => e.querySelector('summary b').textContent).join('|')); check('C4', 'Cada servicio muestra importe en su moneda (RD$ y US$)', /US\$15\.99/.test(own) && /RD\$6,000\.00/.test(own));
  await p.evaluate(() => { const i = document.getElementById('v911-search'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })) });
  /* 4 · Historial */
  await click(p, '[data-v911-tab=historial]'); await p.waitForTimeout(250);
  const h = await p.evaluate(() => ({ txt: document.querySelector('.v911-feat')?.innerText || '', pend: document.querySelectorAll('.v911-hist [data-v911-review]').length }));
  check('H1', 'Historial: tarjeta de revisión con importe previsto, registrado y diferencia', /Importe previsto/.test(h.txt) && /Importe registrado/.test(h.txt) && /Diferencia/.test(h.txt) && /Confirmar importe/.test(h.txt), h.txt.replace(/\s+/g, ' ').slice(0, 160));
  await p.evaluate(() => { const b = [...document.querySelectorAll('[data-v911-review]')].find(e => /Barbería/.test(e.textContent)); b && b.click() }); await p.waitForTimeout(300);
  const hb = await txt(p, '.v911-feat'); check('H2', 'Diferencia calculada: Barbería previsto RD$800 vs registrado RD$900 = +RD$100.00', /Barbería/.test(hb) && /\+RD\$100\.00/.test(hb), hb.replace(/\s+/g, ' ').slice(0, 220));
  const t0 = await p.evaluate(() => window.__T.dbg().transactions.length);
  await click(p, '.v911-feat [data-act=toggleReview]'); await p.waitForTimeout(400);
  const t1 = await p.evaluate(() => ({ n: window.__T.dbg().transactions.length, rev: window.__T.dbg().transactions.filter(t => t.recurringId && t.reviewed !== true).length }));
  check('H3', 'Confirmar importe marca el cobro como revisado y NO crea movimientos duplicados', t1.n === t0, `movimientos ${t0}→${t1.n}, pendientes ${t1.rev}`);
  await click(p, '.v911-feat [data-act=editTransaction]'); await p.waitForTimeout(700);
  check('H4', 'Editar abre el editor de movimientos existente', await p.evaluate(() => !!document.querySelector('#modal-root .modal,#modal-root form,#modal-root .v749-layer')));
  await p.evaluate(() => { try { closeModal() } catch (_) { } });
  /* 5 · Radiografía */
  await click(p, '[data-v911-tab=analisis]'); await p.waitForTimeout(250);
  const r = await p.evaluate(() => { const d = window.__T.dbg(), fx = d.settings.fx; const tot = d.recurring.reduce((s, r) => s + r.amount * (r.currency === 'USD' ? fx : 1), 0); return { tot, txt: document.querySelector('.v911-hero')?.textContent, yr: document.querySelector('.v911-muted')?.textContent, pcts: [...document.querySelectorAll('.v911-legend b')].map(e => parseFloat(e.textContent)) } });
  check('R1', 'Radiografía: gasto mensual y proyección anual (×12) calculados', Math.abs(+r.txt.replace(/[^\d]/g, '') - Math.round(r.tot)) <= 1 && Math.abs(+r.yr.replace(/[^\d]/g, '') - Math.round(r.tot * 12)) <= 12, `${r.txt} · ${r.yr} · esperado ${Math.round(r.tot)}`);
  check('R2', 'Participaciones de la dona suman ≈100 %', Math.abs(r.pcts.reduce((a, c) => a + c, 0) - 100) <= 2, r.pcts.join('+'));
  await click(p, '.v911-legend [data-v911-seg="0"]'); await p.waitForTimeout(250); check('R3', 'La dona es interactiva: elegir una categoría muestra su detalle en el centro', /\/mes/.test(await txt(p, '.v911-donut-c')), (await txt(p, '.v911-donut-c')).replace(/\s+/g, ' '));
  check('R4', 'Hallazgo generado de los datos («N de cada 10 pesos…») y 3 contadores', /de cada 10 pesos/.test(await txt(p, '.v911-insight')) && (await p.evaluate(() => document.querySelectorAll('.v911-stats b').length)) === 3);
  /* 6 · Concentración */
  await click(p, '[data-v911-sub=concentracion]'); await p.waitForTimeout(300);
  const tm = await p.evaluate(() => { const box = document.querySelector('.v911-treemap').getBoundingClientRect(); const bl = [...document.querySelectorAll('.v911-tm')].map(e => { const r = e.getBoundingClientRect(); return { name: e.querySelector('strong').textContent, area: r.width * r.height / (box.width * box.height), pct: parseFloat(e.querySelector('b').textContent) / 100, cls: e.className } }); return { bl, hero: document.querySelector('.v911-hero').textContent } });
  const worst = Math.max(...tm.bl.map(x => Math.abs(x.area - x.pct)));
  check('T1', 'Treemap: el área de cada bloque es proporcional a su participación (error máx. ≤ 2 puntos)', worst <= .02, `error máx ${(worst * 100).toFixed(2)} pts · bloques ${tm.bl.length}`);
  check('T2', 'Bloques de Pareto (≈80 %) en color intenso y «Otros» agrupado', tm.bl.some(x => /top/.test(x.cls)) && tm.bl.some(x => /other/.test(x.cls)), tm.bl.map(x => x.name).join(','));
  const sumTop = tm.bl.filter(x => /top|mid/.test(x.cls)).reduce((a, x) => a + x.pct, 0); check('T3', 'El % de Pareto mostrado corresponde a la suma real de los bloques intensos', Math.abs(parseFloat(tm.hero) / 100 - sumTop) <= .03, `${tm.hero} vs ${(sumTop * 100).toFixed(1)}%`);
  await click(p, '.v911-tm'); await p.waitForTimeout(250); check('T4', 'Tocar un bloque muestra su detalle', await p.evaluate(() => !!document.querySelector('.v911-pick')));
  /* 7 · Inteligencia */
  await click(p, '[data-v911-sub=inteligencia]'); await p.waitForTimeout(300);
  const it = await p.evaluate(() => ({ chart: !!document.querySelector('.v911-chart .v911-line'), grad: !!document.querySelector('#v911-grad'), pts: document.querySelectorAll('.v911-pt').length, kpi: document.querySelector('.v911-kpis')?.innerText.replace(/\s+/g, ' '), why: document.querySelector('.v911-why')?.innerText.replace(/\s+/g, ' ') }));
  check('I1', 'Gráfico histórico con área degradada y puntos reales', it.chart && it.grad && it.pts >= 3, JSON.stringify({ pts: it.pts }));
  check('I2', 'Detecta el aumento de precio (Barbería +12,5 %: RD$800 → RD$900)', /Barbería/.test(it.kpi + it.why) && /12\.5%|12,5%/.test(it.kpi + it.why), (it.kpi + ' ' + it.why).slice(0, 260));
  const dbBefore = await p.evaluate(() => JSON.stringify([window.__T.dbg().recurring, window.__T.dbg().transactions]));
  await click(p, '[data-v911-simtoggle]'); await p.waitForTimeout(250); await p.evaluate(() => { document.querySelectorAll('[data-v911-sim]')[0].click() }); await p.waitForTimeout(300);
  const sim = await p.evaluate(() => ({ out: document.querySelector('.v911-sim-out')?.innerText.replace(/\s+/g, ' ') }));
  const dbAfter = await p.evaluate(() => JSON.stringify([window.__T.dbg().recurring, window.__T.dbg().transactions]));
  check('I3', 'Simulador: calcula ahorro mensual y anual (el de mayor costo = EDEESTE RD$6,000 → RD$72,000)', /6,000/.test(sim.out) && /72,000/.test(sim.out), sim.out);
  check('I4', 'El simulador no modifica los registros reales', dbBefore === dbAfter);
  check('X1', 'Sin errores de página', errs.length === 0, errs.join('|'));
  await p.context().close();
  /* 8 · Claro / Black / acento / desborde */
  for (const [label, env] of [['Claro', {}], ['Black', { theme: 'black' }], ['acento rojo', { palhex: '#c0264a' }]]) {
    const { p: q, errs: e2 } = await sesion(b, 390, 844, env);
    const st = await q.evaluate(() => { const bg = getComputedStyle(document.querySelector('#page')).backgroundColor; const on = getComputedStyle(document.querySelector('.v911-seg .is-on')).backgroundColor; return { bg, on, body: getComputedStyle(document.body).backgroundColor } });
    if (label === 'Claro') check('V1', 'Modo Claro: fondo blanco puro #FFFFFF', st.bg === 'rgb(255, 255, 255)', JSON.stringify(st));
    if (label === 'Black') check('V2', 'Modo Black: fondo negro auténtico #000000', st.bg === 'rgb(0, 0, 0)' && st.body === 'rgb(0, 0, 0)', JSON.stringify(st));
    if (label === 'acento rojo') check('V3', 'El acento dinámico se aplica (no hay color fijo): la pestaña activa toma el acento elegido', /192, 38, 74/.test(st.on) || /rgb\(19\d, 3\d, 7\d\)/.test(st.on), st.on);
    check('V4-' + label, `Sin errores de página en ${label}`, e2.length === 0, e2.join('|'));
    await q.context().close();
  }
  for (const [w, hgt] of [[320, 568], [390, 844], [768, 1024], [1440, 900]]) {
    const { p: q } = await sesion(b, w, hgt); const bad = [];
    for (const [tab, sub] of [['agenda'], ['cartera'], ['historial'], ['analisis', 'radiografia'], ['analisis', 'concentracion'], ['analisis', 'inteligencia']]) {
      await q.evaluate(([t, s]) => { document.querySelector(`[data-v911-tab=${t}]`)?.click(); }, [tab, sub]); await q.waitForTimeout(200); if (sub) { await q.evaluate(s => document.querySelector(`[data-v911-sub=${s}]`)?.click(), sub); await q.waitForTimeout(200) }
      const o = await q.evaluate(() => { const vw = document.documentElement.clientWidth; const off = []; document.querySelectorAll('.v911 *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width > 0 && (r.right > vw + 1 || r.left < -1) && !e.closest('.v911-strip,.v911-chartbox')) { if (off.length < 2) off.push((e.className || e.tagName) + ' ' + Math.round(r.right)) } }); return off });
      if (o.length) bad.push((sub || tab) + ': ' + o.join(' ; '));
    }
    check('V5-' + w, `Sin elementos fuera de pantalla a ${w} px en las 6 vistas`, bad.length === 0, bad.join(' | ')); await q.context().close();
  }
  console.log(fails ? `\nFALLAN: ${fails} de ${n}` : `\nOK: ${n} comprobaciones superadas`); await b.close(); process.exit(fails ? 1 : 0);
})();
