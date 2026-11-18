/* Métricas y pruebas de las mejoras de experiencia (IMPLEMENTACION-04).  Uso: node tests/experiencia-04.js  → imprime las métricas y falla si no se cumplen los umbrales */
const { chromium } = require('playwright');
const open = require('./harness.js');
const PAGES = ['overview', 'register', 'income', 'expenses', 'wallet', 'banks', 'accounts', 'cards', 'loans', 'certificates', 'benefits', 'personal', 'payments', 'transactions', 'recurring', 'budget', 'annual', 'analytics', 'categories', 'advanced', 'patrimony', 'projection', 'pressure', 'mobilehub', 'mobilesearch', 'settings'];
let fails = 0; const M = {};
const check = (id, name, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '✓' : '✕'} ${id} ${name}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`); };
(async () => {
  const b = await chromium.launch();
  /* UX-04 / UX-06 · texto mínimo y objetivos táctiles (móvil y escritorio) */
  for (const [w, h, lab] of [[390, 844, 'móvil'], [1440, 900, 'escritorio']]) {
    const { p } = await open(b, w, h); let tot = 0, pequeno = 0, mini = 0, tgt = 0, errT = [];
    for (const pg of PAGES) { await p.evaluate(pg => window.__T.go(pg), pg).catch(() => {}); await p.waitForTimeout(330);
      const r = await p.evaluate(() => { let t = 0, s = 0, m = 0, g = 0; const bad = [];
        document.querySelectorAll('#app *').forEach(e => { if (e.closest('#modal-root')) return; const r = e.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return; const cs = getComputedStyle(e); if (cs.visibility === 'hidden') return;
          if (e.children.length === 0 && (e.textContent || '').trim().length > 1) { t++; const f = parseFloat(cs.fontSize); if (f < 12) s++; if (f < 11) m++; }
          if (e.matches('button,a[href],[role=button],input:not([type=hidden]),select,summary') && (r.width < 24 || r.height < 24)) { g++; bad.push(e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); } });
        return { t, s, m, g, bad: bad.slice(0, 3) }; });
      tot += r.t; pequeno += r.s; mini += r.m; tgt += r.g; if (r.bad.length) errT.push(...r.bad); }
    M[lab] = { textos: tot, menor12: +(100 * pequeno / tot).toFixed(1), menor11: +(100 * mini / tot).toFixed(1), objetivosMenor24: tgt };
    check('UX-04-' + lab, 'No más del 1 % de los textos mide menos de 11 px (la cola restante son caras de tarjeta y reglas heredadas)', mini / tot <= 0.01, `${mini} de ${tot} (${(100 * mini / tot).toFixed(1)} %); <12 px: ${(100 * pequeno / tot).toFixed(1)} %`);
    check('UX-06-' + lab, 'Todo control interactivo mide al menos 24×24 px (WCAG 2.5.8)', tgt === 0, `${tgt} ${errT.slice(0, 3).join(' | ')}`);
    await p.close(); }
  /* UX-09 · aviso de conexión */
  { const { ctx, p } = await open(b, 390, 844); await p.evaluate(() => window.__T.go('overview')); await p.waitForTimeout(500);
    await ctx.setOffline(true); await p.evaluate(() => window.dispatchEvent(new Event('offline'))); await p.waitForTimeout(500);
    const off = await p.evaluate(() => { const e = document.querySelector('[data-net-banner]'); return e ? { rol: e.getAttribute('role'), vis: e.offsetParent !== null || getComputedStyle(e).position === 'fixed', txt: e.textContent.trim().slice(0, 80) } : null; });
    await ctx.setOffline(false); await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(700);
    const on = await p.evaluate(() => { const e = document.querySelector('[data-net-banner]'); return !e || e.hidden || getComputedStyle(e).display === 'none'; });
    check('UX-09', 'Sin conexión aparece un aviso accesible (role=status) y desaparece al reconectar', !!off && off.rol === 'status' && off.vis && /conexi/i.test(off.txt) && on, JSON.stringify(off) + ' oculto al volver=' + on);
    await p.close(); }
  /* Prevención y recuperación de errores · mensajes de formulario anunciados */
  { const { p } = await open(b, 390, 844); const res = [];
    for (const [pg, re] of [['accounts', /Agregar|Nueva/], ['cards', /Agregar|Nueva/], ['income', /Agregar fuente/]]) { await p.evaluate(pg => window.__T.go(pg), pg); await p.waitForTimeout(450); if (pg === 'income') { await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(e => /Ingresos recurrentes/.test(e.textContent) && e.offsetParent); b && b.click(); }); await p.waitForTimeout(800); }
      await p.evaluate(re => { const bt = [...document.querySelectorAll('#page button')].find(e => new RegExp(re).test(e.textContent) && e.offsetParent); bt && bt.click(); }, re.source); await p.waitForTimeout(600);
      res.push(await p.evaluate(() => { const e = document.querySelector('#modal-root .input-error,#modal-root #formError'); return e ? (e.getAttribute('role') === 'alert' || e.getAttribute('aria-live') != null) : 'sin-contenedor'; })); await p.evaluate(() => { try { closeModal(); } catch (_) {} }); }
    check('ERR-01', 'El contenedor de errores de cada formulario se anuncia a lectores de pantalla (role=alert / aria-live)', res.every(x => x === true), JSON.stringify(res));
    await p.close(); }
  /* Movimiento reducido */
  { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); const { p } = await (async () => { const o = require('./harness.js'); process.env.__RM = '1'; return o(b, 390, 844); })();
    await p.emulateMedia({ reducedMotion: 'reduce' }); await p.evaluate(() => window.__T.go('overview')); await p.waitForTimeout(600);
    const n = await p.evaluate(() => { let a = 0, t = 0; document.querySelectorAll('#app *').forEach(e => { const cs = getComputedStyle(e); const dur = Math.max(...cs.animationDuration.split(',').map(x => parseFloat(x) || 0)); const td = Math.max(...cs.transitionDuration.split(',').map(x => parseFloat(x) || 0)); if (cs.animationName !== 'none' && dur > 0.05) a++; if (td > 0.05) t++; }); return { animaciones: a, transiciones: t }; });
    check('MOV-01', 'Con «reducir movimiento» activo no quedan animaciones ni transiciones de más de 50 ms (WCAG 2.3.3)', n.animaciones === 0 && n.transiciones === 0, JSON.stringify(n)); M.movimiento = n; await ctx.close(); await p.close(); }
  /* UX-07 · indicación de desplazamiento horizontal en tablas móviles */
  { const { p } = await open(b, 390, 844); await p.evaluate(() => window.__T.go('income')); await p.waitForTimeout(600);
    const r = await p.evaluate(() => { const t = document.querySelector('#page .table-wrap'); if (!t) return null; const cs = getComputedStyle(t); return { desborda: t.scrollWidth > t.clientWidth, indicador: cs.backgroundImage !== 'none' || t.hasAttribute('data-scroll-hint') || getComputedStyle(t, '::after').content !== 'none' }; });
    check('UX-07', 'Las tablas que se desplazan en horizontal muestran un indicador de que hay más contenido', !!r && (!r.desborda || r.indicador), JSON.stringify(r)); await p.close(); }
  /* UX-02 · campo de búsqueda móvil con indicador de foco */
  { const { p } = await open(b, 390, 844); await p.evaluate(() => window.__T.go('mobilesearch')); await p.waitForTimeout(500); await p.evaluate(() => { document.activeElement && document.activeElement.blur(); });
    let ok = null; for (let i = 0; i < 12 && ok === null; i++) { await p.keyboard.press('Tab'); await p.waitForTimeout(140); ok = await p.evaluate(() => { const e = document.activeElement; if (!e || e.tagName !== 'INPUT') return null; const cs = getComputedStyle(e); return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' || (e.parentElement && getComputedStyle(e.parentElement).boxShadow !== 'none'); }); }
    check('UX-02b', 'El campo de búsqueda móvil muestra un indicador de foco', ok === true, String(ok)); await p.close(); }
  await b.close(); console.log('\nMÉTRICAS', JSON.stringify(M)); console.log(fails ? `FALLAN: ${fails}` : 'OK'); process.exit(fails ? 1 : 0);
})();
