'use strict';
/* El pago recurrente elige cuenta o tarjeta con el selector universal (hoja «Seleccionar cuenta o tarjeta»). */
const {chromium}=require('playwright');const open=require('../harness.js');
const W=+(process.env.W||390);
(async()=>{if(W<500)process.env.TOUCH='1';const b=await chromium.launch();const {p}=await open(b,W,W<500?844:900);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.evaluate(()=>{document.getElementById('modal-root').innerHTML='';const x=document.createElement('button');x.dataset.act='addRecurring';document.body.appendChild(x);x.click();x.remove()});await p.waitForTimeout(1000);
await p.evaluate(()=>{const e=document.querySelector('#modal-root form').elements;e.name.value='Prueba';e.name.dispatchEvent(new Event('input',{bubbles:true}));e.amount.value='100';e.amount.dispatchEvent(new Event('input',{bubbles:true}))});
await p.evaluate(()=>document.querySelector('#modal-root .v1110-next').click());await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('#modal-root .v1110-pickbtn').click());await p.waitForTimeout(600);
console.log('hoja universal:',await p.evaluate(()=>({titulo:document.querySelector('.v827-picker-sheet h3,.v827-picker-sheet h2')?.textContent,filas:[...document.querySelectorAll('.v827-picker-sheet .v789-picker-row')].map(r=>r.textContent.replace(/\s+/g,' ').slice(0,34)),chips:[...document.querySelectorAll('.v827-picker-sheet button')].map(b=>b.textContent.trim()).filter(t=>/\(\d+\)|Usar|Cancelar/.test(t))})));

// elegir tarjeta
await p.evaluate(()=>[...document.querySelectorAll('.v827-picker-sheet .v789-picker-row')].find(r=>/Mastercard/.test(r.textContent)).click());await p.waitForTimeout(200);
await p.evaluate(()=>document.querySelector('.v789-picker-confirm').click());await p.waitForTimeout(500);
console.log('tras elegir:',await p.evaluate(()=>({src:document.querySelector('#modal-root form').elements.source.value.slice(0,8),texto:document.querySelector('.v1110-pickbtn').innerText.replace(/\s+/g,' ')})));
// elegir cuenta bancaria
await p.evaluate(()=>document.querySelector('#modal-root .v1110-pickbtn').click());await p.waitForTimeout(500);
await p.evaluate(()=>[...document.querySelectorAll('.v827-picker-sheet .v789-picker-row')].find(r=>/Cuenta principal/.test(r.textContent)).click());await p.evaluate(()=>document.querySelector('.v789-picker-confirm').click());await p.waitForTimeout(400);
console.log('cuenta:',await p.evaluate(()=>({src:document.querySelector('#modal-root form').elements.source.value.slice(0,8),cur:document.querySelector('#modal-root form').elements.currency.value,texto:document.querySelector('.v1110-pickbtn').innerText.replace(/\s+/g,' ')})));
await p.evaluate(()=>document.querySelector('#modal-root .v1110-next').click());await p.waitForTimeout(250);await p.evaluate(()=>document.querySelector('#modal-root form button[type=submit]').click());await p.waitForTimeout(900);
const g=await p.evaluate(()=>window.__T.dbg().recurring.at(-1).source.slice(0,8));console.log('guardado:',g,errs);await b.close();process.exit(g==='account:'&&!errs.length?0:1)})();
