/* Validación sistemática del motor de VIVE SCORE CRÉDITO: estructura de pesos, anclas de las fórmulas, monotonía, límites,
   casos extremos, no mutación, independencia de la capacidad y coherencia con la documentación.
   Uso:  node tests/vive-score-reglas.js   — falla (código 1) si alguna comprobación no se cumple. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const open = require('./harness.js');
const ROOT = path.resolve(__dirname, '..');
const results = [];
const check = (n, name, ok, extra = '') => { results.push({ n, name, ok: !!ok, extra }); console.log(`${ok ? '✓' : '✕'} ${String(n).padStart(2)} ${name}${extra ? ' — ' + extra : ''}`); };
const frameOf = p => p.frames().find(f => f.url().includes('vive-score/frame.html'));

(async () => {
  const b = await chromium.launch();
  const { p } = await open(b, 1440, 900);
  await p.evaluate(() => { const x = document.createElement('button'); x.dataset.act = 'navigate'; x.dataset.id = 'score'; x.hidden = true; document.body.append(x); x.click(); });
  await p.waitForTimeout(2500);
  const f = frameOf(p);
  for (let i = 0; i < 6; i++) { await f.evaluate(() => { const n = document.querySelector('[data-q-act="next"]'); if (n) n.click(); }); await p.waitForTimeout(120); }
  await f.evaluate(() => { const n = document.querySelector('[data-q-act="finish"]'); if (n) n.click(); });
  await p.waitForTimeout(900);

  /* 1 · estructura: pesos y subreglas */
  const est = await f.evaluate(() => {
    const e = evaluate(current()), out = { factores: FACTORS.map(x => x.max), total: FACTORS.reduce((a, x) => a + x.max, 0), problemas: [] };
    for (const fa of FACTORS) {
      const sum = e.parts[fa.id].reduce((a, q) => a + q.max, 0);
      if (sum !== fa.max) out.problemas.push(fa.id + ': subreglas suman ' + sum + ' ≠ ' + fa.max);
      for (const q of e.parts[fa.id]) { if (!(q.points >= 0 && q.points <= q.max)) out.problemas.push(q.id + ' fuera de rango'); if (!q.rule || !q.label || !q.metric) out.problemas.push(q.id + ' sin regla o etiqueta'); }
    }
    out.tags = FACTORS.map(x => x.tag).join('/');
    return out;
  });
  check(1, 'Estructura: 5 factores con pesos 350/300/150/100/100 = 1000; cada factor es la suma exacta de sus subreglas; toda subregla tiene etiqueta, métrica y regla escrita', est.total === 1000 && est.factores.join('/') === '350/300/150/100/100' && est.tags === '35%/30%/15%/10%/10%' && est.problemas.length === 0, JSON.stringify(est));

  /* 2 · anclas de las fórmulas de utilización y reglas lineales documentadas */
  const anc = await f.evaluate(() => {
    const base = clone(current()); const mk = fn => { const s = clone(base); fn(s); return evaluate(s); };
    const util = u => { const e = mk(s => { s.cards = [{ id: 'a', name: 'X', currency: 'DOP', limit: 100000, balance: 100000 * u, statementBalance: 0, min: 0, advance: 0, status: 'active', daysPastDue: 0 }]; s.loans = []; }); return e.parts.owed.find(q => q.id === 'o_aggregate').points; };
    const edad = m => mk(s => { s.historyMonths = m; }).parts.age.find(q => q.id === 'a_old').points;
    const nuevo = k => mk(s => { s.new0to6 = k; }).parts.new.find(q => q.id === 'n_new').points;
    const solic = k => mk(s => { s.limitReq0to6 = k; }).parts.new.find(q => q.id === 'n_limit').points;
    const mora = (campo, k) => mk(s => { s.cards.forEach(c => c.daysPastDue = 0); s.loans.forEach(l => l.daysPastDue = 0); s[campo] = k; }).parts.payment.find(q => q.id === 'p_recent').points;
    return {
      util: [0, .01, .09, .29, .49, .75, 1, 1.2].map(util),
      edad: [0, 60, 120, 240].map(edad), nuevo: [0, 1, 2, 4, 5].map(nuevo), solic: [0, 1, 5, 6].map(solic),
      mora: [mora('lateShort', 1), mora('late30', 1), mora('late60', 1), mora('late90', 1), mora('late120', 1), mora('late120', 2)]
    };
  });
  const okU = JSON.stringify(anc.util) === JSON.stringify([180, 180, 177, 148, 110, 60, 12, 0]);
  const okE = JSON.stringify(anc.edad) === JSON.stringify([0, 38, 75, 75]) || JSON.stringify(anc.edad) === JSON.stringify([0, 37, 75, 75]);
  check(2, 'Anclas de las fórmulas publicadas: utilización (≤1 % 180 · 9 % 177 · 29 % 148 · 49 % 110 · 75 % 60 · 100 % 12 · ≥120 % 0), antigüedad (75 × min(m/120, 1)), crédito reciente (60 − 15 por apertura; 40 − 8 por aumento solicitado) y moras declaradas (235 − 18/75/100/135/165; la mora vigente usa la misma escala desde el motor 5.1)',
    okU && okE && JSON.stringify(anc.nuevo) === JSON.stringify([60, 45, 30, 0, 0]) && JSON.stringify(anc.solic) === JSON.stringify([40, 32, 0, 0]) && JSON.stringify(anc.mora) === JSON.stringify([217, 160, 135, 100, 70, 0]), JSON.stringify(anc));

  /* 3 · propiedades sobre 600 perfiles aleatorios (semilla fija) */
  const prop = await f.evaluate(() => {
    let seed = 20261115; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const base = clone(current()), viol = [], N_ = 600; let nulos = 0, validos = 0;
    const gen = () => {
      const s = clone(base); s.cards = []; s.loans = [];
      for (let i = ri(0, 4); i > 0; i--) { const lim = ri(0, 4) ? ri(20, 1000) * 1000 : 0, bal = Math.round(lim * rnd() * 1.4), adv = Math.round(bal * rnd() * .3); s.cards.push({ id: 'c' + i, name: 'T' + i, currency: ri(0, 3) ? 'DOP' : 'USD', limit: lim, balance: bal, statementBalance: bal, min: Math.round(bal * .05), advance: adv, status: ri(0, 9) ? 'active' : 'closed', daysPastDue: ri(0, 9) ? 0 : ri(1, 130) }); }
      for (let i = ri(0, 3); i > 0; i--) { const orig = ri(50, 900) * 1000; s.loans.push({ id: 'l' + i, name: 'P' + i, currency: 'DOP', type: 'personal', original: orig, balance: Math.round(orig * rnd()), due: ri(3, 30) * 1000, status: ri(0, 7) ? 'active' : 'closed', daysPastDue: ri(0, 9) ? 0 : ri(1, 100), variable: false }); }
      for (const k of ['lateShort', 'late30', 'late60', 'late90', 'late120', 'lateOlder', 'new0to6', 'limitReq0to6']) s[k] = ri(0, 3) ? 0 : ri(1, 3);
      s.historyMonths = ri(0, 300); s.avgHistoryMonths = ri(0, s.historyMonths); s.recordMonths = ri(1, 40);
      return s;
    };
    const sc = s => evaluate(s).score;
    const mejor = (a, b2, nombre, s) => { if (a !== null && b2 !== null && b2 > a) viol.push(nombre + ' subió ' + a + '→' + b2); };
    for (let i = 0; i < N_; i++) {
      const s = gen(), e = evaluate(s), s0 = e.score;
      // rango, enteros y suma
      if (s0 === null) { nulos++; } else {
        validos++;
        if (!Number.isInteger(s0) || s0 < 0 || s0 > 1000) viol.push('score fuera de rango ' + s0);
        const sumF = FACTORS.reduce((a, x) => a + e.points[x.id], 0); if (sumF !== s0) viol.push('suma factores ' + sumF + ' ≠ ' + s0);
        for (const fa of FACTORS) { const sp = e.parts[fa.id].reduce((a, q) => a + q.points, 0); if (sp !== e.points[fa.id]) viol.push(fa.id + ' subreglas ≠ factor'); if (e.points[fa.id] > fa.max) viol.push(fa.id + ' supera máximo'); }
        for (const fa of FACTORS) for (const q of e.parts[fa.id]) if (!Number.isFinite(q.points)) viol.push('NaN en ' + q.id);
      }
      // monotonía (peor ⇒ no mayor)
      const v = (fn) => { const t = clone(s); fn(t); return sc(t); };
      mejor(s0, v(t => t.cards.forEach(c => { c.balance = Math.round(c.balance * 1.3); c.advance = Math.min(c.advance, c.balance); })), 'saldo mayor', s);
      mejor(s0, v(t => { t.lateShort += 1; }), 'mora 1–29', s); mejor(s0, v(t => { t.late30 += 1; }), 'mora 30', s); mejor(s0, v(t => { t.late60 += 1; }), 'mora 60', s); mejor(s0, v(t => { t.late90 += 1; }), 'mora 90', s); mejor(s0, v(t => { t.late120 += 1; }), 'mora 120', s);
      mejor(s0, v(t => { t.lateOlder += 1; }), 'mora antigua', s);
      mejor(s0, v(t => { t.new0to6 += 1; }), 'apertura nueva', s); mejor(s0, v(t => { t.limitReq0to6 += 1; }), 'aumento solicitado', s);
      mejor(s0, v(t => t.cards.concat(t.loans).forEach(x => { x.daysPastDue = N(x.daysPastDue) + 30; })), 'atraso vigente', s);
      // mejor ⇒ no menor
      const w = (fn) => { const t = clone(s); fn(t); return sc(t); };
      const peor = (b2, nombre) => { if (s0 !== null && b2 !== null && b2 < s0) viol.push(nombre + ' bajó ' + s0 + '→' + b2); };
      peor(w(t => { t.historyMonths += 12; t.avgHistoryMonths += 12; }), 'más antigüedad'); peor(w(t => { t.recordMonths += 6; }), 'más evidencia');
      peor(w(t => t.cards.forEach(c => { c.limit = c.limit * 1.5; })), 'límite mayor con el mismo saldo');
      peor(w(t => t.cards.forEach(c => { c.balance = Math.round(c.balance * .7); c.advance = Math.min(c.advance, c.balance); })), 'pagar saldo');
      // no muta la entrada
      const antes = JSON.stringify(s); evaluate(s); if (JSON.stringify(s) !== antes) viol.push('evaluate mutó la entrada');
    }
    return { N: N_, validos, nulos, viol: viol.slice(0, 12), nViol: viol.length };
  });
  check(3, 'Propiedades en 600 perfiles aleatorios: score entero 0–1000 = suma de factores = suma de subreglas, sin NaN; más saldo, moras, aperturas, aumentos solicitados o atraso vigente nunca suben el score; más antigüedad, más evidencia, mayor límite o pagar saldo nunca lo bajan; evaluar no muta los datos', prop.nViol === 0 && prop.validos > 200, JSON.stringify(prop));

  /* 4 · condiciones de cálculo: cuándo hay y cuándo no hay score */
  const cond = await f.evaluate(() => {
    const base = clone(current()), ev = fn => { const s = clone(base); fn(s); return evaluate(s); };
    const sinProductos = ev(s => { s.cards = []; s.loans = []; });
    const soloPrestamo = ev(s => { s.cards = []; });
    const soloTarjeta = ev(s => { s.loans = []; });
    const cerrados = ev(s => { s.cards.forEach(c => { c.status = 'closed'; }); s.loans.forEach(l => { l.status = 'closed'; }); });
    const negativo = ev(s => { s.cards[0].balance = -50; });
    const limiteCero = ev(s => { s.cards.forEach(c => { c.limit = 0; c.balance = 5000; }); s.loans = []; });
    const usd = ev(s => { s.cards = [{ id: 'u', name: 'USD', currency: 'USD', limit: 5000, balance: 500, statementBalance: 0, min: 0, advance: 0, status: 'active', daysPastDue: 0 }]; s.loans = []; });
    return { sinProductos: sinProductos.score, soloPrestamo: soloPrestamo.score, soloTarjeta: soloTarjeta.score, cerrados: cerrados.score, negativo: negativo.score, negativoErr: negativo.errors.some(e => e.level === 'critical'), limiteCero: limiteCero.score, usd: usd.score, usdUtil: usd.util, mezclaPrestamo: soloPrestamo.parts.mix.map(q => q.points).join('/'), mezclaTarjeta: soloTarjeta.parts.mix.map(q => q.points).join('/') };
  });
  check(4, 'Condiciones: sin productos activos o con todos cerrados no hay score; un dato negativo es error crítico y bloquea el score; solo préstamo o solo tarjeta sí puntúan (mezcla 65/28); límite cero no rompe el cálculo; USD se convierte con el tipo de cambio',
    cond.sinProductos === null && cond.cerrados === null && cond.negativo === null && cond.negativoErr && Number.isInteger(cond.soloPrestamo) && Number.isInteger(cond.soloTarjeta) && cond.mezclaPrestamo === '65/28' && cond.mezclaTarjeta === '65/28' && cond.limiteCero !== undefined && Number.isInteger(cond.usd) && Math.abs(cond.usdUtil - 0.1) < 1e-9, JSON.stringify(cond));

  /* 5 · reglas condicionales del calibrado: sin respuesta de atrasos no hay score */
  const cal = await f.evaluate(() => {
    const out = {}; const A = ST.answers; const had = JSON.stringify(A);
    const m0 = current().missing.length;
    A.late.answer = null; rebuildDB(); const m1 = current().missing.length, sc1 = evaluate(current()).score;
    A.late.answer = 'unsure'; rebuildDB(); const sc2 = evaluate(current()).score, miss2 = current().missing.join(' | ');
    ST.answers = JSON.parse(had); rebuildDB();
    return { conRespuesta: m0, sinRespuesta: m1, scoreSinRespuesta: sc1, scoreNoSeguro: sc2, nsMsg: /No estoy seguro/.test(miss2), restaurado: evaluate(current()).score !== null };
  });
  check(5, 'Calibrado: con los atrasos respondidos no falta nada y hay score; sin responder o «No estoy seguro» el score no se calcula (queda «—») y se explica qué falta', cal.conRespuesta === 0 && cal.sinRespuesta > 0 && cal.scoreSinRespuesta === null && cal.scoreNoSeguro === null && cal.nsMsg && cal.restaurado, JSON.stringify(cal));

  /* 6 · la capacidad nunca modifica el score; capacidad coherente */
  const cap = await f.evaluate(() => {
    const base = clone(current()), e0 = evaluate(base), viol = [];
    for (const fn of [s => { s.formal = 1e6; }, s => { s.informal = 5e5; }, s => { s.expenses = []; }, s => { s.liquidity = { held30: 1e8, now: 1e8, accounts: 3, days: 30 }; }, s => { s.liquidity = null; }, s => { s.spending = null; }]) {
      const t = clone(base); fn(t); const e = evaluate(t); if (e.score !== e0.score) viol.push('la capacidad cambió el score'); const c = e.capacity; for (const k of ['income', 'debt', 'newQuota', 'needed', 'safe', 'coverage', 'held']) if (!Number.isFinite(c[k])) viol.push('capacidad NaN en ' + k); if (c.newQuota < 0) viol.push('cuota nueva negativa'); if (c.coverage < 0 || c.coverage > 1) viol.push('cobertura fuera de 0–1'); if (c.needed < 0) viol.push('reserva negativa');
    }
    const t0 = clone(base); t0.formal = 0; t0.informal = 0; t0.otherFormal = 0; const c0 = evaluate(t0).capacity;
    const t1 = clone(base); t1.liquidity = { held30: 1e9, now: 1e9, accounts: 1, days: 30 }; const c1 = evaluate(t1).capacity, t2 = clone(base); t2.liquidity = { held30: 0, now: 0, accounts: 1, days: 30 }; const c2 = evaluate(t2).capacity;
    return { viol, sinIngreso: { dti: c0.dti, cuota: c0.newQuota }, reservaCompleta: c1.needed, reservaVacia: c2.needed, base: c2.base };
  });
  check(6, 'Capacidad independiente del score: ingresos, gastos, reserva y gasto esencial nunca cambian el score; sin ingresos no hay DTI ni cuota nueva; reserva completa → 0 por reservar y reserva vacía → colchón completo; sin NaN ni negativos', cap.viol.length === 0 && cap.sinIngreso.dti === null && cap.sinIngreso.cuota === 0 && cap.reservaCompleta === 0 && Math.abs(cap.reservaVacia - cap.base) < 1e-6, JSON.stringify(cap));

  /* 7 · antigüedad con cancelados: suman, los castigados no, sin duplicar */
  const age = await f.evaluate(() => {
    const per = todayPeriod(), base = ST.cancelled ? JSON.parse(JSON.stringify(ST.cancelled)) : [], hist = () => current().historyMonths, avg = () => current().avgHistoryMonths;
    const h0 = hist(), a0 = avg();
    ST.cancelled = base.concat([{ id: 'v1', inst: 'Banco Prueba A', kind: 'card', opened: '2005-01', closed: '2007-01', state: 'cancelado sin saldo' }]); rebuildDB(); const h1 = hist();
    ST.cancelled = base.concat([{ id: 'v2', inst: 'Banco Prueba B', kind: 'card', opened: '2001-01', closed: '2003-01', state: 'castigado' }]); rebuildDB(); const h2 = hist();
    ST.cancelled = base.concat([{ id: 'v3', inst: 'Banco Prueba C', kind: 'card', opened: '2005-01', closed: '2007-01', state: 'saldado' }, { id: 'v4', inst: 'Banco Prueba C', kind: 'card', opened: '2005-01', closed: '2007-01', state: 'saldado' }]); rebuildDB(); const n3 = current().avgHistoryMonths;
    ST.cancelled = base; rebuildDB();
    return { h0, h1, h2, a0, restaurado: hist() === h0, mesesEsperados: (Number(per.slice(0, 4)) - 2005) * 12 + Number(per.slice(5)) - 1, n3 };
  });
  check(7, 'Antigüedad con cancelados: uno en buen estado alarga la cuenta más antigua hasta su fecha real de apertura; uno castigado no suma; al quitarlo todo vuelve al valor anterior', age.h1 === age.mesesEsperados && age.h2 === age.h0 && age.restaurado && age.h1 > age.h0, JSON.stringify(age));

  /* 8 · coherencia de la documentación con el motor */
  const readme = fs.readFileSync(path.join(ROOT, 'src/vive-score/README.md'), 'utf8');
  const docs = await f.evaluate(() => {
    const e = evaluate(current()); const labels = FACTORS.flatMap(fa => e.parts[fa.id].map(q => q.label));
    tab = 'control'; render(); ccOpen.metodologia = true; render(); const t = document.getElementById('view').innerText; ccOpen.metodologia = false;
    return { labels, faltanEnMetodologia: labels.filter(l => !t.includes(l)), nVars: VARS.length };
  });
  const ps = [/35\s*\/\s*30\s*\/\s*15\s*\/\s*10\s*\/\s*10/, /0.6 meses|0–6 meses/, /Historial de límites|historial de límites/, /Reserva automática/, /Productos cancelados/];
  check(8, 'Documentación: todas las subreglas del motor aparecen en la Metodología con su fórmula, y el README documenta pesos, ventana de 0–6 meses, historial de límites, reserva automática y cancelados', docs.faltanEnMetodologia.length === 0 && ps.every(r => r.test(readme)), JSON.stringify({ subreglas: docs.labels.length, faltan: docs.faltanEnMetodologia, variables: docs.nVars }));

  /* 9 · reglas declaradas que hoy no tienen fuente de datos: deben estar señaladas */
  const muertas = await f.evaluate(() => { const s = current(); return { cobranza: s.collections, castigos: s.chargeOffs, judicial: s.judicial, consultas: [s.hard0to3, s.hard4to6, s.hard7to12].join('/') }; });
  const metodologiaDice = await f.evaluate(() => { tab = 'control'; ccOpen.metodologia = true; render(); const t = document.getElementById('view').innerText; ccOpen.metodologia = false; return /sin fuente (de datos )?automática|hoy valen 0|no se alimentan/i.test(t); });
  check(9, 'Entradas sin fuente de datos (cobranzas, castigos, incidencias judiciales, consultas a burós) valen 0 y la Metodología lo declara de forma explícita (nada se presenta como activo si no se alimenta)', muertas.cobranza === 0 && muertas.castigos === 0 && muertas.judicial === 0 && metodologiaDice, JSON.stringify({ ...muertas, metodologiaDice }));

  /* 10 · conciliación entre cortes: Σ Δ factores = Δ total; Σ Δ subreglas = Δ factor; y la línea de tiempo no falla con 1 a 12 cortes */
  const conc = await f.evaluate(() => {
    let seed = 777; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const base = clone(current()), viol = []; const guard = { months: DB.months, idx };
    const gen = k => { const s = clone(base); s.period = '2026-' + String(((k) % 12) + 1).padStart(2, '0'); s.cards.forEach(c => { c.balance = Math.round(c.limit * rnd() * 0.9); c.advance = Math.min(c.advance, c.balance); }); for (const key of ['lateShort', 'late30', 'new0to6']) s[key] = ri(0, 3) ? 0 : 1; s.historyMonths = 40 + k * 2; s.avgHistoryMonths = 20 + k; s.recordMonths = k + 1; return s; };
    let comparados = 0, sinError = 0;
    for (let n = 1; n <= 12; n++) {
      DB.months = Array.from({ length: n }, (_, k) => gen(k));
      for (let i = 0; i < n; i++) {
        try {
          const x = compare(i), e = x.c; timelineDiagnostics(i); forwardSignals(DB.months[i], i); sinError++;
          if (x.p && e.score !== null && x.p.score !== null) { comparados++; const sd = FACTORS.reduce((a, fa) => a + x.diff[fa.id], 0); if (sd !== e.score - x.p.score) viol.push('Σ Δ factores ≠ Δ total en corte ' + i); for (const fa of FACTORS) { const sp = x.partDiff[fa.id].reduce((a, q) => a + q.delta, 0); if (sp !== x.diff[fa.id]) viol.push('Σ Δ subreglas ≠ Δ factor ' + fa.id); } }
        } catch (err) { viol.push('excepción n=' + n + ' i=' + i + ': ' + String(err.message).slice(0, 80)); }
      }
    }
    DB.months = guard.months; idx = guard.idx;
    return { comparados, sinError, viol: viol.slice(0, 8), nViol: viol.length };
  });
  check(10, 'Conciliación entre cortes: Σ Δ factores = Δ total y Σ Δ subreglas = Δ factor en todos los pares; evolución, diagnóstico de línea de tiempo y señales no lanzan errores con 1 a 12 cortes', conc.nViol === 0 && conc.comparados > 20 && conc.sinError > 70, JSON.stringify(conc));

  /* 11 · determinismo y memoización: mismo corte y ajustes ⇒ mismo resultado; los ajustes de capacidad no tocan el score */
  const det = await f.evaluate(() => {
    const s = clone(current()), a = JSON.stringify(evaluate(s)), b2 = JSON.stringify(evaluate(clone(s)));
    const d0 = JSON.parse(JSON.stringify(DB.settings)), e0 = evaluate(s); DB.settings = { ...d0, dti: .6, floor: 90000, reserve: .5 }; const e1 = evaluate(clone(s)); DB.settings = d0;
    return { igual: a === b2, scoreIgual: e0.score === e1.score, capacidadCambia: e0.capacity.dtiRoom !== e1.capacity.dtiRoom || e0.capacity.base !== e1.capacity.base };
  });
  check(11, 'Determinismo: el mismo corte da exactamente el mismo resultado; cambiar los criterios de capacidad (DTI, reserva) cambia la capacidad pero jamás el score', det.igual && det.scoreIgual && det.capacidadCambia, JSON.stringify(det));

  /* 12 · pantallas: todas las pestañas y secciones en tres estados (normal, sin productos y con datos inválidos) sin textos rotos ni errores */
  const errsPage = []; p.on('pageerror', e => errsPage.push(e.message)); f.page().on('console', m => { if (m.type() === 'error') errsPage.push(m.text().slice(0, 120)); });
  const pant = await f.evaluate(() => {
    const secciones = ['antecedentes', 'productos', 'cortes', 'auditoria', 'variables', 'metodologia'], tabs = ['summary', 'detail', 'transunion', 'control'], malos = [], vistas = [];
    const guardado = { months: DB.months, idx, tab, open: { ...ccOpen } };
    const estados = {
      normal: () => {},
      sinProductos: () => { DB.months = DB.months.map(m => { const s = clone(m); s.cards = []; s.loans = []; return s; }); },
      invalido: () => { DB.months = DB.months.map(m => { const s = clone(m); if (s.cards[0]) { s.cards[0].balance = -10; s.cards[0].limit = 'abc'; } s.historyMonths = -3; return s; }); }
    };
    for (const [nombre, fn] of Object.entries(estados)) {
      DB.months = guardado.months; fn(); idx = DB.months.length - 1;
      for (const t of tabs) {
        tab = t; for (const k of secciones) ccOpen[k] = true;
        try { render(); const txt = document.getElementById('view').innerText; vistas.push(nombre + '/' + t + ':' + txt.length); if (txt.length < 150) malos.push(nombre + '/' + t + ' casi vacía'); const m = txt.match(/undefined|NaN|Infinity|\[object|null\b/); if (m) malos.push(nombre + '/' + t + ' contiene «' + m[0] + '»'); } catch (e) { malos.push(nombre + '/' + t + ' excepción: ' + String(e.message).slice(0, 80)); }
      }
    }
    DB.months = guardado.months; idx = guardado.idx; tab = guardado.tab; Object.assign(ccOpen, guardado.open); render();
    return { malos: malos.slice(0, 10), nMalos: malos.length, vistas: vistas.length };
  });
  check(12, 'Pantallas: 4 pestañas (con las 6 secciones del Centro de control abiertas) × 3 estados (normal, sin productos, datos inválidos) se dibujan completas, sin «undefined», «NaN», «Infinity» ni «[object», y sin errores de consola', pant.nMalos === 0 && pant.vistas === 12 && errsPage.length === 0, JSON.stringify({ ...pant, consola: errsPage.slice(0, 3) }));

  await b.close();
  const fallos = results.filter(r => !r.ok);
  console.log(fallos.length ? `\nFALLAN ${fallos.length} de ${results.length}` : `\nOK: ${results.length} comprobaciones superadas`);
  process.exit(fallos.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
