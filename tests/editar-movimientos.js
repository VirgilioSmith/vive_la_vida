/* Editar un movimiento desde Movimientos abre la pantalla NUEVA de captura (móvil) y actualiza el mismo registro sin duplicar ni perder datos.
   Uso: node tests/editar-movimientos.js */
const { chromium } = require('playwright');
process.env.TOUCH = '1';
const open = require('./harness.js');
let fails = 0; const check = (n, name, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '✓' : '✕'} ${n} ${name}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`); };
(async () => {
  const b = await chromium.launch(); const { p } = await open(b, 390, 844); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  const edit = id => p.evaluate(id => { try { closeModal(); } catch (_) {} const x = document.createElement('button'); x.dataset.act = 'editTransaction'; x.dataset.id = id; x.hidden = true; document.body.append(x); x.click(); x.remove(); }, id);
  const info = () => p.evaluate(() => { const l = document.querySelector('#modal-root .v749-layer'); return l ? { etapa: l.dataset.v749Stage, edit: l.dataset.v749Edit === '1', titulo: (l.querySelector('.v749-title') || {}).textContent, segmento: !!l.querySelector('.v749-segment') && getComputedStyle(l.querySelector('.v749-segment')).display !== 'none', monto: (l.querySelector('#v749Amount') || {}).value, boton: (l.querySelector('[data-v749=confirm]') || {}).textContent } : null; });
  await p.evaluate(() => { const d = window.__T.dbg(); const ac = d.accounts.filter(a => !a.archived && a.currency === 'DOP'); d.transactions.push({ id: 'tr-prueba', type: 'transfer', amount: 500, currency: 'DOP', accountId: ac[0].id, toAccountId: ac[1].id, date: '2026-11-10', note: 'ida y vuelta', category: 'Transferencias' }); });
  await p.evaluate(() => window.__T.go('register')); await p.waitForTimeout(600);
  const tx = await p.evaluate(() => { const d = window.__T.dbg(); const pick = t => d.transactions.find(x => x.type === t && x.amount > 0 && x.date <= (new Date().toISOString().slice(0, 10))); return ['expense', 'income', 'card_charge', 'transfer'].map(t => { const x = pick(t); return x ? { id: x.id, type: x.type, amount: x.amount, note: x.note || '', category: x.category, acc: x.accountId, card: x.cardId, extra: JSON.stringify(Object.keys(x).sort()) } : null; }); });
  for (const t of tx.filter(Boolean)) {
    const n0 = await p.evaluate(() => window.__T.dbg().transactions.length);
    await edit(t.id); await p.waitForTimeout(900);
    const a = await info();
    const nueva = !!a && a.etapa === 'entry' && a.edit && /Editar movimiento/.test(a.titulo) && !a.segmento && /Guardar|Continuar/.test(a.boton || 'Continuar');
    check(`E-${t.type}-1`, `Editar un ${t.type} abre la pantalla nueva en modo edición (título «Editar movimiento», sin selector de tipo)`, nueva, JSON.stringify(a));
    check(`E-${t.type}-2`, 'El importe original llega precargado', a && a && Number(a.monto) === t.amount, a && a.monto + ' esperado ' + t.amount);
    // cambiar el importe: borrar todo y teclear 7 → 77
    await p.evaluate(() => { for (let i = 0; i < 12; i++) document.querySelector('[data-v749="key"][data-value="⌫"]')?.click(); for (const k of ['7', '7']) document.querySelector(`[data-v749="key"][data-value="${k}"]`)?.click(); });
    await p.evaluate(() => document.querySelector('[data-v749="continue"]')?.click()); await p.waitForTimeout(900);
    const r = await info();
    check(`E-${t.type}-3`, 'La revisión se titula «Confirma los cambios» y el botón dice «Guardar cambios»', !!r && r.etapa === 'review' && /Confirma los cambios/.test(r.titulo) && /Guardar cambios/.test(r.boton), JSON.stringify(r));
    await p.evaluate(() => document.querySelector('[data-v749="confirm"]')?.click()); await p.waitForTimeout(2200);
    const d = await p.evaluate(id => { const dd = window.__T.dbg(); const x = dd.transactions.find(y => y.id === id); return { n: dd.transactions.length, monto: x && x.amount, tipo: x && x.type, nota: x && (x.note || ''), keys: x ? JSON.stringify(Object.keys(x).sort()) : '', cierra: !document.querySelector('#modal-root .v749-layer') }; }, t.id);
    check(`E-${t.type}-4`, 'Guardar actualiza el MISMO movimiento (mismo id y tipo), sin duplicarlo y cerrando la pantalla', d.n === n0 && d.monto === 77 && d.tipo === t.type && d.cierra, JSON.stringify({ n0, d: { n: d.n, monto: d.monto, tipo: d.tipo, cierra: d.cierra } }));
    const perdidos = JSON.parse(t.extra).filter(k => !JSON.parse(d.keys || '[]').includes(k));
    check(`E-${t.type}-5`, 'No se pierde ningún campo del movimiento (comercio, origen, notas, comisiones…)', perdidos.length === 0 && d.nota === t.note, 'perdidos: ' + perdidos.join(','));
  }
  check('E-err', 'Sin errores de página', errs.length === 0, errs.join('|'));
  await b.close(); console.log(fails ? `\nFALLAN: ${fails}` : '\nOK'); process.exit(fails ? 1 : 0);
})();
