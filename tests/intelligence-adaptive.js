/* VIVE Intelligence — descubrimiento adaptativo en la app real (Playwright): libro mayor, silencio, retroalimentación, memoria, Centro Estratégico. */
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
  const {p,ctx}=await open(b,vw,vh);p.on('pageerror',e=>errs.push(e.message));let sup=0;p.on('request',q=>{if(/supabase\.co/.test(q.url()))sup++});
  await p.evaluate(g=>window.__T.go(g),'overview');await p.waitForTimeout(1500);
  const n=await p.evaluate(SEED);
  /* --- libro mayor normalizado --- */
  const led=await p.evaluate(()=>{const s=window.__viveIntel.snapshot();const L=s.ledger;return {n:L.length,kinds:[...new Set(L.map(e=>e.k))],noTransfers:!L.some(e=>/Transfer|Pago/.test(e.l||'')),exp:Math.round(L.filter(e=>e.k==='x').reduce((a,e)=>a+e.a,0)),txExp:Math.round(db.transactions.filter(t=>t.type==='expense'||t.type==='card_charge').reduce((a,t)=>a+t.amount,0)),cardPay:db.transactions.filter(t=>t.type==='card_payment').length,trf:db.transactions.filter(t=>t.type==='transfer').length}});
  check(`[${name}] libro mayor: gasto = gastos + compras con tarjeta (los pagos de tarjeta y transferencias no se cuentan)`,led.exp===led.txExp&&led.cardPay>0&&led.trf>0,led);
  /* --- silencio: primera evaluación no comunica; con una evaluación previa en otro día sí --- */
  const first=await p.evaluate(()=>{const d=window.__viveIntel.discover();return {vis:d.discoveries.map(h=>h.key),internal:d.internal.map(h=>h.key),ms:d.audit.ms,maturity:d.features.profile.maturity,runs:d.audit.engines.length}});
  check(`[${name}] primera evaluación: el patrón semanal queda en observación (inteligencia silenciosa)`,!first.vis.includes('pat.weekday.5')&&first.internal.includes('pat.weekday.5'),first);
  check(`[${name}] madurez objetiva por días de historial (${first.maturity})`,first.maturity==='consolidado'||first.maturity==='básico'||first.maturity==='amplio');
  check(`[${name}] cálculo de características + 8 motores en < 300 ms (${first.ms} ms)`,first.ms<300,first.ms);
  await p.evaluate(()=>{const d=window.__viveIntel.discover();const m=JSON.parse(JSON.stringify(d.mem));const y=new Date(today()+'T00:00:00Z');y.setUTCDate(y.getUTCDate()-1);const yd=y.toISOString().slice(0,10);for(const k of Object.keys(m.hyp))m.hyp[k].seen=[yd];db.settings.intelligenceMem=m;window.__viveIntel.invalidate()});
  const second=await p.evaluate(()=>{const d=window.__viveIntel.discover();return {vis:d.discoveries.map(h=>({k:h.key,kicker:h.kicker,state:h.state,eng:h.engine}))}});
  check(`[${name}] segunda evaluación en otro día: el patrón se comunica con su mensaje de entrada`,second.vis.some(h=>h.k==='pat.weekday.5'&&h.kicker==='Patrón descubierto'),second);
  /* --- interfaz: descubrimiento + «¿Cómo llegamos a esta conclusión?» --- */
  await p.evaluate(g=>window.__T.go(g),'register');await p.waitForTimeout(800);
  await p.evaluate(g=>window.__T.go(g),'overview');await p.waitForTimeout(700);await p.click('.vi-strip');await p.waitForTimeout(600);
  const ui=await p.evaluate(()=>({disc:document.querySelectorAll('.vi-disc').length,how:!!document.querySelector('.vi-disc .vi-how summary'),know:!!document.querySelector('.vi-know summary'),fits:(()=>{const s=document.querySelector('.vi-sheet').getBoundingClientRect();return s.bottom<=innerHeight+1})(),hOver:document.querySelector('.vi-sheet').scrollWidth>document.querySelector('.vi-sheet').clientWidth+1}));
  check(`[${name}] la hoja muestra solo descubrimientos y su explicación: sin centro de conocimiento, configuración ni métricas`,ui.disc>=1&&ui.how&&!ui.know&&ui.fits&&!ui.hOver,ui);
  await p.evaluate(()=>document.querySelector('.vi-disc .vi-how summary').click());
  const how=await p.evaluate(()=>document.querySelector('.vi-disc .vi-how-body').innerText);
  check(`[${name}] la explicación responde qué, por qué, con qué datos, incertidumbre y alternativas`,/¿Qué detectamos\?/i.test(how)&&/Evidencia/i.test(how)&&/Metodología/i.test(how)&&/Incertidumbre/i.test(how)&&/Alternativas/i.test(how)&&/no es una probabilidad/.test(how),how.slice(0,200));
  /* --- retroalimentación con efectos verificables --- */
  const key=await p.evaluate(()=>document.querySelector('.vi-disc').dataset.viDkey);
  const w0=await p.evaluate(()=>JSON.stringify(window.__viveIntel.memory().w));
  await p.evaluate(()=>{const c=document.querySelector('.vi-disc');c.querySelector('.vi-opts summary').click();c.querySelector('[data-a="correct"]').click()});await p.waitForTimeout(500);
  const mem1=await p.evaluate(k=>{const m=window.__viveIntel.memory();return {know:!!m.know[k],w:m.w,fb:m.fb.length,stored:!!db.settings.intelligenceMem}},key);
  check(`[${name}] «Esto es correcto» consolida el patrón en la memoria y sube el peso del motor`,mem1.know&&(mem1.w.pattern||1)>1&&mem1.fb>=1&&mem1.stored,mem1);
  await p.evaluate(()=>{const c=document.querySelector('.vi-disc');c.querySelector('.vi-opts summary').click();c.querySelector('[data-a="not_interested"]').click()});await p.waitForTimeout(500);
  const gone=await p.evaluate(k=>!document.querySelector(`.vi-disc[data-vi-dkey="${k}"]`),key);
  check(`[${name}] «No me interesa» retira el descubrimiento y queda registrado`,gone&&await p.evaluate(k=>!!window.__viveIntel.memory().exc[k],key));
  /* --- la vista es solo lectura de descubrimientos: nada de configuración ni parámetros --- */
  const vis=await p.evaluate(()=>{const s=document.querySelector('.vi-sheet');return {txt:s.innerText,controls:s.querySelectorAll('input[type=checkbox],.vi-know,.vi-foot,.vi-meta,[data-vi=life],[data-vi=doff],[data-vi=dsim],[data-vi=sfut]').length}});
  check(`[${name}] la hoja no muestra madurez, fuentes, hipótesis, interruptores, simulaciones ni estadísticas técnicas`,vis.controls===0&&!/Madurez|Fuentes autorizadas|reglas ·|Lecturas de estilo de vida|Aprendizaje por categoría|Lo que Vive sabe/i.test(vis.txt),vis);
  /* --- la memoria sigue siendo consultable, corregible, exportable y simulable por API (uso interno / mantenimiento) --- */
  const keyDel=await p.evaluate(()=>{const m=window.__viveIntel.memory();return Object.keys(m.hyp)[0]});
  await p.evaluate(k=>window.__viveIntel.memOp('forget',k),keyDel);
  check(`[${name}] se puede eliminar un conocimiento específico (API interna)`,await p.evaluate(k=>!window.__viveIntel.memory().hyp[k],keyDel));
  check(`[${name}] se puede exportar el conocimiento (JSON válido)`,await p.evaluate(()=>{try{const j=JSON.parse(window.__viveIntel.memOp('export'));return !!j.memory&&j.version}catch(e){return false}}));
  const sim=await p.evaluate(()=>window.__viveIntel.simulate({expensePct:10}));
  check(`[${name}] simulación (API): escenarios conservador / central / favorable con supuestos`,sim.ok&&sim.assumptions.length>0&&sim.conservative<=sim.central&&sim.central<=sim.favorable,sim);
  /* --- aprendizaje por categoría desactivable --- */
  await p.evaluate(()=>{window.__viveIntel.memOp('setOff',{k:'spending',v:true})});
  check(`[${name}] aprendizaje desactivado por categoría: sin descubrimientos de gasto`,await p.evaluate(()=>!window.__viveIntel.discover().discoveries.some(h=>h.category==='spending')));
  await p.evaluate(()=>{window.__viveIntel.memOp('setOff',{k:'spending',v:false})});
  /* --- Centro Estratégico recibe solo hallazgos seleccionados --- */
  await p.keyboard.press('Escape');
  const mo=await p.evaluate(()=>{window.__viveIntel.discover();const s=window.ViveMomentosHost.snapshot();return {n:(s.discoveries||[]).length,k:(s.discoveries||[]).map(d=>d.kicker)}});
  check(`[${name}] el Centro Estratégico recibe como máximo 2 hallazgos seleccionados con su mensaje breve`,mo.n<=2,mo);
  /* --- una escritura de memoria al día como máximo; cero consultas a Supabase --- */
  const wr=await p.evaluate(async()=>{let c=0;const st=db.settings;let v=st.intelligenceMem;Object.defineProperty(st,'intelligenceMem',{configurable:true,get(){return v},set(x){c++;v=x}});for(let i=0;i<8;i++){window.__viveIntel.invalidate();window.__T.go(i%2?'register':'overview');await new Promise(r=>setTimeout(r,250))}await new Promise(r=>setTimeout(r,800));return c});
  check(`[${name}] 8 navegaciones/renders generan ≤ 1 escritura de memoria (hubo ${wr})`,wr<=1,wr);
  check(`[${name}] cero peticiones a Supabase por Intelligence`,sup===0,sup);
  await ctx.close();}
 /* ---------- Temas ---------- */
 for(const th of ['light','black']){process.env.THEME=th;process.env.TOUCH='1';const {p,ctx}=await open(b,390,844);p.on('pageerror',e=>errs.push(e.message));
  await p.evaluate(g=>window.__T.go(g),'overview');await p.waitForTimeout(1200);await p.evaluate(SEED);
  await p.evaluate(()=>{const d=window.__viveIntel.discover();const m=JSON.parse(JSON.stringify(d.mem));const y=new Date(today()+'T00:00:00Z');y.setUTCDate(y.getUTCDate()-1);const yd=y.toISOString().slice(0,10);for(const k of Object.keys(m.hyp))m.hyp[k].seen=[yd];db.settings.intelligenceMem=m;window.__viveIntel.invalidate()});
  await p.evaluate(g=>window.__T.go(g),'register');await p.waitForTimeout(500);await p.evaluate(g=>window.__T.go(g),'overview');await p.waitForTimeout(700);
  await p.click('.vi-strip');await p.waitForTimeout(500);await p.evaluate(()=>{const h=document.querySelector('.vi-how');h&&(h.open=true)});
  const ok2=await p.evaluate(()=>{const s=document.querySelector('.vi-sheet');return s&&s.scrollWidth<=s.clientWidth+1});
  check(`[${th}] hoja con descubrimiento y explicación sin desbordes`,ok2);
  await p.screenshot({path:`/tmp/intel2_${th}.png`});await ctx.close();}
 check('sin errores de JavaScript',errs.length===0,errs.slice(0,3));
 await b.close();console.log(`\nINTELLIGENCE ADAPTIVE: ${ok} verificaciones aprobadas${bad?', '+bad+' FALLAN':''}`);process.exit(bad?1:0);
})();
