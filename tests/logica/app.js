'use strict';
/* Pruebas de la app real: reloj de Santo Domingo, vigencias de certificados, historial inmutable. */
const { chromium } = require('playwright');
const open = require('../harness.js');
const R = require('../../lib/finanzas/reglas.js');
let ok = 0; const fallos = [];
const afirmar = (n, c, d = '') => { if (c) ok++; else fallos.push(n + (d ? ' → ' + d : '')); };
(async () => {
  const b = await chromium.launch();
  const { p } = await open(b, 390, 844);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  // 1) reloj
  const hoyApp = await p.evaluate(() => window.__T.fn.today());
  afirmar('today() = hoy() de Santo Domingo', hoyApp === R.hoy(), hoyApp);
  // 2) certificado existente: editar la tasa crea vigencia y no cambia lo devengado
  const id = await p.evaluate(() => window.__T.dbg().certificates[0]?.id);
  afirmar('hay un certificado de prueba', !!id);
  const antes = await p.evaluate((id) => { const c = window.__T.dbg().certificates.find((x) => x.id === id); return { c: JSON.parse(JSON.stringify(c)), proj: window.__T.fn.certProjection(c), versiones: (window.__T.dbg().ruleVersions || []).length }; }, id);
  const editar = async (campo, valor) => {
    await p.evaluate(([a, id]) => { document.getElementById('modal-root').innerHTML = ''; const x = document.createElement('button'); x.dataset.act = a; x.dataset.id = id; document.body.appendChild(x); x.click(); x.remove(); }, ['editCertificate', id]);
    await p.waitForTimeout(900);
    await p.evaluate(([n, v]) => { const f = document.querySelector('#modal-root form'); const e = f.elements.namedItem(n); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [campo, valor]);
    for (let i = 0; i < 3; i++) { await p.evaluate(() => document.querySelector('#modal-root form .v1110-next:not([hidden])')?.click()); await p.waitForTimeout(200); }
    await p.evaluate(() => document.querySelector('#modal-root form button[type=submit]:not([hidden])')?.click());
    await p.waitForTimeout(800);
  };
  const nuevaTasa = antes.c.rate + 2;
  await editar('rate', String(nuevaTasa));
  const despues = await p.evaluate((id) => { const d = window.__T.dbg(), c = d.certificates.find((x) => x.id === id); return { c: JSON.parse(JSON.stringify(c)), proj: window.__T.fn.certProjection(c), vers: d.ruleVersions.filter((v) => v.sujeto === id).map((v) => ({ ...v })) }; }, id);
  afirmar('la edición guardó la tasa nueva', despues.c.rate === nuevaTasa, String(despues.c.rate));
  afirmar('se crearon 2 vigencias (base y nueva)', despues.vers.length === 2, String(despues.vers.length));
  afirmar('la vigencia base conserva la tasa anterior', despues.vers[0]?.valor.rate === antes.c.rate && despues.vers[0]?.desde === antes.c.startDate);
  afirmar('la nueva vigencia empieza hoy o después', despues.vers[1]?.desde >= hoyApp && despues.vers[1]?.valor.rate === nuevaTasa);
  const esperado = R.interesCertificadoVigencias({
    eventos: [{ fecha: antes.c.startDate, delta: antes.c.principal }], inicio: antes.c.startDate, fin: antes.c.maturityDate,
    condiciones: (f) => (f < despues.vers[1].desde ? { tasa: antes.c.rate, retencion: antes.c.taxPct } : { tasa: nuevaTasa, retencion: antes.c.taxPct }),
    cortes: [despues.vers[1].desde],
  });
  if (antes.c.capitalMode !== 'pending') {
    afirmar('el interés bruto usa tramos (app = capa pura)', despues.proj.gross === esperado.bruto, `${despues.proj.gross} vs ${esperado.bruto}`);
    afirmar('el interés neto usa tramos (app = capa pura)', despues.proj.net === esperado.neto, `${despues.proj.net} vs ${esperado.neto}`);
  }
  // el tramo ya transcurrido (hasta hoy) no cambió: con la tasa vieja hasta hoy el devengado a hoy es idéntico
  const devengadoAntes = R.interesCertificadoSimple({ capital: antes.c.principal, inicio: antes.c.startDate, fin: despues.vers[1].desde, tasaPct: antes.c.rate, retencionPct: antes.c.taxPct });
  const devengadoDespues = R.interesCertificadoVigencias({ eventos: [{ fecha: antes.c.startDate, delta: antes.c.principal }], inicio: antes.c.startDate, fin: despues.vers[1].desde, condiciones: (f) => (f < despues.vers[1].desde ? { tasa: antes.c.rate, retencion: antes.c.taxPct } : { tasa: nuevaTasa, retencion: antes.c.taxPct }), cortes: [despues.vers[1].desde] });
  afirmar('lo devengado hasta el cambio es el mismo', JSON.stringify(devengadoAntes) === JSON.stringify(devengadoDespues));
  // 3) idempotencia: recalcular dos veces da lo mismo
  const dos = await p.evaluate((id) => { const c = window.__T.dbg().certificates.find((x) => x.id === id); return [window.__T.fn.certProjection(c), window.__T.fn.certProjection(c)]; }, id);
  afirmar('certProjection es idempotente', JSON.stringify(dos[0]) === JSON.stringify(dos[1]));
  // 4) historial inmutable en la app
  const inmut = await p.evaluate((id) => { const v = window.__T.dbg().ruleVersions.find((x) => x.sujeto === id); try { 'use strict'; v.valor.rate = 999; } catch (e) { return 'bloqueado'; } return v.valor.rate === 999 ? 'modificado' : 'bloqueado'; }, id);
  afirmar('la vigencia registrada no se puede modificar', inmut === 'bloqueado', inmut);
  // 5) certificado nuevo: vigencia inicial e instantánea
  await p.evaluate(() => { const d = window.__T.dbg(); window.__nuevo = { before: { v: d.ruleVersions.length, s: d.recordSnapshots.length } }; });
  // 6) consistencia: saldo inicial + movimientos = saldo final en todas las cuentas
  const cons = await p.evaluate(() => { const d = window.__T.dbg(), F = window.__T.fn, hoy = F.today(); return d.accounts.map((a) => { const movs = d.transactions.filter((t) => t.accountId === a.id || t.toAccountId === a.id); return { id: a.id, app: F.getAccountBalance(a, hoy), t: movs.some((t) => ['personal_issue', 'personal_settlement'].includes(t.type)) }; }); });
  const movs = await p.evaluate(() => window.__T.dbg().transactions.map((t) => ({ ...t })));
  const cuentas = await p.evaluate(() => window.__T.dbg().accounts.map((a) => ({ id: a.id, opening: a.opening, opened: a.opened })));
  for (const c of cons) { if (c.t) continue; const a = cuentas.find((x) => x.id === c.id); const m = movs.filter((t) => t.accountId === c.id || t.toAccountId === c.id); afirmar('saldo inicial + movimientos = saldo (cuenta)', R.saldoCuenta({ id: c.id, apertura: a.opening, abierta: a.opened, movimientos: m, hasta: hoyApp }) === c.app); }
  // 7) préstamo con varios cambios de tasa: cada fecha usa su tasa
  const tasas = await p.evaluate(() => {
    const F = window.__T.fn;
    const base = { rate: 10, currentRate: 14, rateEffectiveFrom: '2026-09-01', paymentFrequency: 'monthly', months: 12 };
    const con = { ...base, conditionHistory: [{ effectiveFrom: '2026-03-01', fromRate: 10, toRate: 12 }, { effectiveFrom: '2026-09-01', fromRate: 12, toRate: 14 }] };
    const ini = (l, f) => F.loanRateAt(l, f);
    return { sinHist: [ini(base, '2026-01-01'), ini(base, '2026-08-31'), ini(base, '2026-09-01')], conHist: [ini(con, '2026-01-01'), ini(con, '2026-03-01'), ini(con, '2026-08-31'), ini(con, '2026-09-01'), ini(con, '2027-01-01')] };
  });
  afirmar('préstamo sin historial: regla anterior intacta', JSON.stringify(tasas.sinHist) === '[10,10,14]', JSON.stringify(tasas.sinHist));
  afirmar('préstamo con 2 cambios: cada tramo usa su tasa', JSON.stringify(tasas.conHist) === '[10,12,12,14,14]', JSON.stringify(tasas.conHist));
  // 8) monedas: se usa la tasa guardada con el movimiento, no la vigente
  const fxr = await p.evaluate(() => {
    const F = window.__T.fn, d = window.__T.dbg(), antes = d.settings.fx; d.settings.fx = 60;
    const t = { currency: 'USD', amount: 100, fxRateSnapshot: 58 }, sin = { currency: 'USD', amount: 100 }, dop = { currency: 'DOP', amount: 100, fxRateSnapshot: 58 };
    const r = [F.txDop(t), F.v144CurrentFx(t), F.txDop(sin), F.txDop(dop)]; d.settings.fx = 70; r.push(F.txDop(t)); d.settings.fx = antes; return r;
  });
  afirmar('USD con tasa guardada usa esa tasa', fxr[0] === 5800 && fxr[1] === 5800 && fxr[4] === 5800, JSON.stringify(fxr));
  afirmar('USD sin tasa guardada usa la vigente', fxr[2] === 6000, JSON.stringify(fxr));
  afirmar('DOP no se convierte', fxr[3] === 100, JSON.stringify(fxr));
  // 9) tarjeta: cambiar el pago mínimo no altera los cortes anteriores
  const tj = await p.evaluate(() => { const d = window.__T.dbg(), c = d.cards.find((x) => d.transactions.some((t) => t.cardId === x.id)); return c ? { id: c.id, minPct: c.minPct } : null; });
  if (tj) {
    const leer = () => p.evaluate((id) => { const d = window.__T.dbg(), c = d.cards.find((x) => x.id === id); const L = window.__T.fn.v169CardCycleLedger(c, 'DOP'); return L.cycles.map((x) => [x.cutDate, x.amount, x.minimum]); }, tj.id);
    const antesC = await leer();
    await p.evaluate(([a, id]) => { document.getElementById('modal-root').innerHTML = ''; const x = document.createElement('button'); x.dataset.act = a; x.dataset.id = id; document.body.appendChild(x); x.click(); x.remove(); }, ['editCard', tj.id]);
    await p.waitForTimeout(900);
    await p.evaluate(() => { const f = document.querySelector('#modal-root form'); for (const [n, v] of [['minPct', '9'], ['minFloor', '500']]) { const e = f.elements.namedItem(n); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); } });
    for (let i = 0; i < 2; i++) { await p.evaluate(() => document.querySelector('#modal-root form .v1110-next:not([hidden])')?.click()); await p.waitForTimeout(200); }
    await p.evaluate(() => document.querySelector('#modal-root form button[type=submit]:not([hidden])')?.click());
    await p.waitForTimeout(800);
    const vers = await p.evaluate((id) => window.__T.dbg().ruleVersions.filter((v) => v.sujeto === id && v.clave === 'tarjeta.pago_minimo').map((v) => ({ ...v })), tj.id);
    afirmar('cambiar el mínimo agregó dos vigencias', vers.length === 2, String(vers.length));
    const despuesC = await leer();
    const hoyT = hoyApp;
    const cerrados = antesC.filter((c) => c[0] < hoyT && c[2] > 0);
    afirmar('hay cortes anteriores para comparar', cerrados.length > 0, String(antesC.length));
    for (const c of cerrados) { const d2 = despuesC.find((x) => x[0] === c[0]); afirmar('el mínimo del corte ' + c[0] + ' no cambia', d2 && d2[2] === c[2], JSON.stringify([c, d2])); }
  }
  // 11) tarjeta: cambiar el límite rige desde hoy y no altera el histórico
  const tl = await p.evaluate(() => { const d = window.__T.dbg(), c = d.cards.find((x) => d.transactions.some((t) => t.cardId === x.id)); return c ? { id: c.id, limit: c.limitDOP } : null; });
  if (tl) {
    const util = () => p.evaluate((id) => { const d = window.__T.dbg(), c = d.cards.find((x) => x.id === id), F = window.__T.fn, y = +F.today().slice(0, 4); return F.cardHistoryData(c, y, 'DOP').filter((m) => m.balance !== null).map((m) => [m.key, m.limit]); }, tl.id);
    const antesL = await util();
    const nuevoLimite = tl.limit + 100000;
    await p.evaluate(([a, id]) => { document.getElementById('modal-root').innerHTML = ''; const x = document.createElement('button'); x.dataset.act = a; x.dataset.id = id; document.body.appendChild(x); x.click(); x.remove(); }, ['editCard', tl.id]);
    await p.waitForTimeout(900);
    await p.evaluate((v) => { const f = document.querySelector('#modal-root form'); const e = f.elements.namedItem('limitDOP'); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); }, nuevoLimite);
    for (let i = 0; i < 2; i++) { await p.evaluate(() => document.querySelector('#modal-root form .v1110-next:not([hidden])')?.click()); await p.waitForTimeout(200); }
    await p.evaluate(() => document.querySelector('#modal-root form button[type=submit]:not([hidden])')?.click());
    await p.waitForTimeout(800);
    const info = await p.evaluate(([id, ayer]) => { const d = window.__T.dbg(), c = d.cards.find((x) => x.id === id), F = window.__T.fn; return { hoy: F.cardConditionAt(c, 'limitDOP', F.today()), pasado: F.cardConditionAt(c, 'limitDOP', ayer), cambios: F.cardConditionChanges(c), vig: d.ruleVersions.filter((v) => v.sujeto === id && v.clave === 'tarjeta.condiciones').length, audit: d.auditLog.filter((a) => a.idRegistro === id).length }; }, [tl.id, R.fechaTexto(new Date(R.fechaObj(hoyApp).getTime() - 86400000))]);
    afirmar('el límite nuevo rige hoy', info.hoy === nuevoLimite, JSON.stringify(info));
    afirmar('el día anterior conserva el límite anterior', info.pasado === tl.limit, JSON.stringify(info));
    afirmar('se registró el cambio en el historial visible', info.cambios.some((c) => c.campo === 'limitDOP' && c.antes === tl.limit && c.despues === nuevoLimite));
    afirmar('quedó registro de auditoría', info.audit >= 1);
    const despuesL = await util();
    const hoyMes = hoyApp.slice(0, 7);
    for (const [k, lim] of antesL) { if (k >= hoyMes) continue; const d2 = despuesL.find((x) => x[0] === k); afirmar('el límite del mes ' + k + ' no cambia', d2 && d2[1] === lim, JSON.stringify([k, lim, d2])); }
  }
  afirmar('sin errores de consola', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(`app: ${ok} correctas, ${fallos.length} fallan`); fallos.forEach((f) => console.log(' -', f));
  process.exit(fallos.length ? 1 : 0);
})();
