/* Red team · carga y larga duración. Historial sintético grande, tiempos de render por pantalla, fugas (heap/DOM/listeners) tras cientos de navegaciones.
   Límites de seguridad: máx. N movimientos y duración total acotada; se aborta si una pantalla tarda > 20 s. Uso: N=20000 CICLOS=40 node tests/red-team-carga.js */
const { chromium } = require('playwright');
const open = require('./harness.js');
const N = +(process.env.N || 20000), CICLOS = +(process.env.CICLOS || 40);
let fails = 0, n = 0; const check = (id, name, ok, extra = '') => { n++; if (!ok) fails++; console.log(`${ok ? '✓' : '✕'} ${id} ${name}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`); };
const PAGES = ['overview', 'cards', 'banks', 'accounts', 'register', 'payments', 'income', 'budget', 'recurring', 'personal', 'loans', 'certificates', 'benefits', 'advanced', 'kpis', 'patrimony', 'categories', 'settings'];
(async () => {
  const b = await chromium.launch(); const { p, ctx } = await open(b, 1280, 800); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  const cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable');
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage').catch(() => { }); const m = (await cdp.send('Performance.getMetrics')).metrics; const g = k => m.find(x => x.name === k)?.value; return { heapMB: +(g('JSHeapUsedSize') / 1048576).toFixed(1), nodes: g('Nodes'), listeners: g('JSEventListeners') }; };
  const base = await heap();
  /* L1 · volumen sintético con semilla fija */
  const t0 = Date.now();
  await p.evaluate(N => {
    const d = window.__T.dbg(); let a = 12345; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296 };
    const accs = d.accounts.filter(x => x.kind !== 'cash'); const cats = Object.keys(window.__T.cats('expense'));
    for (let i = 0; i < 40; i++) d.accounts.push({ id: 'ld-acc-' + i, name: 'Cuenta carga ' + i, bankId: d.banks[0]?.id, currency: i % 3 ? 'DOP' : 'USD', kind: 'savings', opening: 1000 + i, openingDate: '2020-01-01', created: '2020-01-01T00:00:00Z' });
    const days = 365 * 6;
    for (let i = 0; i < N; i++) { const dt = new Date(Date.UTC(2021, 0, 1) + Math.floor(r() * days) * 864e5).toISOString().slice(0, 10); const acc = (r() < .8 ? accs : d.accounts)[Math.floor(r() * (r() < .8 ? accs.length : d.accounts.length))] || d.accounts[0]; const inc = r() < .25;
      d.transactions.push({ id: 'ld-' + i, type: inc ? 'income' : 'expense', accountId: acc.id, amount: Math.round(r() * 1e6) / 100, currency: acc.currency, date: dt, created: dt + 'T12:00:00Z', category: inc ? 'Salario y nómina' : cats[i % cats.length], subcategory: '', note: 'carga ' + i, tags: '', reviewed: false }); }
    window.__T.inv?.();
  }, N);
  check('L1', `Se generaron ${N} movimientos y 40 cuentas sintéticos`, true, `${Date.now() - t0} ms`);
  /* L2 · tiempo de render por pantalla con el volumen grande */
  const slow = []; const times = {};
  for (const pg of PAGES) { const t = await p.evaluate(async pg => { const s = performance.now(); try { closeModal() } catch (_) { } window.__T.go(pg); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return performance.now() - s }, pg); times[pg] = Math.round(t); if (t > 3000) slow.push(pg + ':' + Math.round(t)); if (t > 20000) { console.log('ABORTADO por seguridad: pantalla > 20 s'); break } }
  console.log('   render (ms):', JSON.stringify(times));
  check('L2', `Ninguna pantalla tarda más de 3 s en renderizar con ${N} movimientos`, slow.length === 0, slow.join(' '));
  /* L3 · el hilo principal no se bloquea más de 1,5 s seguidos al navegar (tareas largas) */
  const longest = await p.evaluate(async pages => { let worst = 0; const ob = new PerformanceObserver(l => l.getEntries().forEach(e => { worst = Math.max(worst, e.duration) })); try { ob.observe({ entryTypes: ['longtask'] }) } catch (_) { } for (const pg of pages) { window.__T.go(pg); await new Promise(r => setTimeout(r, 250)) } await new Promise(r => setTimeout(r, 300)); return Math.round(worst) }, PAGES.slice(0, 10));
  check('L3', 'Tarea larga máxima del hilo principal ≤ 1,5 s al recorrer 10 pantallas', longest <= 1500, longest + ' ms');
  /* L4 · larga duración: ciclos de navegación + abrir/cerrar modales; la memoria y el DOM no deben crecer sin límite */
  const small = N > 2000; if (small) await p.evaluate(() => { const d = window.__T.dbg(); d.transactions = d.transactions.filter((t, i) => !String(t.id).startsWith('ld-') || i % 20 === 0); d.accounts = d.accounts.filter(a => !String(a.id).startsWith('ld-acc-')); window.__T.inv?.(); });
  const samples = []; const t1 = Date.now();
  for (let c = 0; c < CICLOS; c++) {
    for (const pg of PAGES) { await p.evaluate(async pg => { try { closeModal() } catch (_) { } window.__T.go(pg); const bt = [...document.querySelectorAll('#page button')].find(e => e.offsetParent && /Nuev|Añadir|Agregar|Registrar/i.test(e.textContent)); bt && bt.click(); await new Promise(r => setTimeout(r, 15)); try { closeModal() } catch (_) { } }, pg); }
    if (c === 4 || c % 10 === 9 || c === CICLOS - 1) { samples.push({ ciclo: c + 1, ...(await heap()) }); }
    if (Date.now() - t1 > 420000) { console.log('   (parada por límite de tiempo en el ciclo ' + (c + 1) + ')'); break; }
  }
  console.log('   muestras:', JSON.stringify(samples));
  const s0 = samples[0], sN = samples[samples.length - 1]; const growthNodes = sN.nodes - s0.nodes, growthHeap = sN.heapMB - s0.heapMB, growthL = sN.listeners - s0.listeners;
  check('L4a', `DOM estable tras ${sN.ciclo} ciclos (${PAGES.length} pantallas + modales cada uno): crecimiento de nodos ≤ 10 %`, growthNodes <= s0.nodes * .1, `${s0.nodes}→${sN.nodes}`);
  check('L4b', 'Memoria JS estable: crecimiento del heap ≤ 30 % entre la 5.ª vuelta y la última', growthHeap <= s0.heapMB * .3 + 2, `${s0.heapMB}→${sN.heapMB} MB`);
  check('L4c', 'Listeners de eventos estables (crecimiento ≤ 15 %)', growthL <= s0.listeners * .15 + 20, `${s0.listeners}→${sN.listeners}`);
  check('L5', 'Sin errores de página durante la carga y la larga duración', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(fails ? `\nFALLAN: ${fails} de ${n}` : `\nOK: ${n} comprobaciones superadas`); await b.close(); process.exit(fails ? 1 : 0);
})();
