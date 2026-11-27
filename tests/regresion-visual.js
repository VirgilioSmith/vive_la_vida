/* NOTA: 8 capturas se excluyeron de la línea base por no ser deterministas (hora visible o animaciones de gráfico): register 390 (claro y Black), patrimonio/suscripciones/entre personas 1440 en Black.
   Regresión visual por huella: captura 18 vistas × (web 1440, móvil 390) × (Claro, Black) y compara el hash de cada captura contra
   tests/regresion-visual.base.json. Uso:
     node tests/regresion-visual.js --base     genera/actualiza la línea base
     node tests/regresion-visual.js            compara (código de salida 1 si hay diferencias) */
const { chromium } = require('playwright');
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const open = require('./harness.js');
const BASE = path.join(__dirname, 'regresion-visual.base.json');
const PAGES = ['overview', 'advanced', 'patrimony', 'recurring', 'personal', 'banks', 'accounts', 'cards', 'loans', 'certificates', 'register', 'income', 'expenses', 'budget', 'categories', 'vision', 'pressure', 'score'];
const STILL = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}html{scroll-behavior:auto!important}';
/* No deterministas (hora visible o animaciones de gráfico): se excluyen de la línea base */
const NOISY = ['light/390/register', 'black/390/register', 'black/1440/patrimony', 'black/1440/recurring', 'black/1440/personal'];
(async () => {
  const mk = process.argv.includes('--base');
  const b = await chromium.launch(); const got = {};
  for (const theme of ['light', 'black']) for (const [w, h, t] of [[1440, 900, ''], [390, 844, '1']]) {
    process.env.THEME = theme; process.env.TOUCH = t;
    const { p } = await open(b, w, h); await p.addStyleTag({ content: STILL });
    for (const pg of PAGES) {
      await p.evaluate(x => window.__T.go(x), pg); await p.waitForTimeout(pg === 'score' ? 1800 : 800);
      const buf = await p.screenshot({ fullPage: false });
      got[`${theme}/${w}/${pg}`] = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
    }
    await p.context().close();
  }
  await b.close();
  for (const k of NOISY) delete got[k];
  if (mk) { fs.writeFileSync(BASE, JSON.stringify(got, null, 1)); console.log('Línea base escrita:', Object.keys(got).length, 'capturas'); return; }
  const base = JSON.parse(fs.readFileSync(BASE, 'utf8')); const diff = Object.keys(base).filter(k => !NOISY.includes(k) && base[k] !== got[k]);
  console.log(diff.length ? `DIFERENCIAS (${diff.length}/${Object.keys(base).length}): ${diff.join(', ')}` : `OK: ${Object.keys(base).length} capturas idénticas a la línea base`);
  process.exit(diff.length ? 1 : 0);
})();
