/* Red team · caos de infraestructura y concurrencia contra un servidor simulado con revisión (tests/lib-servidor.js).
   Cada escenario: provoca el fallo, comprueba que no se pierde ni duplica nada, que el usuario ve el estado y que tras recuperarse todo converge.
   Uso: node tests/red-team-caos.js */
process.env.NOBOOT = '1'; process.env.MOCKFILE = 'mock-servidor.js';
const { chromium } = require('playwright');
const open = require('./harness.js');
const { Servidor } = require('./lib-servidor.js');
let fails = 0, n = 0; const check = (id, name, ok, extra = '') => { n++; if (!ok) fails++; console.log(`${ok ? '✓' : '✕'} ${id} ${name}${extra ? ' — ' + String(extra).slice(0, 320) : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
async function sesion(b, srv, who = 'A') {
  const { p, ctx } = await open(b, 1280, 800, ctx => ctx.exposeFunction('__srv', async (op, payload, w) => op === 'rpc' ? srv.rpc(payload, w) : srv.read(payload)));
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160))); await p.evaluate(w => { window.__who = w }, who);
  for (let i = 0; i < 40; i++) { const s = await p.evaluate(() => window.__T.sync()); if (s.active) break; await wait(250); }
  return { p, ctx, errs };
}
const sync = p => p.evaluate(() => window.__T.sync());
const addTx = (p, id, amount) => p.evaluate(([id, amount]) => { const d = window.__T.dbg(); d.transactions.push({ id, type: 'expense', accountId: d.accounts[0].id, amount, currency: d.accounts[0].currency, date: window.__T.fn.today(), created: new Date().toISOString(), category: 'Otros gastos', subcategory: '', note: 'caos', tags: '', reviewed: false }); window.__T.persist(); }, [id, amount]);
const hasTx = (p, id) => p.evaluate(id => window.__T.dbg().transactions.some(t => t.id === id), id);
const srvHas = (srv, id) => (srv.doc().transactions || []).some(t => t.id === id);
const srvCount = (srv, id) => (srv.doc().transactions || []).filter(t => t.id === id).length;
const recover = async (p, tries = 8) => { for (let i = 0; i < tries; i++) { await p.evaluate(() => { window.__T.unbackoff(); return window.__T.flush() }); await wait(500); const s = await sync(p); if (!s.dirty && !s.saving) return s; } return sync(p); };
(async () => {
  const b = await chromium.launch();
  /* C0 · línea base: carga inicial y primer guardado contra el servidor simulado */
  { const srv = new Servidor(); const { p, errs } = await sesion(b, srv); const s = await sync(p);
    check('C0a', 'Arranque contra servidor simulado: sesión activa y documento inicial creado', s.active && srv.exists && srv.rev >= 1, JSON.stringify({ s, rev: srv.rev }));
    await addTx(p, 'tx-base-1', 123.45); await wait(1800); const s2 = await sync(p);
    check('C0b', 'Un cambio normal se confirma en el servidor exactamente una vez', srvCount(srv, 'tx-base-1') === 1 && !s2.dirty, JSON.stringify({ n: srvCount(srv, 'tx-base-1'), s2 }));
    check('C0c', 'Sin errores de página', errs.length === 0, errs.join('|')); await p.context().close(); }
  /* C1–C8 · fallos de red/servidor: el cambio se conserva localmente, se informa y converge al recuperarse */
  for (const mode of ['offline', '401', '403', '429', '500', '503', 'incompleta', 'basura']) {
    const srv = new Servidor(); const { p, errs } = await sesion(b, srv); const id = 'tx-' + mode; const rev0 = srv.rev;
    srv.setMode(mode); await addTx(p, id, 77.77); await wait(2200); const s = await sync(p);
    const during = { local: await hasTx(p, id), srvHas: srvHas(srv, id), dirty: s.dirty, state: s.state, label: String(s.label || '').slice(0, 80) };
    check('C-' + mode + 'a', `Fallo «${mode}»: el cambio queda protegido localmente, no llega al servidor y se marca pendiente`, during.local && !during.srvHas && (during.dirty || s.saving), JSON.stringify(during));
    check('C-' + mode + 'b', `Fallo «${mode}»: el usuario ve un estado de error/pendiente (no «guardado»)`, /pendiente|error|sin conexi|reintent|no confirm/i.test(String(s.label)) || s.state === 'error', JSON.stringify({ state: s.state, label: s.label }));
    srv.setMode('ok'); const fin = await recover(p);
    check('C-' + mode + 'c', `Recuperación tras «${mode}»: el servidor recibe el cambio una sola vez y el cliente queda limpio`, srvCount(srv, id) === 1 && !fin.dirty, JSON.stringify({ n: srvCount(srv, id), fin }));
    check('C-' + mode + 'd', `Fallo «${mode}»: sin excepciones no controladas`, errs.length === 0, errs.slice(0, 2).join('|'));
    await p.context().close();
  }
  /* C9 · respuesta perdida: el servidor aplicó el cambio pero el cliente no lo supo (riesgo de duplicado) */
  { const srv = new Servidor(); const { p, errs } = await sesion(b, srv); srv.setMode('respuesta-perdida', 1); await addTx(p, 'tx-perdida', 55.5); await wait(2500);
    const fin = await recover(p, 12);
    check('C9', 'Respuesta perdida tras aplicar en el servidor: tras reintentar hay exactamente una copia y no queda conflicto sin resolver', srvCount(srv, 'tx-perdida') === 1 && !fin.conflict && !fin.dirty, JSON.stringify({ n: srvCount(srv, 'tx-perdida'), fin, errs: errs.slice(0, 2) })); await p.context().close(); }
  /* C10 · latencia alta: ninguna interacción se pierde mientras el guardado está en vuelo */
  { const srv = new Servidor(); srv.latency = 2500; const { p } = await sesion(b, srv); await addTx(p, 'tx-lat-1', 10); await wait(300); await addTx(p, 'tx-lat-2', 20); await addTx(p, 'tx-lat-3', 30); await wait(9000); const fin = await recover(p, 10);
    check('C10', 'Tres cambios durante un guardado lento (2,5 s): los tres terminan una sola vez en el servidor', ['tx-lat-1', 'tx-lat-2', 'tx-lat-3'].every(i => srvCount(srv, i) === 1) && !fin.dirty, JSON.stringify({ c: ['tx-lat-1', 'tx-lat-2', 'tx-lat-3'].map(i => srvCount(srv, i)), fin })); await p.context().close(); }
  /* C11 · concurrencia: dos pestañas escriben a la vez sobre la misma base */
  { const srv = new Servidor(); const A = await sesion(b, srv, 'A'); const B = await sesion(b, srv, 'B');
    await addTx(A.p, 'tx-A-1', 11); await addTx(B.p, 'tx-B-1', 22); await wait(3500); const fa = await recover(A.p, 12), fb = await recover(B.p, 12);
    const dA = await A.p.evaluate(() => window.__T.dbg().transactions.filter(t => /^tx-[AB]-/.test(t.id)).map(t => t.id).sort()); 
    check('C11a', 'Dos pestañas escriben a la vez: el servidor conserva ambos movimientos, una vez cada uno', srvCount(srv, 'tx-A-1') === 1 && srvCount(srv, 'tx-B-1') === 1, JSON.stringify({ a: srvCount(srv, 'tx-A-1'), b: srvCount(srv, 'tx-B-1'), fa, fb, rev: srv.rev, calls: srv.calls.length }));
    check('C11b', 'Tras converger, ninguna pestaña queda en conflicto ni con cambios sin enviar', !fa.conflict && !fb.conflict && !fa.dirty && !fb.dirty, JSON.stringify({ fa, fb }));
    check('C11c', 'Sin errores de página en ninguna pestaña', A.errs.length + B.errs.length === 0, [...A.errs, ...B.errs].join('|')); await A.p.context().close(); await B.p.context().close(); }
  /* C12 · ráfaga de ediciones sobre el mismo movimiento desde dos pestañas (última escritura con fusión) */
  { const srv = new Servidor(); const A = await sesion(b, srv, 'A'); const B = await sesion(b, srv, 'B');
    await addTx(A.p, 'tx-comun', 100); await wait(2200); await B.p.evaluate(() => { window.__T.unbackoff(); return window.__T.pull() }); await wait(1500);
    const hasB = await hasTx(B.p, 'tx-comun');
    await A.p.evaluate(() => { const t = window.__T.dbg().transactions.find(x => x.id === 'tx-comun'); t.note = 'nota-A'; window.__T.persist() });
    if (hasB) await B.p.evaluate(() => { const t = window.__T.dbg().transactions.find(x => x.id === 'tx-comun'); t.amount = 250; window.__T.persist() });
    await wait(3500); const fa = await recover(A.p, 12), fb = await recover(B.p, 12); const sv = (srv.doc().transactions || []).find(t => t.id === 'tx-comun') || {};
    const bLocal = await B.p.evaluate(() => { const t = window.__T.dbg().transactions.find(x => x.id === 'tx-comun'); return t && { amount: t.amount, note: t.note } });
    check('C12', 'Edición simultánea del MISMO movimiento en dos pestañas (diseño conservador): no se sobrescribe nada en silencio; el servidor conserva la versión confirmada, la pestaña que perdió queda en conflicto visible con sus datos locales intactos', hasB && sv.note === 'nota-A' && sv.amount === 100 && fb.conflict && bLocal && bLocal.amount === 250 && !fa.conflict, JSON.stringify({ hasB, sv: { note: sv.note, amount: sv.amount }, bLocal, fa: fa.conflict, fb: fb.conflict })); await A.p.context().close(); await B.p.context().close(); }
  /* C13 · expiración de sesión durante una edición larga y reintentos acotados */
  { const srv = new Servidor(); const { p, errs } = await sesion(b, srv); srv.setMode('401'); for (let i = 0; i < 6; i++) { await addTx(p, 'tx-401-' + i, i + 1); await wait(300) } await wait(1500);
    const callsDuring = srv.calls.filter(c => c.mode === '401').length; srv.setMode('ok'); const fin = await recover(p, 12); const all = [0, 1, 2, 3, 4, 5].every(i => srvCount(srv, 'tx-401-' + i) === 1);
    check('C13a', 'Sesión expirada (401) con 6 cambios: los reintentos son acotados (no una tormenta de peticiones)', callsDuring <= 4, `peticiones durante el fallo: ${callsDuring}`);
    check('C13b', 'Tras renovar la sesión se guardan los 6 cambios, una vez cada uno', all && !fin.dirty, JSON.stringify({ all, fin })); await p.context().close(); }
  console.log(fails ? `\nFALLAN: ${fails} de ${n}` : `\nOK: ${n} comprobaciones superadas`); await b.close(); process.exit(fails ? 1 : 0);
})();
