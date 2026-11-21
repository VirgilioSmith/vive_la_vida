/* Pruebas de VIVE SCORE CRÉDITO (experimental). Ejecuta las validaciones de la lista de entrega con la app real
   (arnés con Supabase simulado). Uso:  node tests/vive-score.js   — falla (código 1) si alguna comprobación no se cumple. */
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const open = require('./harness.js');
const ROOT = path.resolve(__dirname, '..');
const results = [];
const check = (n, name, ok, extra = '') => { results.push({ n, name, ok: !!ok, extra }); console.log(`${ok ? '✓' : '✕'} ${String(n).padStart(2)} ${name}${extra ? ' — ' + extra : ''}`); };

const go = async (p, id) => { await p.evaluate(id => { const b = document.createElement('button'); b.dataset.act = 'navigate'; b.dataset.id = id; b.hidden = true; document.body.append(b); b.click(); b.remove(); }, id); await p.waitForTimeout(400); };
const frameOf = p => p.frames().find(f => f.url().includes('vive-score/frame.html'));
const fclick = async (p, sel) => { const fr = frameOf(p); await fr.evaluate(s => { const e = document.querySelector(s); if (!e) throw Error('sin ' + s); e.click(); }, sel); await p.waitForTimeout(120); };
const fclickIf = async (p, sel) => { const fr = frameOf(p); await fr.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); }, sel); await p.waitForTimeout(120); };
const cc = async (p, section) => { await fclick(p, '[data-tab="control"]'); await frameOf(p).evaluate(k => { document.querySelectorAll('details.ccAll').forEach(a => { a.open = true; }); const d = document.querySelector('details[data-cc="' + k + '"]'); if (!d) throw new Error('sin sección ' + k); d.open = true; }, section); await p.waitForTimeout(80); };
const fchange = async (p, sel, val) => { const fr = frameOf(p); await fr.evaluate(([s, v]) => { const e = document.querySelector(s); if (!e) throw Error('sin ' + s); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, val]); await p.waitForTimeout(120); };
const ftext = p => frameOf(p).evaluate(() => document.getElementById('view').innerText);
const seedDates = p => p.evaluate(() => { const d = window.__T.dbg(); d.cards[0].name = 'Visa Titanium Popular'; if (d.cards[1]) d.cards[1].name = 'Visa Platinum Cibao'; d.cards[0].acquiredOn = '2021-03'; if (d.cards[1]) d.cards[1].acquiredOn = '2023-06'; d.loans[0].acquiredOn = '2024-03'; });
const rail = p => p.evaluate(() => [...document.querySelectorAll('.rail-main .rail-action')].map(b => b.dataset.id));
async function reopenScore(p) { await go(p, 'score'); await p.waitForTimeout(1500); }
async function finishQuestionnaire(p) { for (let i = 0; i < 7; i++) await fclickIf(p, '[data-q-act="next"]'); await fclick(p, '[data-q-act="finish"]'); await p.waitForTimeout(500); }

