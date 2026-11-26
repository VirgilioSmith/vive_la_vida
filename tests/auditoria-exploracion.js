/* Exploración dinámica: pulsa cada control de cada pantalla, abre modales, fuerza formularios (particiones de equivalencia y valores límite)
   y verifica invariantes financieros. Solo lectura sobre la app: usa datos de demostración en memoria.
   Uso: W=390 H=844 PAGES=overview,register CAP=20 FUZZ=1 OUT=/tmp/x.json node tests/auditoria-exploracion.js */
const { chromium } = require('playwright');
const fs = require('fs');
const open = require('./harness.js');
const W = +(process.env.W || 390), H = +(process.env.H || 844), CAP = +(process.env.CAP || 20), FUZZ = process.env.FUZZ !== '0';
const PAGES = (process.env.PAGES || 'overview,register,income,expenses,wallet,banks,accounts,cards,loans,certificates,benefits,personal,payments,transactions,recurring,budget,annual,analytics,categories,advanced,patrimony,projection,pressure,mobilehub,mobilesearch,settings').split(',');
const EVID = process.env.EVID || 'test-results/auditoria/evidencias';
const out = { vista: `${W}x${H}`, paginas: [], hallazgos: [], formularios: {}, noLocalizados: [] };
const find = (tipo, pg, detalle, extra) => out.hallazgos.push({ tipo, pagina: pg, detalle: String(detalle).slice(0, 220), ...extra });

