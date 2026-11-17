/* Recorrido E2E de todas las pantallas: errores de consola/página, red, desbordes, nombres accesibles y axe (WCAG 2.2 AA).
   Uso: AXE=/ruta/axe.min.js node tests/auditoria-recorrido.js [salida.json]   (THEME=black para el modo Black) */
const { chromium } = require('playwright');
const fs = require('fs');
const open = require('./harness.js');
const AXE = process.env.AXE ? fs.readFileSync(process.env.AXE, 'utf8') : null;
const PAGES = ['overview', 'register', 'income', 'expenses', 'wallet', 'banks', 'accounts', 'cards', 'loans', 'certificates', 'benefits', 'personal', 'payments', 'transactions', 'recurring', 'budget', 'annual', 'analytics', 'categories', 'advanced', 'patrimony', 'projection', 'pressure', 'mobilehub', 'mobilesearch', 'settings', 'score'];
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const [w, h, lab] of [[390, 844, 'móvil'], [1440, 900, 'escritorio']]) {
    const { p } = await open(b, w, h); const errs = [], cons = [], reqs = [];
    p.on('pageerror', e => errs.push(e.message.slice(0, 160))); p.on('console', m => { if (m.type() === 'error') cons.push(m.text().slice(0, 160)); }); p.on('requestfailed', r => reqs.push(r.url().slice(0, 90)));
    for (const pg of PAGES) {
      const e0 = errs.length, c0 = cons.length; const t0 = Date.now();
      await p.evaluate(pg => window.__T.go(pg), pg).catch(e => errs.push('go:' + e.message.slice(0, 80))); await p.waitForTimeout(500);
      const ms = Date.now() - t0 - 500;
      const m = await p.evaluate(() => {
        const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const name = e => (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title') || e.textContent || '').trim() || (e.querySelector('img[alt]') && e.querySelector('img[alt]').alt) || (e.id && document.querySelector('label[for="' + e.id + '"]')) || e.closest('label');
        const btns = [...document.querySelectorAll('button,[role=button],a[href],input:not([type=hidden]),select,textarea')].filter(vis);
        const noName = btns.filter(e => !name(e)).slice(0, 6).map(e => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + (e.dataset.act ? '[' + e.dataset.act + ']' : ''));
        const small = btns.filter(e => { const r = e.getBoundingClientRect(); return (r.width < 24 || r.height < 24) && !e.closest('.v905-date,label.switch'); }).length;
        const over = document.documentElement.scrollWidth > innerWidth + 2;
        const ids = {}; document.querySelectorAll('[id]').forEach(e => ids[e.id] = (ids[e.id] || 0) + 1); const dup = Object.keys(ids).filter(k => ids[k] > 1).slice(0, 5);
        return { noName, small, over, dup, text: document.body.innerText.length, nan: /NaN|undefined|\[object|Infinity/.test(document.getElementById('page')?.innerText || '') };
      });
      let ax = null;
      if (AXE) { await p.evaluate(AXE); ax = await p.evaluate(async () => { const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] }); return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes[0] && v.nodes[0].target.join(' ').slice(0, 80) })); }).catch(e => [{ id: 'axe-error', n: 0, ex: e.message.slice(0, 60) }]); }
      out.push({ vista: lab, pagina: pg, ms, errores: errs.slice(e0), consola: cons.slice(c0), ...m, axe: ax });
    }
    out.push({ vista: lab, pagina: '(red)', fallidas: [...new Set(reqs)].slice(0, 12) });
    await p.close();
  }
  await b.close();
  fs.writeFileSync(process.argv[2] || '/tmp/recorrido.json', JSON.stringify(out, null, 1));
  const bad = out.filter(o => o.pagina !== '(red)' && (o.errores.length || o.consola.length || o.over || o.nan));
  console.log('pantallas:', out.filter(o => o.pagina !== '(red)').length, '· con error/desborde/NaN:', bad.length);
  bad.forEach(o => console.log(' ✕', o.vista, o.pagina, JSON.stringify({ e: o.errores, c: o.consola, over: o.over, nan: o.nan }).slice(0, 220)));
})();
