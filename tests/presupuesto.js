/* Presupuesto: asignación guiada con el selector universal (categoría → toda la categoría o subcategoría → importe). */
const { chromium } = require('playwright');
const open = require('./harness.js');
let fails = 0, n = 0; const check = (id, name, ok, extra = '') => { n++; if (!ok) fails++; console.log(`${ok ? '✓' : '✕'} ${id} ${name}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`); };
const txt = p => p.evaluate(() => (document.querySelector('[class*=picker]')?.innerText || '').replace(/\s+/g, ' '));
const pick = (p, re) => p.evaluate(re => { const r = [...document.querySelectorAll('[class*=picker] button,[class*=picker] [role=option]')].find(e => new RegExp(re).test(e.textContent)); r && r.click(); return !!r }, re);
const cont = p => p.evaluate(() => { const c = [...document.querySelectorAll('button')].find(e => /^Continuar/.test(e.textContent.trim()) && e.offsetParent); c && c.click(); return !!c });
(async () => {
  const b = await chromium.launch();
  for (const [w, h, t] of [[390, 844, '1'], [1440, 900, '']]) {
    process.env.TOUCH = t; const { p } = await open(b, w, h); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
    await p.evaluate(() => window.__T.go('budget')); await p.waitForTimeout(500);
    await p.evaluate(() => document.querySelector('[data-act=addBudget]').click()); await p.waitForTimeout(500);
    let s = await txt(p); check('P1-' + w, '«Definir presupuesto» abre el selector universal de categorías con gastado y límite de cada una', /Selecciona la categoría/.test(s) && /Gastado RD\$/.test(s) && /Alimentación/.test(s), s.slice(0, 140));
    await pick(p, 'Transporte'); await p.waitForTimeout(250); await cont(p); await p.waitForTimeout(500); s = await txt(p);
    check('P2-' + w, 'Al elegir la categoría pregunta dónde asignar: «Toda la categoría» o una subcategoría', /¿Dónde asignas el presupuesto de Transporte\?/.test(s) && /Toda la categoría/.test(s) && /Combustible/.test(s), s.slice(0, 160));
    await pick(p, 'Combustible'); await p.waitForTimeout(250); await cont(p); await p.waitForTimeout(700);
    let f = await p.evaluate(() => ({ cat: document.querySelector('#budgetCategory')?.value, sub: document.querySelector('[name=subcategory]')?.value }));
    check('P3-' + w, 'Elegir una subcategoría abre el importe con categoría y subcategoría ya fijadas', f.cat === 'Transporte' && f.sub === 'Combustible', JSON.stringify(f));
    await p.evaluate(() => { try { closeModal() } catch (_) { } });
    await p.evaluate(() => document.querySelector('[data-act=editBudget][data-cat="Transporte"]')?.click()); await p.waitForTimeout(500); s = await txt(p);
    check('P4-' + w, 'El botón de una tarjeta de categoría salta directo a la pregunta de «dónde asignar»', /¿Dónde asignas el presupuesto de Transporte\?/.test(s), s.slice(0, 100));
    await pick(p, 'Toda la categoría'); await p.waitForTimeout(250); await cont(p); await p.waitForTimeout(700);
    f = await p.evaluate(() => ({ cat: document.querySelector('#budgetCategory')?.value, sub: document.querySelector('[name=subcategory]')?.value }));
    const before = await p.evaluate(() => window.__T.dbg().budgetVersions?.length || 0);
    await p.evaluate(() => { const fm = document.querySelector('#budgetForm'); const a = fm.elements.amount; a.value = '9000'; a.dispatchEvent(new Event('input', { bubbles: true })); fm.requestSubmit() }); await p.waitForTimeout(700);
    const after = await p.evaluate(() => { const v = window.__T.dbg().budgetVersions || []; return { n: v.length, last: v.find(x => x.category === 'Transporte' && !x.subcategory && x.amount === 9000) } });
    check('P5-' + w, '«Toda la categoría» guarda un límite general (sin subcategoría) de la categoría', f.sub === '' && after.last && after.n >= before, JSON.stringify({ f, after: { n: after.n, last: !!after.last } }));
    check('P6-' + w, 'Sin errores de página', errs.length === 0, errs.join('|')); await p.context().close();
  }
  console.log(fails ? `\nFALLAN: ${fails} de ${n}` : `\nOK: ${n} comprobaciones superadas`); await b.close(); process.exit(fails ? 1 : 0);
})();
