/* Pruebas de regresión de la remediación 03 (cada una nace de un hallazgo de AUDITORIA-01 / AUDITORIA-02).
   Uso: node tests/remediacion-03.js   (falla si algún hallazgo reaparece) */
const { chromium } = require('playwright');
const open = require('./harness.js');
let fails = 0; const R = {};
const check = (id, name, ok, extra = '') => { if (!ok) fails++; R[id] = !!ok; console.log(`${ok ? '✓' : '✕'} ${id} ${name}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`); };
(async () => {
  const b = await chromium.launch();
  /* H-07 · la regla de redondeo vigente (mitad hacia arriba, entradas inválidas = 0) queda protegida; no se cambió por ser una decisión de negocio documentada */
  { const { p } = await open(b, 390, 844);
    const t = await p.evaluate(() => { const r = window.__T.fn.rnd; return [[2.675, 2.68], [1.005, 1.01], [-1.005, -1], [0.1 + 0.2, 0.3], ['abc', 0], [undefined, 0]].map(([v, e]) => ({ v, e, g: r(v), ok: r(v) === e })); });
    const fmt = await p.evaluate(() => money(window.__T.fn.rnd(-0.001), 'DOP', 2));
    check('H-07', 'rnd conserva la regla documentada y un resultado -0 no se muestra con signo', t.every(x => x.ok) && fmt === 'RD$0.00', JSON.stringify(t.filter(x => !x.ok)) + fmt);
    await p.close(); }
  /* H-09 · «hoy», mes y año salen de la misma zona (America/Santo_Domingo), sin depender de la zona del dispositivo */
  { process.env.TZID = 'Pacific/Auckland'; process.env.FREEZE = '2026-12-31T20:00:00Z';
    const { p } = await open(b, 390, 844);
    const s = await p.evaluate(() => { const u = window.__T.ui(); return { hoy: window.__T.fn.today(), month: u.month, year: u.year, cardYear: u.cardHistoryYear }; });
    delete process.env.TZID; delete process.env.FREEZE;
    check('H-09', 'Con el dispositivo en otra zona, año y mes iniciales coinciden con el «hoy» del producto', s.hoy === '2026-12-31' && s.month === '2026-12' && s.year === 2026 && s.cardYear === 2026, JSON.stringify(s));
    await p.close(); }
  /* H-15 · el selector de instituciones no deja listeners globales al cerrarse */
  { const { ctx, p } = await open(b, 390, 844); const cdp = await ctx.newCDPSession(p);
    const count = async () => { let n = 0; for (const ex of ['document', 'window']) { const o = (await cdp.send('Runtime.evaluate', { expression: ex })).result.objectId; n += (await cdp.send('DOMDebugger.getEventListeners', { objectId: o })).listeners.length; } return n; };
    await p.evaluate(() => window.__T.go('income')); await p.waitForTimeout(700);
    const n0 = await count();
    for (let i = 0; i < 10; i++) { await p.evaluate(() => { const x = document.createElement('button'); x.dataset.v40Action = 'addIncome'; x.hidden = true; document.body.append(x); x.click(); x.remove(); }); await p.waitForTimeout(250); await p.evaluate(() => closeModal()); await p.waitForTimeout(120); }
    const n1 = await count();
    check('H-15', 'Abrir y cerrar 10 veces el asistente de ingreso no acumula listeners globales', n1 - n0 <= 1, `+${n1 - n0}`);
    await p.close(); }
  /* UX-01 · el teclado queda dentro del modal */
  { const { p } = await open(b, 390, 844);
    await p.evaluate(() => window.__T.go('accounts')); await p.waitForTimeout(600);
    await p.evaluate(() => { const bt = [...document.querySelectorAll('#page button')].find(e => /Agregar|Nueva/.test(e.textContent) && e.offsetParent); bt.focus(); bt.click(); }); await p.waitForTimeout(700);
    let fuera = 0, primeroDentro = null; for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); const d = await p.evaluate(() => !!document.activeElement.closest('#modal-root .modal')); if (i === 0) primeroDentro = d; if (!d) fuera++; }
    check('UX-01', 'Con un modal abierto, Tab y Mayús+Tab nunca sacan el foco del modal', primeroDentro && fuera === 0, `primerTabDentro=${primeroDentro} fuera=${fuera}`);
    await p.keyboard.press('Shift+Tab'); const sh = await p.evaluate(() => !!document.activeElement.closest('#modal-root .modal'));
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    check('UX-01b', 'Escape cierra el modal y el foco vuelve a la pantalla', sh && await p.evaluate(() => !document.querySelector('#modal-root .modal') && !!document.activeElement && document.activeElement !== document.body && !!document.activeElement.closest('#page')));
    await p.close(); }
  /* UX-02 / UX-03 · indicador de foco y nombres accesibles */
  { const { p } = await open(b, 1440, 900); let sinInd = 0, sinNom = 0, det = [];
    for (const pg of ['projection', 'patrimony', 'overview', 'advanced']) {
      await p.evaluate(pg => window.__T.go(pg), pg); await p.waitForTimeout(450); await p.evaluate(() => { document.activeElement && document.activeElement.blur(); scrollTo(0, 0); });
      for (let i = 0; i < 45; i++) { await p.keyboard.press('Tab'); const f = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); const ind = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow !== 'none'); const nm = (e.getAttribute('aria-label') || e.textContent || e.getAttribute('title') || e.placeholder || '').trim() || !!(e.labels && e.labels.length) || e.getAttribute('aria-labelledby'); return { id: e.tagName + '.' + String(e.className).split(' ')[0], ind, nm: !!nm }; }); if (!f) continue; if (!f.ind) { sinInd++; det.push(f.id); } if (!f.nm) { sinNom++; det.push('sin-nombre:' + f.id); } } }
    check('UX-02', 'Cada parada de teclado en Proyección, Patrimonio, Inicio y Avanzado tiene indicador de foco visible', sinInd === 0, `sin indicador=${sinInd} ${det.filter(x => !x.startsWith('sin-')).slice(0, 4).join(',')}`);
    check('UX-03', 'Cada parada de teclado tiene nombre accesible', sinNom === 0, `sin nombre=${sinNom} ${det.filter(x => x.startsWith('sin-')).slice(0, 4).join(',')}`);
    await p.close(); }
  await b.close(); console.log(fails ? `\nFALLAN: ${fails}` : '\nOK: sin regresiones'); process.exit(fails ? 1 : 0);
})();
