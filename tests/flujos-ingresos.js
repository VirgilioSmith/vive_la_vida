/* Validación de extremo a extremo de los cuatro flujos: Ingreso recurrente, Registrar cobro, Ampliar catálogo y Registrar salario.
   Móvil (390 px) y escritorio (1440 px), modos Claro y oscuro, acento dinámico, selectores universales, cobros parciales/anticipados,
   formal/informal y ausencia de movimientos duplicados.   Uso:  node tests/flujos-ingresos.js */
const { chromium } = require('playwright');
const open = require('./harness.js');
const results = [];
const check = (n, name, ok, extra = '') => { results.push(!!ok); console.log(`${ok ? '✓' : '✕'} ${String(n).padStart(2)} ${name}${extra ? ' — ' + extra : ''}`); };

const SCH = { id: 'sv-q', name: 'Claro Dominicana', kind: 'formal', active: true, nextDue: '2026-11-30', currency: 'DOP', grossMonthly: 50000, frequency: 'monthly', postingMode: 'manual' };

async function session(b, w, h, dark) {
  process.env.THEME = dark ? 'dark' : 'light';
  const { p } = await open(b, w, h); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await p.evaluate(s => { const d = window.__T.dbg(); s.accountId = (d.accounts.find(a => a.currency === 'DOP' && a.kind !== 'cash') || d.accounts[0]).id; d.incomeSchedules = [s]; }, SCH);
  const nav = id => p.evaluate(id => { const x = document.createElement('button'); x.dataset.act = 'navigate'; x.dataset.id = id; x.hidden = true; document.body.append(x); x.click(); }, id);
  await nav('income'); await p.waitForTimeout(1300);
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(e => /Ingresos recurrentes/.test(e.textContent) && e.offsetParent); b && b.click(); }); await p.waitForTimeout(1000);
  return { p, errs, nav };
}
const clickText = (p, root, re) => p.evaluate(([root, re]) => { const b = [...document.querySelectorAll(root + ' button')].find(e => new RegExp(re).test(e.textContent) && e.offsetParent); if (!b) return false; b.click(); return true; }, [root, re]);
const count = p => p.evaluate(() => window.__T.dbg().transactions.filter(t => t.incomeScheduleId === 'sv-q').length);

