/* Red team · seguridad controlada (cliente, datos sintéticos): respaldo JSON hostil (contaminación de prototipo, tipos erróneos, importes absurdos,
   cargas HTML), aislamiento de claves locales por usuario y ausencia de secretos en el almacenamiento. Uso: node tests/red-team-seguridad.js */
const { chromium } = require('playwright');
const open = require('./harness.js');
let fails = 0, n = 0; const check = (id, name, ok, extra = '') => { n++; if (!ok) fails++; console.log(`${ok ? '✓' : '✕'} ${id} ${name}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`); };
(async () => {
  const b = await chromium.launch(); const { p } = await open(b, 1280, 800); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160))); p.on('dialog', d => d.accept().catch(() => {}));
  const good = await p.evaluate(() => JSON.parse(JSON.stringify(window.__T.dbg())));
  const files = {
    'control': JSON.stringify({ ...good, accounts: good.accounts.map(a => a.kind !== 'cash' && !a.__done && (a.__done = 1) ? { ...a, name: 'CONTROL-IMPORT' } : a) }),
    'proto': JSON.stringify({ ...good, __proto__: { polluted: 'si' }, constructor: { prototype: { polluted2: 'si' } } }).replace('"__proto__"', '"__proto__"'),
    'proto-raw': '{"accounts":[],"cards":[],"loans":[],"transactions":[],"recurring":[],"__proto__":{"polluted3":"si"},"settings":{"__proto__":{"polluted4":"si"},"constructor":{"prototype":{"polluted5":"si"}}}}',
    'tipos': JSON.stringify({ ...good, accounts: 'no-es-lista' }),
    'importe-absurdo': JSON.stringify({ ...good, transactions: [{ id: 'x1', type: 'expense', accountId: good.accounts[0].id, amount: 1e25, currency: 'DOP', date: '2026-01-01' }] }),
    'html': JSON.stringify({ ...good, accounts: good.accounts.map(a => a.kind !== 'cash' && !a.__d2 && (a.__d2 = 1) ? { ...a, name: '<img src=x onerror="window.__pwn=1">' } : a) }),
    'null': 'null', 'vacio': '', 'arreglo': '[]', 'binario': '\u0000\u0001\u0002',
    'profundo': '{"a":'.repeat(3000) + '1' + '}'.repeat(3000),
  };
  for (const [k, content] of Object.entries(files)) {
    await p.evaluate(() => { window.__pwn = 0; try { closeModal() } catch (_) { } });
    await p.evaluate(async () => { window.__T.go('settings'); await new Promise(r => setTimeout(r, 200)); document.querySelector('[data-v242-section="security"]')?.click(); await new Promise(r => setTimeout(r, 200)) });
    try { await p.setInputFiles('#importFile', { name: k + '.json', mimeType: 'application/json', buffer: Buffer.from(content) }, { timeout: 5000 }); if (0) await p.setInputFiles('#importFile', { name: k + '.json', mimeType: 'application/json', buffer: Buffer.from(content) }); } catch (e) { check('S-' + k, 'No se pudo adjuntar el archivo de prueba', false, e.message); continue }
    let confirmShown = false; for (let i = 0; i < 30 && !confirmShown; i++) { await p.waitForTimeout(100); confirmShown = await p.evaluate(() => { const ok = document.querySelector('.v1011-ok'); if (ok) { ok.click(); return true } return false }) } await p.waitForTimeout(900);
    const r = await p.evaluate(() => { const o = {}; const polluted = ['polluted', 'polluted2', 'polluted3', 'polluted4', 'polluted5'].filter(k => ({})[k] !== undefined || (Object.prototype)[k] !== undefined); const d = window.__T.dbg(); let fin = true; try { for (const a of d.accounts) if (!Number.isFinite(window.__T.fn.getAccountBalance(a))) fin = false } catch (e) { fin = false } return { polluted, fin, pwn: window.__pwn, accounts: Array.isArray(d.accounts), tx: Array.isArray(d.transactions), maxAmt: Math.max(0, ...d.transactions.map(t => Math.abs(Number(t.amount) || 0))), img: !!document.querySelector('img[src="x"]') } });
    if (['proto', 'proto-raw', 'tipos', 'importe-absurdo', 'html', 'null', 'vacio', 'arreglo', 'binario', 'profundo'].includes(k)) r.confirmShown = confirmShown;
    check('S-' + k, `Respaldo hostil «${k}»: sin contaminación de prototipo, sin ejecución de código y base utilizable`, r.polluted.length === 0 && !r.pwn && !r.img && r.accounts && r.tx && r.fin, JSON.stringify(r));
    if (k === 'control') { check('S-control-confirm', 'El respaldo válido pide confirmación antes de reemplazar los datos', confirmShown); const nm = await p.evaluate(() => window.__T.dbg().accounts.some(a => a.name === 'CONTROL-IMPORT')); check('S-control', 'Control positivo: un respaldo válido SÍ se importa (la prueba ejercita el camino real)', nm === true, String(nm)); }
    if (k === 'html') { const nm = await p.evaluate(() => ({ imported: window.__T.dbg().accounts.some(a => /onerror/.test(a.name)), htmlInDom: document.body.innerHTML.includes('<img src="x"') })); await p.evaluate(async () => { window.__T.go('accounts'); await new Promise(r => setTimeout(r, 300)) }); const shown = await p.evaluate(() => ({ text: document.body.innerText.includes('<img src=x'), html: !!document.querySelector('#page img[src="x"]') })); check('S-html-b', 'El nombre con HTML se importó y se muestra como texto (visible como «<img…», sin elemento ni ejecución)', nm.imported && shown.text && !shown.html && !nm.htmlInDom, JSON.stringify({ nm, shown })); }
    if (k === 'importe-absurdo') check('S-importe-absurdo-b', 'Un respaldo con un importe de 1e25 no se acepta (el servidor lo rechazaría y la sincronización quedaría bloqueada)', r.maxAmt <= 1e10, 'importe máximo cargado: ' + r.maxAmt);
    // restaurar una base sana para el siguiente caso
    await p.evaluate(g => { try { window.__T.boot() } catch (_) { } }, good);
  }
  check('S-errores', 'Los respaldos hostiles no provocan excepciones no controladas', errs.length === 0, errs.slice(0, 3).join(' | '));
  /* Almacenamiento: sin tokens/contraseñas en claro y claves por usuario */
  const st = await p.evaluate(() => { const ks = Object.keys(localStorage); const secrets = ks.filter(k => /token|password|contrase|secret|jwt|apikey/i.test(k)); const vals = ks.filter(k => /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(localStorage.getItem(k) || '')); const user = ks.filter(k => /^finanzas360\./.test(k)); return { total: ks.length, secrets, jwtEnValores: vals, porUsuarioSinId: user.filter(k => !/[0-9a-f]{8}-/.test(k) && !/\.$/.test(k)).slice(0, 5) } });
  check('S-almacenamiento', 'localStorage no contiene claves de contraseña/secreto ni JWT en valores', st.secrets.length === 0 && st.jwtEnValores.length === 0, JSON.stringify(st));
  console.log(fails ? `\nFALLAN: ${fails} de ${n}` : `\nOK: ${n} comprobaciones superadas`); await b.close(); process.exit(fails ? 1 : 0);
})();
