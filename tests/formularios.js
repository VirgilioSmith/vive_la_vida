'use strict';
/* Recorrido de formularios y modales: se abren desde sus acciones reales, se revisa etiquetado, validación con envío vacío, teclado (Tab/Esc),
   desborde y contraste AA medido dentro del modal. PC y móvil. No guarda datos (se comprueba que el libro y los saldos no cambian). */
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');const open=require('./harness');const {medir}=require('./lib-contraste');
const ACTS=[['newTransaction','income'],['newTransaction','expense'],['newTransaction','transfer'],['newTransaction','card_payment'],['addAccount',''],['addCard',''],['addLoan',''],['addBudget',''],['addCategory',''],['addCertificate',''],['addRecurring',''],['addPersonal',''],['addBank','']];
(async()=>{
 const b=await chromium.launch(),res={};
 for(const [w,h,tag] of [[1440,900,'pc'],[390,844,'movil']]){
  process.env.THEME='light';if(w<800)process.env.TOUCH='1';else delete process.env.TOUCH;
  const {ctx,p}=await open(b,w,h);const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.evaluate(()=>window.__T.go('overview'));
  const base=await p.evaluate(()=>JSON.stringify([window.__T.dbg().transactions,window.__T.dbg().accounts.map(a=>a.id)]));
  for(const [act,type] of ACTS){
   const key=`${tag}:${act}${type?':'+type:''}`;
   try{
    await p.evaluate(([a,t])=>{const bt=document.createElement('button');bt.dataset.act=a;if(t)bt.dataset.type=t;bt.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';document.body.appendChild(bt);bt.click();bt.remove()},[act,type]);
    await p.waitForTimeout(500);
    const info=await p.evaluate(()=>{const m=[...document.querySelectorAll('dialog[open],.modal,#modal-root>*,.v-sheet,.sheet')].filter(e=>{const r=e.getBoundingClientRect();return r.width>100&&r.height>100&&getComputedStyle(e).visibility!=='hidden'})[0];if(!m)return null;
     const inputs=[...m.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(e=>e.getBoundingClientRect().width>0);
     const sinEtiqueta=inputs.filter(e=>!(e.labels&&e.labels.length)&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')&&!e.closest('label')&&!e.placeholder).length;
     const r=m.getBoundingClientRect();
     return {titulo:(m.querySelector('h1,h2,h3,.modal-head')?.textContent||'').trim().slice(0,40),campos:inputs.length,sinEtiqueta,botones:[...m.querySelectorAll('button')].map(x=>x.textContent.trim()).filter(Boolean).slice(0,6),
      desborde:m.scrollWidth>m.clientWidth+2||r.right>innerWidth+2||r.left<-2,ancho:Math.round(r.width),alto:Math.round(r.height),pequeno:[...m.querySelectorAll('*')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&parseFloat(getComputedStyle(e).fontSize)<11).length}});
    if(!info){res[key]={sinModal:true};continue}
    // validación con envío vacío
    const submit=p.locator('dialog[open] button[type=submit], .modal button[type=submit], #modal-root button[type=submit]').first();
    let validacion='sin botón enviar';
    if(await submit.count()){await submit.click({timeout:2000}).catch(()=>{});await p.waitForTimeout(300);
     validacion=await p.evaluate(()=>{const m=document.querySelector('dialog[open],.modal,#modal-root>*');if(!m)return 'se cerró (¿guardó?)';const inv=m.querySelectorAll(':invalid').length,msg=[...m.querySelectorAll('.error,.form-error,[role=alert],.toast')].map(x=>x.textContent.trim()).filter(Boolean).length;return `inválidos:${inv} mensajes:${msg}`})}
    // teclado: Tab permanece en el modal; Esc cierra
    await p.keyboard.press('Tab');await p.keyboard.press('Tab');
    const foco=await p.evaluate(()=>{const a=document.activeElement;return !!a&&!!a.closest('dialog,.modal,#modal-root')});
    const c=await medir(p,{root:'dialog[open],.modal,#modal-root',max:200}).catch(()=>({medidos:0,fallos:[]}));
    await p.keyboard.press('Escape');await p.waitForTimeout(300);
    const cerro=await p.evaluate(()=>!document.querySelector('dialog[open]')&&![...document.querySelectorAll('.modal,#modal-root>*')].some(e=>e.getBoundingClientRect().width>100&&e.getBoundingClientRect().height>100&&getComputedStyle(e).visibility!=='hidden'));
    if(!cerro){await p.evaluate(()=>{document.querySelectorAll('[data-close],.modal-close,button[aria-label*=errar]').forEach(x=>x.click())});await p.waitForTimeout(250)}
    res[key]={...info,validacion,focoEnModal:foco,escCierra:cerro,contraste:{medidos:c.medidos,fallos:c.fallos.length,ej:c.fallos.slice(0,3)}};
   }catch(e){res[key]={error:String(e.message).slice(0,120)}}
  }
  const after=await p.evaluate(()=>JSON.stringify([window.__T.dbg().transactions,window.__T.dbg().accounts.map(a=>a.id)]));
  res[tag+':__integridad']={datosSinCambios:after===base,erroresConsola:errs.length};
  await ctx.close();
 }
 await b.close();fs.writeFileSync(path.join(__dirname,'..','docs','auditoria','fase02','formularios.json'),JSON.stringify(res,null,1));
 for(const [k,v] of Object.entries(res))console.log(k,JSON.stringify(v,(kk,vv)=>kk==='ej'?undefined:vv).slice(0,330));
})().catch(e=>{console.error(e);process.exit(1)});
