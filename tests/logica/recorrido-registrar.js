'use strict';
/* Recorrido: cada opción del menú Registrar abre la pantalla que corresponde. Uso: W=390|1440 node tests/logica/recorrido-registrar.js */
const {chromium}=require('playwright');const open=require('../harness.js');
const W=+(process.env.W||390);
(async()=>{if(W<500)process.env.TOUCH='1';const b=await chromium.launch();const {p}=await open(b,W,W<500?844:900);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const res=[];
const abrir=async()=>{await p.evaluate(()=>{document.getElementById('modal-root').innerHTML='';document.querySelector('#app [data-act=newTransaction]')?.click()});await p.waitForTimeout(800)};
await p.evaluate(()=>window.__T.go('overview'));await p.waitForTimeout(500);await abrir();
const groups=await p.evaluate(()=>[...document.querySelectorAll('#modal-root [data-act=registrationGroup]')].map(e=>({id:e.dataset.id,t:e.textContent.trim().slice(0,14)})));
console.log('grupos:',JSON.stringify(groups));
for(const g of (groups.length?groups:[{id:'pay'}])){
 await abrir();await p.evaluate(id=>document.querySelector(`#modal-root [data-act=registrationGroup][data-id="${id}"]`)?.click(),g.id);await p.waitForTimeout(400);
 const ops=await p.evaluate(()=>[...document.querySelectorAll('#modal-root .v235-register-dialog button[data-act]')].filter(e=>!/registrationGroup|closeModal/.test(e.dataset.act)).map(e=>({act:e.dataset.act,id:e.dataset.id||'',type:e.dataset.type||'',flow:e.dataset.flow||'',t:e.textContent.replace(/\s+/g,' ').trim().slice(0,30)})));
 for(const o of ops){
  await abrir();await p.evaluate(id=>document.querySelector(`#modal-root [data-act=registrationGroup][data-id="${id}"]`)?.click(),g.id);await p.waitForTimeout(300);
  await p.evaluate(o=>{const b=[...document.querySelectorAll('#modal-root .v235-register-dialog button[data-act]')].find(e=>e.dataset.act===o.act&&(e.dataset.id||'')===o.id&&(e.dataset.type||'')===o.type&&(e.dataset.flow||'')===o.flow&&e.textContent.replace(/\s+/g,' ').trim().slice(0,30)===o.t);b?.click()},o);await p.waitForTimeout(900);
  const r=await p.evaluate(()=>{const cx=innerWidth/2,cy=innerHeight*0.6;let e=document.elementFromPoint(cx,cy);let root=e;while(root&&root.parentElement&&root.parentElement!==document.body&&!/^(DIALOG)$/.test(root.tagName)&&!root.classList?.contains('modal')&&!root.classList?.contains('modal-layer'))root=root.parentElement;const txt=(root?.innerText||'').replace(/\s+/g,' ').trim();const f=document.querySelector('form:not([id=""])')&&[...document.querySelectorAll('#modal-root form,#app form')].pop();const tab=[...document.querySelectorAll('button.active,[aria-pressed=true],[aria-selected=true]')].map(x=>x.textContent.trim().slice(0,12)).filter(x=>/Gasto|Ingreso|Transferencia|Egreso/.test(x)).join('/');const h=[...document.querySelectorAll('h1,h2')].filter(x=>x.getBoundingClientRect().width>0).map(x=>x.textContent.trim()).filter(x=>x&&!/vive el hoy|Resumen financiero/.test(x)).slice(-2).join(' | ');return {titulo:h.slice(0,44),form:f?.id||'',flow:f?.elements?.flowMode?.value||'',type:f?.elements?.type?.value||'',tab,hayModal:txt.length>20,vacio:txt.length<20,sheet:txt.slice(0,50)}});
  res.push(`${g.id.padEnd(8)} ${o.t.padEnd(31)} → ${r.titulo.padEnd(34)} form=${r.form||'-'} flow=${r.flow||'-'} type=${r.type||'-'} tab=${r.tab||'-'}${r.vacio?'  ⚠ VACÍA':''}`);
 }
}
res.forEach(x=>console.log(x));console.log('errores JS:',errs.length,errs.slice(0,3));await b.close()})();
