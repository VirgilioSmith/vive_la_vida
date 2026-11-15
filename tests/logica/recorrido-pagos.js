'use strict';
/* Recorrido: todas las entradas de pago de tarjeta, préstamo y servicio abren el formulario correcto. Uso: W=390|1440 node tests/logica/recorrido-pagos.js */
const {chromium}=require('playwright');const open=require('../harness.js');
const W=+(process.env.W||390);
(async()=>{if(W<500)process.env.TOUCH='1';const b=await chromium.launch();const {p}=await open(b,W,W<500?844:900);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const PAGES=['overview','wallet','cards','payments','pressure','banks','mobilehub','register','subscriptions','loans','accounts','income','expenses'];
let ok=0;const bad=[];const seen=new Set();
for(const pg of PAGES){
 try{await p.evaluate(pg=>window.__T.go(pg),pg);await p.waitForTimeout(450)}catch(e){continue}
 const n=await p.evaluate(()=>document.querySelectorAll('#app [data-act=payCard],#app [data-act=payLoan],#app [data-act=payRecurring]').length);
 for(let i=0;i<n;i++){
  const meta=await p.evaluate(i=>{const e=document.querySelectorAll('#app [data-act=payCard],#app [data-act=payLoan],#app [data-act=payRecurring]')[i];return e?{act:e.dataset.act,id:e.dataset.id,ccy:e.dataset.ccy||'',txt:e.textContent.replace(/\s+/g,' ').trim().slice(0,28)}:null},i);
  if(!meta)continue;const key=pg+'|'+meta.act+'|'+meta.id+'|'+meta.ccy;if(seen.has(key))continue;seen.add(key);
  await p.evaluate(()=>{document.getElementById('modal-root').innerHTML=''});
  await p.evaluate(i=>{document.querySelectorAll('#app [data-act=payCard],#app [data-act=payLoan],#app [data-act=payRecurring]')[i].click()},i);await p.waitForTimeout(700);
  const r=await p.evaluate(([m])=>{const f=document.querySelector('#modal-root form');if(!f)return {err:'no abrió formulario'};const el=f.elements,T=window.__T;const o={form:f.id,flow:el.flowMode?.value||'',type:el.type?.value||''};
   if(m.act==='payCard'){o.cardId=el.cardId?.value;o.ccy=el.currency?.value;o.amount=el.amount?.value;o.mode=el.cardPaymentMode?.value;const st=T.cs(m.id,o.ccy);o.esperado=(o.mode==='cut'?Math.min(st.billed,st.debt):o.mode==='total'?st.debt:null);}
   if(m.act==='payLoan'){o.loanId=el.loanId?.value;o.amount=el.amount?.value}
   if(m.act==='payRecurring'){o.txt=(document.querySelector('#modal-root')?.innerText||'').replace(/\s+/g,' ').slice(0,60)}
   return o},[meta]);
  let good=!r.err;
  if(meta.act==='payCard')good=good&&r.cardId===meta.id&&(r.mode==='custom'||Math.abs(+r.amount-(r.esperado??+r.amount))<.011);
  if(meta.act==='payLoan')good=good&&r.loanId===meta.id;
  (good?ok++:bad.push(pg+' '+JSON.stringify(meta)+' => '+JSON.stringify(r)));
 }
}
console.log(`${W}px: ${ok} entradas correctas, ${bad.length} con problema, ${seen.size} únicas`);bad.forEach(x=>console.log(' -',x.slice(0,330)));console.log('errores JS:',errs.length,errs.slice(0,3));await b.close()})();
