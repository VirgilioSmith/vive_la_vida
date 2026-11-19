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
const cc = async (p, section) => { await fclick(p, '[data-tab="control"]'); await frameOf(p).evaluate(k => { const d = document.querySelector('details[data-cc="' + k + '"]'); if (!d) throw new Error('sin sección ' + k); d.open = true; }, section); await p.waitForTimeout(80); };
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
  check('p', 'La página VIVE SCORE CRÉDITO abre en un marco aislado', !!fr && /Vive score crédito/i.test(await p.evaluate(() => document.getElementById('app').innerText)));

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

  /* Vista única: Mi score, Evolución, Tus créditos y Tu capacidad; sin pestañas ni vistas auxiliares */
  await go(p, 'score'); await p.waitForTimeout(800);
  const one = await frameOf(p).evaluate(() => ({ tabsHidden: document.getElementById('tabs').hidden, text: document.getElementById('view').innerText, cards: document.querySelectorAll('#view .card').length }));
  check('vista', 'Una sola vista con score, evolución, créditos y capacidad (sin pestañas, TransUnion, Centro de control ni metodología)', one.tabsHidden && /MI SCORE/i.test(one.text) && /EVOLUCIÓN/i.test(one.text) && /Tus créditos/.test(one.text) && /Tu capacidad/.test(one.text) && !/TransUnion|Centro de control|Metodolog/i.test(one.text), `${one.cards} tarjetas`);
  check('score', 'El score se calcula y el indicador lo muestra', Number.isFinite(score0) && /\d/.test(one.text));


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
  check(2, 'En móvil no hay ítem ni insignia en el menú inferior; Score se abre solo desde Explorar', !mobileOn.score && !mobileOn.badge);
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
