/* Prueba de XSS: llena todos los campos de texto libre con cargas maliciosas, recorre pantallas y modales,
   y falla si se ejecuta código (window.__xss) o aparece un elemento inyectado en el DOM. */
const { chromium } = require('playwright');
const open = require('./harness.js');
const PAY = [`<img src=x onerror="window.__xss=1">`, `"><svg onload="window.__xss=2">`, `<script>window.__xss=3</script>`, `'><iframe srcdoc="<script>parent.__xss=4</script>">`];
const FIELDS = ['name', 'note', 'description', 'merchant', 'payee', 'person', 'tags', 'bank', 'bankName', 'title', 'label', 'cardLabel', 'subcategory', 'counterparty'];
const PAGES = ['overview','accounts','cards','loans','banks','categories','income','expenses','transactions','register','projection','patrimony','pressure','benefits','personal','payments','certificates','recurring','advanced','settings','wallet','mobilehub'];
(async () => {
  const b = await chromium.launch(); const problems = [];
  for (const [w, h, t] of [[1440, 900, false], [390, 844, true]]) {
    if (t) process.env.TOUCH = '1'; else delete process.env.TOUCH;
    const { p, ctx } = await open(b, w, h);
    p.on('pageerror', e => { if (!/xss/i.test(e.message)) return; problems.push('error: ' + e.message); });
    await p.evaluate(([PAY, FIELDS]) => {
      let n = 0;
      const walk = (o, depth) => { if (!o || typeof o !== 'object' || depth > 6) return;
        for (const k of Object.keys(o)) { const v = o[k];
          if (typeof v === 'string' && FIELDS.includes(k)) o[k] = PAY[n++ % PAY.length] + ' ' + v.slice(0, 20);
          else walk(v, depth + 1); } };
      const d = window.__T.dbg(); walk(d, 0); window.__T.inv && window.__T.inv();
    }, [PAY, FIELDS]);
    for (const k of PAGES) {
      await p.evaluate(k => { try { window.__T.go(k) } catch (e) {} }, k); await p.waitForTimeout(250);
      const r = await p.evaluate(() => ({ x: window.__xss, inj: document.querySelectorAll('#app img[src="x"], #modal-root img[src="x"], #app svg[onload], #app iframe[srcdoc], #modal-root iframe[srcdoc], #app script, #modal-root script, [onerror], [onload]').length }));
      if (r.x || r.inj) problems.push(`[${w}] ${k}: xss=${r.x || 0} inyectados=${r.inj}`);
    }
    // modales de detalle/edición
    for (const act of ['newTransaction', 'addAccount', 'addCard', 'addLoan', 'addRecurring', 'addPersonal', 'addCategory']) {
      await p.evaluate(a => { const b = document.createElement('button'); b.dataset.act = a; document.body.appendChild(b); try { b.click() } catch (e) {} b.remove(); }, act); await p.waitForTimeout(200);
      const r = await p.evaluate(() => ({ x: window.__xss, inj: document.querySelectorAll('#modal-root img[src="x"], #modal-root svg[onload], #modal-root script, #modal-root [onerror], #modal-root [onload]').length }));
      if (r.x || r.inj) problems.push(`[${w}] modal ${act}: xss=${r.x || 0} inyectados=${r.inj}`);
      await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; });
    }
    await ctx.close();
  }
  await b.close();
  console.log(problems.length ? 'XSS:\n' + [...new Set(problems)].join('\n') : 'OK: ninguna carga se ejecutó ni se inyectó en el DOM');
  process.exit(problems.length ? 1 : 0);
})();
