'use strict';
/* Pago recurrente en 3 pasos (Servicio, Programación, Confirmación): crea y guarda. Uso: W=390|1440 node tests/logica/recurrente.js */
const {chromium}=require('playwright');const open=require('../harness.js');
const W=+(process.env.W||390);
(async()=>{if(W<500)process.env.TOUCH='1';const b=await chromium.launch();const {p}=await open(b,W,W<500?844:900);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const n0=await p.evaluate(()=>window.__T.dbg().recurring.length);
await p.evaluate(()=>{document.getElementById('modal-root').innerHTML='';const x=document.createElement('button');x.dataset.act='addRecurring';document.body.appendChild(x);x.click();x.remove()});await p.waitForTimeout(1200);
const set=(n,v)=>p.evaluate(([n,v])=>{const e=document.querySelector('#modal-root form').elements.namedItem(n);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))},[n,v]);
await set('name','Internet hogar');await set('amount','1500');
await p.evaluate(()=>[...document.querySelectorAll('#modal-root .v147-preset')].find(b=>/Internet/.test(b.textContent))?.click());await p.waitForTimeout(200);

await p.evaluate(()=>document.querySelector('#modal-root .v1110-next').click());await p.waitForTimeout(400);
await p.evaluate(()=>document.querySelector('#modal-root .v1110-pickbtn').click());await p.waitForTimeout(500);
await p.evaluate(()=>[...document.querySelectorAll('.v827-picker-sheet .v789-picker-row')].find(o=>/Cuenta principal/.test(o.textContent)).click());await p.evaluate(()=>document.querySelector('.v789-picker-confirm').click());await p.waitForTimeout(300);
await p.evaluate(()=>[...document.querySelectorAll('#modal-root .v147-freq-btn')].find(b=>/Mensual/.test(b.textContent))?.click());

console.log('paso2 campos:',await p.evaluate(()=>{const e=document.querySelector('#modal-root form').elements;return JSON.stringify({source:e.source.value.slice(0,12),cur:e.currency.value,freq:e.frequency.value,due:e.nextDue.value,mode:e.postingMode.value,act:e.active.value})}));
await p.evaluate(()=>document.querySelector('#modal-root .v1110-next').click());await p.waitForTimeout(400);

console.log('confirmación:',await p.evaluate(()=>document.querySelector('.v1110-confirm').innerText.replace(/\s+/g,' ').slice(0,260)));
await p.evaluate(()=>document.querySelector('#modal-root form button[type=submit]').click());await p.waitForTimeout(1000);
const r=await p.evaluate(()=>{const d=window.__T.dbg();const x=d.recurring.at(-1);return {n:d.recurring.length,x:x&&{name:x.name,amount:x.amount,cur:x.currency,freq:x.frequency,src:x.source?.slice(0,12),icon:x.iconId,cat:x.category,sub:x.subcategory,mode:x.postingMode,active:x.active}}});
console.log('guardado:',n0,'→',r.n,JSON.stringify(r.x));console.log(errs);await b.close();process.exit(r.n===n0+1&&!errs.length?0:1)})();
