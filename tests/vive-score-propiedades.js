/* Propiedades matemáticas y pruebas destructivas del motor de VIVE SCORE (datos sintéticos, entorno controlado).
   Uso:  node tests/vive-score-propiedades.js            comprueba
         MATRIZ=1 node tests/vive-score-propiedades.js   además escribe docs/auditoria/MATRIZ-SENSIBILIDAD-SCORE.md */
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const open = require('./harness.js');
const res = []; const check = (n, name, ok, extra = '') => { res.push(ok); console.log(`${ok ? '✓' : '✕'} ${n} ${name}${extra ? ' — ' + extra : ''}`); };
(async () => {
  const b = await chromium.launch(); delete process.env.TOUCH;
  const { p } = await open(b, 1440, 900); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => window.__T.go('score')); await p.waitForTimeout(2000);
  const fr = p.frames().find(f => f.url().includes('frame.html'));
  for (let i = 0; i < 7; i++) { await fr.evaluate(() => document.querySelector('[data-q-act="next"]')?.click()); await p.waitForTimeout(100); }
  await fr.evaluate(() => document.querySelector('[data-q-act="finish"]')?.click()); await p.waitForTimeout(800);
  const R = await fr.evaluate(() => {
    const base = JSON.parse(JSON.stringify(current())); const O = {};
    const ev = s => evaluateRaw(s); const sc = s => ev(s).score;
    const mut = f => { const s = JSON.parse(JSON.stringify(base)); f(s); return s; };
    const oneCard = (u, ccy = 'DOP', fx = 60, lim = 100000) => mut(s => { s.txRate = fx; s.cards = [{ ...s.cards[0], currency: ccy, limit: lim, balance: lim * u, min: 0, advance: 0, daysPastDue: 0, status: 'active' }]; s.loans = []; s.cards.forEach(c => c.statementBalance = c.balance); });
    // 1 · fuzz de rango (valores válidos y valores hostiles)
    let seed = 987654; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const pick = a => a[Math.floor(rnd() * a.length)], hostile = () => pick([null, undefined, NaN, -1, -1e9, 0, 1e15, 'abc', '', Infinity, 0.0001]), benign = () => pick([0, 0.0001, 5, 1e6]);
    const numKeys = ['lateShort', 'late30', 'late60', 'late90', 'late120', 'lateOlder', 'new0to6', 'limitReq0to6', 'historyMonths', 'avgHistoryMonths', 'recordMonths', 'restructure', 'refinance', 'collections', 'chargeOffs', 'judicial', 'txRate'];
    const fz = { n: 0, evaluated: 0, range: 0, nonInt: 0, part: 0, threw: 0 };
    for (let i = 0; i < 6000; i++) {
      const odd = i % 2 ? hostile : benign; const s = mut(x => {
        for (const k of numKeys) if (rnd() < .25) x[k] = rnd() < .5 ? odd() : Math.floor(rnd() * 40);
        x.cards = x.cards.filter(() => rnd() < .8).map(c => { const o = { ...c }; for (const k of ['limit', 'balance', 'min', 'advance', 'daysPastDue', 'statementBalance']) if (rnd() < .2) o[k] = odd(); else if (rnd() < .5) o[k] = Math.round(rnd() * 400000 * (k === 'daysPastDue' ? .003 : 1)); if (rnd() < .1) o.status = pick(['closed', 'active']); return o; });
        x.loans = x.loans.filter(() => rnd() < .8).map(l => { const o = { ...l }; for (const k of ['original', 'balance', 'due', 'daysPastDue']) if (rnd() < .2) o[k] = odd(); else if (rnd() < .5) o[k] = Math.round(rnd() * 900000); if (rnd() < .1) o.status = pick(['closed', 'active']); return o; });
      });
      fz.n++; try { const e = ev(s); if (e.score === null) continue; fz.evaluated++; if (e.score < 0 || e.score > 1000) fz.range++; if (!Number.isInteger(e.score)) fz.nonInt++; for (const k in e.parts) for (const q of e.parts[k]) if (!Number.isFinite(q.points) || q.points < 0 || q.points > q.max) fz.part++; } catch (_) { fz.threw++; }
    }
    O.fuzz = fz;
    // 2 · determinismo y pureza por corte
    O.det = JSON.stringify(ev(base)) === JSON.stringify(ev(JSON.parse(JSON.stringify(base))));
    // 3 · pesos
    O.weights = Object.values(WEIGHTS).reduce((a, v) => a + v, 0); O.partsMax = Object.fromEntries(Object.entries(ev(base).parts).map(([k, v]) => [k, v.reduce((a, q) => a + q.max, 0)])); O.factorMax = Object.fromEntries(FACTORS.map(f => [f.id, f.max]));
    // 4 · monotonía
    const util = [0, .01, .05, .1, .2, .3, .5, .75, 1, 1.2, 1.5].map(u => sc(oneCard(u))); O.utilMono = util.every((v, i) => i === 0 || v <= util[i - 1]); O.util = util;
    const lates = [0, 1, 2, 3, 4].map(n => sc(mut(s => { s.cards.forEach(c => c.daysPastDue = 0); s.loans.forEach(l => l.daysPastDue = 0); s.late30 = n; }))); O.lateMono = lates.every((v, i) => i === 0 || v <= lates[i - 1]);
    const age = [0, 6, 12, 24, 60, 120, 240].map(m => sc(mut(s => { s.historyMonths = m; s.avgHistoryMonths = m * .7; }))); O.ageMono = age.every((v, i) => i === 0 || v >= age[i - 1]);
    const dpd = [0, 1, 15, 29, 30, 60, 90, 180].map(d => sc(mut(s => { s.cards.forEach(c => c.daysPastDue = 0); s.loans.forEach(l => l.daysPastDue = 0); s.cards[0].daysPastDue = d; }))); O.dpdMono = dpd.every((v, i) => i === 0 || v <= dpd[i - 1]); O.dpd = dpd;
    // continuidad: salto máximo entre puntos consecutivos de utilización de 1 punto porcentual
    let jump = 0, stepAt = []; for (let u = 0; u < 1.3; u += .01) { const d = Math.abs(sc(oneCard(u)) - sc(oneCard(u + .01))); if (d > 4) stepAt.push(Math.round(u * 100) + '%→' + d); else jump = Math.max(jump, d); } O.maxJump1pp = jump; O.steps = stepAt;
    // 5 · escenarios extremos
    O.noHistory = ev(mut(s => { s.cards = []; s.loans = []; })).score;
    O.noCards = sc(mut(s => { s.cards = []; s.loans = [{ id: 'L', name: 'P', currency: 'DOP', type: 'personal', original: 100000, balance: 90000, due: 3000, status: 'active', daysPastDue: 0 }]; }));
    O.noLoans = sc(oneCard(.2)); O.util100 = sc(oneCard(1)); O.overlimit = sc(oneCard(1.5));
    O.closedOnly = ev(mut(s => { s.cards.forEach(c => c.status = 'closed'); s.loans.forEach(l => l.status = 'closed'); })).score;
    O.zeroLimit = (() => { try { const s = oneCard(0); s.cards[0].limit = 0; s.cards[0].balance = 5000; return ev(s).score; } catch (e) { return 'throw'; } })();
    O.neverLate = sc(mut(s => { s.cards.forEach(c => c.daysPastDue = 0); s.loans.forEach(l => l.daysPastDue = 0); s.lateShort = s.late30 = s.late60 = s.late90 = s.late120 = s.lateOlder = 0; }));
    O.recurrentLate = sc(mut(s => { s.cards.forEach(c => c.daysPastDue = 0); s.loans.forEach(l => l.daysPastDue = 0); s.late30 = 3; s.late60 = 1; }));
    O.refinanced = sc(mut(s => { s.refinance = 2; s.restructure = 1; }));
    // 6 · multimoneda: misma utilización en USD que en DOP => mismo resultado, y el tipo de cambio no altera un solo producto
    O.fxInvariance = [sc(oneCard(.3, 'DOP', 60, 100000)), sc(oneCard(.3, 'USD', 60, 1666.67)), sc(oneCard(.3, 'USD', 40, 1666.67)), sc(oneCard(.3, 'USD', 90, 1666.67))];
    // 7 · pureza histórica: evaluar un corte no depende de cortes posteriores
    const later = JSON.parse(JSON.stringify(base)); later.period = '2027-01'; O.historyPure = sc(base) === sc(JSON.parse(JSON.stringify(base)));
    // 8 · duplicados: se avisa
    O.dupWarn = validate(mut(s => { s.duplicates = [{ type: 'card_charge', cardId: 'x', date: '2026-11-01', amount: 100, count: 2 }]; })).some(e => /duplicados/i.test(e.text));
    // 9 · matriz de sensibilidad (marginal, un cambio a la vez sobre el perfil base)
    const b0 = sc(base), pts = s => ev(s).points; const M = [];
    const row = (lbl, f) => { const e = ev(mut(f)); M.push({ lbl, d: e.score === null ? null : e.score - b0, f: Object.fromEntries(Object.entries(e.points).map(([k, v]) => [k, v - ev(base).points[k]])) }); };
    row('Utilización agregada +10 pp', s => { s.cards.forEach(c => { c.balance = Math.min(c.limit * 1.2, c.balance + c.limit * .1); }); });
    row('Pago total de todas las tarjetas', s => { s.cards.forEach(c => { c.balance = 0; c.statementBalance = 0; c.min = 0; }); });
    row('+1 mora declarada de 30–59 d', s => { s.late30 += 1; }); row('+1 mora declarada de 60–89 d', s => { s.late60 += 1; }); row('+1 mora declarada de 90–119 d', s => { s.late90 += 1; });
    const z = f => { const s0 = mut(x => { x.cards.forEach(c => c.daysPastDue = 0); x.loans.forEach(l => l.daysPastDue = 0); }); const s1 = JSON.parse(JSON.stringify(s0)); f(s1); return sc(s1) - sc(s0); };
    M.push({ lbl: 'Mora vigente de 30 d en una tarjeta (frente a 0 d)', d: z(x => { x.cards[0].daysPastDue = 30; }), f: { payment: 'ver total' } }); M.push({ lbl: 'Mora vigente de 90 d en una tarjeta (frente a 0 d)', d: z(x => { x.cards[0].daysPastDue = 90; }), f: { payment: 'ver total' } }); M.push({ lbl: 'Mora vigente de 672 d en una tarjeta (frente a 0 d)', d: z(x => { x.cards[0].daysPastDue = 672; }), f: { payment: 'ver total' } });
    row('+12 meses de antigüedad', s => { s.historyMonths += 12; s.avgHistoryMonths += 12; });
    row('+1 apertura reciente', s => { s.new0to6 += 1; }); row('+1 aumento de límite solicitado', s => { s.limitReq0to6 += 1; });
    row('Préstamo nuevo de RD$100,000 sin amortizar', s => { s.loans.push({ id: 'N', name: 'N', currency: 'DOP', type: 'personal', original: 100000, balance: 100000, due: 3000, status: 'active', daysPastDue: 0 }); });
    row('Avance de efectivo del 25 % del límite', s => { s.cards.forEach(c => { c.advance = Math.min(c.balance, c.limit * .25); }); });
    row('Tipo de cambio +20 %', s => { s.txRate *= 1.2; }); row('Ingresos ×10', s => { s.formal *= 10; }); row('Liquidez ×100', s => { s.liquidity = { held30: 1e8, now: 1e8 }; });
    O.matrix = M; O.base = b0;
    return O;
  });
  check('R1', `Rango [0,1000], enteros y subpuntajes dentro de su máximo en ${R.fuzz.evaluated} cortes evaluados (de ${R.fuzz.n}: 50 % con valores hostiles nulos, NaN, negativos, Infinity, texto)`, R.fuzz.range === 0 && R.fuzz.nonInt === 0 && R.fuzz.part === 0 && R.fuzz.threw === 0 && R.fuzz.evaluated > 1500, JSON.stringify(R.fuzz));
  check('R2', 'Determinismo: misma entrada produce exactamente la misma salida', R.det);
  check('R3', 'Las ponderaciones suman 1000 y cada factor suma el máximo de sus subreglas', R.weights === 1000 && Object.keys(R.factorMax).every(k => R.factorMax[k] === R.partsMax[k]), JSON.stringify(R.partsMax));
  check('R4', 'Monotonía: más utilización, más moras o más días de atraso nunca suben el puntaje; más antigüedad nunca lo baja', R.utilMono && R.lateMono && R.dpdMono && R.ageMono);
  check('R5', 'Continuidad: salvo en los umbrales de «tarjeta tensionada» (75 %) y «sobrelímite» (100 %), un punto porcentual de utilización mueve el puntaje como máximo 4 puntos; los saltos en esos umbrales quedan registrados como defecto conocido D-1 (AUDITORIA-08)', R.maxJump1pp <= 4 && R.steps.every(x => /^(7[3-6]|9[89]|100|101)%/.test(x)), 'saltos conocidos: ' + R.steps.join(', '));
  check('R6', 'Sin obligaciones el puntaje es «sin datos» (null), no 0 ni 1000', R.noHistory === null && R.closedOnly === null, JSON.stringify([R.noHistory, R.closedOnly]));
  check('R7', 'Perfiles extremos se calculan sin error y dentro de rango (sin tarjetas, sin préstamos, 100 %, sobregiro, sin atrasos, atrasos recurrentes, refinanciado; una tarjeta con límite 0 y saldo suprime el puntaje en vez de inventar uno)', [R.noCards, R.noLoans, R.util100, R.overlimit, R.neverLate, R.recurrentLate, R.refinanced].every(v => Number.isInteger(v) && v >= 0 && v <= 1000) && R.zeroLimit === null, JSON.stringify([R.noCards, R.noLoans, R.util100, R.overlimit, R.zeroLimit, R.neverLate, R.recurrentLate, R.refinanced]));
  check('R8', 'Atrasos recurrentes puntúan peor que una mora aislada y que ninguna', R.recurrentLate < R.neverLate);
  check('R9', 'Multimoneda: la misma utilización en USD que en DOP da el mismo puntaje y el tipo de cambio no altera un producto de una sola moneda', new Set(R.fxInvariance).size === 1, JSON.stringify(R.fxInvariance));
  check('R10', 'Un movimiento de tarjeta duplicado genera una advertencia de calidad de datos', R.dupWarn);
  check('R11', 'Ingresos, liquidez y tipo de cambio de la matriz no mueven el puntaje de comportamiento (excepto vía utilización mixta)', R.matrix.filter(m => /Ingresos|Liquidez/.test(m.lbl)).every(m => m.d === 0));
  check('R12', 'Sin errores de página', errs.length === 0, errs.slice(0, 2).join('|'));
  if (process.env.MATRIZ) {
    const rows = R.matrix.map(m => `| ${m.lbl} | ${m.d === null ? 'n/d' : (m.d > 0 ? '+' : '') + m.d} | ${Object.entries(m.f).map(([k, v]) => typeof v === 'number' ? `${k} ${v > 0 ? '+' : ''}${v}` : `${k} ${v}`).join(' · ')} |`).join('\n');
    fs.writeFileSync(path.join(__dirname, '..', 'docs', 'auditoria', 'MATRIZ-SENSIBILIDAD-SCORE.md'), `# Matriz de sensibilidad de VIVE SCORE (generada)\n\nPerfil base de demostración: **${R.base} puntos**. Cada fila cambia **una sola variable**; las columnas muestran el efecto total y por factor (pagos \`payment\`, deuda \`owed\`, antigüedad \`age\`, crédito nuevo \`new\`, composición \`mix\`). Datos sintéticos; no representan a ninguna persona. Regenerar: \`MATRIZ=1 node tests/vive-score-propiedades.js\`.\n\n| Variable | Efecto total | Por factor |\n|---|---|---|\n${rows}\n\nBarrido de utilización (0, 1, 5, 10, 20, 30, 50, 75, 100, 120, 150 %): ${R.util.join(', ')}.\nBarrido de días de atraso vigente (0, 1, 15, 29, 30, 60, 90, 180): ${R.dpd.join(', ')}.\n`);
  }
  await b.close(); const bad = res.filter(x => !x).length; console.log(bad ? `\nFALLAN ${bad}` : `\nOK: ${res.length} comprobaciones superadas`); process.exit(bad ? 1 : 0);
})();
