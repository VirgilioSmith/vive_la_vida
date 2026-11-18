/* Todos los selectores de productos (cuentas, tarjetas, préstamos, instituciones) de los formularios de creación y pago usan el selector
   universal y ofrecen TODOS los productos activos, en pesos y en dólares (los que la operación no admite aparecen atenuados con su motivo).
   Usa tests/auditoria-selectores.js.  Uso: node tests/selectores-universales.js */
const { execFileSync } = require('child_process'); const fs = require('fs');
let fails = 0; const check = (n, name, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '✓' : '✕'} ${n} ${name}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`); };
const run = (env, out) => { try { execFileSync('node', [__dirname + '/auditoria-selectores.js'], { env: { ...process.env, ...env, OUT: out }, stdio: 'ignore', timeout: 520000 }); } catch (e) { return null; } return JSON.parse(fs.readFileSync(out, 'utf8')); };
const casos = [
  ['móvil · asistente de registro y pantallas de productos', { W: '390', H: '844', PAGES: 'overview,loans,accounts,certificates', ASISTENTE: '1' }, ['Pagar tarjeta', 'Registrar cuota de préstamo', 'Nuevo préstamo', 'Nueva cuenta'], 6],
  ['móvil · wallet (avance de efectivo y nueva tarjeta)', { W: '390', H: '844', PAGES: 'wallet', ASISTENTE: '0', PRIO: 'Avance|Nueva tarjeta' }, ['Avance de efectivo', 'Nueva tarjeta'], 2],
  ['escritorio · registro de gasto e ingreso', { W: '1440', H: '900', PAGES: 'overview', ASISTENTE: '1' }, ['Registrar gasto'], 2],
];
casos.forEach(([nombre, env, titulos, minimo], i) => {
  const d = run(env, `/tmp/selectores-prueba-${i}.json`);
  if (!d) return check('SEL-' + i, nombre + ': la exploración terminó', false);
  const filas = []; d.formularios.forEach(f => f.selects.forEach(s => filas.push({ t: f.titulo, ...s })));
  const noUniv = filas.filter(s => !s.universal), faltan = filas.filter(s => s.faltan && s.faltan.length);
  check('SEL-' + i + 'a', `${nombre}: ${filas.length} listas de productos, todas con selector universal`, filas.length >= minimo && noUniv.length === 0, noUniv.map(s => s.t + '/' + s.campo).join(', '));
  check('SEL-' + i + 'b', `${nombre}: todas ofrecen todos los productos activos (pesos y dólares)`, faltan.length === 0, faltan.map(s => s.t + '/' + s.campo + ' faltan ' + s.faltan.join(',')).join(' | '));
  const vistos = new Set(d.formularios.map(f => f.titulo));
  titulos.forEach(t => check('SEL-' + i + '-' + t, `Se recorrió el formulario «${t}»`, [...vistos].some(v => v.startsWith(t))));
});
console.log(fails ? `\nFALLAN: ${fails}` : '\nOK'); process.exit(fails ? 1 : 0);
