/* Las 7 pantallas de los cuatro flujos deben verse completas, sin scroll interno.  Uso: W=390 H=844 node tests/pantallas-sin-scroll.js */
const { chromium } = require('playwright');
const open = require('./harness.js');
let bad = 0; const W = +(process.env.W||390), H = +(process.env.H||844); const S = process.argv[2], tag = process.argv[3] || 'a';
const SCH = { id: 'sv-q', name: 'Claro Dominicana', kind: 'formal', active: true, nextDue: '2026-11-30', currency: 'DOP', grossMonthly: 50000, frequency: 'monthly', postingMode: 'manual' };
async function session(b, w, h) {
  const { p } = await open(b, W, H);
  await p.evaluate(s => { const d = window.__T.dbg(); s.accountId = (d.accounts.find(a => a.currency === 'DOP' && a.kind !== 'cash') || d.accounts[0]).id; d.incomeSchedules = [s]; }, SCH);
  const nav = id => p.evaluate(id => { const x = document.createElement('button'); x.dataset.act = 'navigate'; x.dataset.id = id; x.hidden = true; document.body.append(x); x.click(); }, id);
  await nav('income'); await p.waitForTimeout(1300);
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(e => /Ingresos recurrentes/.test(e.textContent) && e.offsetParent); b && b.click(); }); await p.waitForTimeout(1000);
  return p;
}
const click = (p, root, re) => p.evaluate(([root, re]) => { const b = [...document.querySelectorAll(root + ' button')].find(e => new RegExp(re).test(e.textContent) && e.offsetParent); if (b) b.click(); return !!b; }, [root, re]);
const shot = async (p, n) => { await p.waitForTimeout(500); const m = await p.evaluate(() => { const e = document.querySelector('#modal-root .modal'); const r = e.getBoundingClientRect(); const sc = [...e.querySelectorAll('*')].concat(e).filter(x => x.scrollHeight > x.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(x).overflowY)).map(x => x.className.toString().slice(0, 30) + ':' + x.scrollHeight + '/' + x.clientHeight); return { top: Math.round(r.top), h: Math.round(r.height), vh: innerHeight, sc }; }); console.log(n, JSON.stringify(m)); bad += m.sc.length + (m.h > m.vh ? 1 : 0); if (m.sc.length) console.log('✕ scroll en', n); };
(async () => {
  const b = await chromium.launch(); let p;
  p = await session(b, W, H);
  await click(p, '#page', 'Agregar fuente'); await p.waitForTimeout(1000); await shot(p, 'w1');
  await p.fill('#v40IncomeForm [name="name"]', 'Salario mensual'); await p.fill('#v40IncomeForm [name="grossMonthly"]', '50000');
  await p.click('#v40IncomeForm [data-v48-next]'); await shot(p, 'w2');
  await p.click('#v40IncomeForm [data-v48-next]'); await shot(p, 'w3');
  await p.evaluate(()=>{const s=document.querySelector('#v40IncomeForm [name=accountId]');s.value=[...s.options].find(o=>o.value).value;s.dispatchEvent(new Event('change',{bubbles:true}))});await p.click('#v40IncomeForm [data-v48-next]'); await shot(p, 'w4'); await p.close();
  p = await session(b, W, H);
  await click(p, '#page', 'Registrar (cobro|salario)'); await p.waitForTimeout(900); await shot(p, 'c1');
  await p.click('.v901-next'); await shot(p, 'c2'); await p.close();
  p = await session(b, W, H);
  await p.evaluate(() => { const x = document.createElement('button'); x.dataset.act = 'addCategory'; x.hidden = true; document.body.append(x); x.click(); }); await p.waitForTimeout(800);
  await p.evaluate(() => { const g = document.querySelector('#modal-root'); g.querySelector('#v900-name').value = 'Actividades deportivas'; g.querySelector('#v900-sub').value = 'Tenis'; g.querySelector('#v900-sub').dispatchEvent(new Event('input', { bubbles: true })); g.querySelector('#v900-name').dispatchEvent(new Event('input', { bubbles: true })); });
  await shot(p, 'k1'); await p.close();
  await b.close(); console.log(bad ? 'FALLA: ' + bad + ' pantallas con scroll' : 'OK: las 7 pantallas caben completas sin scroll (' + W + 'x' + H + ')'); process.exit(bad ? 1 : 0);
})();
