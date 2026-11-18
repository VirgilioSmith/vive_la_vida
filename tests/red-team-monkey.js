/* Red team · monkey/fuzz con semilla. Secuencias aleatorias de clics y entradas hostiles sobre datos sintéticos; comprueba invariantes tras cada paso.
   Uso: SEED=1 STEPS=400 W=390 node tests/red-team-monkey.js   (mismo SEED = misma secuencia) */
const { chromium } = require('playwright');
const open = require('./harness.js');
const SEED = +(process.env.SEED || 1), STEPS = +(process.env.STEPS || 300), W = +(process.env.W || 390), H = +(process.env.H || 844);
process.env.TOUCH = W < 700 ? '1' : '';
let a = SEED >>> 0; const rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const POOL = ['', '0', '-1', '-0.01', '0.001', '1e309', '99999999999999999', '1e21', 'NaN', '٣٤٥', '12,50', '1.2.3', '<img src=x onerror=window.__pwn=1>', '"; DROP TABLE x;--', '😀'.repeat(40), 'A'.repeat(400), '   ', '2026-02-30', '0000-00-00', '9999-12-31', '12345.678'];
const PAGES = ['overview', 'cards', 'banks', 'accounts', 'register', 'payments', 'income', 'budget', 'recurring', 'personal', 'loans', 'certificates', 'benefits', 'advanced', 'kpis', 'patrimony', 'categories', 'settings'];
let typedNaN = false; // «NaN» escrito por el propio mono puede reaparecer legítimamente como eco (búsqueda, nombre)
(async () => {
  const b = await chromium.launch(); const { p } = await open(b, W, H);
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200))); p.on('dialog', d => d.dismiss().catch(() => {}));
  const trace = []; let fails = 0;
  const bad = async (step) => {
    const r = await p.evaluate(() => {
      const t = document.body.innerText; const m = t.replace(/Infinite \/ Infinity/g, '').match(window.__noNaN ? /.{0,40}\b(Infinity|undefined|\[object Object\])\b.{0,40}/ : /.{0,40}\b(NaN|Infinity|undefined|\[object Object\])\b.{0,40}/);
      const d = window.__T.dbg(); const nonfinite = [];
      for (const x of (d.accounts || [])) { try { const v = window.__T.fn.getAccountBalance(x); if (!Number.isFinite(v)) nonfinite.push('saldo ' + x.name) } catch (e) { nonfinite.push('error saldo ' + x.name + ':' + e.message) } }
      for (const x of (d.transactions || [])) if (x.amount !== undefined && (!Number.isFinite(Number(x.amount)) || Math.abs(Number(x.amount)) > 1e10)) nonfinite.push('mov fuera de rango ' + x.id);
      return { bad: m && m[0], nonfinite: nonfinite.slice(0, 3), pwn: window.__pwn, modals: document.querySelectorAll('#modal-root .modal').length, dom: document.getElementsByTagName('*').length, ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    const issues = [];
    if (r.bad) issues.push('texto: ' + r.bad); if (r.nonfinite.length) issues.push('no finito: ' + r.nonfinite.join(',')); if (r.pwn) issues.push('XSS ejecutado'); if (r.modals > 2) issues.push('modales apilados: ' + r.modals); if (r.ovf > 2) issues.push('desborde horizontal ' + r.ovf + 'px');
    if (errs.length) issues.push('pageerror: ' + errs.splice(0).join(' | '));
    return { issues, dom: r.dom };
  };
  let dom0 = null, domN = 0; const found = [];
  for (let i = 0; i < STEPS; i++) {
    const kind = rnd(); let desc = '';
    try {
      if (kind < .08) { const pg = pick(PAGES); desc = 'ir ' + pg; await p.evaluate(x => { try { closeModal() } catch (_) { } window.__T.go(x) }, pg); }
      else if (kind < .55) { const idx = Math.floor(rnd() * 1e6); desc = 'clic#' + idx; desc += await p.evaluate(idx => { const els = [...document.querySelectorAll('button,[data-act],a[href^="#"],summary,[role=button],[role=tab],input[type=checkbox],input[type=radio]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.disabled && !/Cerrar sesión|logout|signOut/i.test(e.textContent + (e.dataset.act || '')) }); if (!els.length) return ' (sin objetivos)'; const e = els[idx % els.length]; const label = (e.textContent || e.ariaLabel || e.dataset.act || e.tagName).trim().slice(0, 30); e.click(); return ' «' + label + '»'; }, idx); }
      else if (kind < .85) { const idx = Math.floor(rnd() * 1e6), v = pick(POOL); desc = `escribir ${JSON.stringify(v).slice(0, 30)}`; if (v === 'NaN') await p.evaluate(() => { window.__noNaN = true }); desc += await p.evaluate(([idx, v]) => { const els = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]),textarea,select')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.disabled && !e.readOnly }); if (!els.length) return ' (sin campos)'; const e = els[idx % els.length]; if (e.tagName === 'SELECT') { e.selectedIndex = idx % Math.max(1, e.options.length); } else { try { e.value = v } catch (_) { } } e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return ' en ' + (e.name || e.id || e.tagName); }, [idx, v]); }
      else if (kind < .93) { desc = 'Escape'; await p.keyboard.press('Escape'); }
      else if (kind < .97) { desc = 'enviar formulario'; desc += await p.evaluate(() => { const f = [...document.querySelectorAll('#modal-root form')].pop(); if (!f) return ' (sin formulario)'; (f.querySelector('[type=submit]') || f).click?.(); return ' ' + (f.id || f.className).slice(0, 30) }); }
      else { desc = 'doble clic rápido'; await p.evaluate(() => { const els = [...document.querySelectorAll('#modal-root button.primary,#modal-root [type=submit],#modal-root .v901-next,#modal-root [data-v48-next]')].filter(e => e.offsetParent); const e = els[0]; if (e) { e.click(); e.click(); e.click() } }); }
      await p.waitForTimeout(40);
    } catch (e) { desc += ' !' + e.message.slice(0, 60); }
    trace.push(desc); if (trace.length > 12) trace.shift();
    const r = await bad(i); if (dom0 === null && i > 20) dom0 = r.dom; domN = r.dom;
    if (r.issues.length) { fails++; found.push({ step: i, issues: r.issues, trace: trace.slice() }); console.log(`✕ paso ${i}: ${r.issues.join(' ; ')}\n   últimos pasos: ${trace.slice(-6).join(' → ')}`); if (found.length >= 5) break; }
  }
  console.log(`semilla ${SEED} · ${W}px · ${STEPS} pasos · DOM ${dom0}→${domN}`);
  console.log(fails ? `FALLAN: ${fails}` : 'OK: sin hallazgos');
  await b.close(); process.exit(fails ? 1 : 0);
})();