const PARTS = {
  vacio: () => '', hostil: () => '<img src=x onerror=window.__pwn=1>\'"; DROP TABLE x;--', largo: () => 'x'.repeat(400),
  cero: () => '0', negativo: () => '-1', decimal: () => '0.005', enorme: () => '99999999999', texto: () => 'abc', tipico: () => null
};
(async () => {
  const b = await chromium.launch();
  const { p } = await open(b, W, H);
  const errs = [], cons = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 180))); p.on('console', m => { if (m.type() === 'error') cons.push(m.text().slice(0, 180)); });
  const go = async pg => { await p.evaluate(pg => { try { typeof closeModal === 'function' && closeModal(); } catch (_) {} window.__T.go(pg); }, pg).catch(() => {}); await p.waitForTimeout(350); };
  const invariantes = () => p.evaluate(() => { const d = window.__T.dbg(); const bad = []; const ids = new Set(); for (const t of d.transactions || []) { if (!Number.isFinite(Number(t.amount))) bad.push('monto no finito ' + t.id); if (ids.has(t.id)) bad.push('id duplicado ' + t.id); ids.add(t.id); }
    for (const a of d.accounts || []) { try { const v = window.__T.fn.getAccountBalance(a.id); if (!Number.isFinite(v)) bad.push('saldo no finito ' + a.name); } catch (e) { bad.push('saldo error ' + a.name); } } return { bad: bad.slice(0, 5), tx: (d.transactions || []).length }; });
  const textoMalo = () => p.evaluate(() => { const t = document.body.innerText; const m = t.match(/.{0,25}(NaN|undefined|Infinity|\[object).{0,25}/); return m ? m[0] : ''; });
  for (const pg of PAGES) {
    const reg = { pagina: pg, controles: 0, probados: 0, modales: 0, formularios: 0, casos: 0 };
    await go(pg);
    const lista = await p.evaluate(cap => { const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && !e.closest('#modal-root'); };
      const els = [...document.querySelectorAll('#page button,#page [data-act],#page summary,#page [role=button],#page a[href],#page select,#page input[type=checkbox],#page input[type=radio]')].filter(vis);
      const seen = new Map(); els.forEach(e => { const k = e.tagName + '|' + (e.dataset.act || '') + '|' + (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 36) + '|' + (e.className && String(e.className).split(' ')[0]); if (!seen.has(k)) seen.set(k, e); });
      return { total: els.length, claves: [...seen.keys()].slice(0, cap) }; }, CAP);
    reg.controles = lista.total; reg.unicos = lista.claves.length;
    // captura de la pantalla
    try { await p.screenshot({ path: `${EVID}/${pg}-${W}.jpg`, type: 'jpeg', quality: 55 }); } catch (_) {}
    const ov = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    if (ov.sw > ov.iw + 2) find('desborde-horizontal', pg, `scrollWidth ${ov.sw} > ${ov.iw}`);
    for (const clave of lista.claves) {
      if (/logout|cerrar sesi|salir|reset|borrar todo|eliminar cuenta|restablecer/i.test(clave)) continue;
      await go(pg);
      const e0 = errs.length, c0 = cons.length;
      const ok = await p.evaluate(clave => { const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('#modal-root'); };
        const el = [...document.querySelectorAll('#page button,#page [data-act],#page summary,#page [role=button],#page a[href],#page select,#page input[type=checkbox],#page input[type=radio]')].filter(vis).find(e => (e.tagName + '|' + (e.dataset.act || '') + '|' + (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 36) + '|' + (e.className && String(e.className).split(' ')[0])) === clave);
        if (!el) return false; if (el.tagName === 'A') el.addEventListener('click', ev => ev.preventDefault(), { once: true }); el.click(); return true; }, clave).catch(() => false);
      if (!ok) { out.noLocalizados.push(pg + ': ' + clave.slice(0, 60)); continue; } reg.probados++; await p.waitForTimeout(380);
      const m = await p.evaluate(() => { const mo = document.querySelector('#modal-root .modal'); if (!mo) return null; const r = mo.getBoundingClientRect(); const scr = [...mo.querySelectorAll('*')].concat(mo).some(x => x.scrollHeight > x.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(x).overflowY)); const form = mo.querySelector('form'); return { titulo: (mo.querySelector('h2,h3') || {}).textContent, h: Math.round(r.height), vh: innerHeight, w: Math.round(r.width), hov: mo.scrollWidth > mo.clientWidth + 2, scroll: scr, form: form ? form.id || 'form' : '', inputs: form ? form.querySelectorAll('input:not([type=hidden]),select,textarea').length : 0, cerrar: !!mo.querySelector('.close,[data-act=closeModal],[aria-label*=errar]'), dialog: !!mo.closest('[role=dialog]') || mo.getAttribute('role') === 'dialog' || mo.getAttribute('aria-modal') === 'true' }; });
      if (errs.length > e0) find('error-js', pg, errs.slice(e0).join(' | '), { control: clave });
      if (cons.length > c0) find('error-consola', pg, cons.slice(c0).join(' | '), { control: clave });
      const tm = await textoMalo(); if (tm) find('texto-invalido', pg, tm, { control: clave });
      if (m) {
        reg.modales++; if (m.form) out.formularios[m.form] = (out.formularios[m.form] || 0) + 1;
        if (m.hov) find('modal-desborda-ancho', pg, `${m.titulo} ancho ${m.w}`, { control: clave });
        if (m.h > m.vh + 1) find('modal-mas-alto-que-pantalla', pg, `${m.titulo} ${m.h}>${m.vh}`, { control: clave });
        if (!m.cerrar) find('modal-sin-cierre-visible', pg, m.titulo, { control: clave });
        if (!m.dialog) out.sinDialogo = (out.sinDialogo || 0) + 1;
        if (FUZZ && m.form && m.inputs) {
          reg.formularios++;
          for (const [nombre, fn] of Object.entries(PARTS)) {
            const e1 = errs.length, tx0 = (await invariantes()).tx;
            await p.evaluate(([nombre, val]) => { const f = document.querySelector('#modal-root form'); if (!f) return; window.__pwn = 0;
              f.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea').forEach(i => { if (nombre === 'tipico') return; const t = i.type; let v = val; if (t === 'date') v = nombre === 'vacio' ? '' : nombre === 'enorme' ? '9999-12-31' : nombre === 'negativo' ? '1900-01-01' : '2026-02-30'; if (t === 'month') v = nombre === 'vacio' ? '' : '0000-13'; if (t === 'number' && !/^-?\d/.test(v || '0')) v = ''; try { i.value = v; } catch (_) {} i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
              f.querySelectorAll('select').forEach(s => { const o = [...s.options].filter(x => x.value); if (!o.length) return; s.value = (nombre === 'vacio' ? s.options[0] : nombre === 'enorme' ? o[o.length - 1] : o[0]).value; s.dispatchEvent(new Event('change', { bubbles: true })); }); }, [nombre, fn()]).catch(() => {});
            await p.evaluate(() => { const f = document.querySelector('#modal-root form'); const s = f && (f.querySelector('button[type=submit]') || f.querySelector('.v901-next,[data-v48-next]')); s && s.click(); }).catch(() => {});
            await p.waitForTimeout(420); reg.casos++;
            const inv = await invariantes(); const pwn = await p.evaluate(() => window.__pwn).catch(() => 0);
            if (errs.length > e1) find('error-js-formulario', pg, `${m.titulo}/${nombre}: ${errs.slice(e1).join(' | ')}`, { control: clave });
            if (inv.bad.length) find('invariante-financiero', pg, `${m.titulo}/${nombre}: ${inv.bad.join('; ')}`, { control: clave });
            if (pwn) find('xss', pg, `${m.titulo}/${nombre}`, { control: clave });
            const tm2 = await textoMalo(); if (tm2) find('texto-invalido', pg, `${m.titulo}/${nombre}: ${tm2}`, { control: clave });
            if (inv.tx > tx0 && (nombre === 'vacio' || nombre === 'texto' || nombre === 'cero' || nombre === 'negativo')) find('registro-con-entrada-invalida', pg, `${m.titulo}/${nombre}: +${inv.tx - tx0} movimiento(s)`, { control: clave });
            const sigue = await p.evaluate(() => !!document.querySelector('#modal-root .modal'));
            if (!sigue) break;
          }
        }
      }
      await p.evaluate(() => { try { closeModal(); } catch (_) {} }).catch(() => {});
    }
    out.paginas.push(reg);
  }
  await b.close();
  fs.writeFileSync(process.env.OUT || `/tmp/expl-${W}.json`, JSON.stringify(out, null, 1));
  const por = {}; out.hallazgos.forEach(h => por[h.tipo] = (por[h.tipo] || 0) + 1);
  console.log(JSON.stringify({ vista: out.vista, paginas: out.paginas.length, controles: out.paginas.reduce((a, x) => a + x.controles, 0), probados: out.paginas.reduce((a, x) => a + x.probados, 0), modales: out.paginas.reduce((a, x) => a + x.modales, 0), formularios: out.paginas.reduce((a, x) => a + x.formularios, 0), casos: out.paginas.reduce((a, x) => a + x.casos, 0), hallazgos: por }));
})();
