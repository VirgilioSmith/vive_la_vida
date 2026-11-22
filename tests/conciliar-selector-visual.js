'use strict';

process.env.TOUCH = '1';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const open = require('./harness');

const dir = path.resolve(__dirname, '../test-results/conciliar-selector');
fs.mkdirSync(dir, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(dir, name + '.png') });

async function run() {
 const browser = await chromium.launch({ headless: false, slowMo: 700 });
 let context;
 try {
  const session = await open({
   async newContext(options) {
    context = await browser.newContext({ ...options, recordVideo: { dir, size: { width: 390, height: 844 } } });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    return context;
   }
  }, 390, 844);
  const page = session.p;
  await page.bringToFront();
  await page.evaluate(() => {
   const t = window.__T, db = t.dbg();
   const opened = t.fn.plusMonths(t.fn.today(), -2);
   db.banks.push({ id: 'test-bank', name: 'Banco de prueba', logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/f1sAAAAASUVORK5CYII=' });
   db.accounts.push({ id: 'test-account', name: 'Cuenta de prueba USD', bankId: 'test-bank', currency: 'USD', kind: 'checking', opening: 250, opened });
   db.cards.push({ id: 'test-card', name: 'Visa de prueba', bankId: 'test-bank', network: 'visa', last4: '2468', limitDOP: 30000, openingDOP: 1000, opened, cutDay: 20, dueDay: 15 });
   t.inv();
   t.go('register');
  });
  console.log('1. Abrir Conciliar un saldo');
  const launch = page.locator('[data-act=otherAdjust]:visible');
  if (!(await launch.count())) {
   await page.getByRole('button', { name: 'Registrar una operación' }).click();
   await page.locator('.v235-register-dialog [data-act=registrationGroup][data-id=other]').click();
  }
  await launch.first().click();

  const accountForm = page.locator('#vReconcileForm');
  const picker = page.locator('.v789-product-backdrop:visible');
  console.log('2. Abrir selector universal y comprobar buscador y filtros');
  await accountForm.locator('.v-reconcile-account').click();
  await picker.locator('.v789-picker-search').waitFor();
  assert.equal(await picker.getByRole('button', { name: 'Cuentas', exact: true }).getAttribute('aria-pressed'), 'true');
  await picker.getByRole('button', { name: 'Tarjetas', exact: true }).waitFor();
  await picker.locator('.v789-picker-search').fill('Cuenta de prueba');
  const bankRow = picker.locator('[data-value=test-account]');
  await bankRow.locator('img').waitFor();
  assert.match(await bankRow.innerText(), /Banco de prueba.*USD/s);
  await shot(page, '01-cuentas');

  console.log('3. Seleccionar cuenta y regresar al formulario de conciliación');
  await bankRow.click();
  await picker.locator('.v789-picker-confirm').click();
  assert.match(await accountForm.locator('.v-reconcile-account').innerText(), /Cuenta de prueba USD/);
  assert.equal(await accountForm.locator('[data-reconcile=symbol]').innerText(), 'US$');
  assert.equal(await page.locator('#transactionForm').count(), 0);
  await shot(page, '02-cuenta-seleccionada');

  console.log('4. Cambiar a Tarjetas, con buscador y marca Visa');
  await accountForm.locator('.v-reconcile-account').click();
  await picker.getByRole('button', { name: 'Tarjetas', exact: true }).click();
  await picker.locator('.v789-picker-search').fill('Visa de prueba');
  const cardRow = picker.locator('[data-value="card:test-card"]');
  await cardRow.locator('.v869-visa').waitFor();
  assert.match(await cardRow.innerText(), /2468.*RD\$/s);
  assert.equal(await bankRow.isVisible(), false);
  await shot(page, '03-tarjetas');

  console.log('5. Seleccionar tarjeta sin abrir el formulario antiguo');
  await cardRow.click();
  await picker.locator('.v789-picker-confirm').click();
  assert.equal(await page.locator('#transactionForm').count(), 0);
  assert.equal(await accountForm.count(), 1);
  assert.match(await accountForm.locator('.v-reconcile-account').innerText(), /Visa de prueba/);
  assert.equal(await accountForm.locator('[data-reconcile=symbol]').innerText(), 'RD$');
  await accountForm.locator('[name=observed]').fill('1250.75');
  assert.equal(await accountForm.locator('[data-reconcile=after]').innerText(), 'RD$1,250.75');
  await shot(page, '04-tarjeta-seleccionada');

  console.log('6. Regresar de Tarjetas a Cuentas dentro del mismo formulario');
  await accountForm.locator('.v-reconcile-account').click();
  assert.equal(await picker.getByRole('button', { name: 'Tarjetas', exact: true }).getAttribute('aria-pressed'), 'true');
  await picker.getByRole('button', { name: 'Cuentas', exact: true }).click();
  await picker.locator('.v789-picker-search').fill('Cuenta de prueba');
  await bankRow.click();
  await picker.locator('.v789-picker-confirm').click();
  assert.match(await accountForm.locator('.v-reconcile-account').innerText(), /Cuenta de prueba USD/);
  assert.equal(await accountForm.locator('[name=observed]').inputValue(), '');
  console.log('Recorrido aprobado. No se confirmó ningún ajuste.');
  if (process.env.CI) await page.waitForTimeout(1000);
  else {
   console.log('Navegador abierto para inspección. Cierra la ventana para finalizar el vídeo.');
   await page.waitForEvent('close', { timeout: 0 });
  }
 } finally {
  if (context) {
   await context.tracing.stop({ path: path.join(dir, 'traza.zip') });
   await context.close();
  }
  await browser.close();
 }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
