/* Préstamos (móvil y escritorio): el detalle cambia de pestaña, exporta, simula y se estiliza (la limpieza de código/CSS no debe romperlo). */
const { chromium } = require('playwright');
const open = require('./harness.js');
let fails = 0, n = 0; const check = (id, name, ok, extra = '') => { n++; if (!ok) fails++; console.log(`${ok ? '✓' : '✕'} ${id} ${name}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  for (const [w, h, t] of [[390, 844, '1'], [1440, 900, '']]) {
    process.env.TOUCH = t; const { p } = await open(b, w, h); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
    await p.evaluate(() => window.__T.go('loans')); await wait(700);
    const ok = await p.evaluate(() => { const x = document.querySelector('#page [data-act=loanDetails]'); if (!x) return false; x.click(); return true }); await wait(800);
    check('P1-' + w, 'Se abre el detalle de un préstamo', ok);
    const niv = await p.evaluate(() => { const pg = document.querySelector('#page'); return { v: !!pg.querySelector('.v1192'), saldo: /Saldo pendiente/.test(pg.innerText), cuota: /Próxima cuota/.test(pg.innerText), prog: !!pg.querySelector('.v1192-prog'), prohibido: /siguiente movimiento|no es un gasto nuevo|Principio contable|Próximo paso/i.test(pg.innerText), acts: [...pg.querySelectorAll('.v1192-hero [data-act]')].map(e => e.dataset.act).join() } });
    check('P2-' + w, 'Nivel 1: saldo pendiente, próxima cuota, progreso y las dos acciones; sin «Próximo paso» ni «Principio contable»', niv.v && niv.saldo && niv.cuota && niv.prog && !niv.prohibido && niv.acts === 'payLoan,extraLoan', JSON.stringify(niv));
    const dd = {};
    for (const k of ['detalle', 'pagos', 'amort', 'sim']) { await p.evaluate(k => document.querySelector(`details[data-v1192=${k}] summary`).click(), k); await wait(500); dd[k] = await p.evaluate(k => document.querySelector(`details[data-v1192=${k}]`).innerText.length, k) }
    check('P3-' + w, 'Nivel 2: detalle, pagos y abonos, amortización y simulador se despliegan con contenido', Object.values(dd).every(n => n > 60), JSON.stringify(dd));
    const fa = await p.evaluate(() => /Monto original/.test(document.querySelector('#page').innerText) && /Tasa de interés/.test(document.querySelector('#page').innerText) && /Plazo/.test(document.querySelector('#page').innerText) && /Cuotas pagadas/.test(document.querySelector('#page').innerText));
    check('P4-' + w, 'Se conservan monto original, tasa, plazo y cuotas pagadas/restantes', fa);
    await p.evaluate(() => { const i = document.getElementById('loanSimAmount'); if (i) i.value = '5000'; document.querySelector('[data-act=loanCalculate]')?.click() }); await wait(700);
    check('P5-' + w, 'El simulador calcula un abono', await p.evaluate(() => /ahorro|Ahorr|nuevo|Cuotas|plazo/i.test(document.querySelector('details[data-v1192=sim]')?.innerText || '')));
    await p.evaluate(() => document.querySelector('[data-act=closeLoanDetails]')?.click()); await wait(500);
    check('P6-' + w, 'Volver a la cartera cierra el detalle', await p.evaluate(() => !document.querySelector('#loan-workspace')));
    check('P7-' + w, 'Sin errores de página', errs.length === 0, errs.join('|')); await p.context().close();
  }
  console.log(fails ? `\nFALLAN: ${fails} de ${n}` : `\nOK: ${n} comprobaciones superadas`); await b.close(); process.exit(fails ? 1 : 0);
})();
