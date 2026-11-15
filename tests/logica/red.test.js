'use strict';
/* Fallos de red: tiempos de espera, reintentos limitados, error 500, respuesta lenta. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function entorno(fetchFalso) {
  const oyentes = {};
  const ventana = {
    fetch: fetchFalso, addEventListener: (t, f) => { (oyentes[t] = oyentes[t] || []).push(f); },
    console: { warn() {}, log() {} },
  };
  const contexto = vm.createContext({ document: { addEventListener() {} }, window: ventana, console: ventana.console, setTimeout, clearTimeout, AbortController, Promise, Date, Object, String, Math, Array });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../src/early.js'), 'utf8'), contexto);
  return { ventana, oyentes };
}
const URL = 'https://ejemplo.supabase.co/rest/v1/finance_items';

test('lectura: reintenta hasta 3 veces ante error 503 y devuelve la respuesta final', async () => {
  let n = 0;
  const { ventana } = entorno(async () => { n++; return { status: n < 3 ? 503 : 200 }; });
  const r = await ventana.fetch(URL, { method: 'GET' });
  assert.equal(r.status, 200); assert.equal(n, 3);
});

test('lectura: nunca más de 4 intentos (1 + 3 reintentos)', async () => {
  let n = 0;
  const { ventana } = entorno(async () => { n++; return { status: 503 }; });
  const r = await ventana.fetch(URL);
  assert.equal(r.status, 503); assert.equal(n, 4);
});

test('lectura: la caída de red se reintenta y luego se propaga', async () => {
  let n = 0;
  const { ventana } = entorno(async () => { n++; throw new TypeError('red caída'); });
  await assert.rejects(ventana.fetch(URL), /red caída/);
  assert.equal(n, 4);
});

test('escritura: error 500 se devuelve sin reintentar (no duplica operaciones)', async () => {
  let n = 0;
  const { ventana } = entorno(async () => { n++; return { status: 500 }; });
  const r = await ventana.fetch(URL, { method: 'POST', body: '{}' });
  assert.equal(r.status, 500); assert.equal(n, 1);
});

test('escritura: la caída de red no se reintenta', async () => {
  let n = 0;
  const { ventana } = entorno(async () => { n++; throw new TypeError('red caída'); });
  await assert.rejects(ventana.fetch(URL, { method: 'POST' }), /red caída/);
  assert.equal(n, 1);
});

test('respuesta lenta: la señal se cancela al vencer el tiempo (comprobado con señal externa)', async () => {
  const { ventana } = entorno((u, o) => new Promise((res, rej) => { o.signal.addEventListener('abort', () => rej(new Error('abortado'))); }));
  const control = new AbortController();
  const p = ventana.fetch(URL, { method: 'POST', signal: control.signal });
  setTimeout(() => control.abort(), 20);
  await assert.rejects(p, /abortado/);
});

test('otras direcciones no se tocan', async () => {
  let n = 0;
  const { ventana } = entorno(async () => { n++; return { status: 503 }; });
  const r = await ventana.fetch('https://otro.example/x');
  assert.equal(r.status, 503); assert.equal(n, 1);
});

test('errores globales se cuentan sin guardar datos', () => {
  const { ventana, oyentes } = entorno(async () => ({ status: 200 }));
  for (let i = 0; i < 6; i++) oyentes.error[0]({ message: 'fallo ' + i });
  assert.equal(ventana.__erroresRecientes, 6);
  oyentes.unhandledrejection[0]({ reason: { message: 'rechazo' } });
  assert.equal(ventana.__erroresRecientes, 7);
});

test('datos vacíos o nulos no rompen la captura de errores', () => {
  const { ventana, oyentes } = entorno(async () => ({ status: 200 }));
  oyentes.error[0](null); oyentes.error[0]({}); oyentes.unhandledrejection[0](null); oyentes.unhandledrejection[0]({ reason: null });
  assert.equal(ventana.__erroresRecientes, 4);
});
