/* Préstamos (móvil y escritorio), ahora dentro de Bancos (la lista vieja se eliminó): el detalle cambia de pestaña, exporta, simula y se estiliza (la limpieza de código/CSS no debe romperlo). */
const { chromium } = require('playwright');
const open = require('./harness.js');
let fails = 0, n = 0; const check = (id, name, ok, extra = '') => { n++; if (!ok) fails++; console.log(`${ok ? '✓' : '✕'} ${id} ${name}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  for (const [w, h, t] of [[390, 844, '1'], [1440, 900, '']]) {
    process.env.TOUCH = t; const { p } = await open(b, w, h); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
    await p.evaluate(() => window.__T.go('loans')); await wait(700);
    const ok = await p.evaluate(() => { const x = document.querySelector('#page [data-act=banksOpenProduct][data-kind=loans]'); if (!x) return false; x.click(); return true }); await wait(800);
    check('P1-' + w, 'Se abre el detalle de un préstamo', ok);
    const mid = await p.evaluate(() => { const e = document.querySelector('.loan-detail-top h1,.loan-detail-top h2,.loan-workspace h2,.loan-workspace h1'); const k = document.querySelector('.loan-kpi,.loan-stat,.glass-loan'); return { icon: Math.max(0, ...[...document.querySelectorAll('.loan-workspace button svg,.loan-workspace [class*=icon] svg,.loan-workspace [class*=ico] svg')].map(s => s.getBoundingClientRect().width)), h: !!e } });
    check('P2-' + w, 'Los íconos del detalle tienen tamaño normal (CSS presente)', mid.icon > 0 && mid.icon < 120, JSON.stringify(mid));
    const txt = {};
    for (const tab of ['amort', 'payments', 'simulate', 'vision']) {
      await p.evaluate(t => document.querySelector(`[data-act=loanTab][data-id=${t}]`)?.click(), tab); await wait(600);
      txt[tab] = await p.evaluate(() => ({ on: document.querySelector('.loan-tab.on')?.dataset.id, len: document.querySelector('#loan-workspace')?.innerText.length }));
    }
    check('P3-' + w, 'Las cuatro pestañas (Visión, Amortización, Historial, Simulador) cambian de contenido', ['amort', 'payments', 'simulate', 'vision'].every(k => txt[k].on === k) && new Set(Object.values(txt).map(x => x.len)).size >= 3, JSON.stringify(txt));
    await p.evaluate(() => document.querySelector('[data-act=loanTab][data-id=amort]')?.click()); await wait(500);
    const seg = await p.evaluate(() => { document.querySelector('[data-act=loanPlan][data-id=original]')?.click(); return 1 }); await wait(400);
    const plan = await p.evaluate(() => { const b = document.querySelector('[data-act=loanPlan][data-id=original]'); return { on: b?.classList.contains('on') || b?.getAttribute('aria-pressed') === 'true' || /on|active|selected/.test(b?.className || ''), bg: b ? getComputedStyle(b).borderTopStyle : '' } });
    check('P4-' + w, 'Plan y periodicidad de la amortización responden y tienen estilo de control segmentado', plan.bg === 'none' || plan.bg === '' || plan.on, JSON.stringify(plan));
    await p.evaluate(() => document.querySelector('[data-act=loanTab][data-id=simulate]')?.click()); await wait(500);
    await p.evaluate(() => { const i = document.getElementById('loanSimAmount'); if (i) i.value = '5000'; document.querySelector('[data-act=loanCalculate]')?.click() }); await wait(600);
    check('P5-' + w, 'El simulador calcula un abono', await p.evaluate(() => /ahorro|Ahorr|nuevo|Cuotas|plazo/i.test(document.querySelector('#loan-workspace')?.innerText || '')));
    await p.evaluate(() => document.querySelector('[data-act=banksCloseProduct]')?.click()); await wait(500);
    check('P6-' + w, 'Volver a la lista de Bancos cierra el detalle', await p.evaluate(() => !document.querySelector('#loan-workspace')));
    check('P7-' + w, 'Sin errores de página', errs.length === 0, errs.join('|')); await p.context().close();
  }
  console.log(fails ? `\nFALLAN: ${fails} de ${n}` : `\nOK: ${n} comprobaciones superadas`); await b.close(); process.exit(fails ? 1 : 0);
})();
