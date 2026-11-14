/* Prueba de humo: abre la app con datos de demostración y recorre las pantallas en escritorio y móvil.
   Uso:  npm i playwright && node tests/smoke.js   (no necesita servidor: el arnés sirve los archivos y simula Supabase)
   Falla (código 1) si hay errores de JavaScript, textos "undefined/NaN" o desbordes horizontales. */
const { chromium } = require('playwright');
const open = require('./harness.js');
const PAGES = ['overview','accounts','cards','loans','banks','categories','income','expenses','transactions','register','projection','patrimony','pressure','benefits','personal','payments','certificates','recurring'];
(async () => {
  const browser = await chromium.launch(); const problems = [];
  for (const [w, h, mobile] of [[1440, 900, false], [390, 844, true]]) {
    if (mobile) process.env.TOUCH = '1'; else delete process.env.TOUCH;
    const { ctx, p: page } = await open(browser, w, h);
    page.on('pageerror', e => problems.push(`[${w}] error JS: ${e.message}`));
    for (const k of PAGES) {
      const r = await page.evaluate(k => { try { window.__T.go(k); const a = document.getElementById('app');
        return { len: a.innerText.length, ov: document.documentElement.scrollWidth > innerWidth + 2, bad: /undefined|NaN|\[object/.test(a.innerText) }; } catch (e) { return { err: e.message }; } }, k);
      if (r.err || r.ov || r.bad || r.len < 80) problems.push(`[${w}] ${k}: ${JSON.stringify(r)}`);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(problems.length ? problems.join('\n') : 'OK: sin problemas'); process.exit(problems.length ? 1 : 0);
})();