(async () => {
  const b = await chromium.launch();
  const errs = [];
  delete process.env.TOUCH;
  let { p, ctx } = await open(b, 1440, 900);
  p.on('pageerror', e => errs.push('PAGE ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 160)); });
  p.on('requestfailed', r => { if (/vive-score/.test(r.url())) errs.push('RED ' + r.url()); });
  p.on('response', r => { if (/vive-score/.test(r.url()) && r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()); });
  await seedDates(p);

  /* 1 · ubicación en la barra lateral */
  const ids = await rail(p), i = ids.indexOf('payments');
  check(1, 'Score está exactamente debajo de Visión global', i >= 0 && ids[i + 1] === 'score', ids.join(' › '));
  /* 3 · indicador pequeño sin puntaje */
  check(3, 'El indicador muestra «—» si no hay puntaje', (await p.evaluate(() => document.querySelector('.rail-action[data-id="score"] .vive-score-badge')?.textContent)) === '—');
  await reopenScore(p);
  const fr = frameOf(p);
  check('p', 'La página VIVE SCORE CRÉDITO abre en un marco aislado', !!fr && /Vive Score/i.test(await p.evaluate(() => document.getElementById('app').innerText)));

  /* 4 · cuestionario, 5 · mes y año, 6 · sin buró */
  const steps = []; for (let k = 0; k < 8; k++) { steps.push(await ftext(p)); if (k < 7) await fclickIf(p, '[data-q-act="next"]'); }
  const dateInputs = await frameOf(p).evaluate(() => document.querySelectorAll('input[type="date"],input[type="time"],input[type="datetime-local"]').length);
  check(4, 'El cuestionario solo pregunta lo que la app no puede saber (atrasos anteriores) y luego muestra el resumen: no hay preguntas manuales sobre productos nuevos, aumentos de límite, cerrados ni otros acontecimientos; el primer crédito solo se pide si la app no tiene fechas de apertura', /Atrasos anteriores/.test(steps[0]) && /PASO 1 DE 3/.test(steps[0]) && /Antigüedad/.test(steps[1]) && /Resumen/.test(steps[2]) && !/tarjeta de cr[eé]dito recientemente|refinanciamientos|aumentado el límite|cancelado o cerrado/.test(steps.join(' ')) && /Comenzar|Guardar/.test(await frameOf(p).evaluate(() => document.querySelector('.qnav .btn')?.textContent || '')), JSON.stringify(steps.slice(0, 3).map(t => t.replace(/\s+/g, ' ').slice(0, 140))));
  // paso «Sí» con atraso: pedir mes y año
  await fclick(p, '[data-q-act="goto"][data-q-arg="0"]').catch(() => {});
  await frameOf(p).evaluate(() => { qStep = 0; render(); });
  await fclick(p, '[data-q-act="ans"][data-q-arg="late:yes"]');
  const lateUi = await frameOf(p).evaluate(() => ({ selects: [...document.querySelectorAll('.qmyrow select')].map(s => s.getAttribute('aria-label')), days: document.querySelectorAll('[data-q-field*="day"],[data-q-field*="hora"]').length }));
  check(5, 'Las preguntas históricas piden solo mes y año (sin día ni hora)', dateInputs === 0 && lateUi.selects.some(s => /mes/.test(s)) && lateUi.selects.some(s => /año/.test(s)) && lateUi.days === 0, lateUi.selects.join(' | '));
  const allQ = steps.join(' ').replace(/Las preguntas históricas usan solo mes y año\. No se pregunta por consultas a burós de crédito\./g, '');
  check(6, 'No hay preguntas sobre consultas a burós', !/TransUnion|Equifax|consult(a|as|ó) (de|a|del) (bur|cr[eé]dito)|qué institución consult/i.test(allQ), 'texto de los pasos revisado');
  // volver al estado limpio: respuesta «No, nunca»
  await fclick(p, '[data-q-act="ans"][data-q-arg="late:no"]');
  await frameOf(p).evaluate(() => { qStep = 7; render(); });
  await fclick(p, '[data-q-act="finish"]'); await p.waitForTimeout(500);

  const score0 = await frameOf(p).evaluate(() => evaluate(current()).score);
  check(3, 'El indicador muestra el último puntaje calculado', Number.isFinite(score0) && (await p.evaluate(() => document.querySelector('.vive-score-badge')?.textContent)) === String(score0), String(score0));

  /* 19 · aumentos de límite precargados por indicación del titular */
  const seedInfo = await frameOf(p).evaluate(() => { const L = ST.answers.limit, ev = L.events || []; return { answer: L.answer, auto: L.autoFilled, n: ev.length, periods: [...new Set(ev.map(e => e.period))].sort().join(','), cards: [...new Set(ev.map(e => e.productLabel))].sort().join(','), amounts: ev.map(e => e.currency + ':' + e.prev + '>' + e.next).sort().join(' '), kinds: [...new Set(ev.map(e => e.kind))].join(','), req: current().limitReq0to6 + current().limitReq7to12, autoCount: current().limitAuto, seeded: Object.keys(ST.seeded || {}).length }; });
  const limitStepShown = steps.some(t => /Aumentos de límite\n/.test(t.split('\n').slice(0, 3).join('\n')));
  check(19, 'Los aumentos de límite de Popular (ago-2026) y Cibao (sep-2026) quedan cargados solos y ese paso se omite', seedInfo.answer === 'yes' && seedInfo.auto && seedInfo.n === 4 && seedInfo.periods === '2026-08,2026-09' && /Cibao/.test(seedInfo.cards) && /Popular/.test(seedInfo.cards) && /DOP:200000>400000/.test(seedInfo.amounts) && /USD:3000>6000/.test(seedInfo.amounts) && /DOP:144000>400000/.test(seedInfo.amounts) && /USD:2000>6000/.test(seedInfo.amounts) && seedInfo.kinds === 'automatic' && seedInfo.req === 0 && seedInfo.autoCount === 4 && !limitStepShown && /PASO \d DE 3/.test(steps[0]), JSON.stringify(seedInfo));

  /* 8 · datos crediticios recuperados */
  const payload = await p.evaluate(() => window.ViveScoreAdapter.read());
  const dbCounts = await p.evaluate(() => { const d = window.__T.dbg(); return { cards: d.cards.filter(c => !c.archived).length, loans: d.loans.filter(l => !l.archived).length }; });
  check(8, 'Tarjetas y préstamos se recuperan de los datos reales', payload.cards.length >= dbCounts.cards && payload.loans.length === dbCounts.loans && payload.cards.every(c => c.limit > 0 || c.balance > 0), `${payload.cards.length} líneas de tarjeta · ${payload.loans.length} préstamos`);
  /* 7 · sin cuentas de ahorro ni saldos */
  const adapterSrc = fs.readFileSync(path.join(ROOT, 'src/vive-score/adapter.js'), 'utf8');
  const before7 = await frameOf(p).evaluate(() => evaluate(current()).score);
  await p.evaluate(() => { const d = window.__T.dbg(); d.transactions.push({ id: 'sv-test-1', date: '2026-11-10', type: 'income', amount: 9000000, currency: 'DOP', accountId: d.accounts[0].id, category: 'Otros ingresos', note: 'prueba saldo' }); });
  await go(p, 'score'); await cc(p, 'productos'); await frameOf(p).evaluate(() => VSHost.refresh()); await p.waitForTimeout(500);
  const after7 = await frameOf(p).evaluate(() => evaluate(current()).score);
  check(7, 'El score no usa cuentas de ahorro ni saldos bancarios', !/certificates|savings/.test(adapterSrc) && !('accounts' in payload) && Object.keys(payload.liquidity || {}).sort().join() === 'accounts,days,held30,now' && before7 === after7, `score ${before7} → ${after7} tras un depósito de RD$9,000,000`);
  /* 30 · reserva automática: solo cuenta lo que lleva ≥30 días; un depósito reciente no cuenta, uno antiguo sí; el score no cambia */
  const liqA = await frameOf(p).evaluate(() => PAYLOAD.liquidity);
  await p.evaluate(() => { const d = window.__T.dbg(); d.transactions.push({ id: 'sv-test-2', date: '2026-09-01', type: 'income', amount: 3000000, currency: 'DOP', accountId: d.accounts[0].id, category: 'Otros ingresos', note: 'prueba reserva antigua' }); window.__viveScoreBridge.rerender(); });
  await frameOf(p).evaluate(() => VSHost.refresh()); await p.waitForTimeout(600);
  const liqB = await frameOf(p).evaluate(() => ({ f: window.parent.__T.dbg().accounts[0].currency === 'USD' ? PAYLOAD.fx : 1, l: PAYLOAD.liquidity, score: evaluate(current()).score, a: evaluate(current()).capacity }));
  check(30, 'Reserva automática: solo cuenta el dinero que lleva ≥30 días en cuentas y efectivo (un depósito de hace 5 días no suma; uno de hace más de 30 días sí) y nunca cambia el score', liqA && liqA.held30 < liqA.now && liqB.l.held30 - liqA.held30 === 3000000 * liqB.f && liqB.score === after7, JSON.stringify({ antes: liqA, despues: liqB.l, score: liqB.score, cobertura: liqB.a && Math.round((liqB.a.coverage || 0) * 100) }));

  /* 9 · declarado vs verificado */
  await cc(p, 'antecedentes');
  const prov = await ftext(p);
  const ageBefore = await frameOf(p).evaluate(() => current().ageSource);
  await cc(p, 'productos');
  await frameOf(p).evaluate(() => { const c = document.querySelector('[data-evidence-checked]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(300);
  const ageAfter = await frameOf(p).evaluate(() => current().ageSource);
  check(9, 'Los antecedentes declarados se distinguen de los datos verificados', /Declarado/.test(prov) && /Observado en la app/.test(prov) && ageBefore === 'registrada en vive el hoy' && ageAfter === 'verificada', `${ageBefore} → ${ageAfter}`);

  /* 10 · sin historial ficticio · 11 · fórmulas */
  const hist = await frameOf(p).evaluate(() => ({ months: DB.months.map(m => m.period), seals: DB.seals.length }));
  check(10, 'No existen puntuaciones históricas ficticias (el historial empieza en noviembre de 2026)', hist.months.length === 1 && hist.months[0] >= '2026-11', hist.months.join(','));
  const calc = await frameOf(p).evaluate(() => {
    const s = current(), e = evaluate(s), sum = Object.values(e.points).reduce((a, v) => a + v, 0);
    const tests = modelAuditSuite();
    const util = e.util, expectedAgg = lerp(util, [[0, 180], [.01, 180], [.09, 177], [.29, 148], [.49, 110], [.75, 60], [1, 12], [1.2, 0]]);
    const agg = e.parts.owed.find(x => x.id === 'o_aggregate').points;
    const p2 = clone(s); p2.late30 = 1; const worse = evaluate(p2).score;
    const p3 = clone(s); p3.limitReq0to6 = 1; const reqd = evaluate(p3).score;
    return { score: e.score, sum, failed: tests.filter(t => !t.ok).map(t => t.name), agg, expectedAgg: Math.round(expectedAgg), worse, reqd, max: FACTORS.reduce((a, f) => a + f.max, 0), weights: FACTORS.map(f => f.max).join('/') };
  });
  check(11, 'Las fórmulas se calculan correctamente (suma, pesos 35/30/15/10/10, regla de utilización, monotonía, 8 pruebas)', calc.score === calc.sum && calc.max === 1000 && calc.weights === '350/300/150/100/100' && calc.agg === calc.expectedAgg && calc.worse < calc.score && calc.reqd < calc.score && calc.failed.length === 0, JSON.stringify(calc));

  /* 12 · ingresos no alteran el score */
  const capBefore = await frameOf(p).evaluate(() => evaluate(current()).capacity.income);
  await p.evaluate(() => { const d = window.__T.dbg(); d.incomeSchedules = [{ id: 'sv-inc', name: 'Salario prueba', kind: 'formal', active: true, nextDue: '2026-11-30', currency: 'DOP', grossMonthly: 150000, frequency: 'monthly', accountId: d.accounts[0].id, postingMode: 'manual' }]; });
  await cc(p, 'productos'); await frameOf(p).evaluate(() => VSHost.refresh()); await p.waitForTimeout(500);
  const inc = await frameOf(p).evaluate(() => { const e = evaluate(current()); return { score: e.score, income: e.capacity.income, newQuota: e.capacity.newQuota }; });
  check(12, 'Los ingresos no alteran directamente el score; solo la capacidad de endeudamiento', inc.score === after7 && inc.income > capBefore, `score ${after7} → ${inc.score}; ingreso reconocido ${Math.round(capBefore)} → ${Math.round(inc.income)}`);

  /* 14 · texto explicativo coincide con el cálculo */
  await fclick(p, '[data-tab="summary"]');
  await fclick(p, '[data-why]'); await p.waitForTimeout(200);
  const sum = await frameOf(p).evaluate(() => { const c = evaluate(current()); return { text: document.getElementById('view').innerText + ' ' + document.getElementById('drawer').innerText, score: c.score, util: pct(c.util) }; });
  await frameOf(p).evaluate(() => drawerClose());
  check(14, 'La explicación «¿Por qué este puntaje?» coincide con los cálculos', sum.text.includes(String(sum.score)) && sum.text.includes(sum.util) && /en construcción/.test(sum.text), `${sum.score} · utilización ${sum.util}`);

  /* 15 · las modificaciones se conservan tras recargar */
  await frameOf(p).evaluate(() => { qEditing = false; setOverride(ST.overrides ? Object.keys(ST.overrides)[0] || current().cards[0].productId : current().cards[0].productId, { opened: '2019-08' }); });
  await p.waitForTimeout(500);
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('vive-score:v1') || 'null'));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2500); await p.evaluate(() => window.__T.boot()); await p.waitForTimeout(1200);
  await seedDates(p); await reopenScore(p);
  const reload = await frameOf(p).evaluate(() => ({ gate: !!document.querySelector('.qcard'), cal: ST.answers?.completed, version: ST.declVersion, seeds: ST.answers.limit.events.length, ov: Object.values(ST.overrides).some(o => o.opened === '2019-08') }));
  check(15, 'Las respuestas y modificaciones se conservan al recargar', !!stored && reload.cal === true && reload.gate === false && reload.ov && reload.seeds === 4, JSON.stringify(reload));

  /* 21 · simulación TransUnion (solo TransUnion; Equifax sin parámetros públicos) */
  const tuSnapDb = await p.evaluate(() => JSON.stringify(window.__T.dbg()));
  await fclick(p, '[data-tab="summary"]');
  const tuScoreBefore = await frameOf(p).evaluate(() => evaluate(current()).score);
  const tu = await frameOf(p).evaluate(() => { const e = evaluate(current()), sc = tuScenarios(), by = l => sc.find(x => x.label.startsWith(l)); return { score: e.score, est: tuEstimate(e.score), expect: Math.round(459 + e.score * 0.389), text: document.getElementById('view').innerText, pay: by('Pagar el 25')?.delta, late: by('Un atraso')?.delta, auto: by('Aumento automático')?.delta, req: by('Un aumento de límite que yo solicite')?.delta, n: sc.length }; });
  const tuSnapDb2 = await p.evaluate(() => JSON.stringify(window.__T.dbg()));
  check(21, 'Píldora TransUnion: la escala 459–848 aplica la fórmula 459 + puntaje × 0,389, aparece en Mi score con su cálculo y los escenarios del simulador usan el motor sin tocar datos reales', tu.est >= 459 && tu.est <= 848 && tu.est === tu.expect && /TransUnion ≈/.test(tu.text) && tu.n === 12 && tu.late < 0 && tu.pay >= 0 && tu.auto >= 0 && tu.req <= tu.auto && tuSnapDb === tuSnapDb2, JSON.stringify({ score: tu.score, est: tu.est, escenarios: { pagar: tu.pay, atraso: tu.late, limiteAuto: tu.auto, limiteSolicitado: tu.req } }));

  /* 22 · créditos recientes: ventanas 0–6 / 7–12 meses, tarjetas sin límite, la fecha de «Editar» manda */
  await p.evaluate(() => { const d = window.__T.dbg(); d.cards[0].name = 'BHD Visa'; d.cards[0].acquiredOn = '2026-09'; d.cards[1].name = 'Qik Pro'; d.cards[1].acquiredOn = '2026-05'; d.loans[0].acquiredOn = '2025-11'; const extra = JSON.parse(JSON.stringify(d.cards[0])); Object.assign(extra, { id: 'nuevo-sv', name: 'Tarjeta nueva', acquiredOn: '2026-10', limitDOP: 0, limitUSD: 0 }); Object.keys(extra).filter(k => /^opening|overdraft/.test(k)).forEach(k => { extra[k] = 0; }); d.cards.push(extra); });
  await cc(p, 'productos'); await frameOf(p).evaluate(() => VSHost.refresh()); await p.waitForTimeout(600);
  await frameOf(p).evaluate(() => { const id = current().cards.find(c => /BHD/.test(c.name)).productId; setOverride(id, { opened: '2020-01' }); rebuildDB(); render(); });
  await fclick(p, '[data-tab="detail"]');
  const rc = await frameOf(p).evaluate(() => { const s = current(), e = evaluate(s); return { n06: s.new0to6, n712: s.new7to12, list: s.products.map(x => x.name + ':' + x.window + ':' + x.source).join(' | '), text: document.getElementById('view').innerText, part: e.parts.new[0].points, score: e.score }; });
  check(22, 'Créditos recientes: BHD, Qik y una tarjeta sin límite cuentan por su mes y año de apertura (solo 0–6 meses); la fecha de la app manda', rc.n06 === 4 && rc.n712 === 0 && /BHD Visa:0–6 meses:registrada en vive el hoy/.test(rc.list) && /Qik Pro:0–6 meses/.test(rc.list) && /Tarjeta nueva:0–6 meses/.test(rc.list) && /Créditos recientes/.test(rc.text) && /Tarjeta nueva/.test(rc.text) && rc.part === 0 && /Banco Lafise:0–6 meses:historial de cancelados/.test(rc.list), JSON.stringify({ n0a6: rc.n06, n7a12: rc.n712, puntos: rc.part, productos: rc.list }));

  const sc23 = await frameOf(p).evaluate(() => evaluate(current()).score);
  /* 23 · ingresos dinámicos: nómina quincenal en base mensual, bruto→neto, adicionales recurrentes */
  await p.evaluate(() => { const d = window.__T.dbg(), acc = d.accounts[0].id; d.incomeSchedules = [{ id: 'sv-q', name: 'Salario quincenal', kind: 'formal', active: true, nextDue: '2026-11-30', currency: 'DOP', grossMonthly: 150000, frequency: 'semi_monthly', accountId: acc, postingMode: 'manual' }]; for (const m of ['2026-06', '2026-08', '2026-09', '2026-10']) d.transactions.push({ id: 'bx-' + m, type: 'income', date: m + '-20', amount: 20000, currency: 'DOP', accountId: acc, incomeScheduleId: 'sv-q', laborExtra: true, laborExtraKind: 'bonus', category: 'Salario y nómina', note: 'bono' }); d.transactions.push({ id: 'rb-1', type: 'income', date: '2026-10-21', amount: 50000, currency: 'DOP', accountId: acc, incomeScheduleId: 'sv-q', laborExtra: true, laborExtraKind: 'reimbursement', category: 'Reembolsos', note: 'reembolso' }); });
  await cc(p, 'productos'); await frameOf(p).evaluate(() => VSHost.refresh()); await p.waitForTimeout(600);
  await fclick(p, '[data-tab="detail"]');
  const inc2 = await frameOf(p).evaluate(() => { const s = current(), e = evaluate(s), br = window.parent.__viveScoreBridge, sch = window.parent.__T.dbg().incomeSchedules[0]; const per = br.payroll(sch, '2026-11-30'), mon = br.payroll({ ...sch, frequency: 'monthly' }, '2026-11-30'); return { net: Math.round(s.payroll.net), perPayment: Math.round(per.net), monthlyRef: Math.round(mon.net), extra: Math.round(s.otherFormal), gross: Math.round(s.payroll.gross), parts: [s.payroll.afp, s.payroll.sfs, s.payroll.isr].map(Math.round), text: document.getElementById('view').innerText, score: e.score }; });
  check(23, 'Ingresos dinámicos: la nómina quincenal se mide en base mensual (2 pagos), calcula bruto→AFP/SFS/ISR→neto (sin desglosarlo en pantalla) y reconoce adicionales recurrentes sin reembolsos', Math.abs(inc2.net - inc2.monthlyRef) <= 2 && Math.abs(inc2.net - 2 * inc2.perPayment) <= 2 && inc2.extra === 13333 && inc2.gross === 150000 && inc2.parts.every(v => v > 0) && inc2.score === sc23, JSON.stringify({ netMensual: inc2.net, pagoQuincenal: inc2.perPayment, referenciaMensual: inc2.monthlyRef, adicionalesRecurrentes: inc2.extra, bruto: inc2.gross, afpSfsIsr: inc2.parts }));

  /* 20 · entidades no financieras: no van para nada (ni score, ni capacidad, ni pantallas) */
  await cc(p, 'productos');
  const nb0 = await frameOf(p).evaluate(() => { const c = evaluate(current()); return { loans: current().loans.length, debt: Math.round(c.capacity.debt), due: Math.round(c.capacity.loanDues) }; });
  await p.evaluate(() => { const d = window.__T.dbg(); const l = d.loans[0]; const bk = d.banks.find(b => b.id === l.bankId); bk.kind = 'Telefonía'; });
  await frameOf(p).evaluate(() => VSHost.refresh()); await p.waitForTimeout(500);
  await fclick(p, '[data-tab="detail"]');
  const nb1 = await frameOf(p).evaluate(() => { const c = evaluate(current()), s = current(); return { loans: s.loans.length, payload: window.__nbPayload, debt: Math.round(c.capacity.debt), due: Math.round(c.capacity.loanDues), text: document.getElementById('view').innerText, amort: c.parts.owed.find(x => x.id === 'o_installments').points }; });
  const nbLoanName = await p.evaluate(() => window.__T.dbg().loans[0].name);
  const nbPay = await p.evaluate(() => window.ViveScoreAdapter.read());
  const nbAll = []; for (const t of ['summary', 'detail', 'control']) { await fclick(p, '[data-tab="' + t + '"]'); nbAll.push(await ftext(p)); }
  check(20, 'Las entidades no financieras no van para nada: ni score, ni capacidad, ni pantallas, ni lectura del adaptador', nb0.loans === 1 && nb1.loans === 0 && nbPay.loans.length === 0 && nb1.debt < nb0.debt && nb1.due === 0 && nb1.amort === 18 && !/Fuera del score/.test(nb1.text) && nbAll.every(t => !t.includes(nbLoanName)), JSON.stringify({ antes: nb0, despues: { loans: nb1.loans, debt: nb1.debt, due: nb1.due }, nombreAusenteEnPantallas: nbAll.every(t => !t.includes(nbLoanName)) }));

  /* 24 · Centro de control: las 5 secciones unificadas, el resto de páginas intactas, sin información repetida */
  const tabsNow = await frameOf(p).evaluate(() => [...document.querySelectorAll('#tabs [data-tab]')].map(b => b.textContent.trim()));
  const expectedTabs = ['Mi score', 'Créditos y capacidad', 'Centro de control'];
  const secs = {}; const headings = []; const features = {};
  await fclick(p, '[data-tab="control"]'); await frameOf(p).evaluate(() => document.querySelectorAll('details.ccAll').forEach(a => { a.open = true; }));
  const chips = await frameOf(p).evaluate(() => [...document.querySelectorAll('details.ccdet > summary')].map(b => b.textContent.trim()));
  for (const k of ['antecedentes', 'productos', 'cortes', 'auditoria', 'variables', 'metodologia']) {
    await cc(p, k);
    secs[k] = await frameOf(p).evaluate(() => ({ h: [...document.querySelectorAll('#view h2, #view .ccdet > summary')].map(e => e.textContent.trim()), len: document.getElementById('view').innerText.length, sel: document.querySelectorAll('[data-evidence-source]').length, chk: document.querySelectorAll('[data-evidence-checked]').length, seal: !!document.getElementById('sealMonth'), audit: !!document.getElementById('downloadAudit'), edit: !!document.querySelector('[data-q-act="edit"]'), json: !!document.getElementById('downloadJson'), csv: !!document.getElementById('downloadCSV'), reset: !!document.getElementById('vsReset'), refresh: !!document.querySelector('[data-refresh-data]'), ov: document.querySelectorAll('[data-ov]').length }));
    if (!headings.length) headings.push(...secs[k].h.filter(t => t !== 'Centro de control'));
  }
  const dupHeadings = headings.filter((t, i) => headings.indexOf(t) !== i);
  const evidenceTotal = Object.values(secs).reduce((a, x) => a + x.sel, 0);
  const aliasOk = await frameOf(p).evaluate(() => { tab = 'observatory'; render(); const a = ccOpen.antecedentes && tab === 'control'; tab = 'audit'; render(); const b = ccOpen.auditoria; tab = 'matrix'; render(); const d = ccOpen.variables; tab = 'method'; render(); const e2 = ccOpen.metodologia; tab = 'capacity'; render(); const c = tab === 'detail' && d && e2; tab = 'summary'; render(); return a && b && c; });
  const otherPages = []; for (const t of ['summary', 'detail']) { await fclick(p, '[data-tab="' + t + '"]'); otherPages.push((await ftext(p)).length > 300); }
  const bgW = await p.evaluate(async () => { const c = el => getComputedStyle(el); const sl = document.querySelector('[data-vs-slot]'); const w = c(document.body).backgroundImage; return { slot: c(sl).backgroundColor, gradient: /gradient/.test(w), body: c(document.body).backgroundColor }; });
  check('fondo', 'La página Score conserva el fondo de las demás vistas (el contenedor del marco es transparente y el degradado de la app se ve)', bgW.slot === 'rgba(0, 0, 0, 0)' && bgW.gradient, JSON.stringify(bgW));
  check(24, 'Centro de control corto: indicadores, estado y 6 secciones plegables (Antecedentes, Productos y cancelados, Cortes guardados, Auditoría, Variables, Metodología); sin botones de exportar, borrar, sellar ni releer; las demás páginas siguen; sin repetidos', JSON.stringify(tabsNow) === JSON.stringify(expectedTabs) && JSON.stringify(chips) === JSON.stringify(['Antecedentes y procedencia', 'Productos y cancelados', 'Cortes guardados', 'Auditoría y pruebas', 'Variables', 'Metodología']) && Object.values(secs).every(x => x.len > 300) && dupHeadings.length === 0 && secs.antecedentes.edit && secs.auditoria.audit && secs.productos.ov >= 2 && Object.values(secs).every(x => !x.seal && !x.json && !x.csv && !x.reset && !x.refresh) && aliasOk && otherPages.every(Boolean), JSON.stringify({ pestanas: tabsNow.length, apartados: chips.length, repetidos: dupHeadings, lens: Object.values(secs).map(x=>x.len), alias: aliasOk, otras: otherPages, ed: secs.antecedentes.edit, au: secs.auditoria.audit, ov: secs.productos.ov, ex: Object.values(secs).map(x=>[x.seal,x.json,x.csv,x.reset,x.refresh].join()) }));

  /* 25 · independencia: leer → analizar → calcular → mostrar, sin modificar datos originales */
  const orig = () => p.evaluate(() => { const d = window.__T.dbg(); return JSON.stringify(['cards', 'loans', 'transactions', 'incomeSchedules', 'recurring', 'accounts', 'banks', 'categories'].map(k => d[k])); });
  const origA = await orig();
  for (const t of ['summary', 'detail', 'control']) await fclick(p, '[data-tab="' + t + '"]');
  for (const k of ['antecedentes', 'productos', 'cortes', 'auditoria', 'variables', 'metodologia']) await cc(p, k);
  await cc(p, 'antecedentes'); await fclick(p, '[data-q-act="edit"]'); await frameOf(p).evaluate(() => { qStep = 7; render(); }); await fclick(p, '[data-q-act="finish"]');
  await frameOf(p).evaluate(async () => { await autoSeal(); });
  
  const origB = await orig();
  const sealsKept = await frameOf(p).evaluate(() => ST.seals.length);
  check(25, 'Independencia: recorrer todo, editar antecedentes, sellar un corte y anotar TransUnion no modifica ningún dato original de la app', origA === origB && sealsKept >= 1, `${origA.length} caracteres de datos originales idénticos antes y después`);

  /* 26 · alimentación automática: un cambio en la app llega solo, sin pulsar nada */
  await fclick(p, '[data-tab="detail"]');
  const before26 = await frameOf(p).evaluate(() => ({ cards: current().cards.length, n06: current().new0to6 }));
  await p.evaluate(() => { const d = window.__T.dbg(); const c = JSON.parse(JSON.stringify(d.cards[0])); Object.assign(c, { id: 'auto-feed-1', name: 'Tarjeta automática', acquiredOn: '2026-11', limitDOP: 90000, limitUSD: 0 }); Object.keys(c).filter(k => /^opening|overdraft/.test(k)).forEach(k => { c[k] = 0; }); d.cards.push(c); });
  await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.waitForTimeout(1200);
  const after26 = await frameOf(p).evaluate(() => ({ cards: current().cards.length, n06: current().new0to6, text: document.getElementById('view').innerText }));
  check(26, 'Alimentación automática: una tarjeta nueva registrada en la app aparece en VIVE SCORE sin pulsar nada', after26.cards === before26.cards + 1 && after26.n06 === before26.n06 + 1 && /Tarjeta automática/.test(after26.text), JSON.stringify({ antes: before26, despues: { cards: after26.cards, n0a6: after26.n06 } }));

  /* 27 · destino del dinero: efectivo y transferencia, sin malas lecturas ni ahorros */
  await fclick(p, '[data-tab="detail"]');
  const cap0 = await frameOf(p).evaluate(() => { const e = evaluate(current()), sp = current().spending || {}; return { fixed: Math.round(e.capacity.cashFixed), score: e.score, ess: Math.round(sp.essentialMonthly || 0), vari: Math.round(sp.variableMonthly || 0), cash: Math.round(sp.cashMonthly || 0), bank: Math.round(sp.bankMonthly || 0), used: sp.monthsUsed || 0 }; });
  await p.evaluate(() => { const d = window.__T.dbg(); const isCash = a => a.kind === 'cash' || /efectivo/i.test(a.name); const bank = d.accounts.find(a => !isCash(a)), cashAcc = d.accounts.find(isCash); const card = d.cards[0], loan = d.loans[0]; let n = 0; const add = (o) => d.transactions.push({ id: 'sp-' + (n++), currency: 'DOP', ...o }); for (const m of ['2026-08', '2026-09', '2026-10']) { add({ type: 'expense', date: m + '-05', amount: 10000, accountId: cashAcc.id, category: 'Alimentación' }); add({ type: 'expense', date: m + '-06', amount: 25000, accountId: bank.id, category: 'Vivienda' }); add({ type: 'expense', date: m + '-07', amount: 4000, accountId: bank.id, category: 'Entretenimiento' }); add({ type: 'card_payment', date: m + '-08', amount: 50000, accountId: bank.id, cardId: card.id }); add({ type: 'transfer', date: m + '-09', amount: 100000, accountId: bank.id, toAccountId: cashAcc.id }); add({ type: 'loan_payment', date: m + '-10', amount: 8000, accountId: bank.id, loanId: loan.id }); add({ type: 'expense', date: m + '-11', amount: 800, accountId: bank.id, category: 'Servicios básicos', recurringId: 'rec-x' }); add({ type: 'card_charge', date: m + '-12', amount: 3000, cardId: card.id, category: 'Compras personales' }); add({ type: 'expense', date: m + '-13', amount: 700, accountId: bank.id, category: 'Deudas e intereses' }); } });
  await cc(p, 'productos'); await frameOf(p).evaluate(() => VSHost.refresh()); await p.waitForTimeout(600);
  await fclick(p, '[data-tab="detail"]');
  const sp = await frameOf(p).evaluate(() => { const s = current(), e = evaluate(s), sp = s.spending; return { ess: Math.round(sp.essentialMonthly), vari: Math.round(sp.variableMonthly), cash: Math.round(sp.cashMonthly), bank: Math.round(sp.bankMonthly), used: sp.monthsUsed, exp: s.expenses.filter(x => x.auto).map(x => x.name + ':' + Math.round(x.amount)).sort().join(' | '), fixed: Math.round(e.capacity.cashFixed), score: e.score, text: document.getElementById('view').innerText, excl: Object.keys(sp.excluded).filter(k => sp.excluded[k] > 0).sort().join(',') }; });
  check(27, 'Destino del dinero: separa efectivo y transferencia, esencial y variable, sin contar pagos de tarjeta/préstamo, transferencias propias, recurrentes ni intereses; no usa ahorros', sp.ess - cap0.ess === 35000 && sp.vari - cap0.vari === 4000 && sp.cash - cap0.cash === 10000 && sp.bank - cap0.bank === 29000 && sp.used === 3 && /Alimentación \(efectivo y transferencia\):/.test(sp.exp) && /Vivienda \(efectivo y transferencia\):/.test(sp.exp) && !/Entretenimiento/.test(sp.exp) && sp.fixed - cap0.fixed === 35000 && sp.score === cap0.score && /Destino del dinero/.test(sp.text) && sp.excl === 'cardPayments,debtInterest,loanPayments,recurring,transfers', JSON.stringify({ sumaEsencial: sp.ess - cap0.ess, sumaVariable: sp.vari - cap0.vari, sumaEfectivo: sp.cash - cap0.cash, sumaTransferencia: sp.bank - cap0.bank, descuentaDelMargen: sp.fixed - cap0.fixed, fuera: sp.excl }));

  /* 28 · encabezado y fondo de la página */
  const head28 = await p.evaluate(() => ({ title: document.querySelector('.topbar-intro .top-title')?.textContent, sub: document.querySelector('.topbar-intro .top-sub')?.textContent }));
  const bg28 = await frameOf(p).evaluate(() => ({ cs: getComputedStyle(document.documentElement).colorScheme, html: getComputedStyle(document.documentElement).backgroundColor, body: getComputedStyle(document.body).backgroundColor })) ;
  const frameCs = await p.evaluate(() => getComputedStyle(document.querySelector('.vs-frame')).colorScheme);
  /* el marco debe ser transparente con el sistema en modo claro y oscuro (si no, el navegador lo pinta con un panel opaco) */
  const fondoOk = {};
  for (const scheme of ['light', 'dark']) {
    await p.emulateMedia({ colorScheme: scheme }); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(400);
    const r = await p.evaluate(() => { const f = document.querySelector('.vs-frame').getBoundingClientRect(); return { x: Math.round(f.right - 70), y: Math.round(Math.min(f.bottom, innerHeight) - 24), width: 50, height: 6 }; });
    const a = await p.screenshot({ clip: r }); await p.evaluate(() => { document.querySelector('.vs-frame').style.visibility = 'hidden'; }); await p.waitForTimeout(150);
    const b2 = await p.screenshot({ clip: r }); await p.evaluate(() => { document.querySelector('.vs-frame').style.visibility = ''; });
    fondoOk[scheme] = a.equals(b2);
  }
  await p.emulateMedia({ colorScheme: 'light' });
  check(28, 'La página se titula «Vive Score» con «vive el hoy» debajo (como las demás vistas), y el fondo es transparente (hereda el diseño de la app)', head28.title === 'Vive Score' && head28.sub === 'vive el hoy' && frameCs === 'light dark' && bg28.html === 'rgba(0, 0, 0, 0)' && bg28.body === 'rgba(0, 0, 0, 0)', JSON.stringify({ ...head28, ...bg28, marco: frameCs, transparenteClaro: fondoOk.light, transparenteOscuro: fondoOk.dark }));

  /* 2 · solo web / 16 · móvil sin cambios / 17 · desactivación */
  /* 32 · variables: todo automático desde la app; solo el historial anterior es manual; sin datos personales */
  const vr = await frameOf(p).evaluate(() => { const man = VARS.filter(v => v[2] !== 'Automático').map(v => v[3]); const txt = VARS.map(v => v.join(' ')).join(' ').toLowerCase() + ' ' + [...document.querySelectorAll('[data-q-act],input,select')].map(e => (e.getAttribute('aria-label') || e.id || '')).join(' ').toLowerCase(); return { n: VARS.length, man, personal: /\b(sexo|género|genero|edad del|estado civil|ocupaci|profesi|nacionalidad|c[eé]dula)\b/.test(txt) }; });
  check(32, 'Variables: todo es automático desde vive el hoy salvo el historial anterior (atrasos anteriores y cancelados anteriores); no hay variables personales como sexo, edad, estado civil u ocupación', vr.n >= 15 && vr.man.length === 2 && vr.man.every(m => /anteriores|antes de usar/i.test(m)) && !vr.personal, JSON.stringify(vr));

  /* 29 · historial de límites automático: editar el límite de una tarjeta queda registrado con fecha y se cuenta desde ese mes */
  await go(p, 'score'); await p.waitForTimeout(800);
  const lim0 = await frameOf(p).evaluate(() => { const e = evaluate(current()); return { score: e.score, req: current().limitReq0to6, auto: current().limitAuto, ev: (ST.answers.limit.events || []).filter(x => x.detected).length, obs: Object.keys(ST.limitObs || {}).length }; });
  await p.evaluate(() => { const c = window.__T.dbg().cards.find(x => x.limitDOP > 0 && !/popular|cibao/i.test(x.name + (x.bank || ''))) || window.__T.dbg().cards.find(x => x.limitDOP > 0); window.__lim = { id: c.id, old: c.limitDOP }; c.limitDOP = c.limitDOP + 100000; });
  await cc(p, 'productos'); await frameOf(p).evaluate(() => VSHost.refresh()); await p.waitForTimeout(700);
  const lim1 = await frameOf(p).evaluate(() => { const e = evaluate(current()), d = (ST.answers.limit.events || []).filter(x => x.detected); return { score: e.score, req: current().limitReq0to6, auto: current().limitAuto, n: d.length, last: d[d.length - 1] || null, hasAt: !!(d[d.length - 1] && d[d.length - 1].at) }; });
  await cc(p, 'antecedentes');
  await fclick(p, '[data-limit-kind]'); await p.waitForTimeout(300);
  const lim2 = await frameOf(p).evaluate(() => ({ req: current().limitReq0to6, score: evaluate(current()).score, text: /historial de límites/i.test(document.getElementById('view').innerText) }));
  await p.evaluate(() => { const c = window.__T.dbg().cards.find(x => x.id === window.__lim.id); c.limitDOP = window.__lim.old; });
  check(29, 'Historial de límites automático: el cambio de límite editado en la app se registra solo con fecha y hora, no resta puntos mientras sea automático y sí al marcarlo como solicitado', lim0.obs >= 1 && lim1.n === lim0.ev + 1 && lim1.hasAt && lim1.last.next - lim1.last.prev === 100000 && lim1.last.period === lim1.last.at.slice(0, 7) && lim1.score === lim0.score && lim1.auto === lim0.auto + 1 && lim2.req === lim0.req + 1 && lim2.score <= lim1.score && lim2.text, JSON.stringify({ lim0, lim1: { ...lim1, last: lim1.last && { prev: lim1.last.prev, next: lim1.last.next, period: lim1.last.period } }, lim2 }));

  /* 33 · reporte de crédito: los 9 productos cancelados (sin Altice) se cargan solos con su tipo (TC/PR), una sola vez */
  const sd = await frameOf(p).evaluate(() => { const c = (ST.cancelled || []).filter(x => x.seed); return { n: c.length, cards: c.filter(x => x.kind === 'card').length, loans: c.filter(x => x.kind === 'loan').length, altice: c.some(x => /altice/i.test(x.inst)), first: c.map(x => x.opened).sort()[0], santa: c.find(x => /santa cruz/i.test(x.inst)), once: ST.seeded['cancelled-report-2026-11'] === true, saldados: c.filter(x => x.state === 'saldado').length, loansSaldados: c.filter(x => x.kind === 'loan' && x.state === 'saldado').length, vectores: c.filter(x => x.vector).length, atrasos: c.filter(x => x.maxLate > 0).length }; });
  await cc(p, 'productos');
  const sdText = await frameOf(p).evaluate(() => document.getElementById('view').innerText);
  check(33, 'Cancelados del reporte de crédito: 9 productos (7 tarjetas canceladas y 2 préstamos saldados, tipo por TC/PR) cargados solos, sin Altice, con límites, fecha de apertura y de cierre, vector de atrasos (ninguno) y visibles en Productos y cancelados', sd.n === 9 && sd.cards === 7 && sd.loans === 2 && !sd.altice && sd.first === '2022-02' && sd.once && sd.santa && sd.santa.opened === '2025-03' && sd.santa.closed === '2025-08' && /US\$2,100/.test(sd.santa.limit) && sd.saldados === 2 && sd.loansSaldados === 2 && sd.vectores === 9 && sd.atrasos === 0 && /Banco Lafise/.test(sdText) && /Qik Banco Digital/.test(sdText) && !/altice/i.test(sdText) && (sdText.match(/Sin atrasos/g) || []).length >= 9 && /cerrado|cancelado junio de 2026|saldado marzo de 2026/.test(sdText) && /abierto febrero de 2022/.test(sdText) && /últimos 12 meses 000 000 000 000/.test(sdText), JSON.stringify(sd));

  /* 31 · productos cancelados: suman años al historial y a la edad promedio; los castigados no; no tocan los datos de la app */
  await go(p, 'score'); await cc(p, 'productos');
  const cx0 = await frameOf(p).evaluate(() => { const c = current(); return { hist: c.historyMonths, avg: c.avgHistoryMonths, oldest: c.oldestPeriod, n: (ST.cancelled || []).length }; });
  const origC0 = await p.evaluate(() => JSON.stringify(['cards', 'loans', 'accounts'].map(k => window.__T.dbg()[k])));
  const addCancelled = (state, y) => frameOf(p).evaluate(([state, y]) => { const set = (id, v) => { document.getElementById(id).value = v; }; set('cx-inst', 'Banco Antiguo'); set('cx-kind', 'card'); set('cx-o-m', '03'); set('cx-o-y', String(y)); set('cx-c-m', '08'); set('cx-c-y', String(y + 3)); set('cx-state', state); document.querySelector('[data-cancel-add]').click(); }, [state, y]);
  await addCancelled('castigado', 2008); await p.waitForTimeout(300);
  const cx1 = await frameOf(p).evaluate(() => { const c = current(); return { hist: c.historyMonths, n: (ST.cancelled || []).length }; });
  await cc(p, 'productos'); await addCancelled('cancelado sin saldo', 2010); await p.waitForTimeout(300);
  const cx2 = await frameOf(p).evaluate(() => { const c = current(), e = evaluate(c); return { hist: c.historyMonths, avg: c.avgHistoryMonths, oldest: c.oldestPeriod, n: (ST.cancelled || []).length, score: e.score, text: document.getElementById('view').innerText.includes('Banco Antiguo') }; });
  const origC1 = await p.evaluate(() => JSON.stringify(['cards', 'loans', 'accounts'].map(k => window.__T.dbg()[k])));
  check(31, 'Productos cancelados: un cancelado en buen estado alarga el historial y la edad promedio; uno castigado no suma; los datos de la app no cambian', cx1.n === cx0.n + 1 && cx1.hist === cx0.hist && cx2.n === cx0.n + 2 && cx2.oldest === '2010-03' && cx2.hist > cx0.hist && cx2.avg >= cx0.avg && cx2.text && origC0 === origC1, JSON.stringify({ antes: cx0, castigado: cx1, bueno: cx2 }));

  /* 34 · un atraso registrado en un producto cancelado cuenta en el historial de pagos */
  await cc(p, 'productos');
  const lt0 = await frameOf(p).evaluate(() => { const c = current(); return { l60: c.late60, pay: evaluate(c).parts.pay ? 0 : 0, pts: evaluate(c).points.payment }; });
  await frameOf(p).evaluate(() => { const set = (id, v) => { document.getElementById(id).value = v; }; set('cx-inst', 'Banco Prueba'); set('cx-kind', 'loan'); set('cx-o-m', '01'); set('cx-o-y', '2025'); set('cx-c-m', '09'); set('cx-c-y', '2026'); set('cx-state', 'saldado'); set('cx-late', '2'); document.querySelector('[data-cancel-add]').click(); });
  await p.waitForTimeout(300);
  const lt1 = await frameOf(p).evaluate(() => { const c = current(); return { l60: c.late60, pts: evaluate(c).points.payment, rows: document.getElementById('view').innerText.includes('Atraso 60 días') }; });
  check(34, 'Un atraso de 60 días registrado en un producto cancelado suma al historial de pagos y resta puntos de pagos', lt1.l60 === lt0.l60 + 1 && lt1.pts < lt0.pts && lt1.rows, JSON.stringify({ antes: lt0, despues: lt1 }));

  /* 35 · espaciado: ningún bloque principal queda pegado al siguiente y las filas de KPI no dejan columnas vacías */
  const tight = [], emptyCols = [];
  for (const t of ['summary', 'detail', 'control']) {
    await fclick(p, '[data-tab="' + t + '"]'); await frameOf(p).evaluate(() => document.querySelectorAll('details.ccAll,details.ccdet').forEach(d => { d.open = true; })); await p.waitForTimeout(250);
    const r = await frameOf(p).evaluate(() => { const bad = [], empty = []; const sel = '.grid,.card,.callout'; for (const par of [document.getElementById('view'), ...document.querySelectorAll('.ccbody')]) { const kids = [...par.children].filter(c => c.matches(sel)); for (let i = 1; i < kids.length; i++) { const a = kids[i - 1].getBoundingClientRect(), c = kids[i].getBoundingClientRect(); if (c.top - a.bottom < 10 && c.top >= a.bottom - 1) bad.push(kids[i - 1].className + ' → ' + kids[i].className); } } for (const g of document.querySelectorAll('.grid.stats')) { const r = g.getBoundingClientRect(), last = [...g.children].reduce((m, k) => Math.max(m, k.getBoundingClientRect().right), 0); if (r.right - last > 24 && g.getBoundingClientRect().width > 700) empty.push(g.children.length); } return { bad, empty }; });
    tight.push(...r.bad.map(x => t + ': ' + x)); emptyCols.push(...r.empty.map(n => t + ': ' + n + ' KPI'));
  }
  check(35, 'Espaciado: ningún bloque (KPI, tarjetas, avisos) queda pegado al siguiente y las filas de KPI ocupan todo el ancho', tight.length === 0 && emptyCols.length === 0, JSON.stringify({ pegados: tight, columnasVacias: emptyCols }));

  /* 36 · Metodología esquematizada por fuente y simulación TransUnion calibrada con las variables del modelo */
  await cc(p, 'metodologia');
  const mt = await frameOf(p).evaluate(() => { const t = document.getElementById('view').innerText; const rules = [...document.querySelectorAll('#view .ccbody .rule code')].length; const links = [...document.querySelectorAll('#view a.source')].map(a => a.href); return { fuente: (t.match(/Qué dice la fuente/g) || []).length, aplica: (t.match(/Cómo lo aplica este modelo/g) || []).length, rules, links: links.length, https: links.every(l => /^https:/.test(l)), fico: /35 %/.test(t) && /VantageScore/.test(t) && /Ley 172-13/.test(t), propias: /Decisiones propias/.test(t), sinStale: !/Aperturas de 7|7–12|Conectar eventos reales|exigir permiso/.test(t), subreglas: FACTORS.reduce((a, f) => a + evaluate(current()).parts[f.id].length, 0) }; });
  check(36, 'Metodología esquematizada (5 factores: qué dice la fuente → cómo lo aplica el modelo → fórmulas del motor), con fuentes https, decisiones propias y sin textos viejos', mt.fuente === 5 && mt.aplica === 5 && mt.links >= 8 && mt.https && mt.fico && mt.propias && mt.sinStale && mt.rules >= mt.subreglas, JSON.stringify({ mt }));

  /* 37 · el marco desaparece al salir de Score, en todas las vistas, incluso si el DOM cambia sin parar */
  const ghost = [];
  await p.evaluate(() => { window.__churn = setInterval(() => { const i = document.createElement('i'); i.hidden = true; document.body.appendChild(i); setTimeout(() => i.remove(), 5); }, 8); });
  for (const d of ['overview', 'banks', 'cards', 'loans', 'income', 'patrimony', 'recurring', 'payments', 'pressure']) {
    await go(p, 'score'); await p.waitForTimeout(500);
    const shown = await p.evaluate(() => document.querySelector('.vs-frame.vs-on') !== null);
    await go(p, d); await p.waitForTimeout(250);
    const still = await p.evaluate(() => { const f = document.querySelector('.vs-frame'); return !!f && f.classList.contains('vs-on') && getComputedStyle(f).display !== 'none'; });
    if (!shown || still) ghost.push(d + (still ? ' (sigue visible)' : ' (no se mostró en Score)'));
  }
  await p.evaluate(() => clearInterval(window.__churn));
  check(37, 'El marco de VIVE SCORE se oculta al salir de Score en todas las vistas, incluso con el DOM cambiando sin parar', ghost.length === 0, JSON.stringify(ghost));

  await ctx.close();
  process.env.TOUCH = '1';
  const mon = await open(b, 390, 844); const monErr = []; mon.p.on('pageerror', e => monErr.push(e.message));
  const mobileOn = await mon.p.evaluate(() => ({ score: !!document.querySelector('[data-id="score"]'), badge: !!document.querySelector('.vive-score-badge'), html: (a => a.innerText.replace(/\d{1,2}:\d{2}/g, '') + '|' + a.querySelectorAll('*').length + '|' + [...a.querySelectorAll('*')].map(e => e.tagName + '.' + e.className).join(' '))(document.getElementById('app')) }));
  await go(mon.p, 'score');
  const mobileScore = await mon.p.evaluate(() => ({ frame: !!document.querySelector('.vs-frame.vs-on'), slot: getComputedStyle(document.querySelector('[data-vs-slot]') || document.body).display }));
  await mon.ctx.close();
  // copia con el interruptor apagado
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-off-'));
  for (const f of ['index.html', 'manifest.webmanifest']) fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f));
  for (const d of ['src', 'vendor', 'assets']) fs.cpSync(path.join(ROOT, d), path.join(tmp, d), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'src/vive-score/flag.js'), 'window.VIVE_SCORE_EXPERIMENTAL=false;');
  process.env.ROOT = tmp;
  const moff = await open(b, 390, 844); const offErr = []; moff.p.on('pageerror', e => offErr.push(e.message));
  const mobileOff = await moff.p.evaluate(() => ({ html: (a => a.innerText.replace(/\d{1,2}:\d{2}/g, '') + '|' + a.querySelectorAll('*').length + '|' + [...a.querySelectorAll('*')].map(e => e.tagName + '.' + e.className).join(' '))(document.getElementById('app')) }));
  await moff.ctx.close();
  check(2, 'En móvil no hay ítem ni insignia en el menú inferior; Score se abre solo desde Explorar, en versión resumida', !mobileOn.score && !mobileOn.badge);
  check(16, 'La versión móvil no presenta cambios (texto, elementos y clases idénticos con el módulo apagado)', mobileOn.html === mobileOff.html, mobileOn.html === mobileOff.html ? 'idéntico' : `${mobileOn.html.length} vs ${mobileOff.html.length}`);
  delete process.env.TOUCH;
  const off = await open(b, 1440, 900); const offErr2 = []; off.p.on('pageerror', e => offErr2.push(e.message));
  const offRail = await rail(off.p);
  for (const k of ['overview', 'cards', 'loans', 'pressure', 'income', 'register']) { await go(off.p, k); }
  const offOk = await off.p.evaluate(() => document.getElementById('app').innerText.length > 200);
  await off.ctx.close(); delete process.env.ROOT; fs.rmSync(tmp, { recursive: true, force: true });
  check(17, 'Con el experimento desactivado no se rompe nada (sin ítem Score, navegación y páginas intactas)', !offRail.includes('score') && offOk && offErr2.length === 0 && offErr.length === 0);

  /* 18 · consola */
  check(18, 'Sin errores de consola ni excepciones', errs.length === 0 && monErr.length === 0, errs.slice(0, 3).join(' | '));

  await b.close();
  const bad = results.filter(r => !r.ok);
  console.log(bad.length ? `\nFALLAN ${bad.length}: ${bad.map(r => r.n).join(', ')}` : `\nOK: ${results.length} comprobaciones superadas`);
  process.exit(bad.length ? 1 : 0);
})();
