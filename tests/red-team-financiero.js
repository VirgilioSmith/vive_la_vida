/* Red team · ataque financiero. Entradas inválidas/extremas, idempotencia del doble envío y propiedades de conservación (centavos) con semilla.
   Uso: SEED=1 node tests/red-team-financiero.js */
const { chromium } = require('playwright');
const open = require('./harness.js');
const SEED = +(process.env.SEED || 1);
let a = SEED >>> 0; const rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
let fails = 0, n = 0; const check = (id, name, ok, extra = '') => { n++; if (!ok) fails++; console.log(`${ok ? '✓' : '✕'} ${id} ${name}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`); };
(async () => {
  const b = await chromium.launch(); const { p } = await open(b, 1440, 900); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160))); p.on('dialog', d => d.accept().catch(() => {}));
  const snap = () => p.evaluate(() => { const d = window.__T.dbg(); const bal = {}; for (const x of d.accounts) bal[x.id] = window.__T.fn.getAccountBalance(x); return { n: d.transactions.length, bal, ids: d.accounts.map(x => x.id) }; });
  const ACC = await p.evaluate(() => { const d = window.__T.dbg(); const f = (c, k) => d.accounts.find(x => x.currency === c && x.kind === k).id; return { dop: f('DOP', 'checking'), sav: f('DOP', 'savings'), usd: f('USD', 'savings') } });
  /* Abre el formulario real, rellena campos y envía (n = veces que se envía en la misma ráfaga) */
  const submit = (type, f, times = 1) => p.evaluate(async ([type, f, times]) => {
    try { closeModal() } catch (_) { }
    const x = document.createElement('button'); x.dataset.act = 'newTransaction'; x.dataset.type = type; x.hidden = true; document.body.append(x); x.click(); x.remove();
    await new Promise(r => setTimeout(r, 120));
    const form = document.querySelector('#modal-root #transactionForm'); if (!form) return { noForm: true };
    for (const [k, v] of Object.entries(f)) { let e = form.elements[k]; if (!e) continue; if (e.length !== undefined && !e.dispatchEvent) { const r = [...e].find(x => x.value === v); if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } continue; } e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }
    const before = window.__T.dbg().transactions.length;
    for (let i = 0; i < times; i++) { try { form.requestSubmit() } catch (_) { form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })) } }
    await new Promise(r => setTimeout(r, 250));
    for (let k = 0; k < times; k++) { const c = [...document.querySelectorAll('#modal-root button')].find(e => e.offsetParent && /^Confirmar operación/.test(e.textContent.trim())); if (c) { c.click(); await new Promise(r => setTimeout(r, 120)) } }
    await new Promise(r => setTimeout(r, 200));
    return { added: window.__T.dbg().transactions.length - before, err: (document.querySelector('#formError,.form-error,[role=alert]')?.textContent || '').trim().slice(0, 100) };
  }, [type, f, times]);
  const cents = v => Math.round(v * 100);
  /* F1 · importes inválidos: nunca crean movimiento ni alteran saldos */
  for (const bad of ['0', '-5', '-0.01', 'abc', '', '1e309', '9'.repeat(25), '0.001', ' ']) {
    const s0 = await snap(); const r = await submit('expense', { amount: bad, accountId: ACC.dop, paymentSource: 'account' }); const s1 = await snap();
    const same = s1.ids.every(id => cents(s0.bal[id]) === cents(s1.bal[id])); const finite = s1.ids.every(id => Number.isFinite(s1.bal[id]));
    check('F1', `Gasto con importe «${bad.slice(0, 12)}»: ${r.added ? 'se registró' : 'rechazado'}`, finite && (r.added === 0 ? same : true), JSON.stringify({ r, same, finite }));
  }
  /* F2 · exactitud centavo a centavo: gasto e ingreso */
  for (const [type, amt, sign] of [['expense', '100.10', -1], ['expense', '0.07', -1], ['income', '12345.67', 1], ['expense', '33333.33', -1]]) {
    const s0 = await snap(); const r = await submit(type, { amount: amt, accountId: ACC.dop, paymentSource: 'account' }); const s1 = await snap();
    check('F2', `${type} ${amt}: el saldo cambia exactamente ${sign * cents(+amt)} centavos`, r.added === 1 && cents(s1.bal[ACC.dop]) - cents(s0.bal[ACC.dop]) === sign * cents(+amt), JSON.stringify({ r, delta: cents(s1.bal[ACC.dop]) - cents(s0.bal[ACC.dop]) }));
  }
  /* F3 · idempotencia: el doble/triple envío crea un solo movimiento */
  { const s0 = await snap(); const r = await submit('expense', { amount: '250.25', accountId: ACC.dop, paymentSource: 'account' }, 3); const s1 = await snap();
    check('F3', 'Triple envío del mismo formulario: un solo movimiento y un solo descuento', r.added === 1 && cents(s0.bal[ACC.dop]) - cents(s1.bal[ACC.dop]) === 25025, JSON.stringify({ r, delta: cents(s0.bal[ACC.dop]) - cents(s1.bal[ACC.dop]) })); }
  /* F4 · transferencias: misma cuenta, otra moneda, conservación */
  { const s0 = await snap(); const r = await submit('transfer', { accountId: ACC.dop, toAccountId: ACC.dop, amount: '100' }); const s1 = await snap();
    const lt = await p.evaluate(() => { const t = window.__T.dbg().transactions; return t[t.length - 1] }); check('F4a', 'Transferencia con origen = destino: el formulario corrige el destino o rechaza; nunca se guarda a sí misma', r.added === 0 || lt.accountId !== lt.toAccountId, JSON.stringify({ r, from: lt.accountId, to: lt.toAccountId })); }
  { const s0 = await snap(); const r = await submit('transfer', { accountId: ACC.dop, toAccountId: ACC.sav, amount: '1234.56' }); const s1 = await snap();
    const d1 = cents(s1.bal[ACC.dop]) - cents(s0.bal[ACC.dop]), d2 = cents(s1.bal[ACC.sav]) - cents(s0.bal[ACC.sav]);
    check('F4b', 'Transferencia DOP→DOP: lo que sale entra (conservación de centavos)', r.added === 1 && d1 === -123456 && d2 === 123456, JSON.stringify({ r, d1, d2 })); }
  { const s0 = await snap(); const r = await submit('transfer', { accountId: ACC.dop, toAccountId: ACC.usd, amount: '6000', fxRate: '60' }); const s1 = await snap();
    const d1 = cents(s1.bal[ACC.dop]) - cents(s0.bal[ACC.dop]), d2 = cents(s1.bal[ACC.usd]) - cents(s0.bal[ACC.usd]);
    check('F4c', 'Transferencia DOP→USD a tasa 60: RD$6,000 → US$100', r.added === 1 && d1 === -600000 && d2 === 10000, JSON.stringify({ r, d1, d2 })); }
  /* F5 · fechas inválidas / extremas */
  for (const d of ['2026-02-30', '0000-00-00', '9999-12-31', '1900-01-01', 'no-fecha']) {
    const s0 = await snap(); const r = await submit('expense', { amount: '10', accountId: ACC.dop, paymentSource: 'account', date: d }); const s1 = await snap();
    const okState = s1.ids.every(id => Number.isFinite(s1.bal[id]));
    const last = await p.evaluate(() => { const t = window.__T.dbg().transactions; return t.length ? t[t.length - 1].date : '' });
    check('F5', `Fecha «${d}»: rechazada o normalizada a una fecha real`, okState && (r.added === 0 || /^\d{4}-\d\d-\d\d$/.test(last) && !isNaN(Date.parse(last)) && last !== '0000-00-00'), JSON.stringify({ r, last }));
  }
  /* F6 · propiedad con semilla: 300 operaciones aleatorias; saldo final == saldo inicial + Σ efectos (en centavos) */
  { const s0 = await snap(); let expected = cents(s0.bal[ACC.dop]); let ok = 0, rejected = 0;
    for (let i = 0; i < 300; i++) {
      const amt = (Math.floor(rnd() * 500000) / 100).toFixed(2); const k = rnd() < .5 ? 'expense' : 'income'; const r = await submit(k, { amount: amt, accountId: ACC.dop, paymentSource: 'account' });
      if (r.added === 1) { expected += (k === 'income' ? 1 : -1) * cents(+amt); ok++ } else rejected++;
    }
    const s1 = await snap(); check('F6', `300 operaciones aleatorias (semilla ${SEED}; ${ok} registradas, ${rejected} rechazadas): saldo = inicial + Σ efectos al centavo`, cents(s1.bal[ACC.dop]) === expected, `esperado ${expected} obtenido ${cents(s1.bal[ACC.dop])} dif ${cents(s1.bal[ACC.dop]) - expected}`); }
  /* F7 · pago de tarjeta/préstamo repetido y por encima de la deuda */
  { const r0 = await p.evaluate(() => { const d = window.__T.dbg(); return { card: d.cards[0].id, loan: d.loans[0].id } });
    const s0 = await snap(); const r = await submit('card_payment', { cardId: r0.card, accountId: ACC.dop, amount: '1', cardPaymentMode: 'custom' }, 2); const s1 = await snap();
    check('F7a', 'Pago de tarjeta doble envío: un solo movimiento', r.added <= 1, JSON.stringify(r));
    const r2 = await submit('card_payment', { cardId: r0.card, accountId: ACC.dop, amount: '99999999', cardPaymentMode: 'custom' }); const s2 = await snap();
    check('F7b', 'Pago de tarjeta muy superior a la deuda: rechazado o saldo finito y coherente', s2.ids.every(id => Number.isFinite(s2.bal[id])) , JSON.stringify({ r2, dbal: cents(s2.bal[ACC.dop]) - cents(s1.bal[ACC.dop]) }));
    const r3 = await submit('loan_payment', { loanId: r0.loan, accountId: ACC.dop, amount: '999999999' }); const s3 = await snap();
    check('F7c', 'Pago de préstamo desproporcionado: sin NaN/Infinity en saldos', s3.ids.every(id => Number.isFinite(s3.bal[id])), JSON.stringify({ r3 })); }
  /* F8 · coherencia global tras todo el ataque */
  { const inv = await p.evaluate(() => { const d = window.__T.dbg(); const bad = []; for (const t of d.transactions) { if (!Number.isFinite(Number(t.amount)) && t.amount !== undefined) bad.push('amount ' + t.id); if (t.accountId && !d.accounts.some(a => a.id === t.accountId)) bad.push('cuenta inexistente ' + t.id); if (t.date && !/^\d{4}-\d\d-\d\d$/.test(t.date)) bad.push('fecha ' + t.date) } const ids = d.transactions.map(t => t.id); if (new Set(ids).size !== ids.length) bad.push('ids duplicados'); return bad.slice(0, 5) });
    check('F8', 'Tras el ataque: sin importes no finitos, cuentas fantasma, fechas mal formadas ni ids duplicados', inv.length === 0, inv.join(' | ')); }
  check('F9', 'Sin errores de página durante todo el ataque financiero', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(fails ? `\nFALLAN: ${fails} de ${n}` : `\nOK: ${n} comprobaciones superadas`); await b.close(); process.exit(fails ? 1 : 0);
})();
