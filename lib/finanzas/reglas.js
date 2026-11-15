/* Reglas y cálculos financieros puros.
   Sin acceso a datos, sin DOM y sin reloj: todo recibe sus entradas y devuelve su resultado.
   Funciona en el navegador (window.FinanzasReglas) y en Node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FinanzasReglas = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Números y redondeo ---------- */
  const num = (v) => (Number.isFinite(+v) ? +v : 0);
  /* Regla única de redondeo: dos decimales, mitad hacia arriba, solo al producir un importe. */
  const rnd = (v) => Math.round((num(v) + Number.EPSILON) * 100) / 100;

  /* ---------- Fechas (AAAA-MM-DD, sin zona horaria: son fechas de calendario) ---------- */
  const ZONA = 'America/Santo_Domingo';
  const pad = (n) => String(n).padStart(2, '0');
  const fechaTexto = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fechaObj = (s) => {
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d || 1);
  };
  /* Fecha de hoy en la zona del producto, independiente de la zona del dispositivo. */
  const hoy = (ahora = new Date()) => {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
    return p;
  };
  /* Día del mes limitado al último día válido (29, 30 y 31 en meses cortos y bisiestos). */
  const diaEnMes = (anio, mes, dia) =>
    fechaTexto(new Date(anio, mes - 1, Math.min(Math.max(1, dia), new Date(anio, mes, 0).getDate())));
  const masMeses = (s, n) => {
    const d = fechaObj(s);
    return diaEnMes(d.getFullYear(), d.getMonth() + 1 + n, d.getDate());
  };
  const diferenciaDias = (a, b) => Math.round((fechaObj(a) - fechaObj(b)) / 86400000);

  /* ---------- Tarjetas: ciclo ---------- */
  /* Corte que cierra la fecha s: el del mismo mes si aún no pasó, si no el del mes siguiente. */
  const corteQueCierra = (s, dia) => {
    const d = fechaObj(s), y = d.getFullYear(), m = d.getMonth() + 1;
    const corte = diaEnMes(y, m, dia);
    return s <= corte ? corte : diaEnMes(y, m + 1, dia);
  };
  /* Último corte ocurrido en o antes de s. */
  const ultimoCorte = (s, dia) => {
    const d = fechaObj(s), y = d.getFullYear(), m = d.getMonth() + 1;
    const c = diaEnMes(y, m, dia);
    return c <= s ? c : diaEnMes(y, m - 1, dia);
  };
  /* Fecha de pago de un corte: primer día de pago posterior al corte. */
  const fechaDePago = (corte, diaPago) => {
    const d = fechaObj(corte), y = d.getFullYear(), m = d.getMonth() + 1;
    const mismo = diaEnMes(y, m, diaPago);
    return mismo > corte ? mismo : diaEnMes(y, m + 1, diaPago);
  };
  const pagoMinimo = (facturado, pct) => rnd(num(facturado) * Math.max(0, num(pct)) / 100);
  /* Comisión por avance: se cobra sobre el efectivo recibido. */
  const avanceDeEfectivo = (efectivo, pct) => {
    const neto = rnd(efectivo), comision = rnd(neto * Math.max(0, num(pct)) / 100);
    return { neto, comision, total: rnd(neto + comision) };
  };

  /* ---------- Certificados: interés simple, base 365 días ---------- */
  /* eventos: [{fecha, delta}] aportes (+) y rescates (-) dentro de la vigencia. El capital inicial entra como evento en `inicio`. */
  const interesCertificado = ({ eventos, inicio, fin, tasaPct, retencionPct }) => {
    const orden = [...eventos].sort((a, b) => a.fecha.localeCompare(b.fecha));
    let actual = 0, cursor = inicio, capitalDias = 0;
    for (const e of orden) {
      const dia = e.fecha < cursor ? cursor : e.fecha;
      if (dia > fin) continue;
      capitalDias += Math.max(0, actual) * Math.max(0, diferenciaDias(dia, cursor));
      actual = Math.max(0, rnd(actual + e.delta));
      cursor = dia;
    }
    capitalDias += Math.max(0, actual) * Math.max(0, diferenciaDias(fin, cursor));
    const bruto = rnd(capitalDias * Math.max(0, num(tasaPct)) / 36500);
    const retencion = rnd(bruto * Math.max(0, num(retencionPct)) / 100);
    return { dias: Math.max(0, diferenciaDias(fin, inicio)), bruto, retencion, neto: rnd(bruto - retencion) };
  };
  const interesCertificadoSimple = ({ capital, inicio, fin, tasaPct, retencionPct }) =>
    interesCertificado({ eventos: [{ fecha: inicio, delta: Math.max(0, num(capital)) }], inicio, fin, tasaPct, retencionPct });

  /* ---------- Préstamos: cuota nivelada y amortización ---------- */
  const cuotaNivelada = (capital, tasaAnualPct, periodosPorMes, cuotas) => {
    const p = Math.max(0, num(capital)), n = Math.max(1, Math.floor(cuotas));
    const r = Math.max(0, num(tasaAnualPct)) / 1200 / periodosPorMes;
    return r === 0 ? p / n : p * r / (1 - Math.pow(1 + r, -n));
  };
  const amortizacion = ({ capital, tasaAnualPct, periodosPorMes, cuotas, seguroPorPeriodo = () => 0, cargoPorPeriodo = () => 0 }) => {
    const p = Math.max(0, num(capital)), n = Math.min(1200, Math.max(1, Math.floor(cuotas)));
    const r = Math.max(0, num(tasaAnualPct)) / 1200 / periodosPorMes;
    const pago = cuotaNivelada(p, tasaAnualPct, periodosPorMes, n);
    let saldo = p; const filas = [];
    for (let i = 0; i < n && saldo > 0.005; i++) {
      const interes = rnd(saldo * r);
      const capitalPago = i === n - 1 ? rnd(saldo) : rnd(Math.min(saldo, Math.max(0, pago - interes)));
      saldo = rnd(Math.max(0, saldo - capitalPago));
      const seguro = seguroPorPeriodo(i), cargo = cargoPorPeriodo(i);
      filas.push({ periodo: i + 1, capital: capitalPago, interes, seguro, cargo, pago: rnd(capitalPago + interes + seguro + cargo), saldo });
    }
    return { cuota: rnd(pago), filas, interesTotal: rnd(filas.reduce((a, f) => a + f.interes, 0)) };
  };
  /* Un mes de seguro o cargo repartido entre periodos (quincenal: la primera mitad redondeada). */
  const repartirMensual = (monto, periodosPorMes, indice = 0) => {
    const mensual = rnd(monto);
    if (periodosPorMes === 1) return mensual;
    const primera = rnd(mensual / 2);
    return indice % 2 === 0 ? primera : rnd(mensual - primera);
  };

  /* ---------- Cuentas: saldo ---------- */
  /* Signo del movimiento sobre la cuenta `idCuenta`. Devuelve el cambio de saldo. */
  const efectoMovimiento = (t, idCuenta) => {
    const monto = num(t.amount), origen = num(t.sourceAmount || t.amount);
    const impuestos = num(t.paymentTax) + num(t.paymentFee);
    const propia = t.accountId === idCuenta;
    if (['income', 'bank_reward'].includes(t.type) && propia) return monto;
    if (t.type === 'expense' && propia) return -(monto + impuestos);
    if (t.type === 'adjustment' && propia) return monto;
    if (t.type === 'certificate_funding' && propia) return -monto;
    if (t.type === 'certificate_redemption' && propia) return monto;
    if (t.type === 'card_advance' && t.toAccountId === idCuenta) return num(t.advanceNet);
    if (t.type === 'card_payment' && propia) return -(origen + impuestos);
    if (t.type === 'loan_payment' && propia) return -(origen + impuestos);
    if (t.type === 'transfer') {
      let d = 0;
      if (propia) d -= monto + num(t.transferFee);
      if (t.toAccountId === idCuenta) d += num(t.targetAmount || monto);
      return d;
    }
    return 0;
  };
  const saldoCuenta = ({ id, apertura, abierta, movimientos, hasta }) => {
    let saldo = abierta <= hasta ? num(apertura) : 0;
    for (const t of movimientos) { if (t.date > hasta) continue; saldo += efectoMovimiento(t, id); }
    return rnd(saldo);
  };

  /* ---------- Monedas ---------- */
  /* La tasa aplicada es la que se guardó con el registro; solo si falta se usa la vigente. */
  const aDop = (monto, moneda, tasaGuardada, tasaVigente) =>
    num(monto) * (moneda === 'USD' ? (num(tasaGuardada) > 0 ? num(tasaGuardada) : num(tasaVigente)) : 1);

  /* ---------- Vigencias: el pasado no se modifica ---------- */
  const congelar = (o) => {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.values(o).forEach(congelar); Object.freeze(o); }
    return o;
  };
  /* Lista de vigencias de una regla: [{clave, sujeto, valor, desde, creada}] solo se agrega, nunca se edita. */
  const nuevaVigencia = (vigencias, { clave, sujeto = '*', valor, desde, creada = new Date().toISOString() }) => {
    if (!clave || !/^\d{4}-\d{2}-\d{2}$/.test(String(desde))) throw new Error('Vigencia inválida: clave y fecha de inicio son obligatorias.');
    const previas = vigencias.filter((v) => v.clave === clave && v.sujeto === sujeto);
    const ultima = previas.reduce((m, v) => (v.desde > m ? v.desde : m), '');
    if (ultima && desde <= ultima) throw new Error('La nueva vigencia debe empezar después de la última registrada; el historial no se reescribe.');
    return congelar([...vigencias, { clave, sujeto, valor: JSON.parse(JSON.stringify(valor)), desde, creada }]);
  };
  /* Regla vigente en `fecha`: la última cuyo inicio es ≤ fecha. El fin de una vigencia es el inicio de la siguiente. */
  const reglaVigente = (vigencias, clave, fecha, sujeto = '*') => {
    let elegida = null;
    for (const v of vigencias) {
      if (v.clave !== clave || (v.sujeto !== sujeto && v.sujeto !== '*')) continue;
      if (v.desde <= fecha && (!elegida || v.desde > elegida.desde || (v.desde === elegida.desde && v.sujeto === sujeto))) elegida = v;
    }
    return elegida ? elegida.valor : undefined;
  };
  const hastaVigencia = (vigencias, clave, desde, sujeto = '*') => {
    const siguientes = vigencias.filter((v) => v.clave === clave && v.sujeto === sujeto && v.desde > desde).map((v) => v.desde).sort();
    return siguientes[0] || null;
  };
  /* Copia inmutable de las reglas y resultados vigentes al crear o calcular un registro. */
  const instantanea = ({ tipo, idRegistro, fecha, reglas, resultados }) =>
    congelar({ tipo, idRegistro, fecha, reglas: JSON.parse(JSON.stringify(reglas)), resultados: JSON.parse(JSON.stringify(resultados)) });

  return {
    ZONA, num, rnd, hoy, fechaObj, fechaTexto, diaEnMes, masMeses, diferenciaDias,
    corteQueCierra, ultimoCorte, fechaDePago, pagoMinimo, avanceDeEfectivo,
    interesCertificado, interesCertificadoSimple,
    cuotaNivelada, amortizacion, repartirMensual,
    efectoMovimiento, saldoCuenta, aDop,
    nuevaVigencia, reglaVigente, hastaVigencia, instantanea, congelar,
  };
});
