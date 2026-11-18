/* Detalle de cuentas y préstamos (envoltorios de «Antigüedad» sobre las vistas base) en móvil y escritorio: cualquier excepción de página es fallo. */
const { chromium } = require('playwright');
const open = require('./harness.js');
let fails = 0, n = 0; const check = (id, name, ok, extra = '') => { n++; if (!ok) fails++; console.log(`${ok ? '✓' : '✕'} ${id} ${name}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`); };
(async () => {
  const b = await chromium.launch();
  for (const [w, h, t] of [[390, 844, '1'], [1440, 900, '']]) {
    process.env.TOUCH = t; const { p } = await open(b, w, h); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
    const ids = await p.evaluate(() => { const d = window.__T.dbg(); return { accounts: d.accounts.map(a => a.id), loans: d.loans.map(l => l.id), banks: d.banks.map(x => x.id), cards: d.cards.map(c => c.id) } });
    let ok = 0, tot = 0;
    for (const [pg, act, list] of [['accounts', 'openAccount', ids.accounts], ['loans', 'openLoan', ids.loans], ['banks', 'openBank', ids.banks], ['cards', 'openCard', ids.cards]]) {
      for (const id of list) { tot++; await p.evaluate(async ([pg, act, id]) => { try { closeModal() } catch (_) { } window.__T.go(pg); await new Promise(r => setTimeout(r, 120)); const sels = [`[data-id="${id}"][data-act]`, `[data-act][data-id="${id}"]`]; const el = sels.map(s => document.querySelector(s)).find(Boolean); if (el) el.click(); await new Promise(r => setTimeout(r, 200)); }, [pg, act, id]); ok++ }
    }
    const antig = await p.evaluate(async () => { const d = window.__T.dbg(); const a = d.accounts.find(x => x.kind !== 'cash'); window.__T.go('accounts'); const el = document.querySelector(`[data-id="${a.id}"][data-act]`); el && el.click(); await new Promise(r => setTimeout(r, 400)); return /Antigüedad/i.test(document.body.innerText) });
    check('D-' + w, `Abrir el detalle de ${tot} productos (cuentas, préstamos, bancos, tarjetas) sin excepciones de página`, errs.length === 0, errs.slice(0, 3).join(' | '));
    if (w >= 700) check('D-' + w + 'b', 'El detalle de una cuenta (escritorio) muestra la sección «Antigüedad»', antig === true);
    await p.context().close();
  }
  console.log(fails ? `\nFALLAN: ${fails} de ${n}` : `\nOK: ${n} comprobaciones superadas`); await b.close(); process.exit(fails ? 1 : 0);
})();
