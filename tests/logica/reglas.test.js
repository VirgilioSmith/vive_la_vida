'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../lib/finanzas/reglas.js');

test('redondeo: dos decimales, mitad hacia arriba, entradas inválidas = 0', () => {
  assert.equal(R.rnd(1.005), 1.01);
  assert.equal(R.rnd(2.675), 2.68);
  assert.equal(R.rnd(-1.005), -1);
  assert.equal(R.rnd('abc'), 0);
  assert.equal(R.rnd(undefined), 0);
  assert.equal(R.rnd(0.1 + 0.2), 0.3);
  assert.equal(R.rnd(1e12 + 0.126), 1000000000000.13);
});

test('fechas: fin de mes, bisiestos y zona America/Santo_Domingo', () => {
  assert.equal(R.diaEnMes(2028, 2, 30), '2028-02-29');
  assert.equal(R.diaEnMes(2027, 2, 30), '2027-02-28');
  assert.equal(R.diaEnMes(2026, 4, 31), '2026-04-30');
  assert.equal(R.masMeses('2026-01-31', 1), '2026-02-28');
  assert.equal(R.masMeses('2027-01-31', 1), '2027-02-28');
  assert.equal(R.masMeses('2027-12-15', 1), '2028-01-15');
  assert.equal(R.masMeses('2026-03-31', -1), '2026-02-28');
  assert.equal(R.diferenciaDias('2028-03-01', '2028-02-01'), 29);
  assert.equal(R.diferenciaDias('2027-03-01', '2027-02-01'), 28);
  // 02:00 UTC del 15 es todavía el 14 en Santo Domingo (UTC-4)
  assert.equal(R.hoy(new Date('2026-11-15T02:00:00Z')), '2026-11-14');
  assert.equal(R.hoy(new Date('2026-11-15T05:00:00Z')), '2026-11-15');
});

test('tarjeta: corte y pago en meses cortos', () => {
  assert.equal(R.corteQueCierra('2026-02-10', 31), '2026-02-28');
  assert.equal(R.corteQueCierra('2026-02-28', 31), '2026-02-28');
  assert.equal(R.corteQueCierra('2026-03-01', 31), '2026-03-31');
  assert.equal(R.corteQueCierra('2028-02-29', 30), '2028-02-29');
  assert.equal(R.ultimoCorte('2026-03-05', 20), '2026-02-20');
  assert.equal(R.ultimoCorte('2026-03-20', 20), '2026-03-20');
  assert.equal(R.ultimoCorte('2026-03-05', 31), '2026-02-28');
  assert.equal(R.fechaDePago('2026-01-20', 15), '2026-02-15');
  assert.equal(R.fechaDePago('2026-01-20', 25), '2026-01-25');
  assert.equal(R.fechaDePago('2026-01-31', 31), '2026-02-28');
  assert.equal(R.pagoMinimo(10000, 5), 500);
  assert.equal(R.pagoMinimo(0, 5), 0);
  assert.equal(R.pagoMinimo(1000, -5), 0);
  assert.deepEqual(R.avanceDeEfectivo(1000, 6.5), { neto: 1000, comision: 65, total: 1065 });
  assert.deepEqual(R.avanceDeEfectivo(0, 6.5), { neto: 0, comision: 0, total: 0 });
});

test('certificado: interés simple base 365, retención sobre los intereses', () => {
  const base = { capital: 100000, inicio: '2026-11-14', fin: '2027-11-14', tasaPct: 8, retencionPct: 10 };
  assert.deepEqual(R.interesCertificadoSimple(base), { dias: 365, bruto: 8000, retencion: 800, neto: 7200 });
  assert.equal(R.interesCertificadoSimple({ ...base, tasaPct: 0 }).bruto, 0);
  assert.equal(R.interesCertificadoSimple({ ...base, retencionPct: 0 }).neto, 8000);
  assert.equal(R.interesCertificadoSimple({ ...base, tasaPct: -5 }).bruto, 0, 'tasa negativa no genera interés');
  assert.equal(R.interesCertificadoSimple({ ...base, capital: -10 }).bruto, 0);
  assert.equal(R.interesCertificadoSimple({ ...base, fin: base.inicio }).bruto, 0, 'plazo cero');
  assert.equal(R.interesCertificadoSimple({ ...base, fin: '2026-01-01' }).bruto, 0, 'fin anterior al inicio');
  // año bisiesto: 366 días y la misma base 365
  const bis = R.interesCertificadoSimple({ capital: 36500, inicio: '2028-01-01', fin: '2029-01-01', tasaPct: 10, retencionPct: 0 });
  assert.equal(bis.dias, 366); assert.equal(bis.bruto, 3660);
  // valor extremo
  assert.equal(R.interesCertificadoSimple({ ...base, capital: 1e9 }).bruto, 80000000);
  // la retención nunca se aplica al capital
  const r = R.interesCertificadoSimple(base);
  assert.ok(r.retencion < base.capital * 0.1);
  // rescate parcial a mitad del plazo
  const parcial = R.interesCertificado({ eventos: [{ fecha: '2026-01-01', delta: 1000 }, { fecha: '2026-07-02', delta: -500 }], inicio: '2026-01-01', fin: '2027-01-01', tasaPct: 10, retencionPct: 0 });
  assert.equal(parcial.bruto, R.rnd((1000 * 182 + 500 * 183) * 10 / 36500));
});