(async () => {
  const b = await chromium.launch();
  for (const [label, w, h, dark] of [['móvil claro', 390, 844, false], ['móvil oscuro', 390, 844, true], ['escritorio', 1440, 900, false]]) {
    console.log('\n== ' + label);
    /* ---------- Registrar cobro / salario ---------- */
    let { p, errs } = await session(b, w, h, dark);
    await clickText(p, '#page', 'Registrar (cobro|salario)'); await p.waitForTimeout(900);
    const c1 = await p.evaluate(() => ({ titulo: document.querySelector('#modal-root .modal h2,#modal-root .modal h3')?.textContent.trim(), back: !!document.querySelector('#modal-root .v903-back'), x: !!document.querySelector('#modal-root .close:not(.v903-back)'), universal: !!document.querySelector('#modal-root form .v789-select-open'), modo: document.querySelector('#modal-root [name="captureMode"]')?.value, resumen: document.querySelectorAll('#modal-root .v940-occurrence span').length, live: !!document.querySelector('.v901-live') }));
    check(1, 'Registrar salario: datos del cobro con flecha circular, X, selector universal de cuenta y resumen; el período futuro se registra como anticipado', /Registrar salario/.test(c1.titulo) && c1.back && c1.x && c1.universal && c1.modo === 'advance' && c1.resumen === 4, JSON.stringify(c1));
    // parcial
    await p.evaluate(() => { const e = document.querySelector('#modal-root input[name="amount"]'); e.value = '20000'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.click('.v901-next'); await p.waitForTimeout(400);
    const c2 = await p.evaluate(() => ({ titulo: document.querySelector('#modal-root .modal h2,#modal-root .modal h3')?.textContent.trim(), txt: document.querySelector('.v901-confirm')?.innerText.replace(/\s+/g, ' '), botones: [...document.querySelectorAll('#modal-root .form-foot button')].filter(x => x.offsetParent).map(x => x.textContent.trim()) }));
    check(2, 'Confirmación del cobro parcial: muestra importe, período vinculado y el pendiente real (RD$25,191.00)', /Confirmar salario/.test(c2.titulo) && /RD\$20,000\.00/.test(c2.txt) && /30 nov 2026/.test(c2.txt) && /Pendiente RD\$25,191\.00/.test(c2.txt) && c2.botones.join('|') === 'Volver|Confirmar registro' && /Banco Modelo/.test(c2.txt) && /Fecha del cobro/.test(c2.txt) && /Anticipado/.test(c2.txt) && /Importe recibido/.test(c2.txt), JSON.stringify(c2));
    const antes = await count(p);
    await p.evaluate(() => { const s = document.querySelector('#modal-root .form-foot button[type="submit"]'); s.click(); s.click(); s.click(); }); await p.waitForTimeout(1800);
    const despues = await count(p);
    const mv = await p.evaluate(() => window.__T.dbg().transactions.filter(t => t.incomeScheduleId === 'sv-q').map(t => ({ a: t.amount, d: t.date })));
    check(3, 'Confirmar tres veces seguidas crea un solo movimiento vinculado a la programación (sin duplicados)', despues === antes + 1 && mv.length === 1 && mv[0].a === 20000, JSON.stringify(mv));
    // completar el pendiente
    await clickText(p, '#page', 'Completar (cobro|salario)|Registrar (cobro|salario)|Confirmar (cobro|salario)'); await p.waitForTimeout(900);
    const rest = await p.evaluate(() => document.querySelector('#modal-root input[name="amount"]')?.value);
    check(4, 'Tras el cobro parcial, el siguiente registro propone exactamente el pendiente (25191.00)', Number(rest) === 25191, String(rest));
    await p.evaluate(() => { document.querySelector('#modal-root .v903-back')?.click(); }); await p.waitForTimeout(500);
    check(5, 'La flecha de retroceso del primer paso cierra el flujo sin registrar nada', await p.evaluate(() => !document.querySelector('#v940IncomeCaptureForm')) && await count(p) === 1);
    // Cambiar frecuencia y día de cobro no altera los cobros ya registrados (ni crea otros).
    const firmaCobros = () => p.evaluate(() => JSON.stringify(window.__T.dbg().transactions.filter(t => t.incomeScheduleId === 'sv-q').map(t => [t.id, t.amount, t.date, t.accountId])));
    const cobrosAntes = await firmaCobros(), fuenteAntes = await p.evaluate(() => window.__T.dbg().incomeSchedules.length);
    await p.evaluate(() => { const x = document.createElement('button'); x.dataset.v40Action = 'editIncome'; x.dataset.id = 'sv-q'; x.hidden = true; document.body.append(x); x.click(); }); await p.waitForTimeout(900);
    await p.evaluate(() => { [...document.querySelectorAll('#v40IncomeForm .v45-schedule-pills button')].find(b => /Trimestral/.test(b.textContent))?.click(); }); await p.waitForTimeout(300);
    for (let i = 0; i < 3; i++) { await p.click('#v40IncomeForm [data-v48-next]'); await p.waitForTimeout(350); }
    await p.click('#v40IncomeForm .v48-final'); await p.waitForTimeout(1500);
    const frec = await p.evaluate(() => window.__T.dbg().incomeSchedules.find(x => x.id === 'sv-q')?.frequency);
    check('5b', 'Cambiar la frecuencia no altera cobros registrados ni duplica la fuente', frec === 'quarterly' && await firmaCobros() === cobrosAntes && await p.evaluate(() => window.__T.dbg().incomeSchedules.length) === fuenteAntes, frec + ' ' + (await firmaCobros()).slice(0, 80));
    check(6, 'Sin errores de página en el cobro', errs.length === 0, JSON.stringify(errs.slice(0, 2)));
    await p.close();

    /* ---------- Ingreso recurrente ---------- */
    ({ p, errs } = await session(b, w, h, dark));
    await clickText(p, '#page', 'Agregar fuente'); await p.waitForTimeout(1000);
    const w1 = await p.evaluate(() => ({ titulo: document.querySelector('#modal-root .modal h2,#modal-root .modal h3')?.textContent.trim(), back: !!document.querySelector('#modal-root .v903-back'), segm: [...document.querySelectorAll('#v40IncomeForm [data-v48-kind]')].map(x => x.textContent.trim().split('\n')[0]).join('|'), inst: !!document.querySelector('#v40IncomeForm .v1110-pickbtn'), barras: document.querySelectorAll('#v40IncomeForm .v48-step-track span').length }));
    check(7, 'Ingreso recurrente: título, flecha circular, selector Trabajo formal/informal, selector universal de instituciones y 4 pasos', /Ingreso recurrente/.test(w1.titulo) && w1.back && /Trabajo formal/.test(w1.segm) && w1.inst && w1.barras === 4, JSON.stringify(w1));
    await p.fill('#v40IncomeForm [name="name"]', 'Salario mensual'); await p.fill('#v40IncomeForm [name="grossMonthly"]', '50000');
    await p.click('#v40IncomeForm [data-v48-next]'); await p.waitForTimeout(400);
    const w2 = await p.evaluate(() => ({ chip: document.querySelector('[data-v902-chip]')?.textContent, nomina: !document.querySelector('[data-v902-payroll]').hidden, informal: !document.querySelector('[data-v902-informal]').hidden, lineas: [...document.querySelectorAll('[data-v902-lines] > div')].map(x => x.innerText.replace(/\s+/g, ' ')), live: !!document.querySelector('.v902-live') }));
    check(8, 'Trabajo formal: el paso Descuentos muestra AFP, SFS e ISR con importes estimados', w2.chip === 'Trabajo formal' && w2.nomina && !w2.informal && w2.lineas.length === 3 && w2.lineas.every(l => /RD\$|Estimado/.test(l)), JSON.stringify(w2.lineas));
    await p.click('#v40IncomeForm [data-v48-next]'); await p.waitForTimeout(400);
    const w3 = await p.evaluate(() => ({ cuenta: !!document.querySelector('#v40IncomeForm .v789-select-open'), pills: [...document.querySelectorAll('#v40IncomeForm .v45-schedule-pills button')].map(x => x.textContent.trim()).join('|') }));
    check(9, 'Calendario y cuenta: selector universal de cuentas (logos y moneda) y frecuencias', w3.cuenta && /Mensual/.test(w3.pills), JSON.stringify(w3));
    await p.evaluate(() => { const s = document.querySelector('#v40IncomeForm [name="accountId"]'); s.value = [...s.options].find(o => o.value).value; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await p.evaluate(() => { document.querySelector('#modal-root .v903-back').click(); }); await p.waitForTimeout(300);
    check(10, 'La flecha de retroceso vuelve al paso anterior', await p.evaluate(() => document.querySelector('#v40IncomeForm').dataset.v48Step === '2'));
    await p.click('#v40IncomeForm [data-v48-next]'); await p.waitForTimeout(300); await p.click('#v40IncomeForm [data-v48-next]'); await p.waitForTimeout(500);
    const w4 = await p.evaluate(() => ({ titulo: document.querySelector('.v48-step-title')?.textContent, txt: document.querySelector('.v48-confirm-body')?.innerText.replace(/\s+/g, ' ') }));
    check(11, 'Confirmación: «Revisa tu programación» con bruto, deducciones y neto', /Revisa tu programación/.test(w4.titulo) && /Bruto mensual/.test(w4.txt) && /AFP/.test(w4.txt) && /Neto por cobro/.test(w4.txt), w4.txt.slice(0, 120));
    const sAntes = await p.evaluate(() => window.__T.dbg().incomeSchedules.length), txAntes = await p.evaluate(() => window.__T.dbg().transactions.length);
    await p.evaluate(() => { const f = document.querySelector('#v40IncomeForm .v48-final'); f.click(); f.click(); }); await p.waitForTimeout(1800);
    const sD = await p.evaluate(() => window.__T.dbg().incomeSchedules), txD = await p.evaluate(() => window.__T.dbg().transactions.length);
    check(12, 'Guardar la programación (doble clic) crea una sola fuente y no genera movimientos ni toca el historial', sD.length === sAntes + 1 && sD.slice(-1)[0].kind === 'formal' && txD === txAntes, JSON.stringify({ fuentes: sD.length, tx: txAntes + '→' + txD }));
    // informal
    await clickText(p, '#page', 'Agregar fuente'); await p.waitForTimeout(900);
    await p.evaluate(() => document.querySelector('#v40IncomeForm [data-v48-kind="informal"]').click()); await p.waitForTimeout(300);
    await p.fill('#v40IncomeForm [name="name"]', 'Joseo'); await p.fill('#v40IncomeForm [name="grossMonthly"]', '30000');
    await p.click('#v40IncomeForm [data-v48-next]'); await p.waitForTimeout(400);
    const i2 = await p.evaluate(() => ({ chip: document.querySelector('[data-v902-chip]')?.textContent, nomina: !document.querySelector('[data-v902-payroll]').hidden, nota: !document.querySelector('[data-v902-informal]').hidden }));
    check(13, 'Trabajo informal: sin AFP/SFS/ISR automáticos y con la nota de descuentos opcionales', i2.chip === 'Trabajo informal' && !i2.nomina && i2.nota, JSON.stringify(i2));
    check(14, 'Sin errores de página en el asistente', errs.length === 0, JSON.stringify(errs.slice(0, 2)));
    await p.close();

    /* ---------- Ampliar catálogo ---------- */
    ({ p, errs } = await session(b, w, h, dark));
    await p.evaluate(() => { const x = document.createElement('button'); x.dataset.act = 'addCategory'; x.hidden = true; document.body.append(x); x.click(); }); await p.waitForTimeout(800);
    const k1 = await p.evaluate(() => ({ back: !!document.querySelector('#modal-root .v903-back'), btn: document.querySelector('#modal-root form#categoryForm button[type="submit"]')?.textContent.trim(), prev: document.querySelector('#v900-preview')?.innerText.replace(/\s+/g, ' ') }));
    const txFirma = () => p.evaluate(() => JSON.stringify(window.__T.dbg().transactions.map(t => [t.id, t.amount, t.category, t.subcategory, t.date])));
    const firmaAntes = await txFirma();
    await p.fill('#v900-name', 'Actividades deportivas'); await p.fill('#v900-sub', 'Tenis');
    await p.click('#modal-root form#categoryForm button[type="submit"]'); await p.waitForTimeout(1300);
    const cat1 = await p.evaluate(() => (window.__T.dbg().customCategories || []).filter(c => c.name === 'Actividades deportivas'));
    check(15, 'Ampliar catálogo: crea la categoría con su primera subcategoría (botón «Crear categoría», flecha y vista previa)', k1.back && k1.btn === 'Crear categoría' && /Nueva categoría/.test(k1.prev) && cat1.length === 1 && cat1[0].subcategories.join() === 'Tenis', JSON.stringify({ k1, cat1 }));
    await p.evaluate(() => { const x = document.createElement('button'); x.dataset.act = 'addCategory'; x.hidden = true; document.body.append(x); x.click(); }); await p.waitForTimeout(700);
    await p.click('[data-v900-seg="what"] [data-val="subcategoria"]'); await p.selectOption('#customParent', 'Actividades deportivas'); await p.fill('#v900-sub', 'Natación');
    const btn2 = await p.evaluate(() => document.querySelector('#modal-root form#categoryForm button[type="submit"]').textContent.trim());
    await p.click('#modal-root form#categoryForm button[type="submit"]'); await p.waitForTimeout(1300);
    const cat2 = await p.evaluate(() => (window.__T.dbg().customCategories || []).filter(c => c.name === 'Actividades deportivas'));
    check(16, 'Añadir subcategoría a una categoría existente (botón «Añadir subcategoría»)', btn2 === 'Añadir subcategoría' && cat2.length === 1 && cat2[0].subcategories.join() === 'Tenis,Natación', JSON.stringify(cat2));
    await p.evaluate(() => { const x = document.createElement('button'); x.dataset.act = 'addCategory'; x.hidden = true; document.body.append(x); x.click(); }); await p.waitForTimeout(700);
    await p.click('[data-v900-seg="what"] [data-val="subcategoria"]'); await p.selectOption('#customParent', 'Actividades deportivas'); await p.fill('#v900-sub', 'Natación');
    await p.click('#modal-root form#categoryForm button[type="submit"]'); await p.waitForTimeout(1000);
    const cat3 = await p.evaluate(() => (window.__T.dbg().customCategories || []).find(c => c.name === 'Actividades deportivas').subcategories);
    check(17, 'Una subcategoría repetida se rechaza: el catálogo no se duplica', cat3.length === 2, JSON.stringify(cat3));
    check('17b', 'Crear categorías y subcategorías no modifica ningún movimiento anterior', (await txFirma()) === firmaAntes);
    check(18, 'Sin errores de página en el catálogo', errs.length === 0, JSON.stringify(errs.slice(0, 2)));
    await p.close();

    /* ---------- Acento dinámico y modo ---------- */
    ({ p } = await session(b, w, h, dark));
    // Personalización: acento propio (rojo) guardado en los ajustes; los flujos deben derivar de él.
    await p.evaluate(() => { const d = window.__T.dbg(); d.settings.paletteChoice = 'custom'; d.settings.paletteHex = '#c0392b'; });
    await p.evaluate(id => { const x = document.createElement('button'); x.dataset.act = 'navigate'; x.dataset.id = id; x.hidden = true; document.body.append(x); x.click(); }, 'overview'); await p.waitForTimeout(900);
    await p.evaluate(() => { const x = document.createElement('button'); x.dataset.act = 'addCategory'; x.hidden = true; document.body.append(x); x.click(); }); await p.waitForTimeout(800);
    const toRgb = c => { const n = (c.match(/-?\d*\.?\d+/g) || []).map(Number); return /^color\(/.test(c) ? n.slice(0, 3).map(v => v * 255) : n.slice(0, 3); };
    const ac = await p.evaluate(() => { const on = document.querySelector('#modal-root .v900-seg button.on'); return { seg: getComputedStyle(on).backgroundColor, sub: getComputedStyle(document.querySelector('#modal-root form#categoryForm button[type="submit"]')).backgroundColor, caja: getComputedStyle(document.querySelector('#modal-root .v900-seg')).backgroundColor, comp: getComputedStyle(document.querySelector('#modal-root .v900-seg')).color }; });
    const rojo = c => { const [r, g, bl] = toRgb(c); return r > 140 && g < 110 && bl < 110 && r > g + 60; };
    check(19, 'El acento elegido en Personalización (rojo) gobierna el selector segmentado y el botón principal: no hay colores fijos', rojo(ac.seg) && rojo(ac.sub), JSON.stringify(ac));
    if (dark) { const lum = c => { const m = toRgb(c); return (m[0] + m[1] + m[2]) / 3; }; check(20, 'En el modo oscuro las superficies de los flujos son oscuras (no quedan blancas)', lum(ac.caja) < 80, ac.caja); }
    else { const lum = c => { const m = toRgb(c); return (m[0] + m[1] + m[2]) / 3; }; check(20, 'En el modo claro las superficies son limpias (blancas)', lum(ac.caja) > 235, ac.caja); }
    await p.close();
  }
  await b.close();
  const f = results.filter(x => !x).length; console.log(f ? `\nFALLAN ${f} de ${results.length}` : `\nOK: ${results.length} comprobaciones superadas`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
