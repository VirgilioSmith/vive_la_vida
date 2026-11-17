/* Core Web Vitals en la app con datos de demostración: LCP, CLS, tareas largas (TBT aprox.), INP (navegación por pestañas) y memoria.
   Uso: [ROOT=/otra/copia] node tests/rendimiento-web-vitals.js   Objetivos: LCP ≤ 2500 ms · INP ≤ 200 ms · CLS ≤ 0,1 */
const { chromium } = require('playwright');
const open = require('./harness.js');
const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
(async () => {
  const b = await chromium.launch(); const runs = [];
  for (const [w, h, lab] of [[390, 844, 'móvil'], [1440, 900, 'escritorio']]) {
    const res = [];
    for (let i = 0; i < 3; i++) {
      const { p } = await open(b, w, h);
      await p.evaluate(() => { window.__m = { lt: 0, inp: [], ls: 0 }; new PerformanceObserver(l => l.getEntries().forEach(e => { window.__m.lt += Math.max(0, e.duration - 50); })).observe({ type: 'longtask', buffered: true }); new PerformanceObserver(l => l.getEntries().forEach(e => { if (e.interactionId) window.__m.inp.push(e.duration); })).observe({ type: 'event', durationThreshold: 16, buffered: true }); });
      const pages = ['overview', 'register', 'income', 'wallet', 'transactions', 'budget', 'annual', 'settings'];
      for (const pg of pages) { await p.evaluate(pg => window.__T.go(pg), pg); await p.waitForTimeout(350); }
      // interacciones reales: clic en pestañas y filtros
      for (const sel of ['.nav-item,[data-act="navigate"]']) { const els = await p.$$(sel); for (const e of els.slice(0, 6)) { try { await e.click({ timeout: 800 }); await p.waitForTimeout(250); } catch (_) {} } }
      const m = await p.evaluate(() => new Promise(r => { let lcp = 0, cls = 0; new PerformanceObserver(l => l.getEntries().forEach(e => { lcp = e.startTime; })).observe({ type: 'largest-contentful-paint', buffered: true }); new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) cls += e.value; })).observe({ type: 'layout-shift', buffered: true }); setTimeout(() => r({ lcp, cls, tbt: window.__m.lt, inp: window.__m.inp.length ? window.__m.inp.slice().sort((a, b) => b - a)[Math.min(window.__m.inp.length - 1, Math.floor(window.__m.inp.length / 50))] : 0, heap: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0, nodes: document.getElementsByTagName('*').length, ls: window.__m.ls }), 150); }));
      res.push(m); await p.close();
    }
    runs.push({ vista: lab, lcp: Math.round(med(res.map(r => r.lcp))), cls: +med(res.map(r => r.cls)).toFixed(3), tbt: Math.round(med(res.map(r => r.tbt))), inp: Math.round(med(res.map(r => r.inp))), heapMB: +med(res.map(r => r.heap)).toFixed(1), nodos: med(res.map(r => r.nodes)) });
  }
  await b.close(); runs.forEach(r => console.log(JSON.stringify(r)));
})();
