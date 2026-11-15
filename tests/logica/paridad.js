'use strict';
/* Paridad: las funciones puras de src/lib/finanzas/reglas.js deben dar el mismo resultado que la app. */
const { chromium } = require('playwright');
const path = require('path');
const open = require('../harness.js');
const R = require('../../src/lib/finanzas/reglas.js');
let ok = 0, fallos = [];
const eq = (nombre, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else fallos.push(`${nombre}: app=${JSON.stringify(a)} puro=${JSON.stringify(b)}`); };
(async () => {
  const b = await chromium.launch();
  const { p } = await open(b, 390, 844);
  const r = await p.evaluate(() => {
    const T = window.__T, F = T.fn, db = T.dbg(), out = {};
    const fechas = ['2026-01-31', '2026-02-28', '2028-02-29', '2027-03-31', '2026-12-15', '2026-06-30', '2026-11-14'];
    out.masMeses = fechas.flatMap(f => [-13, -1, 1, 2, 12].map(n => [f, n, F.plusMonths(f, n)]));
    out.corte = fechas.flatMap(f => [1, 15, 20, 28, 29, 30, 31].map(d => [f, d, F.cutFor(f, d), F.lastCutAt(f, d), F.cardDue(F.cutFor(f, d), 15), F.cardDue(F.cutFor(f, d), 31)]));
    out.rnd = [1.005, 2.675, -1.005, 0.1 + 0.2, 1e9 + 0.126, 'x', null, 12.345].map(v => [v, F.rnd(v)]);
    out.dias = [['2028-03-01', '2028-02-01'], ['2027-03-01', '2027-02-01'], ['2026-11-14', '2027-11-14']].map(([a, c]) => [a, c, F.diffDays(a, c)]);
    out.prestamos = db.loans.map(l => { const o = F.fullOriginalLoan(l); return { id: l.id, principal: l.principal, rate: l.rate, ppm: F.v49LoanPeriodsPerMonth(l), n: F.v49LoanPeriodCount(l), insurance: l.insuranceMonthly, fee: l.monthlyFee, cuota: o.installment, interes: o.interest, filas: o.rows.length, ultimoSaldo: o.rows.at(-1)?.balance, capitalSuma: Math.round(o.rows.reduce((s, x) => s + x.principal, 0) * 100) / 100 }; });
    out.certificados = db.certificates.map(c => ({ id: c.id, capitalMode: c.capitalMode, principal: c.principal, rate: c.rate, tax: c.taxPct, start: c.startDate, end: c.maturityDate, movs: db.transactions.filter(t => t.certificateId === c.id).length, proj: (() => { const x = F.certProjection(c); return { days: x.days, gross: x.gross, tax: x.tax, net: x.net }; })() }));
    out.cuentas = db.accounts.map(a => ({ id: a.id, opening: a.opening, opened: a.opened, saldo: F.getAccountBalance(a, new Date().toISOString().slice(0, 10)) }));
    out.hoy = (() => { const d = new Date(); return [d.getFullYear(), d.getMonth() + 1, d.getDate()]; })();
    out.movs = db.transactions.map(t => ({ ...t }));
    return out;
  });
  for (const [f, n, v] of r.masMeses) eq(`masMeses ${f} ${n}`, v, R.masMeses(f, n));
  for (const [f, d, cut, last, due15, due31] of r.corte) {
    eq(`corte ${f} d${d}`, cut, R.corteQueCierra(f, d)); eq(`ultimoCorte ${f} d${d}`, last, R.ultimoCorte(f, d));
    eq(`pago15 ${f} d${d}`, due15, R.fechaDePago(cut, 15)); eq(`pago31 ${f} d${d}`, due31, R.fechaDePago(cut, 31));
  }
  for (const [v, x] of r.rnd) eq(`rnd ${v}`, x, R.rnd(v));
  for (const [a, c, x] of r.dias) eq(`dias ${a} ${c}`, x, R.diferenciaDias(a, c));
  for (const l of r.prestamos) {
    const rep = (m) => (i) => R.repartirMensual(m, l.ppm, i);
    const a = R.amortizacion({ capital: l.principal, tasaAnualPct: l.rate, periodosPorMes: l.ppm, cuotas: l.n, seguroPorPeriodo: rep(l.insurance || 0), cargoPorPeriodo: rep(l.fee || 0) });
    eq(`préstamo cuota ${l.id}`, l.cuota, a.cuota); eq(`préstamo interés ${l.id}`, l.interes, a.interesTotal);
    eq(`préstamo filas ${l.id}`, l.filas, a.filas.length); eq(`préstamo saldo final ${l.id}`, l.ultimoSaldo, a.filas.at(-1)?.saldo);
    eq(`préstamo capital ${l.id}`, l.capitalSuma, R.rnd(a.filas.reduce((s, f) => s + f.capital, 0)));
  }
  for (const c of r.certificados) {
    if (c.capitalMode === 'pending' || c.movs > 0) continue;
    const x = R.interesCertificadoSimple({ capital: c.principal, inicio: c.start, fin: c.end, tasaPct: c.rate, retencionPct: c.tax });
    eq(`certificado bruto ${c.id}`, c.proj.gross, x.bruto); eq(`certificado retención ${c.id}`, c.proj.tax, x.retencion); eq(`certificado neto ${c.id}`, c.proj.net, x.neto); eq(`certificado días ${c.id}`, c.proj.days, x.dias);
  }
  const hoyTexto = `${r.hoy[0]}-${String(r.hoy[1]).padStart(2, '0')}-${String(r.hoy[2]).padStart(2, '0')}`;
  for (const a of r.cuentas) {
    const movs = r.movs.filter(t => t.accountId === a.id || t.toAccountId === a.id);
    // las operaciones con préstamos personales dependen de otro registro: se excluyen de la comparación
    if (movs.some(t => ['personal_issue', 'personal_settlement'].includes(t.type))) continue;
    eq(`saldo cuenta ${a.id}`, a.saldo, R.saldoCuenta({ id: a.id, apertura: a.opening, abierta: a.opened, movimientos: movs, hasta: hoyTexto }));
  }
  await b.close();
  console.log(`paridad: ${ok} coinciden, ${fallos.length} difieren`);
  fallos.slice(0, 25).forEach(f => console.log(' -', f));
  process.exit(fallos.length ? 1 : 0);
})();
