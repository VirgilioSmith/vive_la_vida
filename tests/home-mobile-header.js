'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const open=require('./harness');
const engine=process.env.HOME_BROWSER==='webkit'?webkit:chromium;
(async()=>{
 const browser=await engine.launch({headless:true});
 try{
  for(const theme of ['light','black'])for(const width of [320,390,430]){
   process.env.TOUCH='1';process.env.THEME=theme;process.env.PALHEX='#087b72';
   const {ctx,p}=await open(browser,width,844);
   try{
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.evaluate(()=>{const t=window.__T;t.dbg().settings.mobilePositionStyle='matrix';t.go('overview')});
    const row=p.locator('.v1302-home-controls'),personalize=row.locator('.v273-personalize-link'),period=row.locator('.v732-period'),matrix=p.locator('.v985-matrix');
    await matrix.waitFor({state:'visible'});
    assert.equal(await p.locator('.vive-mobile-top .v146-mobile-date').count(),0);
    assert.equal(await p.locator('.vive-mobile-greeting h1').count(),0);
    assert.equal(await p.locator('.vive-mobile-greeting p').count(),0);
    const [a,b,c]=await Promise.all([personalize.boundingBox(),period.boundingBox(),matrix.boundingBox()]);
    assert.ok(Math.abs(a.y+a.height/2-b.y-b.height/2)<=2,'Controles centrados en la misma fila');
    assert.ok(a.x+a.width<=b.x,'Controles sin solapamiento');
    assert.ok(c.y>=b.y+b.height-1&&c.y-b.y-b.height<40,'Matriz inmediatamente debajo');
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    const month=await p.evaluate(()=>window.__T.ui().month),target=month==='2026-10'?'2026-09':'2026-10';
    await period.locator('input').fill(target);
    await p.waitForFunction(val=>window.__T.ui().month===val,target);
    await personalize.tap();
    await p.waitForFunction(()=>window.__T.ui().page==='personalize');
    assert.equal(await p.locator('.vive-mobile-top .v146-mobile-date').count(),0);
    assert.deepEqual(errors,[]);
    console.log(`OK Inicio ${theme} ${width}px: encabezado compacto, mes y Personalizar`);
   }finally{await ctx.close()}
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
