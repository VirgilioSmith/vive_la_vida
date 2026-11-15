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
  const ids = await rail(p), i = ids.indexOf('pressure');
  check(1, 'Score está exactamente debajo de Presión financiera', i >= 0 && ids[i + 1] === 'score', ids.join(' › '));
  /* 3 · indicador pequeño sin puntaje */
  check(3, 'El indicador muestra «—» si no hay puntaje', (await p.evaluate(() => document.querySelector('.rail-action[data-id="score"] .vive-score-badge')?.textContent)) === '—');
  await reopenScore(p);
  const fr = frameOf(p);
  check('p', 'La página VIVE SCORE CRÉDITO abre en un marco aislado', !!fr && /VIVE SCORE CRÉDITO/.test(await p.evaluate(() => document.getElementById('app').innerText)));

  /* 4 · cuestionario, 5 · mes y año, 6 · sin buró */
  const steps = []; for (let k = 0; k < 8; k++) { steps.push(await ftext(p)); if (k < 7) await fclickIf(p, '[data-q-act="next"]'); }
  const dateInputs = await frameOf(p).evaluate(() => document.querySelectorAll('input[type="date"],input[type="time"],input[type="datetime-local"]').length);
  check(4, 'El cuestionario recorre sus 7 pasos y el resumen', steps.length === 8 && /Resumen/.test(steps[7]) && /Comenzar|Guardar/.test(await frameOf(p).evaluate(() => document.querySelector('.qnav .btn')?.textContent || '')));
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
  check(19, 'Los aumentos de límite de Popular (ago-2026) y Cibao (sep-2026) quedan cargados solos y ese paso se omite', seedInfo.answer === 'yes' && seedInfo.auto && seedInfo.n === 4 && seedInfo.periods === '2026-08,2026-09' && /Cibao/.test(seedInfo.cards) && /Popular/.test(seedInfo.cards) && /DOP:200000>400000/.test(seedInfo.amounts) && /USD:3000>6000/.test(seedInfo.amounts) && /DOP:144000>400000/.test(seedInfo.amounts) && /USD:2000>6000/.test(seedInfo.amounts) && seedInfo.kinds === 'automatic' && seedInfo.req === 0 && seedInfo.autoCount === 4 && !limitStepShown && /PASO \d DE 7/.test(steps[0]), JSON.stringify(seedInfo));

  /* 8 · datos crediticios recuperados */
  const payload = await p.evaluate(() => window.ViveScoreAdapter.read());
  const dbCounts = await p.evaluate(() => { const d = window.__T.dbg(); return { cards: d.cards.filter(c => !c.archived).length, loans: d.loans.filter(l => !l.archived).length }; });
  check(8, 'Tarjetas y préstamos se recuperan de los datos reales', payload.cards.length >= dbCounts.cards && payload.loans.length === dbCounts.loans && payload.cards.every(c => c.limit > 0 || c.balance > 0), `${payload.cards.length} líneas de tarjeta · ${payload.loans.length} préstamos`);
  /* 7 · sin cuentas de ahorro ni saldos */
  const adapterSrc = fs.readFileSync(path.join(ROOT, 'src/vive-score/adapter.js'), 'utf8');
  const before7 = await frameOf(p).evaluate(() => evaluate(current()).score);
  await p.evaluate(() => { const d = window.__T.dbg(); d.transactions.push({ id: 'sv-test-1', date: '2026-11-10', type: 'income', amount: 9000000, currency: 'DOP', accountId: d.accounts[0].id, category: 'Otros ingresos', note: 'prueba saldo' }); });
  await go(p, 'score'); await fclick(p, '[data-refresh-data]').catch(() => {}); await fclick(p, '[data-tab="data"]'); await fclick(p, '[data-refresh-data]'); await p.waitForTimeout(500);
  const after7 = await frameOf(p).evaluate(() => evaluate(current()).score);
  check(7, 'El score no usa cuentas de ahorro ni saldos bancarios', !/db\.accounts|\.accounts\b|certificates|savings/.test(adapterSrc) && !('accounts' in payload) && before7 === after7, `score ${before7} → ${after7} tras un depósito de RD$9,000,000`);

  /* 9 · declarado vs verificado */
  await fclick(p, '[data-tab="data"]');
  const prov = await ftext(p);
  const ageBefore = await frameOf(p).evaluate(() => current().ageSource);
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
  await fclick(p, '[data-refresh-data]'); await p.waitForTimeout(500);
  const inc = await frameOf(p).evaluate(() => { const e = evaluate(current()); return { score: e.score, income: e.capacity.income, newQuota: e.capacity.newQuota }; });
  check(12, 'Los ingresos no alteran directamente el score; solo la capacidad de endeudamiento', inc.score === after7 && inc.income > capBefore, `score ${after7} → ${inc.score}; ingreso reconocido ${Math.round(capBefore)} → ${Math.round(inc.income)}`);

  /* 13 · simulaciones sin tocar datos reales */
  const snapDb = await p.evaluate(() => JSON.stringify(window.__T.dbg()));
  const snapSt = await frameOf(p).evaluate(() => JSON.stringify(ST));
  await fclick(p, '[data-tab="simulator"]');
  await fchange(p, '#simPayment', '40000'); await fchange(p, '#simLoan', '250000'); await fchange(p, '#simLimit', '50000');
  const simOut = await ftext(p);
  const snapDb2 = await p.evaluate(() => JSON.stringify(window.__T.dbg()));
  const snapSt2 = await frameOf(p).evaluate(() => JSON.stringify(ST));
  check(13, 'Las simulaciones no modifican datos reales', snapDb === snapDb2 && snapSt === snapSt2 && /Simulado/.test(simOut), 'base y almacenamiento idénticos');

  /* 14 · texto explicativo coincide con el cálculo */
  await fclick(p, '[data-tab="summary"]');
  const sum = await frameOf(p).evaluate(() => { const c = evaluate(current()); return { text: document.getElementById('view').innerText, score: c.score, util: pct(c.util) }; });
  check(14, 'El texto «Tu score, explicado» coincide con los cálculos', sum.text.includes(String(sum.score)) && sum.text.includes(sum.util) && /en construcción/.test(sum.text), `${sum.score} · utilización ${sum.util}`);

  /* 15 · las modificaciones se conservan tras recargar */
  await frameOf(p).evaluate(() => { qEditing = false; setOverride(ST.overrides ? Object.keys(ST.overrides)[0] || current().cards[0].productId : current().cards[0].productId, { opened: '2019-08' }); });
  await p.waitForTimeout(500);
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('vive-score:v1') || 'null'));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2500); await p.evaluate(() => window.__T.boot()); await p.waitForTimeout(1200);
  await seedDates(p); await reopenScore(p);
  const reload = await frameOf(p).evaluate(() => ({ gate: !!document.querySelector('.qcard'), cal: ST.answers?.completed, version: ST.declVersion, seeds: ST.answers.limit.events.length, ov: Object.values(ST.overrides).some(o => o.opened === '2019-08') }));
  check(15, 'Las respuestas y modificaciones se conservan al recargar', !!stored && reload.cal === true && reload.gate === false && reload.ov && reload.seeds === 4, JSON.stringify(reload));

  /* 20 · entidades no financieras: no puntúan (no se reportan a burós), pero sí cuentan para la capacidad */
  await fclick(p, '[data-tab="data"]');
  const nb0 = await frameOf(p).evaluate(() => { const c = evaluate(current()); return { loans: current().loans.length, debt: Math.round(c.capacity.debt), due: Math.round(c.capacity.loanDues) }; });
  await p.evaluate(() => { const d = window.__T.dbg(); const l = d.loans[0]; const bk = d.banks.find(b => b.id === l.bankId); bk.kind = 'Telefonía'; });
  await fclick(p, '[data-refresh-data]'); await p.waitForTimeout(500);
  await fclick(p, '[data-tab="detail"]');
  const nb1 = await frameOf(p).evaluate(() => { const c = evaluate(current()), s = current(); return { loans: s.loans.length, excluded: s.excluded.loans.length, debt: Math.round(c.capacity.debt), due: Math.round(c.capacity.loanDues), text: document.getElementById('view').innerText, cashAdv: c.parts.owed.find(x => x.id === 'o_installments').points }; });
  check(20, 'Las entidades no financieras no puntúan en el score pero sí cuentan en la capacidad', nb0.loans === 1 && nb1.loans === 0 && nb1.excluded === 1 && nb1.debt === nb0.debt && nb1.due === nb0.due && /Fuera del score/.test(nb1.text) && nb1.cashAdv === 26, JSON.stringify({ antes: nb0, despues: { loans: nb1.loans, excluded: nb1.excluded, debt: nb1.debt, due: nb1.due, amort: nb1.cashAdv } }));

  /* 2 · solo web / 16 · móvil sin cambios / 17 · desactivación */
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
  check(2, 'Score solo existe en la versión web (no hay ítem ni página en móvil)', !mobileOn.score && !mobileOn.badge && !mobileScore.frame);
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
