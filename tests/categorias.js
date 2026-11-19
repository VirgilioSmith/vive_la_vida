/* Categorías: lista por tipo, detalle (ver, añadir y eliminar subcategorías, eliminar categoría) y emoji propio que se refleja en toda la app. */
const { chromium } = require('playwright');
const open = require('./harness.js');
let fails = 0, n = 0; const check = (id, name, ok, extra = '') => { n++; if (!ok) fails++; console.log(`${ok ? '✓' : '✕'} ${id} ${name}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  for (const [w, h, t] of [[390, 844, '1'], [1440, 900, '']]) {
    process.env.TOUCH = t; const { p } = await open(b, w, h); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
    const confirmar = async () => { for (let i = 0; i < 20; i++) { await wait(100); const ok = await p.evaluate(() => { const x = document.querySelector('.v1011-ok'); if (x) { x.click(); return true } return false }); if (ok) return true } return false };
    await p.evaluate(() => window.__T.go('categories')); await wait(500);
    const l = await p.evaluate(() => ({ rows: document.querySelectorAll('#v920-list .v920-row').length, kpis: document.querySelectorAll('.v911-kpi,.v1170-kpi').length, seg: [...document.querySelectorAll('.v911-seg button,.v1170-seg button')].map(e => e.textContent).join(','), esp: Object.keys(window.__T.dbg().categoryEmoji || {}).length, n: window.__T.cats('gasto').length }));
    check('K1-' + w, 'Lista de categorías por tipo (Gastos/Ingresos) con tarjetas de resumen y una fila por categoría', l.rows === l.n && l.kpis === 2 && /^(Gastos,Ingresos|Ingresos,Gastos)$/.test(l.seg), JSON.stringify(l));
    await p.evaluate(() => document.querySelector('[data-v920-kind=ingreso]').click()); await wait(300);
    const li = await p.evaluate(() => ({ rows: document.querySelectorAll('#v920-list .v920-row').length, n: window.__T.cats('ingreso').length })); check('K2-' + w, 'La pestaña Ingresos lista las categorías de ingreso', li.rows === li.n && li.n > 0, JSON.stringify(li));
    await p.evaluate(() => document.querySelector('[data-v920-kind=gasto]').click()); await wait(300);
    await p.evaluate(() => document.querySelector('[data-v920-open^="gasto|Transporte"]').click()); await wait(400);
    const d = await p.evaluate(() => ({ subs: document.querySelectorAll('#v920-detail .v920-subs li:not(.v920-none)').length, esp: window.__T.subs('gasto', 'Transporte').length }));
    check('K3-' + w, 'Al entrar en una categoría se ven todas sus subcategorías', d.subs === d.esp && d.subs > 0, JSON.stringify(d));
    await p.evaluate(() => { const f = document.querySelector('#v920-detail form[data-v920-add]'); f.elements.sub.value = 'Lavado de carro'; f.requestSubmit() }); await wait(500);
    const a = await p.evaluate(() => ({ en: window.__T.subs('gasto', 'Transporte').includes('Lavado de carro'), ui: [...document.querySelectorAll('#v920-detail .v920-subs li span')].some(e => e.textContent === 'Lavado de carro') }));
    check('K4-' + w, 'Añadir subcategoría desde el detalle: queda en el catálogo y en la lista', a.en && a.ui, JSON.stringify(a));
    /* emoji de la categoría */
    await p.evaluate(() => document.querySelector('#v920-detail .v920-big').click()); await wait(400);
    await p.evaluate(() => [...document.querySelectorAll('#v920-emoji [data-v920-pick]')].find(e => e.dataset.v920Pick === '🚗').click()); await wait(500);
    const e1 = await p.evaluate(() => ({ db: window.__T.dbg().categoryEmoji['gasto||Transporte'], ico: window.__T.catIcon('gasto', 'Transporte', ''), sub: window.__T.catIcon('gasto', 'Transporte', 'Pasajes'), fila: document.querySelector('[data-v920-open^="gasto|Transporte"] .v920-chip,[data-v920-open^="gasto|Transporte"] .v1170-ic')?.textContent.trim(), sheet: !!document.querySelector('#v920-emoji') }));
    check('K5-' + w, 'Asignar emoji a una categoría: se guarda, se muestra en la lista y lo usa el resto de la app (ícono = emoji)', e1.db === '🚗' && e1.ico === 'emoji:🚗' && e1.fila === '🚗' && !e1.sheet, JSON.stringify(e1));
    /* emoji de una subcategoría propio */
    await p.evaluate(() => document.querySelector('#v920-detail .v920-sub').click()); await wait(300);
    await p.evaluate(() => { document.getElementById('v920-emoji-input').value = '⛽'; document.querySelector('[data-v920-use]').click() }); await wait(500);
    const e2 = await p.evaluate(() => { const s = window.__T.subs('gasto', 'Transporte')[0]; return { sub: s, db: window.__T.dbg().categoryEmoji['gasto||Transporte||' + s], ico: window.__T.catIcon('gasto', 'Transporte', s) } });
    check('K6-' + w, 'Emoji propio de una subcategoría (escrito a mano) se guarda y prevalece sobre el de la categoría', e2.db === '⛽' && e2.ico === 'emoji:⛽', JSON.stringify(e2));
    const inv = await p.evaluate(() => { document.querySelector('#v920-detail .v920-big').click(); return 1 }); await wait(300);
    await p.evaluate(() => { document.getElementById('v920-emoji-input').value = 'abc'; document.querySelector('[data-v920-use]').click() }); await wait(300);
    const e3 = await p.evaluate(() => ({ db: window.__T.dbg().categoryEmoji['gasto||Transporte'], abierto: !!document.querySelector('#v920-emoji') })); check('K7-' + w, 'Un texto que no es emoji se rechaza (no se guarda)', e3.db === '🚗' && e3.abierto, JSON.stringify(e3));
    await p.evaluate(() => document.querySelector('#v920-emoji [data-v920-pick=""]').click()); await wait(400);
    const e4 = await p.evaluate(() => ({ db: window.__T.dbg().categoryEmoji['gasto||Transporte'], ico: window.__T.catIcon('gasto', 'Transporte', '') })); check('K8-' + w, '«Quitar emoji» vuelve al ícono original', e4.db === undefined && !/^emoji:/.test(e4.ico), JSON.stringify(e4));
    /* eliminar subcategoría y categoría */
    await p.evaluate(() => document.querySelector('#v920-detail .v920-del[data-v920-del$="|Lavado de carro"]').click()); const c1 = await confirmar(); await wait(500);
    const s1 = await p.evaluate(() => ({ en: window.__T.subs('gasto', 'Transporte').includes('Lavado de carro') })); check('K9-' + w, 'Eliminar una subcategoría (con confirmación) la retira del catálogo', c1 && !s1.en, JSON.stringify({ c1, s1 }));
    await p.evaluate(() => document.querySelector('#v920-detail .v920-danger').click()); const c2 = await confirmar(); await wait(600);
    const s2 = await p.evaluate(() => ({ en: window.__T.cats('gasto').includes('Transporte'), hoja: !!document.querySelector('#v920-detail'), fila: !!document.querySelector('[data-v920-open^="gasto|Transporte"]') })); check('K10-' + w, 'Eliminar la categoría (con confirmación) la retira del catálogo y de la lista', c2 && !s2.en && !s2.hoja && !s2.fila, JSON.stringify({ c2, s2 }));
    /* crear con emoji desde «+» */
    await p.evaluate(() => document.querySelector('.v920 [data-act=addCategory]').click()); await wait(600);
    await p.evaluate(() => { const f = document.querySelector('#modal-root form#categoryForm'); f.querySelector('[data-v920-form-emoji]').click() }); await wait(400);
    await p.evaluate(() => [...document.querySelectorAll('#v920-emoji [data-v920-pick]')].find(e => e.dataset.v920Pick === '🎾' || e.dataset.v920Pick === '⚽').click()); await wait(300);
    await p.evaluate(() => { const f = document.querySelector('#modal-root form#categoryForm'); f.elements.name.value = 'Deportes'; f.requestSubmit() }); await wait(700);
    const nc = await p.evaluate(() => ({ en: window.__T.cats('gasto').includes('Deportes'), em: window.__T.dbg().categoryEmoji['gasto||Deportes'], fila: document.querySelector('[data-v920-open^="gasto|Deportes"] :is(.v920-chip,.v1170-ic),[data-v920-open^="gasto|Transporte"] .v1170-ic')?.textContent.trim() })); check('K11-' + w, 'Crear una categoría nueva con emoji desde el formulario: aparece en la lista con su emoji', nc.en && nc.em === '⚽' && nc.fila === '⚽', JSON.stringify(nc));
    check('K12-' + w, 'Sin errores de página', errs.length === 0, errs.join('|')); await p.context().close();
  }
  console.log(fails ? `\nFALLAN: ${fails} de ${n}` : `\nOK: ${n} comprobaciones superadas`); await b.close(); process.exit(fails ? 1 : 0);
})();
