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
      '<label>Importe<input name="already" type="text" inputmode="decimal"></label>',
      '<label>Últimos dígitos<input name="last4" type="text" pattern="[0-9]{0,4}"></label>',
      '<label>Porcentaje AFP<input name="afpPct" type="text"></label>',
      '<label>APR<input name="apr" type="text"></label>'
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
        adjustment:'decimal', name:null, search:null, already:'decimal',
        last4:'numeric', afpPct:'decimal', apr:'decimal' }
    : { amount:null, termCount:null, rate:null, cutDay:null,
        adjustment:null, name:null, search:null, already:'decimal',
        last4:null, afpPct:null, apr:null };
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
    check('Tarjeta: día editable sin selector intermedio ' + width,
      await cutDay.evaluate(i => !i.classList.contains('v1110-native') && !i.parentElement.querySelector('select')), true);
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


/* Recorrido natural: páginas de VIVE + accesos de creación. No guarda registros.
   El navegador no puede mostrar el teclado físico del iPhone; comprueba inputmode,
   foco y edición, y conserva un inventario por pantalla en los artefactos de CI. */
async function auditNaturalJourney(browser) {
  process.env.TOUCH = '1';
  const { ctx, p } = await open(browser, 390, 844);
  const pages = ['overview', 'register', 'income', 'expenses', 'wallet', 'banks',
    'accounts', 'cards', 'loans', 'certificates', 'benefits', 'personal',
    'payments', 'transactions', 'recurring', 'budget', 'annual', 'analytics',
    'categories', 'advanced', 'patrimony', 'projection', 'pressure',
    'mobilehub', 'mobilesearch', 'settings', 'score'];
  const report = [], problems = [], errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await ctx.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const inspect = async (pageName, step) => {
    await p.waitForTimeout(90);
    const fields = await p.evaluate(() => {
      const modal = document.getElementById('modal-root');
      const root = modal && modal.children.length ? modal : document.getElementById('app');
      if (!root) return [];
      const visible = e => {
        const r = e.getBoundingClientRect(), s = getComputedStyle(e);
        return r.width > 0 && r.height > 0 && s.display !== 'none' &&
          s.visibility !== 'hidden' && !e.disabled && !e.readOnly;
      };
      return [...root.querySelectorAll('input')].filter(visible).map(e => {
        const type = (e.getAttribute('type') || 'text').toLowerCase();
        const identity = [e.name, e.id, e.dataset.field || ''].join(' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').toLowerCase();
        const step = (e.getAttribute('step') || '').trim().toLowerCase();
        let expected = null;
        if (type === 'number') {
          const n = Number(step);
          expected = step === 'any' || (step && n > 0 && !Number.isInteger(n)) ? 'decimal' : 'numeric';
        } else if (type === 'text') {
          if (/(?:^|\s)(last4|last 4|last four|ultimos 4)(?:\s|$)/.test(identity)) expected = 'numeric';
          else if (/(?:^|\s)(amount|importe|monto|principal|capital|balance|saldo|debt|deuda|rate|tasa|fx|interest|interes|fee|commission|comision|cost|costo|price|precio|limit|limite|income|ingreso|deduction|deduccion|tax|impuesto|gross|net|neto|anualidad|cuota|pct|percent|percentage|porcentaje|apr|insurance|seguro|withholding|retencion|salary|sueldo|threshold|tope|discount|descuento|deposit|deposito)(?:\s|$)/.test(identity)) expected = 'decimal';
        }
        return { id:e.id, name:e.name, type, step, inputmode:e.getAttribute('inputmode'),
          expected, label:(e.getAttribute('aria-label') || e.closest('label')?.textContent || '').trim().slice(0, 72) };
      });
    });
    const wrong = fields.filter(f => f.expected && f.inputmode !== f.expected);
    report.push({ page:pageName, step, fields, wrong });
    for (const field of wrong) problems.push({ page:pageName, step, ...field });
  };
  try {
    // Navegación real en el selector de operaciones: los tres estados comparten campo decimal.
    await p.evaluate(() => {
      const b = document.createElement('button');
      b.dataset.act = 'newTransaction'; b.dataset.type = 'expense';
      document.body.append(b); b.click(); b.remove();
    });
    for (const mode of ['spend', 'income', 'transfer']) {
      const choice = p.locator('#modal-root .v749-segment [data-value="' + mode + '"]');
      await choice.waitFor({ state:'visible' });
      await choice.click();
      check('Operación ' + mode + ': selección activa',
        await choice.getAttribute('aria-pressed'), 'true');
      const amount = p.locator('#v749Amount');
      await amount.click();
      check('Operación ' + mode + ': teclado decimal',
        await amount.getAttribute('inputmode'), 'decimal');
      check('Operación ' + mode + ': foco con toque',
        await amount.evaluate(i => document.activeElement === i), true);
      await amount.fill('123.45');
      check('Operación ' + mode + ': edición',
        await amount.inputValue(), '123.45');
      await inspect('Nuevo movimiento', mode);
      await p.screenshot({ path:path.join(output, 'recorrido-' + mode + '.png') });
    }
    // Visita todas las rutas y abre controles visibles de creación/registro.
    for (const pageName of pages) {
      await p.evaluate(pg => {
        document.getElementById('modal-root').replaceChildren();
        window.__T.go(pg);
      }, pageName);
      await inspect(pageName, 'página');
      const count = await p.evaluate(() => {
        const valid = b => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && !b.disabled &&
            /\b(nuevo|nueva|nuevos|nuevas|agregar|añadir|crear|registrar|simular|conciliar)\b/i.test((b.textContent || '').trim()) &&
            !/eliminar|borrar|guardar|confirmar/i.test(b.textContent || '');
        };
        return [...document.querySelectorAll('#app button')].filter(valid).length;
      });
      for (let i = 0; i < Math.min(count, 24); i++) {
        const opened = await p.evaluate(({ pg, index }) => {
          document.getElementById('modal-root').replaceChildren();
          window.__T.go(pg);
          const valid = b => {
            const r = b.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && !b.disabled &&
              /\b(nuevo|nueva|nuevos|nuevas|agregar|añadir|crear|registrar|simular|conciliar)\b/i.test((b.textContent || '').trim()) &&
              !/eliminar|borrar|guardar|confirmar/i.test(b.textContent || '');
          };
          const b = [...document.querySelectorAll('#app button')].filter(valid)[index];
          if (!b) return null;
          const label = (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70);
          b.click();
          return label;
        }, { pg:pageName, index:i });
        if (opened) await inspect(pageName, 'abrir: ' + opened);
      }
    }
    fs.writeFileSync(path.join(output, 'recorrido-integral.json'),
      JSON.stringify({ routes:pages.length, visited:report.length,
        checked:report.reduce((n,r) => n + r.fields.filter(f => !!f.expected).length,0),
        problems, errors, report }, null, 2));
    console.log('Recorrido de teclado: ' + pages.length + ' páginas, ' +
      report.length + ' pantallas/estados, ' +
      report.reduce((n,r) => n + r.fields.filter(f => !!f.expected).length, 0) +
      ' campos numéricos verificados.');
    check('Campos numéricos con inputmode incorrecto', problems, []);
    check('Errores JavaScript en el recorrido', errors, []);
  } finally {
    await ctx.tracing.stop({ path:path.join(output, 'recorrido-integral.zip') });
    await ctx.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless:process.env.PW_VISIBLE !== '1' });
  try {
    for (const [w,h] of [[375,667],[390,844],[430,932]]) {
      await auditMobile(browser,w,h);
    }
    await auditNaturalJourney(browser);
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
