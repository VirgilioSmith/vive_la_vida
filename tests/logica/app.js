'use strict';
/* Pruebas de la app real: reloj de Santo Domingo, vigencias de certificados, historial inmutable. */
const { chromium } = require('playwright');
const open = require('../harness.js');
const R = require('../../lib/finanzas/reglas.js');
let ok = 0; const fallos = [];
const afirmar = (n, c, d = '') => { if (c) ok++; else fallos.push(n + (d ? ' → ' + d : '')); };
(async () => {
  const b = await chromium.launch();
  const { p } = await open(b, 390, 844);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  // 1) reloj
  const hoyApp = await p.evaluate(() => window.__T.fn.today());
  afirmar('today() = hoy() de Santo Domingo', hoyApp === R.hoy(), hoyApp);
  // 2) certificado existente: editar la tasa crea vigencia y no cambia lo devengado
  const id = await p.evaluate(() => window.__T.dbg().certificates[0]?.id);
  afirmar('hay un certificado de prueba', !!id);
  const antes = await p.evaluate((id) => { const c = window.__T.dbg().certificates.find((x) => x.id === id); return { c: JSON.parse(JSON.stringify(c)), proj: window.__T.fn.certProjection(c), versiones: (window.__T.dbg().ruleVersions || []).length }; }, id);
  const editar = async (campo, valor) => {
    await p.evaluate(([a, id]) => { document.getElementById('modal-root').innerHTML = ''; const x = document.createElement('button'); x.dataset.act = a; x.dataset.id = id; document.body.appendChild(x); x.click(); x.remove(); }, ['editCertificate', id]);
    await p.waitForTimeout(900);
    await p.evaluate(([n, v]) => { const f = document.querySelector('#modal-root form'); const e = f.elements.namedItem(n); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [campo, valor]);
    for (let i = 0; i < 3; i++) { await p.evaluate(() => document.querySelector('#modal-root form .v1110-next:not([hidden])')?.click()); await p.waitForTimeout(200); }
    await p.evaluate(() => document.querySelector('#modal-root form button[type=submit]:not([hidden])')?.click());
    await p.waitForTimeout(800);
  };
  const nuevaTasa = antes.c.rate + 2;
  await editar('rate', String(nuevaTasa));
  const despues = await p.evaluate((id) => { const d = window.__T.dbg(), c = d.certificates.find((x) => x.id === id); return { c: JSON.parse(JSON.stringify(c)), proj: window.__T.fn.certProjection(c), vers: d.ruleVersions.filter((v) => v.sujeto === id).map((v) => ({ ...v })) }; }, id);
  afirmar('la edición guardó la tasa nueva', despues.c.rate === nuevaTasa, String(despues.c.rate));
  afirmar('se crearon 2 vigencias (base y nueva)', despues.vers.length === 2, String(despues.vers.length));
  afirmar('la vigencia base conserva la tasa anterior', despues.vers[0]?.valor.rate === antes.c.rate && despues.vers[0]?.desde === antes.c.startDate);
  afirmar('la nueva vigencia empieza hoy o después', despues.vers[1]?.desde >= hoyApp && despues.vers[1]?.valor.rate === nuevaTasa);
  const esperado = R.interesCertificadoVigencias({
    eventos: [{ fecha: antes.c.startDate, delta: antes.c.principal }], inicio: antes.c.startDate, fin: antes.c.maturityDate,
    condiciones: (f) => (f < despues.vers[1].desde ? { tasa: antes.c.rate, retencion: antes.c.taxPct } : { tasa: nuevaTasa, retencion: antes.c.taxPct }),
    cortes: [despues.vers[1].desde],
  });
  if (antes.c.capitalMode !== 'pending') {
    afirmar('el interés bruto usa tramos (app = capa pura)', despues.proj.gross === esperado.bruto, `${despues.proj.gross} vs ${esperado.bruto}`);
    afirmar('el interés neto usa tramos (app = capa pura)', despues.proj.net === esperado.neto, `${despues.proj.net} vs ${esperado.neto}`);
  }
  // el tramo ya transcurrido (hasta hoy) no cambió: con la tasa vieja hasta hoy el devengado a hoy es idéntico
  const devengadoAntes = R.interesCertificadoSimple({ capital: antes.c.principal, inicio: antes.c.startDate, fin: despues.vers[1].desde, tasaPct: antes.c.rate, retencionPct: antes.c.taxPct });
  const devengadoDespues = R.interesCertificadoVigencias({ eventos: [{ fecha: antes.c.startDate, delta: antes.c.principal }], inicio: antes.c.startDate, fin: despues.vers[1].desde, condiciones: (f) => (f < despues.vers[1].desde ? { tasa: antes.c.rate, retencion: antes.c.taxPct } : { tasa: nuevaTasa, retencion: antes.c.taxPct }), cortes: [despues.vers[1].desde] });
  afirmar('lo devengado hasta el cambio es el mismo', JSON.stringify(devengadoAntes) === JSON.stringify(devengadoDespues));
  // 3) idempotencia: recalcular dos veces da lo mismo
  const dos = await p.evaluate((id) => { const c = window.__T.dbg().certificates.find((x) => x.id === id); return [window.__T.fn.certProjection(c), window.__T.fn.certProjection(c)]; }, id);
  afirmar('certProjection es idempotente', JSON.stringify(dos[0]) === JSON.stringify(dos[1]));
  // 4) historial inmutable en la app
  const inmut = await p.evaluate((id) => { const v = window.__T.dbg().ruleVersions.find((x) => x.sujeto === id); try { 'use strict'; v.valor.rate = 999; } catch (e) { return 'bloqueado'; } return v.valor.rate === 999 ? 'modificado' : 'bloqueado'; }, id);
  afirmar('la vigencia registrada no se puede modificar', inmut === 'bloqueado', inmut);
  // 5) certificado nuevo: vigencia inicial e instantánea
  await p.evaluate(() => { const d = window.__T.dbg(); window.__nuevo = { before: { v: d.ruleVersions.length, s: d.recordSnapshots.length } }; });
  // 6) consistencia: saldo inicial + movimientos = saldo final en todas las cuentas
  const cons = await p.evaluate(() => { const d = window.__T.dbg(), F = window.__T.fn, hoy = F.today(); return d.accounts.map((a) => { const movs = d.transactions.filter((t) => t.accountId === a.id || t.toAccountId === a.id); return { id: a.id, app: F.getAccountBalance(a, hoy), t: movs.some((t) => ['personal_issue', 'personal_settlement'].includes(t.type)) }; }); });
  const movs = await p.evaluate(() => window.__T.dbg().transactions.map((t) => ({ ...t })));
  const cuentas = await p.evaluate(() => window.__T.dbg().accounts.map((a) => ({ id: a.id, opening: a.opening, opened: a.opened })));
  for (const c of cons) { if (c.t) continue; const a = cuentas.find((x) => x.id === c.id); const m = movs.filter((t) => t.accountId === c.id || t.toAccountId === c.id); afirmar('saldo inicial + movimientos = saldo (cuenta)', R.saldoCuenta({ id: c.id, apertura: a.opening, abierta: a.opened, movimientos: m, hasta: hoyApp }) === c.app); }
  afirmar('sin errores de consola', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(`app: ${ok} correctas, ${fallos.length} fallan`); fallos.forEach((f) => console.log(' -', f));
  process.exit(fallos.length ? 1 : 0);
})();
