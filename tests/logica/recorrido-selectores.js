'use strict';
/* Recorrido: beneficios y abono a préstamo abren el formulario de la tarjeta o préstamo elegido. Uso: W=390|1440 node tests/logica/recorrido-selectores.js */
const {chromium}=require('playwright');const open=require('../harness.js');
const W=+(process.env.W||390);
(async()=>{if(W<500)process.env.TOUCH='1';const b=await chromium.launch();const {p}=await open(b,W,W<500?844:900);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const data=await p.evaluate(()=>({cards:window.__T.dbg().cards.map(c=>c.id),loans:window.__T.dbg().loans.map(l=>l.id)}));
const go=async(txt)=>{await p.evaluate(()=>window.__T.go('overview'));await p.waitForTimeout(300);await p.evaluate(()=>{document.getElementById('modal-root').innerHTML='';document.querySelector('#app [data-act=newTransaction]')?.click()});await p.waitForTimeout(600);await p.evaluate(()=>document.querySelector('#modal-root [data-act=registrationGroup][data-id="other"]')?.click());await p.waitForTimeout(300);await p.evaluate(t=>[...document.querySelectorAll('#modal-root button[data-act]')].find(e=>e.textContent.includes(t))?.click(),txt);await p.waitForTimeout(800)};
const out=[];
for(const [txt,ids,kind] of [['Beneficios bancarios',data.cards,'card'],['Abonar a un préstamo',data.loans,'loan']]){
 await go(txt);
 const items=await p.evaluate(()=>[...document.querySelectorAll('.v827-picker-sheet .v789-picker-row')].map((e,i)=>({i,t:e.textContent.replace(/\s+/g,' ').slice(0,30)})));
 out.push(`${txt}: ${items.length} opciones en la lista → ${items.map(i=>i.t).join(' | ')}`);
 for(const it of items){
  await go(txt);
  await p.evaluate(i=>document.querySelectorAll('.v827-picker-sheet .v789-picker-row')[i]?.click(),it.i);await p.waitForTimeout(400);
  await p.evaluate(()=>document.querySelector('.v789-picker-confirm')?.click());await p.waitForTimeout(1000);
  const r=await p.evaluate(()=>{const f=document.querySelector('#modal-root form');return f?{id:f.id,cardId:f.elements.cardId?.value,loanId:f.elements.loanId?.value,type:f.elements.type?.value}:{err:'sin formulario',txt:document.getElementById('modal-root').innerText.replace(/\s+/g,' ').slice(0,80)}});
  const good=r.err?false:(kind==='card'?r.cardId===ids[it.i]:r.loanId===ids[it.i]);
  out.push(`   ${good?'OK ':'MAL'} ${it.t} → ${JSON.stringify(r)}`);
 }
}
out.forEach(x=>console.log(x));console.log('errores JS:',errs.length);await b.close()})();
