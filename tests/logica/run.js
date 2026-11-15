'use strict';
/* Ejecuta todas las pruebas de lógica: unitarias (Node) y paridad con la app (navegador). */
const { spawnSync } = require('child_process');
const path = require('path');
let fallo = 0;
for (const [titulo, args] of [['Unitarias', ['--test', path.join(__dirname, 'reglas.test.js')]], ['Paridad con la app', [path.join(__dirname, 'paridad.js')]], ['App real', [path.join(__dirname, 'app.js')]], ['Recorrido de pagos', [path.join(__dirname, 'recorrido-pagos.js')]], ['Vive', [path.join(__dirname, 'vive.js')]]]) {
  console.log(`\n== ${titulo}`);
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (r.status) fallo = 1;
}
process.exit(fallo);
