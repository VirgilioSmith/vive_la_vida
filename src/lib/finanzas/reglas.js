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
  let fmtHoy = null;
  const hoy = (ahora = new Date()) => {
    const p = (fmtHoy || (fmtHoy = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }))).format(ahora);
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

  /* ---------- Antigüedad ---------- */
  /* Años, meses y días completos entre `desde` y `hasta` (fechas de calendario). Fechas inválidas o futuras: null. */
  const antiguedad = (desde, hasta) => {
    const mA = String(desde || '').match(/^(\d{4})-(\d{2})/), mB = String(hasta || '').match(/^(\d{4})-(\d{2})/);
    if (!mA || !mB || +mA[2] < 1 || +mA[2] > 12 || +mB[2] < 1 || +mB[2] > 12) return null;
    /* Solo mes y año: se cuentan meses calendario completos entre ambos meses. */
    const total = (+mB[1] - +mA[1]) * 12 + (+mB[2] - +mA[2]);
    if (total < 0) return null;
    const anios = Math.floor(total / 12), meses = total % 12;
    const partes = [];
    if (anios) partes.push(anios + (anios === 1 ? ' año' : ' años'));
    if (meses) partes.push(meses + (meses === 1 ? ' mes' : ' meses'));
    if (!partes.length) partes.push('Menos de 1 mes');
    return { anios, meses, texto: partes.join(' y ') };
  };

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
  /* Pago mínimo: porcentaje del facturado con un piso opcional; nunca supera lo facturado. */
  const pagoMinimo = (facturado, pct, piso = 0) => {
    const f = Math.max(0, num(facturado));
    return rnd(Math.min(f, Math.max(rnd(f * Math.max(0, num(pct)) / 100), Math.max(0, num(piso)))));
  };
  /* Interés estimado (informativo) si el saldo facturado no se paga en la fecha de pago:
     saldo × tasa anual / 365 × días de atraso. No se registra como movimiento. */
  /* Interés mensual orientativo sobre el saldo facturado: saldo × tasa anual / 12 (informativo, no se registra). */
  const interesTarjetaMensual = (facturado, tasaAnualPct) => rnd(Math.max(0, num(facturado)) * Math.max(0, num(tasaAnualPct)) / 1200);
  const interesTarjetaEstimado = (saldoImpago, tasaAnualPct, dias) =>
    rnd(Math.max(0, num(saldoImpago)) * Math.max(0, num(tasaAnualPct)) / 36500 * Math.max(0, Math.floor(num(dias))));
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
  /* Igual que `interesCertificado`, pero la tasa y la retención pueden cambiar con el tiempo.
     condiciones(fecha) devuelve { tasa, retencion } vigentes ese día; cortes son las fechas donde cambian.
     Cada tramo usa las condiciones vigentes al inicio del tramo: lo ya devengado no se recalcula. */
  const interesCertificadoVigencias = ({ eventos, inicio, fin, condiciones, cortes = [] }) => {
    const aplicables = eventos.map((e) => ({ fecha: e.fecha < inicio ? inicio : e.fecha, delta: e.delta })).filter((e) => e.fecha <= fin);
    const puntos = [...new Set([...aplicables.map((e) => e.fecha), ...cortes.filter((c) => c > inicio && c < fin)])].sort();
    let actual = 0, cursor = inicio, bruto = 0, ret = 0;
    const retenciones = new Set();
    const avanzar = (hasta) => {
      const dias = Math.max(0, diferenciaDias(hasta, cursor));
      if (dias > 0 && actual > 0) {
        const c = condiciones(cursor), b = actual * dias * Math.max(0, num(c.tasa)) / 36500;
        bruto += b; ret += b * Math.max(0, num(c.retencion)) / 100; retenciones.add(Math.max(0, num(c.retencion)));
      }
      cursor = hasta;
    };
    for (const punto of puntos) {
      avanzar(punto);
      for (const e of aplicables) if (e.fecha === punto) actual = Math.max(0, rnd(actual + e.delta));
    }
    avanzar(fin);
    const brutoR = rnd(bruto);
    const retencion = retenciones.size <= 1 ? rnd(brutoR * ([...retenciones][0] || 0) / 100) : rnd(ret);
    return { dias: Math.max(0, diferenciaDias(fin, inicio)), bruto: brutoR, retencion, neto: rnd(brutoR - retencion) };
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
    /* Una corrección el mismo día agrega otro registro (gana el más reciente); una fecha anterior a la última se rechaza. */
    if (ultima && desde < ultima) throw new Error('La nueva vigencia debe empezar después de la última registrada; el historial no se reescribe.');
    return congelar([...vigencias, { clave, sujeto, valor: JSON.parse(JSON.stringify(valor)), desde, creada }]);
  };
  /* Regla vigente en `fecha`: la última cuyo inicio es ≤ fecha. El fin de una vigencia es el inicio de la siguiente. */
  const reglaVigente = (vigencias, clave, fecha, sujeto = '*') => {
    let elegida = null;
    for (const v of vigencias) {
      if (v.clave !== clave || (v.sujeto !== sujeto && v.sujeto !== '*')) continue;
      if (v.desde <= fecha && (!elegida || v.desde > elegida.desde || (v.desde === elegida.desde && (v.sujeto === sujeto || elegida.sujeto !== sujeto)))) elegida = v;
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
    antiguedad, corteQueCierra, ultimoCorte, fechaDePago, pagoMinimo, interesTarjetaMensual, interesTarjetaEstimado, avanceDeEfectivo,
    interesCertificado, interesCertificadoSimple, interesCertificadoVigencias,
    cuotaNivelada, amortizacion, repartirMensual,
    efectoMovimiento, saldoCuenta, aDop,
    nuevaVigencia, reglaVigente, hastaVigencia, instantanea, congelar,
  };
});
