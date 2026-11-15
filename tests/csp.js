/* Prueba de CSP: recorre las pantallas con la política de index.html y falla ante cualquier violación o recurso externo bloqueado. */
const { chromium } = require('playwright');
const open = require('./harness.js');
const PAGES = ['overview','accounts','cards','loans','banks','categories','income','expenses','transactions','register','projection','patrimony','pressure','benefits','personal','payments','certificates','recurring','advanced','settings'];
(async () => {
  const b = await chromium.launch(); const bad = [];
  for (const [w, h, t] of [[1440, 900, false], [390, 844, true]]) {
    if (t) process.env.TOUCH = '1'; else delete process.env.TOUCH;
    const { p, ctx } = await open(b, w, h);
    await p.exposeFunction('__cspBad', v => bad.push(v));
    await p.evaluate(() => document.addEventListener('securitypolicyviolation', e => window.__cspBad(`${e.violatedDirective} ← ${(e.blockedURI || '').slice(0, 60)}`)));
    p.on('console', m => { if (/Content Security Policy|violates the following/i.test(m.text())) bad.push(m.text().slice(0, 160)); });
    for (const k of PAGES) { await p.evaluate(k => { try { window.__T.go(k) } catch (e) {} }, k); await p.waitForTimeout(250); }
    await ctx.close();
  }
  await b.close();
  console.log(bad.length ? 'VIOLACIONES CSP:\n' + [...new Set(bad)].join('\n') : 'OK: sin violaciones de CSP');
  process.exit(bad.length ? 1 : 0);
})();
