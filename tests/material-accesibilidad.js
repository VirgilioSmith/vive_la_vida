'use strict';
/* Preferencias del sistema: reducción de movimiento y alto contraste/reducción de transparencia → sin filtros ni transiciones; vidrio sólido legible. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');const open=require('./harness');
(async()=>{
 const b=await chromium.launch();let hecho=[];
 for(const theme of ['light','black']){process.env.THEME=theme;delete process.env.TOUCH;
  const {ctx,p}=await open(b,1440,900);await p.evaluate(()=>window.__T.go('overview'));await p.waitForTimeout(400);
  const cuenta=()=>p.evaluate(()=>[...document.querySelectorAll('#app *')].filter(e=>{const s=getComputedStyle(e);return (s.backdropFilter&&s.backdropFilter!=='none')||(s.webkitBackdropFilter&&s.webkitBackdropFilter!=='none')}).length);
  const normal=await cuenta();assert.ok(normal>0,'en modo normal hay desenfoque de interacción');
  await p.emulateMedia({reducedMotion:'reduce'});
  const dur=await p.evaluate(()=>{const e=document.querySelector('#app button');return parseFloat(getComputedStyle(e).transitionDuration)});assert.ok(dur<=0.001,`[${theme}] reduced-motion sin transiciones: ${dur}`);hecho.push('reducedMotion');
  let contrasteOk=true;try{await p.emulateMedia({contrast:'more'})}catch(e){contrasteOk=false}
  if(contrasteOk){await p.waitForTimeout(200);const n=await cuenta();assert.equal(n,0,`[${theme}] alto contraste: sin backdrop-filter (${n})`);const g=await p.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--vx-glass-1').trim());assert.ok(/^#/.test(g),`[${theme}] vidrio sólido en alto contraste: ${g}`);hecho.push('contrast:more')}
  await ctx.close()}
 await b.close();console.log('material-accesibilidad: OK',[...new Set(hecho)].join(', '));
})().catch(e=>{console.error(e);process.exit(1)});
