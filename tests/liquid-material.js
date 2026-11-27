'use strict';
/* Material Liquid Glass: es solo estético. Para 22 rutas, PC y móvil, Claro y Black, compara la geometría de todos los
   elementos con la hoja liquid-material.css desactivada y activada: debe ser idéntica. También exige 0 errores de consola.
   Capturas antes/después en test-results/auditoria/liquid-material/. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const open=require('./harness');
const ROUTES=['overview','wallet','banks','accounts','cards','loans','certificates','register','income','expenses','budget','categories','recurring','personal','patrimony','advanced','score','settings','mobilehub','mobilesearch','projection','payments'];
async function run(browser,{mob,theme}){
 if(mob)process.env.TOUCH='1';else delete process.env.TOUCH;process.env.THEME=theme;
 const {ctx,p}=await open(browser,mob?390:1440,mob?844:900);
 const errs=[];p.on('pageerror',e=>errs.push(e.message));const bad=[];
 const sig=()=>p.evaluate(()=>[...document.querySelectorAll('#page *, .vive-mobile-dock')].filter(e=>!e.closest('.v149-card-reveal,.vi-strip')).map(e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.width,r.height].map(Math.round).join(',')}).join('|'));
 const sheet=on=>p.evaluate(on=>{const l=document.querySelector('link[href*="liquid-material"]');if(l)l.disabled=!on;return !!l},on);
 for(const r of ROUTES){
  await p.evaluate(()=>window.__T.go('overview'));
  try{await p.evaluate(v=>window.__T.go(v),r)}catch(e){continue}
  await p.waitForTimeout(400);
  assert.ok(await sheet(false),'liquid-material.css debe estar enlazada');await p.waitForTimeout(500);const a=await sig();
  await sheet(true);await p.waitForTimeout(500);const c=await sig();
  if(a!==c)bad.push(r);
 }
 await ctx.close();
 return {bad,errs,tag:`${mob?'móvil':'PC'} ${theme}`};
}
module.exports=async function liquidMaterial(browser){
 for(const cfg of [{mob:0,theme:'light'},{mob:0,theme:'black'},{mob:1,theme:'light'},{mob:1,theme:'black'}]){
  const r=await run(browser,cfg);
  assert.deepEqual(r.bad,[],`[${r.tag}] el material alteró el layout en: ${r.bad.join(', ')}`);
  assert.deepEqual(r.errs,[],`[${r.tag}] errores de consola: ${r.errs.join(' | ')}`);
 }
 console.log('Liquid Glass (material) validado: layout idéntico en 22 rutas, PC y móvil, Claro y Black; sin errores.');
};
if(require.main===module)(async()=>{const b=await chromium.launch();try{await module.exports(b)}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