test('préstamo: cuota nivelada, amortización cuadra con el capital', () => {
  assert.equal(R.rnd(R.cuotaNivelada(12000, 0, 1, 12)), 1000);
  const a = R.amortizacion({ capital: 100000, tasaAnualPct: 15, periodosPorMes: 1, cuotas: 36 });
  assert.equal(a.filas.length, 36);
  assert.equal(a.filas.at(-1).saldo, 0);
  assert.equal(R.rnd(a.filas.reduce((s, f) => s + f.capital, 0)), 100000);
  assert.equal(a.filas[0].interes, 1250);
  assert.ok(a.cuota > 3466 && a.cuota < 3467);
  const q = R.amortizacion({ capital: 5000, tasaAnualPct: 12, periodosPorMes: 2, cuotas: 10 });
  assert.equal(q.filas.at(-1).saldo, 0);
  assert.equal(R.amortizacion({ capital: 1000, tasaAnualPct: 10, periodosPorMes: 1, cuotas: 1 }).filas.length, 1);
  assert.equal(R.amortizacion({ capital: 0, tasaAnualPct: 10, periodosPorMes: 1, cuotas: 12 }).filas.length, 0);
  assert.equal(R.repartirMensual(100, 1, 0), 100);
  assert.equal(R.repartirMensual(101, 2, 0) + R.repartirMensual(101, 2, 1), 101);
});

test('consistencia de cuentas: saldo inicial + movimientos = saldo final', () => {
  const movs = [
    { type: 'income', accountId: 'a', amount: 1000, date: '2026-01-05' },
    { type: 'expense', accountId: 'a', amount: 200, paymentTax: 1, date: '2026-01-06' },
    { type: 'certificate_funding', accountId: 'a', amount: 300, date: '2026-01-07' },
    { type: 'certificate_redemption', accountId: 'a', amount: 300, date: '2026-12-31' },
    { type: 'transfer', accountId: 'a', toAccountId: 'b', amount: 100, transferFee: 2, date: '2026-01-08' },
    { type: 'card_payment', accountId: 'a', amount: 50, date: '2026-01-09' },
    { type: 'income', accountId: 'a', amount: 5, date: '2027-01-01' },
  ];
  const a = R.saldoCuenta({ id: 'a', apertura: 500, abierta: '2026-01-01', movimientos: movs, hasta: '2026-06-30' });
  assert.equal(a, 500 + 1000 - 201 - 300 - 102 - 50);
  // la constitución disminuye y el vencimiento aumenta, sin doble conteo
  assert.equal(R.saldoCuenta({ id: 'a', apertura: 500, abierta: '2026-01-01', movimientos: movs, hasta: '2026-12-31' }), a + 300);
  // una transferencia conserva el dinero salvo la comisión
  const b = R.saldoCuenta({ id: 'b', apertura: 0, abierta: '2026-01-01', movimientos: movs, hasta: '2026-06-30' });
  assert.equal(b, 100);
  // cuenta abierta después de la fecha: saldo inicial no cuenta
  assert.equal(R.saldoCuenta({ id: 'c', apertura: 900, abierta: '2026-07-01', movimientos: [], hasta: '2026-06-30' }), 0);
  // saldo nunca depende del orden de los movimientos
  assert.equal(R.saldoCuenta({ id: 'a', apertura: 500, abierta: '2026-01-01', movimientos: [...movs].reverse(), hasta: '2026-06-30' }), a);
});

test('monedas: se usa la tasa guardada con el registro', () => {
  assert.equal(R.aDop(100, 'USD', 58, 60), 5800);
  assert.equal(R.aDop(100, 'USD', 0, 60), 6000);
  assert.equal(R.aDop(100, 'DOP', 58, 60), 100);
});

