/* VIVE Intelligence — revisión estratégica en la app real (Playwright). */
const {chromium}=require('playwright');const open=require('./harness.js');
let ok=0,bad=0;const check=(n,c,x)=>{if(c){ok++;console.log('✓',n)}else{bad++;console.log('✗ FAIL',n,x===undefined?'':JSON.stringify(x).slice(0,400))}};
const SEED=`
 (()=>{const t=today();const add=(d,n)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
  let a=12345;const R=()=>{a|=0;a=a+0x6D2B79F5|0;let q=Math.imul(a^a>>>15,1|a);q=q+Math.imul(q^q>>>7,61|q)^q;return((q^q>>>14)>>>0)/4294967296};
  const acc=db.accounts.find(x=>x.currency==='DOP'),card=db.cards[0],id=()=>Math.random().toString(36).slice(2);
  db.transactions=[];const start=add(t,-300);
  for(let i=0;i<300;i++){const d=add(start,i),w=new Date(d+'T00:00:00Z').getUTCDay();
   if(R()<.7){const n=1+Math.floor(R()*2);for(let k=0;k<n;k++){const m=w===5?3.4:1;const am=Math.round(1500*m*Math.exp((R()-.5)*1.2));const useCard=R()<.4;db.transactions.push(useCard?{id:id(),type:'card_charge',date:d,amount:am,currency:'DOP',cardId:card.id,category:'Alimentación',note:'Compra '+Math.floor(R()*4),reviewed:true}:{id:id(),type:'expense',date:d,amount:am,currency:'DOP',accountId:acc.id,category:'Alimentación',note:'Compra '+Math.floor(R()*4),reviewed:true})}}
   if(i%14===0)db.transactions.push({id:id(),type:'income',date:d,amount:60000,currency:'DOP',accountId:acc.id,category:'Salario',note:'Nómina',reviewed:true});
   if(i%30===5)db.transactions.push({id:id(),type:'card_payment',date:d,amount:25000,currency:'DOP',cardId:card.id,accountId:acc.id,reviewed:true});
   if(i%45===9)db.transactions.push({id:id(),type:'transfer',date:d,amount:10000,currency:'DOP',accountId:acc.id,toAccountId:(db.accounts.find(x=>x.id!==acc.id)||acc).id,targetAmount:10000,reviewed:true});}
  window.__viveIntel.invalidate();return db.transactions.length})()`;
(async()=>{
 const b=await chromium.launch();const errs=[];
 for(const [name,vw,vh,touch] of [['móvil',390,844,'1'],['PC',1280,860,'']]){
  if(touch)process.env.TOUCH='1';else delete process.env.TOUCH;
  const {p}=await open(b,vw,vh);p.on('pageerror',e=>errs.push(e.message));let sup=0;p.on('request',q=>{if(/supabase\.co/.test(q.url())&&!/rpc|rest\/v1\/(profiles|finance)/.test(q.url()))sup++});
  await p.evaluate(g=>window.__T.go(g),'overview');await p.waitForTimeout(1500);await p.evaluate(SEED);
  const d=await p.evaluate(()=>{const r=window.__viveIntel.discover();return {s:!!r.strategy,ms:r.audit.ms,eng:r.audit.engines.map(e=>e.id+(e.error?':ERR '+e.error:'')),lm:r.strategy&&r.strategy.lifeModel.items.length}});
  check(`[${name}] la app ejecuta 9 motores y la revisión estratégica sin errores (${d.ms} ms)`,d.s&&d.lm===4&&d.eng.length>=9&&!d.eng.some(e=>/ERR/.test(e))&&d.ms<400,d);
  await p.evaluate(g=>window.__T.go(g),'register');await p.waitForTimeout(600);await p.evaluate(g=>window.__T.go(g),'overview');await p.waitForTimeout(800);
  await p.click('.vi-strip');await p.waitForTimeout(600);
  const ui=await p.evaluate(()=>{const k=document.querySelector('.vi-know');if(k)k.open=true;return {know:!!k,strat:!!document.querySelector('.vi-know-body')&&/Revisión estratégica/i.test(document.querySelector(".vi-know-body").innerText),btn:!!document.querySelector('[data-vi="sfut"]')}});
  check(`[${name}] el centro de conocimiento muestra la revisión estratégica`,ui.know&&ui.strat&&ui.btn,ui);
  await p.evaluate(()=>document.querySelector('[data-vi="sfut"]').click());await p.waitForTimeout(500);
  const fut=await p.evaluate(()=>({rows:document.querySelectorAll('.vi-strat .vi-fut').length,txt:document.querySelector('.vi-strat').innerText.slice(0,200)}));
  check(`[${name}] «Cinco futuros posibles» muestra 5 futuros con supuestos`,fut.rows===5,fut);
  await p.evaluate(()=>document.querySelector('[data-vi="slab"]').click());await p.waitForTimeout(400);
  check(`[${name}] laboratorio de decisiones: 5 alternativas`,await p.evaluate(()=>document.querySelectorAll('.vi-strat details').length===5));
  await p.evaluate(()=>document.querySelector('[data-vi="schain"]').click());await p.waitForTimeout(400);
  check(`[${name}] consecuencias de 1.º a 4.º orden`,await p.evaluate(()=>/Primer orden/.test(document.querySelector('.vi-strat').innerText)&&/Cuarto orden/.test(document.querySelector('.vi-strat').innerText)));
  const tech=await p.evaluate(()=>document.querySelector('.vi-sheet').textContent);
  check(`[${name}] la hoja no expone nombres de algoritmos, motores ni paneles técnicos`,!/Isolation|CUSUM|Mann|Spearman|bootstrap|Monte Carlo|Benjamini|Theil|Diagnóstico técnico|campeón|Champion|hiperpar/i.test(tech),(tech.match(/Isolation|CUSUM|Mann|Spearman|bootstrap|Monte Carlo|Benjamini|Theil|Diagnóstico técnico|campeón|Champion/i)||[])[0]);
  check(`[${name}] no hay preguntas proactivas ni botones de cuestionario`,await p.evaluate(()=>!document.querySelector('[data-vi="sans"]')&&!document.querySelector('[data-vi="sdone"]')));
  check(`[${name}] como máximo una pregunta contextual en pantalla`,await p.evaluate(()=>document.querySelectorAll('.vi-ask').length<=1));
  check(`[${name}] el panel de auditoría existe solo como API interna`,await p.evaluate(()=>{const a=window.__viveIntel.audit();return a&&a.audit&&a.audit.engines.length>=9}));
  const fit=await p.evaluate(()=>{const s=document.querySelector('.vi-sheet');return !s||s.scrollWidth<=s.clientWidth+1});
  check(`[${name}] sin desbordes horizontales`,fit);
  check(`[${name}] sin consultas a Supabase por el análisis estratégico`,sup===0,sup);
 }
 check('sin errores de página',errs.length===0,errs);
 console.log(`\nINTELLIGENCE STRATEGY UI: ${ok} verificaciones aprobadas${bad?`, ${bad} FALLARON`:''}`);await b.close();process.exit(bad?1:0);
})();
