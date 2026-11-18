/* Red team · ataque visual: nombres larguísimos, importes máximos, emoji, texto del sistema ampliado, 320–1440 px, Claro/Black y acentos.
   Detecta desborde horizontal de la página, elementos fuera de pantalla y modales recortados. Uso: node tests/red-team-visual.js */
const { chromium } = require('playwright');
const open = require('./harness.js');
const PAGES = ['overview', 'cards', 'banks', 'accounts', 'register', 'payments', 'income', 'budget', 'recurring', 'personal', 'loans', 'certificates', 'benefits', 'advanced', 'kpis', 'patrimony', 'categories', 'settings'];
const LONG = 'Institución Financiera Internacional del Caribe y Latinoamérica Sociedad Anónima Simplificada 😀😀😀';
let fails = 0, n = 0; const check = (id, name, ok, extra = '') => { n++; if (!ok) fails++; console.log(`${ok ? '✓' : '✕'} ${id} ${name}${extra ? ' — ' + String(extra).slice(0, 360) : ''}`); };
(async () => {
  const b = await chromium.launch(); const issues = {}, truncs = {};
  for (const th of ['light', 'black']) for (const [w, h, touch] of [[320, 568, '1'], [390, 844, '1'], [768, 1024, '1'], [1440, 900, '']]) for (const zoom of [100, 150]) {
    process.env.THEME = th; process.env.TOUCH = touch; const { p } = await open(b, w, h); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 140)));
    await p.evaluate(LONG => {
      const d = window.__T.dbg();
      d.banks.forEach((x, i) => { x.name = LONG.slice(0, 60 + i * 10) }); d.accounts.forEach((x, i) => { x.name = LONG; x.opening = 9999999999.99 - i });
      d.cards.forEach(x => { x.name = LONG; x.limit = 9999999999.99; x.limitDop = 9999999999.99 }); d.loans.forEach(x => { x.name = LONG });
      d.transactions.slice(0, 40).forEach((t, i) => { t.note = LONG; t.amount = 9999999999.99 - i });
    }, LONG);
    if (zoom !== 100) await p.evaluate(z => { document.documentElement.style.fontSize = z + '%' }, zoom);
    for (const pg of PAGES) {
      await p.evaluate(x => { try { closeModal() } catch (_) { } window.__T.go(x) }, pg); await p.waitForTimeout(220);
      const r = await p.evaluate(() => { const vw = document.documentElement.clientWidth; const ovf = document.documentElement.scrollWidth - vw; const off = []; { document.querySelectorAll('#app *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width > 0 && r.right > vw + 2 && off.length < 3) { let s = e, scroll = false; while (s && s !== document.body) { const o = getComputedStyle(s).overflowX; if ((o === 'auto' || o === 'scroll' || o === 'hidden') && s !== e && s.getBoundingClientRect().right <= vw + 2) { scroll = true; break } s = s.parentElement } if (!scroll) off.push((e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : e.tagName) + ' +' + Math.round(r.right - vw)) } }) } const trunc = []; document.querySelectorAll('#app *').forEach(e => { if (e.children.length === 0 && e.scrollWidth > e.clientWidth + 1 && /RD\$|US\$|\d{1,3}(,\d{3}){2,}/.test(e.textContent) && getComputedStyle(e).textOverflow === 'ellipsis' && e.getBoundingClientRect().width > 0 && trunc.length < 3) trunc.push(e.textContent.trim().slice(0, 18)) });
      return { ovf, off, trunc } });
      if (r.trunc.length) truncs[`${pg}|${w}|${th}|z${zoom}`] = r.trunc;
      if (r.off.length) { const k = `${pg}|${w}|${th}|z${zoom}`; issues[k] = r }
    }
    // un modal con campos (formularios largos) recortado
    for (const kind of ['expense', 'transfer']) {
      const m = await p.evaluate(async kind => { try { closeModal() } catch (_) { } const x = document.createElement('button'); x.dataset.act = 'newTransaction'; x.dataset.type = kind; x.hidden = true; document.body.append(x); x.click(); x.remove(); await new Promise(r => setTimeout(r, 250)); const mo = document.querySelector('#modal-root .modal'); if (!mo) return null; const r = mo.getBoundingClientRect(); const vw = innerWidth, vh = innerHeight; const act = [...mo.querySelectorAll('button')].filter(e => e.offsetParent && /Siguiente|Continuar|Confirmar|Guardar/i.test(e.textContent)); return { right: Math.round(r.right - vw), left: Math.round(r.left), bottom: Math.round(r.bottom - vh), btnReach: act.length ? act.every(e => { const q = e.getBoundingClientRect(); return q.right <= vw + 2 && q.left >= -2 && q.top < vh }) : true } }, kind);
      if (m && (m.right > 2 || m.left < -2 || !m.btnReach)) issues[`modal-${kind}|${w}|${th}|z${zoom}`] = { ovf: 0, off: [JSON.stringify(m)] };
    }
    if (errs.length) issues[`errores|${w}|${th}|z${zoom}`] = { ovf: 0, off: errs.slice(0, 2) };
    await p.context().close();
  }
  const keys = Object.keys(issues); const agg = {}; for (const k of keys) { const [pg] = k.split('|'); (agg[pg] ||= []).push(k.split('|').slice(1).join('/') + ' ' + (issues[k].off.join(', ') || issues[k].ovf + 'px')); }
  for (const [pg, list] of Object.entries(agg)) console.log(`   ${pg}: ${list.length} combinaciones · ej.: ${list.slice(0, 3).join(' ; ')}`);
  const tk = Object.keys(truncs); const t100 = tk.filter(k => k.endsWith('z100'));
  console.log('   importes truncados (…): ' + tk.length + ' combinaciones; a texto 100 %: ' + t100.length + (tk.length ? ' · ej.: ' + tk.slice(0, 4).map(k => k + ' «' + truncs[k][0] + '»').join(' ; ') : ''));
  // Informativo: con importes de 11 cifras (10 000 millones) a 320 px algunas cifras se abrevian con «…»; no se trata como fallo porque supera el uso real.
  check('V1', 'Ninguna pantalla desborda horizontalmente ni recorta botones con datos extremos (320–1440 px, Claro/Black, texto 100 %/150 %)', keys.length === 0, keys.length + ' combinaciones con problema');
  console.log(fails ? `\nFALLAN: ${fails} de ${n}` : `\nOK: ${n} comprobaciones superadas`); await b.close(); process.exit(fails ? 1 : 0);
})();
