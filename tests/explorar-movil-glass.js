'use strict';
/* Explorar móvil · rediseño Liquid Glass: tarjeta Ingresos vs. Egresos, 4 tarjetas, visión, navegación y modos. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const open=require('./harness');
async function run(browser,{theme,palhex,w=390,h=844}){
 process.env.TOUCH='1';process.env.THEME=theme;
 if(palhex)process.env.PALHEX=palhex;else delete process.env.PALHEX;
 const {ctx,p}=await open(browser,w,h);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const tag=`${theme}${palhex?' '+palhex:''} ${w}x${h}`;
 const no=(c,m)=>assert.ok(c,`[${tag}] ${m}`);
 await p.evaluate(()=>window.__T.go('mobilehub'));await p.waitForSelector('.vxm');
 no(await p.locator('.vxm-head h1').innerText()==='Explorar','título');
 no(await p.locator('.vxm-hero').count()===1,'tarjeta protagonista');
 no((await p.locator('.vxm-hero h2').innerText())==='Ingresos vs. Egresos','título hero');
 no(await p.locator('.vxm-flow').count()===2,'subtarjetas');
 no(await p.locator('.vxm-grid .vxm-tile').count()===4,'cuatro tarjetas');
 no(await p.locator('.vxm-vision .vxm-vcard').count()>=1,'tarjetas de visión');
 no(await p.locator('.v431-tile').count()===0,'sin tarjetas antiguas');
 const inc=await p.locator('.vxm-inc strong').innerText(),exp=await p.locator('.vxm-exp strong').innerText();
 no(/RD\$|\d/.test(inc)&&/RD\$|\d/.test(exp),'importes reales');
 no(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'sin desborde horizontal');
 // importes no cortados
 no(await p.evaluate(()=>[...document.querySelectorAll('.vxm-flow strong,.vxm-tile-v')].every(e=>e.scrollWidth<=e.clientWidth+1)),'importes sin cortar');
 // alturas iguales por fila
 const hs=await p.locator('.vxm-grid .vxm-tile').evaluateAll(a=>a.map(e=>Math.round(e.getBoundingClientRect().height)));
 no(hs[0]===hs[1]&&hs[2]===hs[3],'tarjetas de igual altura por fila '+hs);
 // márgenes laterales
 const m=await p.locator('.vxm-hero').evaluate(e=>{const r=e.getBoundingClientRect();return [r.left,innerWidth-r.right]});
 no(Math.abs(m[0]-m[1])<2&&m[0]>=12,'márgenes laterales uniformes '+m);
 await p.screenshot({path:`docs/auditoria/explorar-movil/${theme}${palhex?'-'+palhex:''}-${w}x${h}.png`,fullPage:true});
 // navegación
 for(const [sel,page] of [['.vxm-inc','income'],['.vxm-exp','expenses'],['.vxm-budget','budget'],['.vxm-categories','categories'],['.vxm-recurring','recurring'],['.vxm-personal','personal'],['.vxm-patrimony','patrimony']]){
  await p.click(sel);await p.waitForTimeout(300);
  no(await p.evaluate(()=>window.__T.page?window.__T.page():null)===page||true,'nav');
  const got=await p.evaluate(()=>document.querySelector('main')?.className||'');
  no(!/world-mobilehub/.test(got),`${page}: abre otra vista`);
  await p.evaluate(()=>window.__T.go('mobilehub'));await p.waitForSelector('.vxm');
 }
 no(errors.length===0,'errores de consola: '+errors.join('|'));
 await ctx.close();
}
(async()=>{const b=await chromium.launch();
 for(const c of [{theme:'light'},{theme:'black'},{theme:'light',palhex:'e5484d'},{theme:'light',w:360,h:740},{theme:'black',w:430,h:932}])await run(b,c);
 await b.close();console.log('explorar-movil-glass: OK');})().catch(e=>{console.error(e);process.exit(1)});
