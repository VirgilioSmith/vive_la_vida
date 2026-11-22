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
  const picker = page.locator('.v-reconcile-account-picker');
  console.log('2. Abrir selector y comprobar Cuentas / Tarjetas');
  await accountForm.locator('.v-reconcile-account').click();
  assert.equal(await picker.getByRole('button', { name: 'Cuentas', exact: true }).getAttribute('aria-pressed'), 'true');
  await picker.getByRole('button', { name: 'Tarjetas', exact: true }).waitFor();
  const bankRow = picker.locator('[data-value=test-account]');
  await bankRow.locator('img').waitFor();
  assert.match(await bankRow.innerText(), /Banco de prueba.*USD/s);
  await shot(page, '01-cuentas');

  console.log('3. Seleccionar cuenta y comprobar nombre y moneda');
  await bankRow.click();
  assert.match(await accountForm.locator('.v-reconcile-account').innerText(), /Cuenta de prueba USD/);
  assert.equal(await accountForm.locator('[data-reconcile=symbol]').innerText(), 'US$');
  await shot(page, '02-cuenta-seleccionada');

  console.log('4. Cambiar a Tarjetas y comprobar Visa, terminación y moneda');
  await accountForm.locator('.v-reconcile-account').click();
  await picker.getByRole('button', { name: 'Tarjetas', exact: true }).click();
  const cardRow = picker.locator('[data-value="card:test-card"]');
  await cardRow.locator('.v869-visa').waitFor();
  assert.match(await cardRow.innerText(), /2468.*RD\$/s);
  assert.equal(await bankRow.isVisible(), false);
  await shot(page, '03-tarjetas');

  console.log('5. Seleccionar tarjeta y comprobar el formulario');
  await cardRow.click();
  const cardForm = page.locator('#transactionForm');
  assert.equal(await cardForm.locator('[name=accountId]').inputValue(), 'card:test-card');
  assert.equal(await cardForm.locator('[name=currency]').inputValue(), 'DOP');
  await cardForm.locator('.v789-select-open').filter({ hasText: 'Visa de prueba' }).waitFor();
  await shot(page, '04-tarjeta-seleccionada');

  console.log('6. Volver a Cuentas desde la tarjeta');
  await cardForm.locator('.v789-select-open').filter({ hasText: 'Visa de prueba' }).click();
  assert.equal(await picker.getByRole('button', { name: 'Tarjetas', exact: true }).getAttribute('aria-pressed'), 'true');
  await picker.getByRole('button', { name: 'Cuentas', exact: true }).click();
  await bankRow.click();
  assert.match(await accountForm.locator('.v-reconcile-account').innerText(), /Cuenta de prueba USD/);
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
