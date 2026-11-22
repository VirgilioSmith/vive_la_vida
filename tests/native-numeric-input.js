/* Validación del teclado nativo móvil: Chromium/WebKit pueden comprobar
   inputmode y foco, no pueden abrir el teclado real de iOS. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const open = require('./harness');
const output = path.resolve(__dirname, '../test-results/native-numeric-input');
fs.mkdirSync(output, { recursive: true });
const all = [];
const check = (name, actual, expected) => {
  assert.deepEqual(actual, expected, name);
  console.log('✓ ' + name);
};

async function fixtures(page, mobile) {
  const result = await page.evaluate(async () => {
    const form = document.createElement('form');
    form.id = 'native-numeric-test-fixtures';
    form.innerHTML = [
      '<label>Importe<input name="amount" type="text"></label>',
      '<label>Plazo<input name="termCount" type="text"></label>',
      '<label>Tasa<input name="rate" type="number" step="0.001"></label>',
      '<label>Día de pago<input name="cutDay" type="number" step="1"></label>',
      '<label>Importe negativo<input name="adjustment" type="number" step="0.01" min="-500"></label>',
      '<label>Nombre<input name="name" type="text"></label>',
      '<label>Buscar<input name="search" type="text"></label>',
      '<label>Importe<input name="already" type="text" inputmode="decimal"></label>'
    ].join('');
    document.body.append(form);
    await new Promise(resolve => setTimeout(resolve, 30));
    const modes = Object.fromEntries([...form.querySelectorAll('input')].map(i =>
      [i.name, i.getAttribute('inputmode')]));
    const negative = form.elements.namedItem('adjustment');
    negative.value = '-12.50';
    const acceptsNegative = negative.value === '-12.50' && negative.checkValidity();
    form.remove();
    return { modes, acceptsNegative };
  });
  const expected = mobile
    ? { amount:'decimal', termCount:'numeric', rate:'decimal', cutDay:'numeric',
        adjustment:'decimal', name:null, search:null, already:'decimal' }
    : { amount:null, termCount:null, rate:null, cutDay:null,
        adjustment:null, name:null, search:null, already:'decimal' };
  check('Modos nativos del formulario de prueba (' + (mobile?'móvil':'escritorio') + ')',
    result.modes, expected);
  check('No altera validación original de negativos', result.acceptsNegative, true);
}

async function auditMobile(browser, width, height) {
  process.env.TOUCH = '1';
  const { ctx, p } = await open(browser, width, height);
  const file = path.join(output, 'iphone-' + width + '.zip');
  await ctx.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const errors = [];
  p.on('pageerror', error => errors.push(error.message));
  try {
    await fixtures(p, true);
    await p.evaluate(() => {
      const b = document.createElement('button');
      b.dataset.act = 'newTransaction'; b.dataset.type = 'expense';
      document.body.append(b); b.click(); b.remove();
    });
    const selector = '#v749Amount,#mqrAmountInput';
    const amount = p.locator(selector).first();
    await amount.waitFor({ state: 'visible' });
    check('Nuevo movimiento: decimal ' + width, await amount.getAttribute('inputmode'), 'decimal');
    await amount.click();
    check('Foco directo en importe ' + width, await amount.evaluate(i => document.activeElement === i), true);
    await amount.fill('1250.75');
    check('Edición decimal ' + width, await amount.inputValue(), '1250.75');
    await amount.fill('125');
    check('Reemplazo del importe ' + width, await amount.inputValue(), '125');
    await amount.fill('');
    check('Borrado del importe ' + width, await amount.inputValue(), '');
    check('Sin teclados HTML heredados ' + width,
      await p.locator('.mqr-keypad,.v749-keypad').count(), 0);
    await p.screenshot({ path: path.join(output, 'movimiento-' + width + '.png') });

    await p.evaluate(() => window.__T.openCardForm());
    const cutDay = p.locator('#cardForm [name="cutDay"]').first();
    const limit = p.locator('#cardForm [name="limitDOP"]').first();
    await cutDay.waitFor({ state: 'attached' });
    check('Tarjeta: día entero ' + width, await cutDay.getAttribute('inputmode'), 'numeric');
    check('Tarjeta: límite decimal ' + width, await limit.getAttribute('inputmode'), 'decimal');
    const inventory = await p.locator('input').evaluateAll(inputs => inputs
      .filter(i => i.type === 'number' || /decimal|numeric/.test(i.inputMode))
      .map(i => ({ id:i.id, name:i.name, type:i.type, step:i.getAttribute('step'),
        inputmode:i.getAttribute('inputmode') })));
    all.push({ screen:width + 'x' + height, inputCount:inventory.length, fields:inventory });
    await p.screenshot({ path:path.join(output,'tarjeta-' + width + '.png') });
    check('Sin errores nuevos de JavaScript ' + width, errors.length, 0);
  } finally {
    await ctx.tracing.stop({ path:file });
    await ctx.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless:process.env.PW_VISIBLE !== '1' });
  try {
    for (const [w,h] of [[375,667],[390,844],[430,932]]) {
      await auditMobile(browser,w,h);
    }
    delete process.env.TOUCH;
    const {ctx,p} = await open(browser,1194,834);
    try { await fixtures(p,false); } finally { await ctx.close(); }
    fs.writeFileSync(path.join(output,'inventario.json'),JSON.stringify(all,null,2));
    console.log('Auditoría numérica móvil finalizada; inventario y trazas guardados.');
  } finally { await browser.close(); }
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
