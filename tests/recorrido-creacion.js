/* Recorrido natural de TODOS los formularios de creación: se abre cada «Nueva/o…», se rellena como lo haría una persona (valores válidos),
   se guarda y se comprueba que (1) se crea el registro, (2) no hay errores de JavaScript y (3) el producto nuevo aparece en los selectores universales.
   Uso: W=390 H=844 node tests/recorrido-creacion.js */
const { chromium } = require('playwright');
const W = +(process.env.W || 390), H = +(process.env.H || 844); if (W < 500) process.env.TOUCH = '1';
const open = require('./harness.js');
let fails = 0, omitidos = 0; const res = [];
/* Asistentes de varios pasos con tarjetas de elección y campos propios (préstamo, certificado, pago recurrente, tarjeta): el rellenador genérico no los completa. Se informan como OMITIDOS, no como aprobados. */
const NO_AUTOMATIZABLE = new Set(['loanForm', 'certificateForm', 'recurringForm', 'cardForm']); const check = (n, name, ok, extra = '') => { if (!ok) fails++; res.push([ok, n, name, extra]); console.log(`${ok ? '✓' : '✕'} ${n} ${name}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`); };
const SOLO = process.env.SOLO; const PAGINAS = (process.env.SOLO ? [] : []).concat(SOLO ? [[SOLO, 'Nuev|Agreg|Añad|tarjeta']] : []); const PAGINAS_TODAS = [['banks', 'Nuev|Agreg|Añad'], ['accounts', 'Nuev|Agreg|Añad'], ['wallet', 'Nuev|Agreg|Añad|tarjeta'], ['loans', 'Nuev|Agreg|Añad'], ['certificates', 'Nuev|Agreg|Añad'], ['personal', 'Nuev|Agreg|Añad|acuerdo'], ['recurring', 'Nuev|Agreg|Añad'], ['categories', 'Nuev|Agreg|Añad']];
(async () => {
  const b = await chromium.launch(); const { p } = await open(b, W, H); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  const contar = () => p.evaluate(() => { const d = window.__T.dbg(); return { cuentas: d.accounts.length, tarjetas: d.cards.length, bancos: (d.banks || []).length, prestamos: d.loans.length, certificados: d.certificates.length, recurrentes: d.recurring.length, personales: (d.personalLoans || []).length, contactos: (d.personalContacts || []).length, categorias: (d.customCategories || []).length, presupuestos: (d.budgets || []).length }; });
  const total = o => Object.values(o).reduce((a, x) => a + x, 0);
  for (const [pg, re] of (SOLO ? PAGINAS : PAGINAS_TODAS)) {
    await p.evaluate(pg => { try { closeModal(); } catch (_) {} window.__T.go(pg); }, pg); await p.waitForTimeout(500);
    const botones = await p.evaluate(re => { const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('#modal-root'); }; return [...new Set([...document.querySelectorAll('#app button,#app [data-act]')].filter(vis).map(e => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)).filter(t => new RegExp(re, 'i').test(t) && !/eliminar|borrar/i.test(t)))]; }, re);
    for (const txt of botones) {
      await p.evaluate(pg => { try { closeModal(); } catch (_) {} window.__T.go(pg); }, pg); await p.waitForTimeout(350);
      const antes = await contar(); const e0 = errs.length;
      const abre = await p.evaluate(txt => { const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('#modal-root'); }; const bt = [...document.querySelectorAll('#app button,#app [data-act]')].filter(vis).find(e => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40) === txt); if (!bt) return false; bt.click(); return true; }, txt);
      if (!abre) continue; await p.waitForTimeout(900);
      const form = await p.evaluate(() => { const f = document.querySelector('#modal-root form'); return f ? f.id : null; });
      if (!form) { await p.evaluate(() => { try { closeModal(); } catch (_) {} document.getElementById('modal-root').innerHTML = ''; }); continue; }
      // rellenar como una persona: paso a paso (Continuar…) y guardar al final
      let info = 0, inval = [];
      for (let paso = 0; paso < 10; paso++) {
        const r = await p.evaluate(() => { const f = document.querySelector('#modal-root form'); if (!f) return { fin: true }; const hoy = window.__T.fn.today(); let n = 0;
          f.querySelectorAll('details').forEach(d => { d.open = true; }); const vis = e => e.getClientRects().length > 0 && !e.closest('[hidden]') && !e.closest('.v1110-native');
          const set = (e, v) => { try { e.value = v; } catch (_) { return; } e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); n++; };
          // selectores de institución / producto personalizados
          f.querySelectorAll('.v1110-pick').forEach(w => { const sel = w.querySelector('select'); if (sel && sel.required && !sel.value && vis(w)) { const o = [...sel.options].find(x => x.value); if (o) { sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); n++; } } });
          [...f.elements].filter(e => e.name && !e.disabled && e.type !== 'hidden' && e.type !== 'submit' && e.type !== 'button' && e.type !== 'radio' && e.type !== 'checkbox' && vis(e)).forEach(e => {
            if (e.tagName === 'SELECT') { if (e.value) return; const o = [...e.options].find(x => x.value && !x.disabled); if (o) set(e, o.value); return; }
            if (e.value) return; if (!e.required && !/name|nombre|title|titulo|concept|merchant|payee/.test(e.name.toLowerCase())) return;
            const nm = e.name.toLowerCase(), t = e.type;
            if (t === 'date') { const mx = e.max && e.max < hoy ? e.max : hoy; return set(e, mx); } if (t === 'month') return set(e, hoy.slice(0, 7));
            if (t === 'number') { const mn = e.min !== '' ? Number(e.min) : null; return set(e, /rate|pct|apr|interes|tasa|percent/.test(nm) ? '10' : /day|dia|corte|cutoff|vence/.test(nm) ? '15' : /year|anio|plazo|term|cuota|period/.test(nm) ? '12' : String(Math.max(mn === null ? 0 : mn, 5000))); }
            if (/last4|ultimos/.test(nm)) return set(e, '4321'); if (t === 'email') return set(e, 'prueba@example.com'); if (t === 'tel') return set(e, '8095550101'); set(e, 'Prueba ' + e.name); });
          f.querySelectorAll('input[type=radio][required]').forEach(r => { const g = f.querySelectorAll(`input[type=radio][name="${r.name}"]`); if (![...g].some(x => x.checked)) g[0].click(); });
          // tarjetas de elección (p. ej. «Nuevo / Ya iniciado», frecuencia, tipo): si ningún hermano está elegido, se elige el primero
          const grupos = new Map(); [...f.querySelectorAll('button')].filter(b => b.type !== 'submit' && b.getClientRects().length > 0 && b.textContent.trim().length > 6 && !/siguiente|continuar|cancelar|anterior|volver|guardar|crear|^\d|selecciona|cerrar/i.test(b.textContent.trim()) && !b.closest('[class*=stepper],.form-foot,.modal-head')).forEach(b => { const g = b.parentElement; if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(b); });
          grupos.forEach(bs => { if (bs.length >= 2 && !bs.some(b => b.classList.contains('selected') || b.classList.contains('active') || b.classList.contains('on') || b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-checked') === 'true')) { bs[0].click(); n++; } });
          const root = f.closest('#modal-root') || document; const next = [...root.querySelectorAll('button')].find(b => /^(continuar|siguiente)/i.test(b.textContent.trim()) && b.getClientRects().length > 0 && !b.hidden && !b.disabled); const submit = f.querySelector('button[type=submit]') || [...f.querySelectorAll('button')].find(x => /guardar|crear|agregar|añadir|registrar|confirmar/i.test(x.textContent));
          const nextVis = !!next; const subVis = submit && submit.getClientRects().length > 0 && !submit.hidden;
          const bad = [...f.elements].filter(e => e.name && e.willValidate && !e.checkValidity() && vis(e)).map(e => e.name + ': ' + e.validationMessage.slice(0, 40));
          if (nextVis) { next.click(); return { n, accion: 'continuar', bad }; } if (subVis || submit) { submit.click(); return { n, accion: 'guardar', bad }; } return { n, accion: 'nada', bad }; });
        if (process.env.DEBUG) console.log('   paso', paso, JSON.stringify(r), await p.evaluate(() => { const a = document.activeElement; return ((document.querySelector('#modal-root #formError,#modal-root .input-error,.toast') || {}).textContent || '') + ' | foco: ' + (a && a.name) + ' ' + (a && a.type) + ' ' + (a && a.validationMessage) + ' val=' + (a && a.value); }));
        if (r.fin) break; info += r.n || 0; inval = r.bad || inval; await p.waitForTimeout(r.accion === 'guardar' ? 1500 : 400); if (r.accion !== 'continuar') break;
      }
      const dsp = await contar(); const cerrado = await p.evaluate(() => !document.querySelector('#modal-root form')); const msg = await p.evaluate(() => (document.querySelector('#modal-root #formError,#modal-root .input-error,#modal-root .v940-error') || {}).textContent || '');
      const creado = total(dsp) > total(antes);
      if (!creado && NO_AUTOMATIZABLE.has(form)) { omitidos++; console.log(`⚠ OMITIDO ${pg} › ${txt} (${form}) — requiere un guion específico; no cuenta como aprobado`); await p.evaluate(() => { try { closeModal(); } catch (_) {} document.getElementById('modal-root').innerHTML = ''; }); continue; }
      check(`${pg} › ${txt} (${form})`, 'se crea el registro y el formulario se cierra sin errores', creado && cerrado && errs.length === e0, creado ? '' : `inválidos: ${inval.join('; ') || 'ninguno'} · mensaje: ${msg.trim().slice(0, 100)} · campos rellenados ${info}`);
      await p.evaluate(() => { try { closeModal(); } catch (_) {} document.getElementById('modal-root').innerHTML = ''; });
    }
  }
  // los productos nuevos aparecen en los selectores universales (pago de tarjeta: todas las cuentas, en pesos y dólares)
  await p.evaluate(() => { try { closeModal(); } catch (_) {} window.__T.go('overview'); }); await p.waitForTimeout(500);
  const todos = await p.evaluate(() => { const d = window.__T.dbg(); return d.accounts.filter(a => !a.archived).length; });
  await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; document.querySelector('#app [data-act=newTransaction]')?.click(); }); await p.waitForTimeout(700);
  await p.evaluate(() => document.querySelector('#modal-root [data-act=registrationGroup][data-id="pay"]')?.click()); await p.waitForTimeout(400);
  await p.evaluate(() => { [...document.querySelectorAll('#modal-root button[data-act]')].find(e => /Pagar tarjeta/.test(e.textContent))?.click(); }); await p.waitForTimeout(1200);
  await p.evaluate(() => { document.querySelectorAll('#transactionForm .v789-select-open')[1]?.click(); }); await p.waitForTimeout(500);
  const filas = await p.evaluate(() => [...document.querySelectorAll('dialog .v789-picker-row')].length);
  check('selector-universal', `Tras crear productos, «Pagar tarjeta › Pagar desde» muestra las ${todos} cuentas activas`, filas === todos, `filas=${filas} cuentas=${todos}`);
  check('errores', 'Sin errores de página durante todo el recorrido', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); console.log(`\nOMITIDOS (no aprobados): ${omitidos}`); console.log(fails ? `FALLAN: ${fails}` : 'OK (lo ejecutado)'); process.exit(fails ? 1 : 0);
})();
