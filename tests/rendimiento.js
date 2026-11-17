/* Rendimiento y bloqueos con historial grande (miles de movimientos). Falla si una pantalla tarda demasiado o si escribir un importe
   en el registro de gasto/ingreso (escritorio) deja la página sin responder.   Uso:  node tests/rendimiento.js */
const { chromium } = require('playwright');
const open = require('./harness.js');
const N = 3000, LIMIT = 4000;
const results = [];
const check = (n, name, ok, extra = '') => { results.push(ok); console.log(`${ok ? '✓' : '✕'} ${String(n).padStart(2)} ${name}${extra ? ' — ' + extra : ''}`); };
(async () => {
  const b = await chromium.launch();
  const { p } = await open(b, 1440, 900);
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await p.evaluate(n => { const d = window.__T.dbg(), acc = d.accounts[0].id, cats = ['Alimentación', 'Transporte', 'Vivienda', 'Salud', 'Educación', 'Servicios básicos', 'Entretenimiento']; for (let i = 0; i < n; i++) { const day = 1 + (i % 28), m = 1 + ((i / 28 | 0) % 12), y = 2022 + ((i / 336 | 0) % 5); d.transactions.push({ id: 'big-' + i, type: i % 5 === 0 ? 'income' : 'expense', date: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`, amount: 100 + (i * 37 % 5000), currency: 'DOP', accountId: acc, category: i % 5 === 0 ? 'Salario y nómina' : cats[i % cats.length], note: 'n' + i }); } }, N);
  const timed = async (fn) => { const t = Date.now(); const ok = await Promise.race([fn().then(() => true), new Promise(r => setTimeout(() => r(false), 20000))]); return ok ? Date.now() - t : -1; };
  const nav = id => p.evaluate(id => { const x = document.createElement('button'); x.dataset.act = 'navigate'; x.dataset.id = id; x.hidden = true; document.body.append(x); x.click(); }, id);
  const slow = [];
  for (const id of ['register', 'income', 'expenses', 'budget', 'overview', 'banks', 'categories']) { const ms = await timed(async () => { await nav(id); await p.evaluate(() => 1); }); if (ms < 0 || ms > LIMIT) slow.push(id + ':' + ms); }
  check(1, `Con ${N} movimientos cada pantalla principal abre en menos de ${LIMIT / 1000} s`, slow.length === 0, JSON.stringify(slow));
  const rows = await p.evaluate(() => { const x = document.createElement('button'); x.dataset.act = 'navigate'; x.dataset.id = 'register'; x.hidden = true; document.body.append(x); x.click(); return 0; });
  await p.waitForTimeout(800);
  const nrows = await p.evaluate(() => document.querySelectorAll('#ledger-world table tbody tr').length);
  check(2, 'El libro de escritorio dibuja solo las primeras filas y ofrece «Ver más movimientos»', nrows > 0 && nrows <= 260 && await p.evaluate(() => !!document.querySelector('.v51-desk-more')), 'filas=' + nrows);
  await p.evaluate(() => { [...document.querySelectorAll('button')].find(e => /Registrar movimiento/.test(e.textContent) && e.offsetParent).click(); }); await p.waitForTimeout(900);
  await p.evaluate(() => { [...document.querySelectorAll('#modal-root button')].find(e => /^Gasto/.test(e.textContent.trim()) && e.offsetParent).click(); }); await p.waitForTimeout(1500);
  const typing = await timed(async () => { await p.evaluate(() => { const e = document.querySelector('#modal-root input[name="amount"]'); e.value = '777'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(600); await p.evaluate(() => 1); });
  check(3, 'Escribir un importe en el registro de gasto (con asesor de capacidad y mucho historial) no congela la página', typing > 0 && typing < 5000, typing + ' ms');
  const storm = await p.evaluate(() => new Promise(res => { let c = 0; const mo = new MutationObserver(m => { c += m.length; }); mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true }); setTimeout(() => { mo.disconnect(); res(c); }, 1500); }));
  check(4, 'El formulario queda en reposo: sin cambios continuos del DOM (bucle de observadores)', storm < 50, 'mutaciones en 1,5 s: ' + storm);
  const antes = await p.evaluate(() => window.__T.dbg().transactions.length);
  await p.evaluate(() => { const bt = [...document.querySelectorAll('#modal-root button')].find(e => /^Alimentación/.test(e.textContent.trim()) && e.offsetParent); bt && bt.click(); }); await p.waitForTimeout(300);
  await p.evaluate(() => { [...document.querySelectorAll('#modal-root button')].find(e => /Registrar egreso/.test(e.textContent) && e.offsetParent).click(); }); await p.waitForTimeout(2800);
  const despues = await p.evaluate(() => window.__T.dbg().transactions.length);
  check(5, 'Guardar el gasto crea exactamente un movimiento (sin duplicados)', despues === antes + 1, antes + ' → ' + despues);
  check(6, 'Sin errores de página', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await b.close();
  const f = results.filter(x => !x).length; console.log(f ? `\nFALLAN ${f} de ${results.length}` : `\nOK: ${results.length} comprobaciones superadas`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
