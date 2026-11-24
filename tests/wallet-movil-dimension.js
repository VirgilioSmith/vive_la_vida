'use strict';
/* Wallet móvil · dimensionamiento compacto (referencia aprobada): carrusel ≈55 vw, resumen de crédito ≈208 px, acciones de 32–36 px, Estado del
   crédito inmediatamente debajo. Mide con getBoundingClientRect en 320–430 px, Claro/Black; sin scroll horizontal ni importes cortados. */
const assert=require('node:assert/strict');const path=require('node:path');
const {chromium}=require('playwright');const open=require('./harness');
const OUT=path.join(__dirname,'..','docs','auditoria','wallet-movil-dimension');
(async()=>{const b=await chromium.launch();const res=[];
 for(const theme of ['light','black'])for(const w of [320,360,375,390,430]){
  process.env.THEME=theme;process.env.TOUCH='1';const {ctx,p}=await open(b,w,844);const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.evaluate(()=>window.__T.go('wallet'));await p.waitForSelector('.v266-gallery');await p.waitForTimeout(500);
  const g=await p.evaluate(()=>{const R=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {t:Math.round(r.top+scrollY),h:Math.round(r.height),w:Math.round(r.width),l:Math.round(r.left)}};
   const vw=innerWidth;const face=R('.v68-wallet-face'),sum=R('.wallet-mobile-summary'),ctl=R('.v1244-state'),dots=R('.v266-dots'),act=document.querySelector('.v266-wallet-actions button>span').getBoundingClientRect();
   return {vw,face,sum,ctl,dots,circ:Math.round(act.width),circH:Math.round(act.height),ovX:document.documentElement.scrollWidth-vw,
    gapDotsSum:sum.t-(dots.t+dots.h),gapSumCtl:ctl.t-(sum.t+sum.h),
    clip:[...document.querySelectorAll('.v266-wallet *')].filter(e=>e.children.length===0&&/(RD\$|US\$)\s?\d/.test(e.textContent)&&e.scrollWidth>e.clientWidth+1).map(e=>e.textContent.slice(0,14)),
    overlap:(()=>{const a=document.querySelector('.v68-wallet-face').getBoundingClientRect(),s=document.querySelector('.wallet-mobile-summary').getBoundingClientRect(),c=document.querySelector('.v1244-state').getBoundingClientRect();return a.bottom>s.top+1||s.bottom>c.top+1})()}});
  const tag=`${theme}-${w}`;
  assert.ok(g.face.h/g.vw>=.5&&g.face.h/g.vw<=.58||g.face.h<=236&&g.face.h>=184,`[${tag}] carrusel compacto: ${g.face.h}px (${(g.face.h/g.vw).toFixed(2)} vw)`);
  assert.ok(g.sum.h<=228,`[${tag}] resumen de crédito compacto: ${g.sum.h}px`);
  assert.ok(g.circ>=32&&g.circ<=36&&g.circH===g.circ,`[${tag}] acciones circulares ${g.circ}×${g.circH}`);
  assert.ok(g.gapDotsSum>=6&&g.gapDotsSum<=20&&g.gapSumCtl>=8&&g.gapSumCtl<=22,`[${tag}] separaciones equilibradas ${g.gapDotsSum}/${g.gapSumCtl}`);
  assert.ok(g.ovX<=1,`[${tag}] sin scroll horizontal`);assert.deepEqual(g.clip,[],`[${tag}] importes completos`);assert.ok(!g.overlap,`[${tag}] sin superposición`);assert.equal(errs.length,0,'consola');
  res.push({tag,card:g.face.h,summary:g.sum.h,controlTop:g.ctl.t,circle:g.circ});
  if(w===390)await p.screenshot({path:path.join(OUT,`despues-${theme}-390.jpg`),type:'jpeg',quality:72});
  await ctx.close()}
 await b.close();console.log(JSON.stringify(res));console.log('wallet-movil-dimension: OK');
})().catch(e=>{console.error(e);process.exit(1)});
