'use strict';
/* Vive Score (iframe): acceso real al marco con Playwright, contraste AA medido dentro del marco, desborde, tamaños de texto y modos Claro/Black, PC y móvil. */
const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');const open=require('./harness');const {medir}=require('./lib-contraste');
(async()=>{
 const b=await chromium.launch(),res={};
 for(const [w,h] of [[1440,900],[820,1180],[390,844]])for(const theme of ['light','black']){
  process.env.THEME=theme;if(w<800)process.env.TOUCH='1';else delete process.env.TOUCH;
  const {ctx,p}=await open(b,w,h);const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.evaluate(()=>window.__T.go('score'));await p.waitForTimeout(3000);
  const fr=p.frames().find(f=>/vive-score|frame/.test(f.url())&&f!==p.mainFrame());
  const key=`${w}-${theme}`;
  if(!fr){res[key]={sinMarco:true,nota:'En este perfil Score no se monta (móvil: solo versión resumida desde Explorar)'};await ctx.close();continue}
  await fr.waitForSelector('#view',{timeout:8000}).catch(()=>{});
  // completa la calibración inicial para llegar a las vistas reales (Mi score y Centro de control)
  for(let i=0;i<6;i++){const fin=await fr.$('[data-q-act="finish"]');if(fin){await fin.click();break}const nx=await fr.$('[data-q-act="next"],.qnav .btn:not([data-q-act="finish"])');if(!nx)break;await nx.click();await p.waitForTimeout(250)}
  await p.waitForTimeout(800);
  const info=await fr.evaluate(()=>({tabs:[...document.querySelectorAll('#tabs [data-tab]')].map(x=>x.textContent.trim()),ancho:document.documentElement.scrollWidth,vw:innerWidth,pequeno:[...document.querySelectorAll('#view *')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&parseFloat(getComputedStyle(e).fontSize)<11).length}));
  const c=await medir(p,{root:'body',max:300,frame:fr});
  res[key]={...info,medidos:c.medidos,fallos:c.fallos.length,ej:c.fallos.slice(0,5),errores:errs.length};
  await fr.click('#tabs [data-tab="control"]').catch(()=>{});await p.waitForTimeout(500);
  const c2=await medir(p,{root:'body',max:300,frame:fr});res[key].control={medidos:c2.medidos,fallos:c2.fallos.length,ej:c2.fallos.slice(0,4)};
  await p.screenshot({path:path.join(__dirname,'..','docs','auditoria','fase02',`score-${key}.jpg`),type:'jpeg',quality:65});
  await ctx.close();
 }
 await b.close();fs.writeFileSync(path.join(__dirname,'..','docs','auditoria','fase02','score-iframe.json'),JSON.stringify(res,null,1));
 console.log(JSON.stringify(res,(k,v)=>k==='ej'?undefined:v));
})().catch(e=>{console.error(e);process.exit(1)});
