/* VIVE Intelligence — integración (Playwright): normalización real, interfaz, aprendizaje, red y rendimiento. */
const {chromium}=require('playwright');const open=require('./harness.js');
let ok=0,bad=0;const check=(n,c,x)=>{if(c){ok++;console.log('✓',n)}else{bad++;console.log('✗ FAIL',n,x===undefined?'':JSON.stringify(x).slice(0,300))}};
(async()=>{
 const b=await chromium.launch();const errs=[];
 /* ---------- A · Normalización financiera con las funciones reales de la app ---------- */
 {process.env.TOUCH='1';const {p,ctx}=await open(b,390,844);p.on('pageerror',e=>errs.push(e.message));
  const r=await p.evaluate(()=>{
   const t=today(),[Y,M]=t.slice(0,7).split('-').map(Number),d=new Date(Y,M-2,10),k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),day=k+'-10';
   db.settings.fx=60;
   const acc=db.accounts.find(a=>a.currency==='DOP'),acc2=db.accounts.find(a=>a.id!==acc.id&&a.currency==='DOP')||db.accounts[1],card=db.cards[0];
   db.transactions=db.transactions.filter(x=>!String(x.date).startsWith(k));
   const id=()=>Math.random().toString(36).slice(2);
   db.transactions.push(
    {id:id(),type:'income',date:day,amount:100000,currency:'DOP',accountId:acc.id,category:'Salario',reviewed:true},
    {id:id(),type:'expense',date:day,amount:10000,currency:'DOP',accountId:acc.id,category:'Alimentación',reviewed:true},
    {id:id(),type:'card_charge',date:day,amount:20000,currency:'DOP',cardId:card.id,category:'Compras',reviewed:true},
    {id:id(),type:'card_payment',date:day,amount:20000,currency:'DOP',cardId:card.id,accountId:acc.id,reviewed:true},
    {id:id(),type:'transfer',date:day,amount:5000,currency:'DOP',accountId:acc.id,toAccountId:acc2.id,targetAmount:5000,reviewed:true},
    {id:id(),type:'card_refund',date:day,amount:2000,currency:'DOP',cardId:card.id,category:'Compras',reviewed:true},
    {id:id(),type:'expense',date:day,amount:100,currency:'USD',accountId:(db.accounts.find(a=>a.currency==='USD')||acc).id,category:'Tecnología',fxRateSnapshot:60,reviewed:true});
   window.persist&&0;
   window.__viveIntel.invalidate();
   const s=window.__viveIntel.snapshot();const m=s.months.find(x=>x.ym===k);
   return {k,income:m.income,expense:m.expense,expenseBy:m.expenseBy,partial:m.partial,txCount:m.txCount};
  });
  check('ingresos del mes = 100.000 (solo el salario)',r.income===100000,r);
  check('gastos = 10.000 + 20.000 (compra con tarjeta) − 2.000 (devolución) + US$100×60 = 34.000',Math.round(r.expense)===34000,r);
  check('el pago de tarjeta (20.000) no se cuenta como gasto (sin doble contabilización)',Math.round(r.expense)<54000,r);
  check('la transferencia entre cuentas propias no es gasto ni ingreso',r.income===100000&&Math.round(r.expense)===34000);
  check('el mes consultado es completo (no parcial)',r.partial===false,r);
  await ctx.close();}
 /* ---------- B · Interfaz móvil y PC ---------- */
 for(const [name,vw,vh,touch] of [['móvil',390,844,'1'],['PC',1280,860,'']]){
  if(touch)process.env.TOUCH='1';else delete process.env.TOUCH;
  const {p,ctx}=await open(b,vw,vh);p.on('pageerror',e=>errs.push(e.message));let sup=0;p.on('request',q=>{if(/supabase\.co/.test(q.url()))sup++});
  const pages=[['overview','Inicio'],['register','Movimientos'],['wallet','Tarjetas'],['loans','Préstamos'],['recurring','Suscripciones'],['banks','Bancos'],['patrimony','Patrimonio']];
  const seen={};
  for(const [pg,lab] of pages){await p.evaluate(g=>window.__T.go(g),pg);await p.waitForTimeout(900);const st=await p.evaluate(()=>{const s=document.querySelector('.vi-strip');if(!s)return null;const r=s.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),inView:r.right<=innerWidth+1&&r.left>=-1,txt:s.innerText.slice(0,60)}});seen[pg]=st;
   check(`[${name}] franja de Intelligence en ${lab} (si hay algo propio de la página: visible, dentro de pantalla, ≤ 70 px; si no, silencio)`,['Bancos','Patrimonio'].includes(lab)?(!st||(st.inView&&st.h<=70)):(!!st&&st.inView&&st.h<=70),st);}
  await p.evaluate(g=>window.__T.go(g),'overview');await p.waitForTimeout(900);
  check(`[${name}] sin desbordamiento horizontal`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  // hoja
  await p.evaluate(g=>window.__T.go(g),'overview');await p.waitForTimeout(700);
  await p.click('.vi-strip');await p.waitForTimeout(500);
  const sh=await p.evaluate(()=>{const s=document.querySelector('.vi-sheet');if(!s)return null;const r=s.getBoundingClientRect();return {cards:document.querySelectorAll('.vi-card').length,groups:[...document.querySelectorAll('.vi-group h3')].map(h=>h.childNodes[0].textContent),h:Math.round(r.height),fits:r.bottom<=innerHeight+1&&r.top>=-1,back:!!document.querySelector('.vi-back'),closeX:document.querySelectorAll('.vi-sheet .close').length,meta:document.querySelector('.vi-meta')?.innerText}});
  check(`[${name}] la hoja abre con hallazgos agrupados por prioridad`,!!sh&&sh.cards>=3&&sh.groups[0]==='Crítico',sh);
  check(`[${name}] la hoja cabe en pantalla y tiene flecha atrás (sin ×)`,!!sh&&sh.fits&&sh.back&&sh.closeX===0,sh);
  check(`[${name}] la hoja no muestra pie técnico (reglas, milisegundos, interruptores)`,!!sh&&!sh.meta,sh&&sh.meta);
  // por qué
  await p.click('.vi-card .vi-opts summary');await p.click('.vi-card [data-vi="why"]');
  check(`[${name}] «¿Por qué estoy viendo esto?» muestra evidencia`,await p.evaluate(()=>{const w=document.querySelector('.vi-card .vi-why');return w&&!w.hidden&&/Evidencia/.test(w.innerText)}));
  // acción → navegación real
  const target=await p.evaluate(()=>document.querySelector('.vi-card .vi-act')?.dataset.target);
  await p.click('.vi-card .vi-act');await p.waitForTimeout(700);
  const after=await p.evaluate(()=>({page:window.__viveIntel.page(),sheet:!!document.querySelector('.vi-sheet')}));
  check(`[${name}] la acción sugerida navega con el sistema real (${target})`,!after.sheet&&!!target,{target,after});
  // aprendizaje: «No me interesa» sobre un hallazgo no esencial lo oculta; sobre uno esencial no
  await p.evaluate(g=>window.__T.go(g),'overview');await p.waitForTimeout(700);await p.click('.vi-strip');await p.waitForTimeout(400);
  const before=await p.evaluate(()=>[...document.querySelectorAll('.vi-card')].map(c=>({k:c.dataset.viKey,ess:c.classList.contains('vi-p-critical')})));
  const nonEss=await p.evaluate(()=>{const c=[...document.querySelectorAll('.vi-card')].find(c=>!c.classList.contains('vi-p-critical')&&!c.classList.contains('vi-p-attention'));return c&&c.dataset.viKey});
  if(nonEss){await p.evaluate(k=>{const c=document.querySelector(`.vi-card[data-vi-key="${k}"]`);c.querySelector('summary').click();c.querySelector('[data-a="not_interested"]').click()},nonEss);await p.waitForTimeout(500);
   check(`[${name}] «No me interesa» oculta el hallazgo no esencial`,await p.evaluate(k=>!document.querySelector(`.vi-card[data-vi-key="${k}"]`),nonEss));}
  const crit=await p.evaluate(()=>document.querySelector('.vi-card.vi-p-critical')?.dataset.viKey);
  if(crit){await p.evaluate(k=>{const c=document.querySelector(`.vi-card[data-vi-key="${k}"]`);c.querySelector('summary').click();c.querySelector('[data-a="not_interested"]').click()},crit);await p.waitForTimeout(500);
   check(`[${name}] «No me interesa» NO oculta un compromiso crítico`,await p.evaluate(k=>!!document.querySelector(`.vi-card[data-vi-key="${k}"]`),crit));}
  check(`[${name}] el aprendizaje queda en db.settings.intelligence (compacto)`,await p.evaluate(()=>{const s=db.settings.intelligence;return !!s&&JSON.stringify(s).length<2048}));
  await p.keyboard.press('Escape');await p.waitForTimeout(200);
  check(`[${name}] Escape cierra la hoja`,await p.evaluate(()=>!document.querySelector('.vi-sheet')));
  // red
  check(`[${name}] abrir, evaluar y navegar no generó peticiones a Supabase`,sup===0,sup);
  // caché y rendimiento
  const perf=await p.evaluate(()=>{const a=window.__viveIntel.run();const t=performance.now();const b=window.__viveIntel.run();const hit=performance.now()-t;const rev0=window.__viveIntelRev;window.__viveIntel.invalidate();const c=window.__viveIntel.run();return {first:a.meta.ms,cacheHit:a===b,hitMs:+hit.toFixed(3),invalidated:c!==a,revBumped:window.__viveIntelRev>rev0}});
  check(`[${name}] caché: segunda llamada instantánea y misma referencia`,perf.cacheHit&&perf.hitMs<1,perf);
  check(`[${name}] invalidación por eventos (v99Invalidate) recalcula`,perf.invalidated&&perf.revBumped,perf);
  check(`[${name}] primer cálculo < 60 ms`,perf.first<60,perf);
  await ctx.close();}
 /* ---------- C · Temas y acentos ---------- */
 for(const th of ['light','black']){process.env.THEME=th;process.env.TOUCH='1';const {p,ctx}=await open(b,390,844);p.on('pageerror',e=>errs.push(e.message));
  await p.evaluate(g=>window.__T.go(g),'overview');await p.waitForTimeout(900);
  for(const accent of ['#6d69f1','#0f9f8f','#e0527a','#d98a1c']){await p.evaluate(a=>{document.documentElement.style.setProperty('--vg-accent',a)},accent);
   const m=await p.evaluate(()=>{const s=document.querySelector('.vi-strip');if(!s)return null;const c=getComputedStyle(s),t=s.querySelector('strong'),tc=getComputedStyle(t).color;const rgb=x=>x.match(/\d+(\.\d+)?/g).slice(0,3).map(Number);const L=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};const lum=a=>.2126*L(a[0])+.7152*L(a[1])+.0722*L(a[2]);const bg=getComputedStyle(document.body).backgroundColor;const fg=rgb(tc),bgc=rgb(bg);const r=(Math.max(lum(fg),lum(bgc))+.05)/(Math.min(lum(fg),lum(bgc))+.05);return {ratio:+r.toFixed(1)}});
   check(`[${th}] ${accent}: texto de la franja legible (contraste ≥ 4,5 sobre el fondo)`,!!m&&m.ratio>=4.5,m);}
  await p.click('.vi-strip');await p.waitForTimeout(400);
  check(`[${th}] la hoja es legible y no desborda`,await p.evaluate(()=>{const s=document.querySelector('.vi-sheet');return !!s&&s.scrollWidth<=s.clientWidth+1}));
  await p.screenshot({path:`/tmp/intel_${th}.png`});await ctx.close();}
 check('sin errores de JavaScript',errs.length===0,errs.slice(0,3));
 await b.close();console.log(`\nINTELLIGENCE: ${ok} verificaciones aprobadas${bad?', '+bad+' FALLAN':''}`);process.exit(bad?1:0);
})();
