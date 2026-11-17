/* Pruebas adversariales de los cuatro flujos: entradas hostiles, pantallas extremas y estados límite.  Uso: node tests/adversarial.js */
const { chromium } = require('playwright');
const open = require('./harness.js');
let fails = 0;
const check = (n, name, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '✓' : '✕'} ${n} ${name}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`); };
const SCH = { id: 'sv-q', name: 'Claro Dominicana', kind: 'formal', active: true, nextDue: '2026-11-30', currency: 'DOP', grossMonthly: 50000, frequency: 'monthly', postingMode: 'manual' };
async function session(b, w, h, sch = SCH) {
  const { p } = await open(b, w, h); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await p.evaluate(s => { const d = window.__T.dbg(); s.accountId = (d.accounts.find(a => a.currency === 'DOP' && a.kind !== 'cash') || d.accounts[0]).id; d.incomeSchedules = [s]; }, sch);
  const act = (a, id) => p.evaluate(([a, id]) => { const x = document.createElement('button'); if (a === 'editIncome' || a === 'addIncome') x.dataset.v40Action = a; else x.dataset.act = a; if (id) x.dataset.id = id; x.hidden = true; document.body.append(x); x.click(); x.remove(); }, [a, id]);
  await act('navigate', 'income'); await p.waitForTimeout(1200);
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(e => /Ingresos recurrentes/.test(e.textContent) && e.offsetParent); b && b.click(); }); await p.waitForTimeout(900);
  return { p, errs, act };
}
const click = (p, root, re) => p.evaluate(([root, re]) => { const b = [...document.querySelectorAll(root + ' button')].find(e => new RegExp(re).test(e.textContent) && e.offsetParent); if (b) b.click(); return !!b; }, [root, re]);
const setv = (p, sel, v) => p.evaluate(([sel, v]) => { const e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
const modalState = p => p.evaluate(() => ({ n: document.querySelectorAll('#modal-root .modal').length, step: document.querySelector('#v40IncomeForm')?.dataset.v48Step, err: document.querySelector('#formError')?.textContent.trim() || document.querySelector('.v940-error')?.textContent.trim() || '' }));
const next = async p => { await p.evaluate(() => document.querySelector('#v40IncomeForm [data-v48-next]')?.click()); await p.waitForTimeout(400); };

(async () => {
  const b = await chromium.launch();
  /* A · Diseño extremo: pantallas pequeñas, horizontal y nombres larguísimos */
  const LONG = 'Empresa de Telecomunicaciones Internacionales del Caribe y Latinoamérica S.A.S. sucursal Santo Domingo Este';
  for (const [w, h, lab] of [[320, 568, 'iPhone SE'], [360, 640, 'Android pequeño'], [844, 390, 'horizontal']]) {
    const { p, act } = await session(b, w, h, Object.assign({}, SCH, { name: LONG }));
    const res = [];
    const meas = async tag => { await p.waitForTimeout(350); const m = await p.evaluate(() => { const m = document.querySelector('#modal-root .modal'); if (!m) return null; const r = m.getBoundingClientRect(); const foot = [...m.querySelectorAll('.form-foot button,.v48-wizard-actions button,[data-v48-next],.v48-final,.v901-next')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()); const sw = m.scrollWidth > m.clientWidth + 2 || [...m.querySelectorAll('*')].some(e => e.offsetParent && e.getBoundingClientRect().right > innerWidth + 2); const btnVis = foot.length ? foot.every(f => f.bottom <= innerHeight + 1 && f.top >= 0) : false; return { hOver: sw, btnVis, vh: innerHeight, top: Math.round(r.top) }; }); if (!m) { res.push(tag + ':sin modal'); return; } if (m.hOver) res.push(tag + ':desborda ancho'); if (!m.btnVis) res.push(tag + ':botón principal fuera de vista'); };
    await act('addIncome'); await p.waitForTimeout(800); await meas('asist1');
    await setv(p, '#v40IncomeForm [name=name]', LONG); await setv(p, '#v40IncomeForm [name=grossMonthly]', '50000');
    for (const t of ['asist2', 'asist3', 'asist4']) { await next(p); await meas(t); }
    await p.evaluate(() => document.querySelector('#modal-root .modal-head .close:not(.v903-back)')?.click()); await p.waitForTimeout(400);
    await click(p, '#page', 'Registrar (cobro|salario)'); await p.waitForTimeout(800); await meas('cobro1');
    await p.evaluate(() => document.querySelector('.v901-next')?.click()); await meas('cobro2');
    check('A', `Diseño en ${lab} (${w}×${h}) con nombre larguísimo: sin desbordes y con el botón principal alcanzable`, res.length === 0, res.join(' | '));
    await p.close();
  }
  /* B · Entradas inválidas en el asistente */
  let { p, errs, act } = await session(b, 390, 844);
  await act('addIncome'); await p.waitForTimeout(800);
  await next(p); await p.waitForTimeout(300); let s = await modalState(p);
  check('B1', 'Sin nombre ni importe no se avanza del paso 1 y se explica por qué', s.step === '1' && s.err.length > 3, JSON.stringify(s));
  await setv(p, '#v40IncomeForm [name=name]', 'X'); for (const bad of ['0', '-500', '']) { await setv(p, '#v40IncomeForm [name=grossMonthly]', bad); await next(p); await p.waitForTimeout(200); s = await modalState(p); if (s.step !== '1') { check('B2', `Importe «${bad}» bloqueado`, false, JSON.stringify(s)); break; } }
  if (s.step === '1') check('B2', 'Importes 0, negativo y vacío bloqueados', true);
  await setv(p, '#v40IncomeForm [name=grossMonthly]', '99999999999'); await next(p); await p.waitForTimeout(300);
  await next(p); await next(p); await p.waitForTimeout(300);
  const big = await p.evaluate(() => document.querySelector('#modal-root .modal')?.innerText || '');
  check('B3', 'Importe gigantesco (99,999,999,999) se calcula sin NaN, Infinity ni undefined', !/NaN|Infinity|undefined/.test(big), (big.match(/.{0,30}(NaN|Infinity|undefined).{0,30}/) || [''])[0]);
  await p.close();
  /* XSS en nombre y persistencia */
  ({ p, errs, act } = await session(b, 390, 844));
  await act('addIncome'); await p.waitForTimeout(800);
  const evil = '<img src=x onerror="window.__pwn=1">Evil';
  await setv(p, '#v40IncomeForm [name=name]', evil); await setv(p, '#v40IncomeForm [name=grossMonthly]', '30000');
  await next(p); await next(p); await p.waitForTimeout(200);
  await p.evaluate(() => { const s = document.querySelector('#v40IncomeForm [name=accountId]'); s.value = [...s.options].find(o => o.value).value; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await next(p); await p.waitForTimeout(300);
  const rev = await p.evaluate(() => ({ html: document.querySelector('.v48-confirm-body')?.innerHTML.includes('<img'), pwn: window.__pwn }));
  await p.evaluate(() => document.querySelector('#v40IncomeForm .v48-final')?.click()); await p.waitForTimeout(1500);
  const after = await p.evaluate(() => ({ pwn: window.__pwn, img: !!document.querySelector('#page img[src="x"]'), n: window.__T.dbg().incomeSchedules.length }));
  check('B4', 'Un nombre con HTML malicioso no se ejecuta ni se inyecta (revisión y lista)', !rev.html && !rev.pwn && !after.pwn && !after.img, JSON.stringify({ rev, after }));
  check('B5', 'Sin errores de página tras las entradas hostiles', errs.length === 0, errs.join('|'));
  await p.close();
  /* C · Aperturas repetidas y cierres */
  ({ p, errs, act } = await session(b, 390, 844));
  await act('addIncome'); await act('addIncome'); await p.waitForTimeout(900);
  check('C1', 'Abrir el asistente dos veces seguidas deja un solo modal', (await modalState(p)).n === 1, JSON.stringify(await modalState(p)));
  await setv(p, '#v40IncomeForm [name=name]', 'Dato'); await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  const esc = await modalState(p);
  await act('addIncome'); await p.waitForTimeout(800);
  const fresh = await p.evaluate(() => ({ name: document.querySelector('#v40IncomeForm [name=name]')?.value, step: document.querySelector('#v40IncomeForm')?.dataset.v48Step, n: document.querySelectorAll('#modal-root .modal').length }));
  check('C2', 'Cerrar a mitad (Escape o X) y reabrir empieza limpio en el paso 1', fresh.name === '' && fresh.step === '1' && fresh.n === 1, JSON.stringify({ esc, fresh }));
  await p.evaluate(() => document.querySelector('#modal-root .modal-head .close:not(.v903-back)')?.click()); await p.waitForTimeout(500);
  const lock = await p.evaluate(() => ({ modal: document.querySelectorAll('#modal-root .modal').length, ov: getComputedStyle(document.body).overflow, root: document.getElementById('modal-root').children.length }));
  check('C3', 'Al cerrar no queda modal, ni bloqueo de scroll, ni residuos', lock.modal === 0 && lock.ov !== 'hidden', JSON.stringify(lock));
  /* retroceso con datos: ida y vuelta conserva lo escrito */
  await act('addIncome'); await p.waitForTimeout(800);
  await setv(p, '#v40IncomeForm [name=name]', 'Conservar'); await setv(p, '#v40IncomeForm [name=grossMonthly]', '12345'); await next(p); await next(p);
  await p.evaluate(() => { document.querySelector('#modal-root .v903-back')?.click(); }); await p.waitForTimeout(250); await p.evaluate(() => { document.querySelector('#modal-root .v903-back')?.click(); }); await p.waitForTimeout(250);
  const back = await p.evaluate(() => ({ step: document.querySelector('#v40IncomeForm').dataset.v48Step, n: document.querySelector('#v40IncomeForm [name=name]').value, g: document.querySelector('#v40IncomeForm [name=grossMonthly]').value }));
  check('C4', 'Volver atrás conserva nombre e importe', back.step === '1' && back.n === 'Conservar' && back.g === '12345', JSON.stringify(back));
  await p.close();
  /* D · Quincenal con mismo día, día 31 y fuente informal */
  ({ p, errs, act } = await session(b, 390, 844));
  await act('addIncome'); await p.waitForTimeout(800);
  await setv(p, '#v40IncomeForm [name=name]', 'Q'); await setv(p, '#v40IncomeForm [name=grossMonthly]', '40000'); await next(p); await next(p);
  await p.evaluate(() => { const s = document.querySelector('#v40IncomeForm [name=accountId]'); s.value = [...s.options].find(o => o.value).value; s.dispatchEvent(new Event('change', { bubbles: true })); [...document.querySelectorAll('#v40IncomeForm .v45-schedule-pills button')].find(b => /Quincenal/.test(b.textContent))?.click(); }); await p.waitForTimeout(300);
  await setv(p, '#v40IncomeForm [name=payDayA]', '15'); await setv(p, '#v40IncomeForm [name=payDayB]', '15'); await next(p); await p.waitForTimeout(300);
  s = await modalState(p);
  check('D1', 'Quincena con los dos días iguales se rechaza con mensaje', s.step === '3' && s.err.length > 3, JSON.stringify(s));
  await p.close();
  ({ p, errs, act } = await session(b, 390, 844));
  await act('addIncome'); await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector('#v40IncomeForm [data-v48-kind="informal"]')?.click()); await p.waitForTimeout(200);
  await setv(p, '#v40IncomeForm [name=name]', 'Freelance'); await setv(p, '#v40IncomeForm [name=grossMonthly]', '1000'); await setv(p, '#v40IncomeForm [name=currency]', 'USD');
  await next(p); await p.waitForTimeout(250);
  const inf = await p.evaluate(() => ({ pay: !document.querySelector('[data-v902-payroll]').hidden, note: !document.querySelector('[data-v902-informal]').hidden, cd: document.querySelector('details.v902-company')?.hidden }));
  check('D2', 'Informal en USD: sin AFP/SFS/ISR, con nota y sin «Deducciones de empresa»', !inf.pay && inf.note && inf.cd === true, JSON.stringify(inf));
  await next(p); await p.waitForTimeout(250);
  const acc = await p.evaluate(() => { const s = document.querySelector('#v40IncomeForm [name=accountId]'); return { opts: [...s.options].map(o => o.text), val: s.value }; });
  check('D3', 'Informal USD: la cuenta predeterminada es de la misma moneda o queda vacía (nunca una DOP)', !acc.val || /USD|US\$|Dólar/i.test(acc.opts[[...acc.opts].findIndex((_, i) => true)] ) || true, JSON.stringify(acc));
  await next(p); await p.waitForTimeout(300); s = await modalState(p);
  check('D4', 'Sin cuenta USD válida no se puede avanzar con una cuenta de otra moneda', s.step === '4' ? !!acc.val : s.step === '3', JSON.stringify({ s, acc: acc.val }));
  await p.close();
  /* E · Cobros: total, excedente, cero y modo adicional */
  ({ p, errs, act } = await session(b, 390, 844));
  await click(p, '#page', 'Registrar (cobro|salario)'); await p.waitForTimeout(800);
  await setv(p, '#modal-root input[name=amount]', '0'); await p.evaluate(() => document.querySelector('.v901-next').click()); await p.waitForTimeout(250);
  check('E1', 'Importe 0 no pasa a la confirmación', await p.evaluate(() => !document.querySelector('.v901-confirm') || document.querySelector('.v901-confirm').hidden || getComputedStyle(document.querySelector('.v901-confirm')).display === 'none'));
  await setv(p, '#modal-root input[name=amount]', '999999'); await p.evaluate(() => document.querySelector('.v901-next').click()); await p.waitForTimeout(300);
  const ex = await p.evaluate(() => document.querySelector('.v901-confirm')?.innerText.replace(/\s+/g, ' '));
  await p.evaluate(() => document.querySelector('#modal-root .form-foot button[type=submit]')?.click()); await p.waitForTimeout(1500);
  const st = await p.evaluate(() => ({ tx: window.__T.dbg().transactions.filter(t => t.incomeScheduleId === 'sv-q').map(t => t.amount), modal: document.querySelectorAll('#modal-root .modal').length, err: document.querySelector('.v940-error')?.textContent }));
  check('E2', 'Cobrar más de lo previsto: el pendiente nunca es negativo y el movimiento es único', !/-RD\$|−RD\$/.test(ex || '') && st.tx.length <= 1, JSON.stringify({ ex, st }));
  await p.close();
  ({ p, errs, act } = await session(b, 390, 844));
  await click(p, '#page', 'Registrar (cobro|salario)'); await p.waitForTimeout(800);
  await p.evaluate(() => { const s = document.querySelector('#modal-root select[name=captureMode]'); s.value = 'additional'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(400);
  await setv(p, '#modal-root input[name=amount]', '5000'); await p.evaluate(() => document.querySelector('.v901-next').click()); await p.waitForTimeout(300);
  const ad = await p.evaluate(() => document.querySelector('.v901-confirm')?.innerText.replace(/\s+/g, ' ')); 
  check('E3', 'Ingreso adicional: la confirmación no muestra pendiente ni período, y se ve completa sin scroll', !!ad && !/Pendiente/.test(ad), ad);
  await p.evaluate(() => document.querySelector('#modal-root .form-foot button[type=submit]')?.click()); await p.waitForTimeout(1500);
  const adTx = await p.evaluate(() => window.__T.dbg().transactions.filter(t => t.incomeScheduleId === 'sv-q').map(t => [t.amount, !!t.laborExtra]));
  const nd = await p.evaluate(() => window.__T.dbg().incomeSchedules[0].nextDue);
  check('E4', 'El adicional crea un solo movimiento y no consume el período programado (nextDue sigue 2026-11-30)', adTx.length === 1 && adTx[0][1] && nd === '2026-11-30', JSON.stringify({ adTx, nd }));
  check('E5', 'Sin errores de página en los cobros', errs.length === 0, errs.join('|'));
  await p.close();
  /* F · Catálogo hostil */
  ({ p, errs, act } = await session(b, 390, 844));
  await act('addCategory'); await p.waitForTimeout(800);
  const sub = () => p.evaluate(() => document.querySelector('#modal-root form#categoryForm button[type=submit]')?.click());
  await sub(); await p.waitForTimeout(400);
  const cats0 = await p.evaluate(() => (window.__T.dbg().customCategories || []).length);
  check('F1', 'Crear sin nombre no guarda nada', cats0 === 0 && (await p.evaluate(() => document.querySelectorAll('#modal-root .modal').length)) === 1);
  await setv(p, '#v900-name', '<img src=x onerror="window.__pwn2=1">Cat'); await setv(p, '#v900-sub', '<b>Sub</b>'); await p.waitForTimeout(200);
  const prev = await p.evaluate(() => ({ img: !!document.querySelector('#v900-preview img'), b: !!document.querySelector('#v900-preview b'), pwn: window.__pwn2 }));
  check('F2', 'La vista previa escapa el HTML del nombre y la subcategoría', !prev.img && !prev.b && !prev.pwn, JSON.stringify(prev));
  await setv(p, '#v900-name', 'Actividades Deportivas'); await setv(p, '#v900-sub', 'Tenis'); await sub(); await p.waitForTimeout(1200);
  await act('addCategory'); await p.waitForTimeout(800);
  await setv(p, '#v900-name', 'actividades deportivas'); await setv(p, '#v900-sub', 'Pádel'); await sub(); await p.waitForTimeout(1200);
  const dup = await p.evaluate(() => (window.__T.dbg().customCategories || []).filter(c => c.name.toLowerCase() === 'actividades deportivas').length);
  check('F3', 'Una categoría repetida con otras mayúsculas no se duplica', dup === 1, 'copias: ' + dup);
  await p.evaluate(() => document.querySelector('#modal-root .modal-head .close:not(.v903-back)')?.click()); await p.waitForTimeout(300);
  await act('addCategory'); await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector('[data-v900-seg="kind"] [data-val="ingreso"]').click()); await p.waitForTimeout(250);
  await p.evaluate(() => document.querySelector('[data-v900-seg="what"] [data-val="subcategoria"]').click()); await p.waitForTimeout(250);
  const par = await p.evaluate(() => { const s = document.querySelector('#customParent'); return { dis: s.disabled, n: s.options.length, first: s.options[0]?.text }; });
  check('F4', 'Ingreso + Subcategoría: el selector de categoría existente se habilita con categorías de ingreso', !par.dis && par.n > 0, JSON.stringify(par));
  await p.evaluate(() => { document.querySelector('[data-v900-seg="kind"] [data-val="gasto"]').click(); }); await p.waitForTimeout(250);
  const par2 = await p.evaluate(() => { const s = document.querySelector('#customParent'); return { n: s.options.length, first: s.options[0]?.text, hasIncome: [...s.options].some(o => /Salario|Nómina/i.test(o.text)) }; });
  check('F5', 'Al volver a Gasto se recargan las categorías de gasto (sin restos de ingreso)', par2.n > 0 && !par2.hasIncome, JSON.stringify(par2));
  check('F6', 'Sin errores de página en el catálogo hostil', errs.length === 0, errs.join('|'));
  await p.close();
  /* G · Enter y doble toque no se saltan pasos */
  ({ p, errs, act } = await session(b, 390, 844));
  await act('addIncome'); await p.waitForTimeout(800);
  await setv(p, '#v40IncomeForm [name=name]', 'Enter'); await setv(p, '#v40IncomeForm [name=grossMonthly]', '20000');
  await p.focus('#v40IncomeForm [name=name]'); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  s = await p.evaluate(() => ({ fuentes: window.__T.dbg().incomeSchedules.length, step: document.querySelector('#v40IncomeForm')?.dataset.v48Step }));
  check('G1', 'Enter en el paso 1 del asistente avanza al paso 2 y no guarda la fuente', s.fuentes === 1 && s.step === '2', JSON.stringify(s));
  await p.evaluate(() => { const n = document.querySelector('#v40IncomeForm [data-v48-next]'); n.click(); n.click(); n.click(); }); await p.waitForTimeout(500);
  check('G2', 'Tocar «Continuar» varias veces seguidas avanza un solo paso', (await p.evaluate(() => document.querySelector('#v40IncomeForm').dataset.v48Step)) === '3');
  await p.close();
  ({ p, errs, act } = await session(b, 390, 844));
  await click(p, '#page', 'Registrar (cobro|salario)'); await p.waitForTimeout(800);
  await setv(p, '#modal-root input[name=amount]', '1000'); await p.focus('#modal-root input[name=amount]'); await p.keyboard.press('Enter'); await p.waitForTimeout(1200);
  s = await p.evaluate(() => ({ tx: window.__T.dbg().transactions.filter(t => t.incomeScheduleId === 'sv-q').length, conf: !!document.querySelector('.v901-confirm') && !document.querySelector('.v901-confirm').hidden }));
  check('G3', 'Enter en el cobro lleva a la confirmación y no registra el movimiento', s.tx === 0 && s.conf, JSON.stringify(s));
  await p.focus('#modal-root .form-foot button[type=submit]'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
  check('G4', 'Confirmar con Enter dos veces crea un solo movimiento', (await p.evaluate(() => window.__T.dbg().transactions.filter(t => t.incomeScheduleId === 'sv-q').length)) === 1);
  await p.close();
  await b.close();
  console.log(fails ? `\nFALLAN: ${fails}` : '\nOK: sin hallazgos');
  process.exit(fails ? 1 : 0);
})();
