'use strict';
/* Sistema universal de iconos: catálogo, emoji (buscar o pegar), letras con color, validación estricta y guardado. */
const {chromium}=require('playwright');const open=require('../harness.js');
(async()=>{process.env.TOUCH='1';const b=await chromium.launch();const {p}=await open(b,390,844);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const val=()=>p.evaluate(()=>document.querySelector('#modal-root form').elements.serviceIcon.value);
await p.evaluate(()=>{document.getElementById('modal-root').innerHTML='';const x=document.createElement('button');x.dataset.act='addRecurring';document.body.appendChild(x);x.click();x.remove()});await p.waitForTimeout(1000);
await p.evaluate(()=>{const f=document.querySelector('#modal-root form').elements.name;f.value='Mi gasto';f.dispatchEvent(new Event('input',{bubbles:true}))});
await p.evaluate(()=>document.querySelector('#modal-root .v147-icon-drawer').open=true);await p.waitForTimeout(200);
await p.evaluate(()=>document.querySelector('[data-v41-tab=emoji]').click());await p.waitForTimeout(150);
await p.evaluate(()=>{const s=document.querySelector('#v41EmojiSearch');s.value='cafe';s.dispatchEvent(new Event('input',{bubbles:true}))});await p.waitForTimeout(150);
console.log('buscar "cafe" →',await p.evaluate(()=>[...document.querySelectorAll('.v41-emoji-btn')].filter(b=>!b.hidden).map(b=>b.dataset.v41Emoji).join(' ')));
await p.evaluate(()=>[...document.querySelectorAll('.v41-emoji-btn')].find(b=>!b.hidden).click());await p.waitForTimeout(150);console.log('emoji elegido:',await val(),'| vista previa:',await p.evaluate(()=>document.querySelector('#v41IconPreview').innerText));
await p.evaluate(()=>{const o=document.querySelector('#v41EmojiOwn');o.value='hola 🦄 mundo';o.dispatchEvent(new Event('input',{bubbles:true}))});await p.waitForTimeout(150);console.log('emoji pegado:',await val());
await p.evaluate(()=>document.querySelector('[data-v41-tab=mono]').click());await p.waitForTimeout(100);
await p.evaluate(()=>{const o=document.querySelector('#v41MonoText');o.value='tv';o.dispatchEvent(new Event('input',{bubbles:true}))});await p.evaluate(()=>document.querySelectorAll('[data-v41-mono-color]')[2].click());await p.waitForTimeout(150);console.log('letras:',await val());

// inválidos
console.log('validación:',await p.evaluate(()=>['emoji:<b>','emoji:ab','mono:XYZ:#fff','mono:A:#12345g','netflix','emoji:🦄','mono:Tv:#7b2d57','javascript:1'].map(x=>x+'→'+window.__T.fn.v41ValidIcon(x)).join(' | ')));
// guardar con emoji
await p.evaluate(()=>document.querySelector('[data-v41-tab=emoji]').click());await p.evaluate(()=>[...document.querySelectorAll('.v41-emoji-btn')].find(b=>!b.hidden).click());
await p.evaluate(()=>{const e=document.querySelector('#modal-root form').elements;e.amount.value='500';e.amount.dispatchEvent(new Event('input',{bubbles:true}))});
await p.evaluate(()=>document.querySelector('#modal-root .v1110-next').click());await p.waitForTimeout(250);
await p.evaluate(()=>{const f=document.querySelector('#modal-root form');const s=f.elements.source;const o=[...s.options].find(o=>/account/.test(o.value)&&!/Efectivo|Dólares/.test(o.text));s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}))});
await p.evaluate(()=>document.querySelector('#modal-root .v1110-next').click());await p.waitForTimeout(250);
await p.evaluate(()=>document.querySelector('#modal-root form button[type=submit]').click());await p.waitForTimeout(900);
console.log('guardado icono:',await p.evaluate(()=>window.__T.dbg().recurring.at(-1).iconId));
const g=await p.evaluate(()=>window.__T.dbg().recurring.at(-1).iconId);const v=await p.evaluate(()=>['emoji:<b>','mono:XYZ:#fff','javascript:1'].map(x=>window.__T.fn.v41ValidIcon(x)));console.log(errs);await b.close();process.exit(g==='emoji:☕'&&v.every(x=>x==='general')&&!errs.length?0:1)})();
