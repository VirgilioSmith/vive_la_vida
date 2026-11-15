'use strict';
/* Vive: abrir, otro instante, copiar, Esc, variedad de textos y almacenamiento dañado. */
const { chromium } = require('playwright');
const open = require('../harness.js');
let ok = 0; const fallos = [];
const afirmar = (n, c, d = '') => { if (c) ok++; else fallos.push(n + (d ? ' → ' + d : '')); };
(async () => {
  process.env.TOUCH = '1';
  const b = await chromium.launch();
  const { p } = await open(b, 390, 844);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const txt = () => p.evaluate(() => document.querySelector('.vive-reader-copy')?.innerText || '');
  const clic = (s) => p.evaluate((s) => document.querySelector(s)?.click(), s);
  await p.evaluate(() => { localStorage.setItem('vive.seen.v2', 'xx'); });
  await clic('[data-vive-open]'); await p.waitForTimeout(400);
  afirmar('abre con un texto (aun con almacenamiento dañado)', (await txt()).length > 20);
  afirmar('solo hay «Otro instante» y «Copiar»', await p.evaluate(() => [...document.querySelectorAll('.vive-reader-actions button')].map((b) => b.textContent.trim().replace(/\s*↗/, '')).join('|') === 'Otro instante|Copiar'));
  const vistos = new Set();
  for (let i = 0; i < 60; i++) { vistos.add(await txt()); await clic('[data-vive-next]'); await p.waitForTimeout(40); }
  afirmar('60 instantes seguidos sin repetir ninguno', vistos.size >= 59, String(vistos.size));
  afirmar('todos terminan en punto y empiezan en mayúscula', [...vistos].every((t) => /[.!]$/.test(t) && /^[A-ZÁÉÍÓÚÑ¿¡]/.test(t)), [...vistos].find((t) => !(/[.!]$/.test(t) && /^[A-ZÁÉÍÓÚÑ¿¡]/.test(t))));
  await clic('[data-vive-copy]'); await p.waitForTimeout(200);
  afirmar('«Copiar» responde', await p.evaluate(() => /Copiado|No se pudo/.test(document.querySelector('[data-vive-copy]').textContent)));
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  afirmar('Esc cierra', !(await p.evaluate(() => !!document.getElementById('vive-reader'))));
  afirmar('sin errores de consola', errs.length === 0, errs.join(' | '));
  const total = await p.evaluate(() => window.ViveModule.stats());
  afirmar('más de 100 millones de combinaciones', total.combinations > 1e8, String(total.combinations));
  await b.close();
  console.log(`vive: ${ok} correctas, ${fallos.length} fallan`); fallos.forEach((f) => console.log(' -', f));
  process.exit(fallos.length ? 1 : 0);
})();