test('vigencias: el pasado no se modifica', () => {
  let v = [];
  v = R.nuevaVigencia(v, { clave: 'tarjeta.avance', sujeto: 't1', valor: { pct: 6.5 }, desde: '2026-01-01' });
  const antes = JSON.stringify(v);
  const v2 = R.nuevaVigencia(v, { clave: 'tarjeta.avance', sujeto: 't1', valor: { pct: 7 }, desde: '2026-07-01' });
  assert.equal(JSON.stringify(v), antes, 'la lista anterior no cambia');
  assert.equal(v.length, 1); assert.equal(v2.length, 2);
  assert.equal(R.reglaVigente(v2, 'tarjeta.avance', '2026-06-30', 't1').pct, 6.5);
  assert.equal(R.reglaVigente(v2, 'tarjeta.avance', '2026-07-01', 't1').pct, 7);
  assert.equal(R.reglaVigente(v2, 'tarjeta.avance', '2025-12-31', 't1'), undefined);
  assert.equal(R.hastaVigencia(v2, 'tarjeta.avance', '2026-01-01', 't1'), '2026-07-01');
  assert.equal(R.hastaVigencia(v2, 'tarjeta.avance', '2026-07-01', 't1'), null);
  assert.throws(() => R.nuevaVigencia(v2, { clave: 'tarjeta.avance', sujeto: 't1', valor: { pct: 9 }, desde: '2026-03-01' }), /no se reescribe/);
  assert.throws(() => R.nuevaVigencia(v2, { clave: 'tarjeta.avance', sujeto: 't1', valor: { pct: 9 }, desde: '2026-07-01' }), /no se reescribe/);
  assert.throws(() => { v2[0].valor.pct = 99; }, TypeError, 'las vigencias están congeladas');
  assert.throws(() => R.nuevaVigencia(v2, { clave: '', valor: 1, desde: 'x' }), /inválida/);
  // regla general con excepción por sujeto
  let g = R.nuevaVigencia([], { clave: 'cert.retencion', valor: { pct: 10 }, desde: '2026-01-01' });
  g = R.nuevaVigencia(g, { clave: 'cert.retencion', sujeto: 'c9', valor: { pct: 0 }, desde: '2026-01-01' });
  assert.equal(R.reglaVigente(g, 'cert.retencion', '2026-05-01', 'c9').pct, 0);
  assert.equal(R.reglaVigente(g, 'cert.retencion', '2026-05-01', 'otro').pct, 10);
});

test('historial: un cambio de regla no altera registros anteriores y sí los periodos posteriores', () => {
  let v = R.nuevaVigencia([], { clave: 'cert.retencion', valor: { pct: 10 }, desde: '2026-01-01' });
  const calcular = (fecha) => {
    const reglas = { retencion: R.reglaVigente(v, 'cert.retencion', fecha).pct, tasa: 8 };
    const res = R.interesCertificadoSimple({ capital: 100000, inicio: fecha, fin: R.masMeses(fecha, 12), tasaPct: reglas.tasa, retencionPct: reglas.retencion });
    return R.instantanea({ tipo: 'certificado', idRegistro: 'c' + fecha, fecha, reglas, resultados: res });
  };
  const antiguo = calcular('2026-03-01');
  const copia = JSON.stringify(antiguo);
  v = R.nuevaVigencia(v, { clave: 'cert.retencion', valor: { pct: 15 }, desde: '2026-09-01' });
  assert.equal(JSON.stringify(antiguo), copia, 'el registro anterior es idéntico');
  assert.equal(antiguo.resultados.neto, 7200);
  assert.equal(calcular('2026-10-01').resultados.neto, 6800, 'el nuevo periodo usa la regla nueva');
  assert.throws(() => { antiguo.resultados.neto = 1; }, TypeError, 'la instantánea es inmutable');
});

test('idempotencia: recalcular dos veces da el mismo resultado', () => {
  const e = { capital: 123456.78, inicio: '2026-02-28', fin: '2027-02-28', tasaPct: 7.25, retencionPct: 10 };
  assert.deepEqual(R.interesCertificadoSimple(e), R.interesCertificadoSimple(e));
  const p = { capital: 250000, tasaAnualPct: 14.5, periodosPorMes: 2, cuotas: 48 };
  assert.deepEqual(R.amortizacion(p), R.amortizacion(p));
  const ent = { id: 'a', apertura: 10, abierta: '2026-01-01', movimientos: [{ type: 'income', accountId: 'a', amount: 5, date: '2026-01-02' }], hasta: '2026-02-01' };
  assert.equal(R.saldoCuenta(ent), R.saldoCuenta(ent));
});
