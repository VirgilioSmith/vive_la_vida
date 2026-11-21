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
    // Regresión V1283/V1285: el botón inferior de «Nueva tarjeta» y el scroll del formulario deben ser accesibles.
    try {
      await page.evaluate(() => window.__T.go('cards'));
      await page.locator('[data-act="addCard"]').first().click({timeout:5000});
      await page.waitForTimeout(650);
      const formCheck = await page.evaluate(() => {
        const f=document.getElementById('cardForm'),g=f?.querySelector('.form-grid'),foot=f?.querySelector('.form-foot');
        const b=[...(foot?.querySelectorAll('button')||[])].find(el=>!el.hidden&&getComputedStyle(el).display!=='none');
        if(!f||!g||!b)return {missing:true};
        const box=b.getBoundingClientRect(),needsScroll=g.scrollHeight>g.clientHeight+3;
        g.scrollTop=g.scrollHeight;
        const hit=document.elementFromPoint(box.left+box.width/2,box.top+box.height/2);
        return {missing:false,needsScroll,scrollTop:g.scrollTop,overflow:getComputedStyle(g).overflowY,buttonInViewport:box.top>=0&&box.bottom<=innerHeight,buttonClickable:!!hit&&(hit===b||b.contains(hit))};
      });
      if(formCheck.missing||!formCheck.buttonInViewport||!formCheck.buttonClickable||(formCheck.needsScroll&&formCheck.scrollTop<1)){
        problems.push(`[${w}] Nueva tarjeta, pie de formulario inaccesible: ${JSON.stringify(formCheck)}`);
      }
    } catch (e) {problems.push(`[${w}] Nueva tarjeta, error Playwright: ${e.message}`)}
    await ctx.close();
  }
  await browser.close();
  console.log(problems.length ? problems.join('\n') : 'OK: sin problemas'); process.exit(problems.length ? 1 : 0);
})();
