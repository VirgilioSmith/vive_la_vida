'use strict';
/* Wallet móvil · auditoría reproducible de composición, navegación y legibilidad.
   Ejecuta la app del checkout vía tests/harness (sin depender de GitHub Pages).
   Capturas: test-results/wallet-mobile-fidelity/<browser>/<theme>/<width>/ */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const open=require('./harness');
const browserName=process.env.WALLET_BROWSER==='webkit'?'webkit':'chromium';
const engine=browserName==='webkit'?webkit:chromium;
const widths=[320,375,390,430];
const themes=['light','black'];
const results=[];
const out='test-results/wallet-mobile-fidelity';
const GLOBAL='__vive_wallet_credit_global__';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const closeEnough=(a,b,tolerance=2)=>Math.abs(a-b)<=tolerance;
const check=async(p,label,width)=>{
 const report=await p.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
  const wallet=document.querySelector('.v68-wallet');
  const page=document.querySelector('main.world-wallet #page');
  const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
  const cards=[...document.querySelectorAll('.v68-wallet > .v1244-state,.v68-wallet > .v371-card-return,.v68-wallet > .v1301-insight,.v68-wallet > .v1244-cutpanel')].filter(visible);
  const overflow=[...document.querySelectorAll('.v1244-limits,.v1301-rank,.v1301-rank-info,.v1301-equivalent,.v371-return-tile,.v1244-pill')].filter(visible).filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>({selector:e.className,scroll:e.scrollWidth,client:e.clientWidth}));
  const glass=cards[0]&&getComputedStyle(cards[0]);
  const pct=[...document.querySelectorAll('.v1244-gauge b,.v371-return-tile:nth-child(4) strong')].filter(visible).map(e=>({text:e.textContent.trim(),rect:rect(e)}));
  return {screen:innerWidth,documentWidth:document.documentElement.scrollWidth,page:page&&rect(page),wallet:wallet&&rect(wallet),cards:cards.map(rect),overflow,pct,glass:glass&&{backdrop:glass.backdropFilter||glass.webkitBackdropFilter,background:glass.backgroundImage},dock:(()=>{let e=document.querySelector('.vive-mobile-dock');return e&&rect(e)})()};
 });
 assert.ok(report.wallet,'No está montado Wallet móvil en '+label);
 assert.ok(report.documentWidth<=width+2,'Desbordamiento horizontal de documento '+label+': '+JSON.stringify(report));
 assert.ok(report.wallet.left>=16,'Wallet pegada al borde izquierdo '+label+': '+report.wallet.left);
 assert.ok(report.wallet.right<=width-16,'Wallet pegada al borde derecho '+label+': '+report.wallet.right);
 assert.deepEqual(report.overflow,[],'Contenido horizontalmente recortado '+label);
 for(const box of report.cards){
  assert.ok(box.left>=16&&box.right<=width-16,'Tarjeta fuera de márgenes '+label+': '+JSON.stringify(box));
 }
 for(let i=1;i<report.cards.length;i++)assert.ok(report.cards[i].top>=report.cards[i-1].bottom+7,'Tarjetas superpuestas '+label);
 assert.ok(report.glass?.backdrop.includes('blur('),'No hay backdrop Liquid Glass '+label);
 for(const pct of report.pct)assert.ok(pct.rect.left>=0&&pct.rect.right<=width,'Porcentaje fuera de viewport '+label+': '+pct.text);
 results.push({browser:browserName,label,width,...report});
};
const shot=async(p,dir,name)=>{await p.screenshot({path:path.join(dir,name+'.png'),fullPage:true,animations:'disabled'})};
(async()=>{
 const browser=await engine.launch({headless:true});
 let failures=0;
 try{
  for(const theme of themes)for(const width of widths){
   const dir=path.join(out,browserName,theme,String(width));fs.mkdirSync(dir,{recursive:true});
   process.env.TOUCH='1';process.env.THEME=theme;process.env.PALHEX='#b32262';
   const {ctx,p}=await open(browser,width,844);
   const errors=[];p.on('pageerror',e=>errors.push(e.message));
   try{
    await p.evaluate(()=>{const t=window.__T;t.go('wallet')});
    await p.locator('.v68-wallet').waitFor();
    const global=p.locator('.v68-wallet-dots button[data-id="'+GLOBAL+'"]');
    assert.equal(await global.count(),1,'Falta Créditos generales');
    await global.click();await sleep(450);
    await p.getByRole('heading',{name:'Estado del crédito',exact:true}).waitFor();
    await check(p,theme+' global',width);
    await shot(p,dir,'01-estado-credito');
    const gauge=await p.locator('.v1244-gauge b').innerText();
    assert.match(gauge,/\d/,'Falta utilización legible');
    const faces=p.locator('.v68-wallet-dots button');
    assert.ok(await faces.count()>=2,'No hay tarjetas individuales');
    await faces.nth(1).click();await sleep(400);
    await check(p,theme+' individual',width);
    await shot(p,dir,'02-tarjeta-individual');
    await global.click();await sleep(400);
    const returnAction=p.locator('.v371-return-action').first();
    assert.ok(await returnAction.count(),'Falta acceso a Beneficios y retorno');
    await returnAction.click();await sleep(400);
    await shot(p,dir,'03-beneficios-retorno');
    assert.ok(await p.getByRole('button',{name:'Registrar beneficio',exact:true}).count()>0,'Falta Registrar beneficio');
    assert.ok(await p.getByRole('button',{name:'Anualidad y seguros',exact:true}).count()>0,'Falta Anualidad y seguros');
    await check(p,theme+' beneficios',width);
    assert.equal(errors.length,0,'Errores JS '+JSON.stringify(errors));
    fs.writeFileSync(path.join(dir,'resultado.json'),JSON.stringify({width,theme,browser:browserName,globalGauge:gauge,errors},null,2));
    console.log('OK Wallet móvil',browserName,theme,width);
   }catch(e){failures++;fs.writeFileSync(path.join(dir,'error.txt'),String(e.stack||e));await p.screenshot({path:path.join(dir,'error.png'),fullPage:true}).catch(()=>{});console.error('FAIL Wallet móvil',browserName,theme,width,e.message)}
   finally{await ctx.close()}
  }
 }finally{await browser.close();fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'geometry-'+browserName+'.json'),JSON.stringify(results,null,2))}
 if(failures)process.exitCode=1;
})();
