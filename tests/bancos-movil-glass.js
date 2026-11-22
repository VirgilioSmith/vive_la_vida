'use strict';
/* Bancos móvil · rediseño Liquid Glass: ocho pantallas, interacciones, acentos y modos Claro/Black. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const open=require('./harness');

async function run(browser,{theme,palhex}){
 process.env.TOUCH='1';process.env.THEME=theme;
 if(palhex)process.env.PALHEX=palhex;else delete process.env.PALHEX;
 const {ctx,p}=await open(browser,390,844);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const tag=`${theme}${palhex?' '+palhex:''}`;
 const no=(cond,msg)=>assert.ok(cond,`[${tag}] ${msg}`);
 const pick=async name=>{await p.click('.vBanks-mobile-selector');await p.waitForSelector('dialog.vBanks-picker');await p.locator('dialog button',{hasText:name}).first().click();await p.locator('dialog button',{hasText:'Continuar'}).first().click();await p.waitForTimeout(350)};
 const home=async()=>{for(let i=0;i<3;i++){const b=await p.$('.vBanks-back');if(b){await b.click();await p.waitForTimeout(250)}}};
 const noOverflow=async label=>no(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label}: desborde horizontal`);
 await p.evaluate(()=>window.__T.go('banks'));await p.waitForSelector('.vBanks-mobile');
 // 1 · consolidada
 no(await p.locator('.vBanks-mobile-head h1').innerText()==='Bancos','título Bancos');
 no(await p.locator('.vBanks-mobile-hero').count()===1,'KPI principal');
 no(await p.locator('.vBanks-filter-btn').count()===1,'botón de filtro');
 const heroBg=await p.locator('.vBanks-mobile-hero').evaluate(e=>getComputedStyle(e).backgroundImage);
 no(/gradient/.test(heroBg),'KPI coloreado con degradado del acento');
 const tileBorder=await p.locator('.vBanks-mobile-products').evaluate(e=>getComputedStyle(e).borderTopWidth);
 no(tileBorder==='0px','superficies de cristal sin borde');
 await noOverflow('consolidada');
 // 2 · selector
 await p.click('.vBanks-mobile-selector');await p.waitForSelector('dialog.vBanks-picker');
 no(await p.locator('dialog.vBanks-picker .v789-picker-row').count()>=3,'selector con instituciones');
 await p.locator('dialog button',{hasText:'Cancelar'}).first().click();await p.waitForTimeout(250);
 // 3 · individual
 await pick('Banco Modelo A');
 no((await p.locator('.vBanks-mobile-selector small').innerText()).includes('Vista individual'),'vista individual');
 await noOverflow('individual');
 await pick('Todos los bancos');
 // 4-7 · productos
 const shapes={accounts:'Fondos disponibles',cards:'Deuda utilizada',loans:'Capital pendiente',certificates:'Total invertido'};
 for(const [k,label] of Object.entries(shapes)){
  await home();
  await p.click(`.vBanks-mobile-tiles [data-id="${k}"]`);await p.waitForSelector('.vBanks-mobile-screen');
  no((await p.locator('.vBanks-kpi').innerText()).includes(label),`${k}: KPI «${label}»`);
  no(await p.locator('.vBanks-back').count()===1,`${k}: botón volver`);
  no(await p.locator('.vBanks-sub-cta').count()===1,`${k}: acción de agregar`);
  await noOverflow(k);
  const row=p.locator('.vBanksPc-product').first();
  if(await row.count()){await row.click();await p.waitForTimeout(400);
   no(await p.locator('.vBanks-detail,.vBanksPc-card-detail').count()>0,`${k}: el producto abre su detalle`);
   await p.evaluate(()=>{const c=document.querySelector('[data-act="banksCloseProduct"]');c&&c.click()});await p.waitForTimeout(300)}
 }
 // volver
 await home();no(await p.locator('.vBanks-mobile-hero').count()===1,'volver devuelve al resumen');
 // 8 · beneficios
 await p.evaluate(()=>document.querySelector('[data-v144-action="open-benefits"]')?.click());await p.waitForTimeout(400);
 no(await p.locator('.vBanksPc-benefits').count()===1,'pantalla de beneficios');
 await noOverflow('beneficios');
 no(errors.length===0,'errores de página: '+errors.join('|'));
 await ctx.close();
}
module.exports=async function bancosMovilGlass(browser){
 for(const cfg of [{theme:'light'},{theme:'black'},{theme:'light',palhex:'#e0457b'},{theme:'black',palhex:'#16a085'}])await run(browser,cfg);
 console.log('Bancos móvil (8 pantallas, Claro/Black, 3 acentos) validado con Playwright.');
};
if(require.main===module)(async()=>{const b=await chromium.launch();try{await module.exports(b)}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
