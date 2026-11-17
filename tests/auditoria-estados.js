/* Auditoría dinámica de estados: teclado y foco, responsive por 9 anchos, scroll innecesario, desconexión, red lenta, interacciones repetidas
   y consistencia de dimensiones.  Uso: OUT=/tmp/estados.json node tests/auditoria-estados.js */
const { chromium } = require('playwright');
const fs = require('fs');
const open = require('./harness.js');
const PAGES = ['overview', 'register', 'income', 'expenses', 'wallet', 'banks', 'accounts', 'cards', 'loans', 'certificates', 'benefits', 'personal', 'payments', 'transactions', 'recurring', 'budget', 'annual', 'analytics', 'categories', 'advanced', 'patrimony', 'projection', 'pressure', 'mobilehub', 'mobilesearch', 'settings'];
const res = { responsive: [], teclado: [], scroll: [], consistencia: {}, estados: {}, concurrencia: {} };
(async () => {
  const b = await chromium.launch();
  /* 1 · Responsive y scroll por ancho */
  for (const [w, h] of [[320, 568], [360, 640], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [844, 390]]) {
    const { p } = await open(b, w, h);
    for (const pg of PAGES) {
      await p.evaluate(pg => window.__T.go(pg), pg).catch(() => {}); await p.waitForTimeout(380);
      const m = await p.evaluate(() => {
        const iw = innerWidth, ih = innerHeight, de = document.documentElement;
        const wide = [...document.querySelectorAll('#page *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > iw + 2 && !e.closest('.table-scroll,.matrix-scroll,.matrix-table-scroll,[class*=scroll],[class*=carousel],[class*=strip]') && getComputedStyle(e).position !== 'fixed'; }).slice(0, 3).map(e => (e.tagName + '.' + String(e.className).split(' ')[0]).slice(0, 40));
        const nav = document.querySelector('.v953-mobile-nav,.mobile-nav,nav.bottom,#mobileNav,.vive-dock,[class*=dock]');
        const fixedBottom = [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.position === 'fixed' && r.bottom >= ih - 4 && r.width > iw * 0.5 && r.height > 30 && r.height < 140; })[0];
        const last = [...document.querySelectorAll('#page *')].filter(e => { const r = e.getBoundingClientRect(); return r.height > 8 && r.width > 40 && e.children.length === 0 && (e.textContent || '').trim(); }).sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
        let hiddenBehind = false; if (fixedBottom && last) { const fr = fixedBottom.getBoundingClientRect(), lr = last.getBoundingClientRect(); const docBottom = lr.bottom + scrollY; hiddenBehind = (de.scrollHeight - fr.height < docBottom - 2) && (lr.top < fr.top && lr.bottom > fr.top - 6 && scrollY + ih >= de.scrollHeight - 2); }
        return { sw: de.scrollWidth, iw, sh: de.scrollHeight, ih, wide, hiddenBehind, nav: !!fixedBottom };
      });
      res.responsive.push({ w, h, pg, ...m });
    }
    await p.close();
  }
  /* 2 · Teclado y foco (móvil y escritorio) */
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const { p } = await open(b, w, h);
    for (const pg of PAGES) {
      await p.evaluate(pg => window.__T.go(pg), pg).catch(() => {}); await p.waitForTimeout(350);
      await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
      const seq = []; let sinIndicador = 0, sinNombre = 0;
      for (let i = 0; i < 45; i++) {
        await p.keyboard.press('Tab');
        const f = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); const ind = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || /rgba?\([^)]*\)\s+\d+px/.test(cs.boxShadow) || e.matches(':focus-visible'); const nm = (e.getAttribute('aria-label') || e.textContent || e.getAttribute('title') || e.placeholder || '').trim(); return { id: e.tagName + '.' + String(e.className).split(' ')[0] + (e.dataset.act ? '[' + e.dataset.act + ']' : '') + '#' + (e.dataset.id || e.name || ''), ind: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? 'outline' : (cs.boxShadow !== 'none' ? 'sombra' : 'ninguno'), nm: !!nm || !!(e.labels && e.labels.length), vis: r.width > 0 && r.height > 0, dentro: !!e.closest('#modal-root') }; });
        if (!f) continue; seq.push(f.id); if (f.ind === 'ninguno') sinIndicador++; if (!f.nm) sinNombre++;
      }
      const unicos = new Set(seq).size;
      res.teclado.push({ w, pg, paradas: seq.length, unicos, atrapado: seq.length > 12 && unicos < 4, sinIndicador, sinNombre });
    }
    await p.close();
  }
  /* 2b · Modal: foco, Escape y retorno */
  { const { p } = await open(b, 390, 844);
    await p.evaluate(() => window.__T.go('accounts')); await p.waitForTimeout(500);
    const r = await p.evaluate(async () => { const btn = [...document.querySelectorAll('#page button')].find(e => /Agregar|Añadir|Nueva|\+/.test(e.textContent) && e.offsetParent); if (!btn) return { err: 'sin botón' }; btn.focus(); btn.click(); await new Promise(r => setTimeout(r, 500)); const m = document.querySelector('#modal-root .modal'); return { abre: !!m, rol: !!(m && (m.closest('[role=dialog]') || m.getAttribute('role') === 'dialog' || m.getAttribute('aria-modal'))), foco: !!(m && m.contains(document.activeElement)), aria: m && (m.getAttribute('aria-label') || m.getAttribute('aria-labelledby')) || '' }; });
    let fuera = 0; for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); if (await p.evaluate(() => !document.activeElement.closest('#modal-root') && document.activeElement !== document.body)) fuera++; }
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    r.tabFuera = fuera; r.escapeCierra = await p.evaluate(() => !document.querySelector('#modal-root .modal')); r.focoVuelve = await p.evaluate(() => !!document.activeElement && document.activeElement !== document.body && !!document.activeElement.closest('#page'));
    res.estados.modal = r; await p.close(); }
  /* 3 · Consistencia de dimensiones (radios, rellenos, huecos) */
  { const { p } = await open(b, 390, 844); const rad = {}, pad = {}, gap = {}, fs = {}, h = {};
    for (const pg of PAGES) { await p.evaluate(pg => window.__T.go(pg), pg).catch(() => {}); await p.waitForTimeout(350);
      const m = await p.evaluate(() => { const o = { rad: {}, pad: {}, gap: {}, fs: {}, btnH: {} }; const add = (k, v) => { o[k][v] = (o[k][v] || 0) + 1; };
        document.querySelectorAll('#page .panel,#page [class*=card],#page section').forEach(e => { const r = e.getBoundingClientRect(); if (r.width < 120 || r.height < 40) return; const s = getComputedStyle(e); if (s.borderRadius && s.borderRadius !== '0px') add('rad', s.borderRadius.split(' ')[0]); add('pad', s.paddingTop + '/' + s.paddingLeft); if (s.gap !== 'normal') add('gap', s.gap.split(' ')[0]); });
        document.querySelectorAll('#page button').forEach(e => { const r = e.getBoundingClientRect(); if (r.width > 40) add('btnH', Math.round(r.height) + ''); });
        document.querySelectorAll('#page *').forEach(e => { if (e.children.length === 0 && (e.textContent || '').trim()) add('fs', getComputedStyle(e).fontSize); }); return o; });
      for (const k of ['rad', 'pad', 'gap', 'fs', 'btnH']) { const t = { rad, pad, gap, fs, btnH: h }[k]; for (const [v, n] of Object.entries(m[k])) t[v] = (t[v] || 0) + n; } }
    const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]); res.consistencia = { radios: top(rad).length, radiosTop: top(rad).slice(0, 8), rellenos: top(pad).length, rellenosTop: top(pad).slice(0, 8), huecos: top(gap).length, tamañosFuente: top(fs).length, fuentesTop: top(fs).slice(0, 12), alturasBoton: top(h).length, alturasBotonTop: top(h).slice(0, 10) };
    await p.close(); }
  /* 4 · Desconexión, red lenta, interacciones repetidas */
  { const { ctx, p } = await open(b, 390, 844); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
    await p.evaluate(() => window.__T.go('register')); await p.waitForTimeout(500);
    const antes = await p.evaluate(() => window.__T.dbg().transactions.length);
    await ctx.setOffline(true);
    await p.evaluate(() => { const x = document.createElement('button'); x.dataset.act = 'addExpense'; x.hidden = true; document.body.append(x); x.click(); }); await p.waitForTimeout(700);
    const f = await p.evaluate(() => { const mo = document.querySelector('#modal-root form'); return { abre: !!mo, aviso: (document.body.innerText.match(/sin conexi[oó]n|offline|desconect/i) || [''])[0] }; });
    res.estados.offline = { ...f, movimientosAntes: antes, indicadorDeEstado: await p.evaluate(() => document.querySelector('[data-f33-status],.f33-status,#syncStatus,[class*=sync-status]')?.textContent?.trim() || '(no encontrado)'), errores: errs.length };
    await ctx.setOffline(false); await p.close();
    // red lenta (3G) en la carga
    const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } }); const p2 = await ctx2.newPage(); const cdp = await ctx2.newCDPSession(p2);
    await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8 });
    res.estados.redLenta = 'no medible con el arnés (los recursos se sirven con interceptor local; ver limitaciones)'; await ctx2.close();
    const { p: p3 } = await open(b, 390, 844); const e3 = []; p3.on('pageerror', e => e3.push(e.message.slice(0, 160)));
    // navegación frenética: 120 cambios de pantalla en < 4 s
    const t0 = Date.now(); await p3.evaluate(async pages => { for (let i = 0; i < 120; i++) { window.__T.go(pages[i % pages.length]); await new Promise(r => setTimeout(r, 15)); } }, PAGES);
    await p3.waitForTimeout(800); res.concurrencia.navegacion120 = { ms: Date.now() - t0, errores: e3.length, nodos: await p3.evaluate(() => document.getElementsByTagName('*').length) };
    // 30 aperturas/cierres de modal seguidas
    await p3.evaluate(() => window.__T.go('overview')); await p3.waitForTimeout(400);
    const e4 = e3.length; await p3.evaluate(async () => { for (let i = 0; i < 30; i++) { const x = document.createElement('button'); x.dataset.act = 'addExpense'; x.hidden = true; document.body.append(x); x.click(); x.remove(); await new Promise(r => setTimeout(r, 40)); closeModal(); } });
    await p3.waitForTimeout(500); res.concurrencia.modal30 = { errores: e3.length - e4, modalesAbiertos: await p3.evaluate(() => document.querySelectorAll('#modal-root .modal').length) };
    // 10 envíos del mismo gasto
    await p3.evaluate(() => { const x = document.createElement('button'); x.dataset.act = 'addExpense'; x.hidden = true; document.body.append(x); x.click(); }); await p3.waitForTimeout(700);
    const r10 = await p3.evaluate(async () => { const f = document.querySelector('#modal-root form'); if (!f) return { err: 'sin formulario' }; const a = f.querySelector('[name=amount]'); if (a) { a.value = '123.45'; a.dispatchEvent(new Event('input', { bubbles: true })); } const n0 = window.__T.dbg().transactions.length; for (let i = 0; i < 10; i++) { const s = f.querySelector('button[type=submit]'); s && s.click(); } await new Promise(r => setTimeout(r, 1500)); return { creados: window.__T.dbg().transactions.length - n0 }; });
    res.concurrencia.diezEnvios = r10; await p3.close(); }
  await b.close(); fs.writeFileSync(process.env.OUT || '/tmp/estados.json', JSON.stringify(res, null, 1)); console.log('ok');
})();
