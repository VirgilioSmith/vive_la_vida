/* Recorre todas las pantallas y abre cada formulario/hoja de captura; para cada lista de productos (cuentas, tarjetas, préstamos)
   comprueba que (1) usa el selector universal o un selector con buscador y (2) ofrece TODOS los productos activos, en pesos y en dólares.
   Uso: W=390 H=844 OUT=/tmp/selectores.json node tests/auditoria-selectores.js */
const { chromium } = require('playwright');
const fs = require('fs');
const W = +(process.env.W || 390), H = +(process.env.H || 844);
if (W < 500) process.env.TOUCH = '1';
const open = require('./harness.js');
const PAGES = (process.env.PAGES || '').split(',').filter(Boolean).length ? process.env.PAGES.split(',') : ['overview', 'register', 'income', 'expenses', 'wallet', 'banks', 'accounts', 'cards', 'loans', 'certificates', 'benefits', 'personal', 'payments', 'transactions', 'recurring', 'budget', 'annual', 'analytics', 'categories', 'advanced', 'patrimony', 'projection', 'pressure', 'mobilehub', 'mobilesearch', 'settings'];
const out = { vista: W + 'x' + H, formularios: [] }; let asistenteHecho = process.env.ASISTENTE === '0';
(async () => {
  const b = await chromium.launch(); const { p } = await open(b, W, H); const seen = new Set();
  const analizar = async (origen) => {
    const r = await p.evaluate(() => {
      const d = window.__T.dbg();
      const prod = { cuenta: d.accounts.filter(a => !a.archived).map(a => ({ id: String(a.id), n: (a.name || '').trim(), c: a.currency })), tarjeta: d.cards.filter(c => !c.archived).map(c => ({ id: String(c.id), n: (c.name || '').trim() })), prestamo: d.loans.filter(l => !l.archived).map(l => ({ id: String(l.id), n: (l.name || '').trim() })), banco: (d.banks || []).filter(b => !b.archived).map(b => ({ id: String(b.id), n: (b.name || '').trim() })) };
      const root = document.getElementById('modal-root'); if (!root.querySelector('.modal,.v749-layer,[role=dialog]')) return null;
      const titulo = ((root.querySelector('h1,h2,h3') || {}).textContent || '').trim().slice(0, 50);
      const forms = [...root.querySelectorAll('form')].map(f => f.id).filter(Boolean);
      let idx = 0; const selects = [];
      root.querySelectorAll('select').forEach(s => {
        const vals = [...s.options].map(o => String(o.value)).filter(Boolean);
        const tipo = ['cuenta', 'tarjeta', 'prestamo', 'banco'].find(k => prod[k].some(x => vals.includes(x.id)) && vals.filter(v => prod[k].some(x => x.id === v)).length >= Math.min(1, vals.length));
        if (!tipo) return; s.setAttribute('data-aud', String(idx));
        const label = s.closest('label') || s.parentElement; const universal = !!(label && label.querySelector('.v789-select-open,.v1028-picker-btn,.v1110-pickbtn,.v827-universal-trigger,.v901-product-trigger')) || s.classList.contains('v1110-native') || !!s.parentElement.querySelector('.v901-product-trigger');
        selects.push({ i: idx++, campo: s.name || s.id, tipo, universal, opciones: vals.length, visibleNativo: s.offsetParent !== null && !universal, ids: prod[tipo].map(x => x.id), nombres: Object.fromEntries(prod[tipo].map(x => [x.id, x.n + (x.c ? ' ' + x.c : '')])) });
      });
      return { titulo, forms, selects };
    });
    if (!r) return;
    for (const sel of r.selects) {
      if (sel.universal) {
        await p.evaluate(i => { const s = document.querySelector(`[data-aud="${i}"]`); if (!s) return; const t = (s.closest('label') || s.parentElement)?.querySelector('.v789-select-open,.v827-universal-trigger,.v1028-picker-btn,.v1110-pickbtn,.v901-product-trigger'); t && t.click(); }, sel.i); await p.waitForTimeout(350);
        const filas = await p.evaluate(() => [...document.querySelectorAll('dialog.v827-picker-backdrop .v789-picker-row,.v1028-picker-list .v1028-opt')].map(e => ({ v: e.dataset.value || e.dataset.v, d: e.disabled || e.getAttribute('aria-disabled') === 'true' })));
        await p.evaluate(() => { const c = document.querySelector('dialog.v827-picker-backdrop .v789-picker-close'); c && c.click(); }); await p.waitForTimeout(200);
        const vals = new Set(filas.map(f => String(f.v))); sel.filas = filas.length; sel.deshabilitadas = filas.filter(f => f.d).length;
        sel.faltan = sel.ids.filter(id => !vals.has(id)).map(id => sel.nombres[id]);
      } else sel.faltan = null;
      delete sel.ids; delete sel.nombres;
    }
    const clave = r.titulo + '|' + r.forms.join(',') + '|' + r.selects.map(s => s.campo + s.universal).join(',');
    if (seen.has(clave)) return; seen.add(clave); out.formularios.push({ origen, ...r });
  };
  const cerrar = () => p.evaluate(() => { try { closeModal(); } catch (_) {} document.getElementById('modal-root').innerHTML = ''; }).catch(() => {});
  for (const pg of PAGES) {
    await p.evaluate(pg => window.__T.go(pg), pg).catch(() => {}); await p.waitForTimeout(350);
    const claves = await p.evaluate(() => { const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('#modal-root'); };
      const els = [...document.querySelectorAll('#app button,#app [data-act],#app summary,#app [role=button]')].filter(vis); const m = new Map(); els.forEach(e => { const k = (e.dataset.act || '') + '|' + (e.dataset.id || '') + '|' + (e.dataset.mode || '') + '|' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28); if (!m.has(k) && !/logout|cerrar sesi|eliminar|borrar|restablecer|salir/i.test(k)) m.set(k, 1); }); return [...m.keys()]; });
    if (process.env.PRIO) { const re = new RegExp(process.env.PRIO, 'i'); claves.sort((x, y) => (re.test(y) ? 1 : 0) - (re.test(x) ? 1 : 0)); }
    for (const k of claves) {
      await p.evaluate(pg => { try { closeModal(); } catch (_) {} window.__T.go(pg); }, pg).catch(() => {}); await p.waitForTimeout(250);
      const ok = await p.evaluate(k => { const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('#modal-root'); };
        const el = [...document.querySelectorAll('#app button,#app [data-act],#app summary,#app [role=button]')].filter(vis).find(e => ((e.dataset.act || '') + '|' + (e.dataset.id || '') + '|' + (e.dataset.mode || '') + '|' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28)) === k); if (!el) return false; el.click(); return true; }, k).catch(() => false);
      if (!ok) continue; await p.waitForTimeout(450); await analizar(pg + ' › ' + k.split('|')[3]);
      /* Si la acción abre primero el selector universal de producto (p. ej. avance de efectivo), se elige el primero y se analiza el formulario que sigue */
      if (await p.evaluate(() => !!document.querySelector('#modal-root .v789-picker-row'))) { await p.evaluate(() => { document.querySelector('#modal-root .v789-picker-row').click(); const c = document.querySelector('#modal-root .v789-picker-confirm'); if (c && c.offsetParent) c.click(); }); await p.waitForTimeout(600); await analizar(pg + ' › ' + k.split('|')[3] + ' › formulario'); }
      // asistente de registro: abrir cada operación de cada grupo
      const grupos = asistenteHecho ? [] : await p.evaluate(() => [...document.querySelectorAll('#modal-root [data-act=registrationGroup]')].map(e => e.dataset.id));
      if (grupos.length) asistenteHecho = true;
      for (const g of grupos) {
        const ops = await p.evaluate(g => { document.querySelector(`#modal-root [data-act=registrationGroup][data-id="${g}"]`)?.click(); return [...document.querySelectorAll('#modal-root button[data-act=guidedFlow],#modal-root button[data-act=newTransaction]')].map(e => e.dataset.mode || e.dataset.type || e.textContent.trim().slice(0, 20)); }, g);
        for (const m of [...new Set(ops)]) {
          await p.evaluate(g => { document.getElementById('modal-root').innerHTML = ''; document.querySelector('#app [data-act=newTransaction]')?.click(); }, g); await p.waitForTimeout(500);
          await p.evaluate(([g, m]) => { document.querySelector(`#modal-root [data-act=registrationGroup][data-id="${g}"]`)?.click(); const b = [...document.querySelectorAll('#modal-root button[data-act=guidedFlow],#modal-root button[data-act=newTransaction]')].find(e => (e.dataset.mode || e.dataset.type || e.textContent.trim().slice(0, 20)) === m); b && b.click(); }, [g, m]); await p.waitForTimeout(900);
          await analizar('registrar › ' + g + ' › ' + m);
        }
      }
      await cerrar();
    }
  }
  await b.close(); fs.writeFileSync(process.env.OUT || '/tmp/selectores.json', JSON.stringify(out, null, 1));
  let nativos = 0, incompletos = 0, total = 0; for (const f of out.formularios) for (const s of f.selects) { total++; if (!s.universal) nativos++; if (s.faltan && s.faltan.length) incompletos++; }
  console.log(`formularios/hojas con productos: ${out.formularios.length} · listas de productos: ${total} · sin selector universal: ${nativos} · incompletas (faltan productos): ${incompletos}`);
})();
