'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const open=require('./harness');
process.env.EXTRA_T='noticeFixture:source=>{v36DueItems=()=>source;v123CategoryAlerts=()=>[]}';
process.env.FREEZE='2026-11-28T13:00:00Z';

(async()=>{
 const browser=await (process.env.WRAPPED_BROWSER==='webkit'?webkit:chromium).launch();
 try{
  for(const [width,height,theme] of [[320,660,'light'],[390,844,'black'],[844,390,'light'],[1024,768,'dark'],[1920,1080,'black']]){
   process.env.THEME=theme;
   if(width<835)process.env.TOUCH='1';else delete process.env.TOUCH;
   const {p,ctx}=await open(browser,width,height);
   try{
    await p.emulateMedia({reducedMotion:'reduce'});
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.evaluate(()=>{
     const card=window.__T.dbg().cards[0];
     const source=Array.from({length:13},(_,i)=>({
      kind:'card',id:card.id,ref:card.id,date:'2026-11-'+String(16+i),
      name:i===0?'Tarjeta con un nombre largo para comprobar el ajuste de esta fila':'Tarjeta '+i,
      amount:1200+i,currency:'DOP',action:'payCard'
     }));
     window.__T.noticeFixture(source);
     window.__T.go('overview');
    });
    const launch=p.locator('[data-vn-open]:visible').first();
    await launch.click();
    const d=p.locator('.vn-dialog[open]'),scroll=d.locator('.vn-scroll');
    await d.waitFor();
    const layout=await d.evaluate(el=>{
     const r=el.getBoundingClientRect(),grid=el.querySelector('.vn-grid');
     return {width:r.width,height:r.height,overflow:el.scrollWidth>el.clientWidth+1||grid.scrollWidth>grid.clientWidth+1,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length};
    });
    assert.equal(layout.width,width);
    assert.equal(layout.height,height);
    assert.equal(layout.overflow,false);
    assert.equal(layout.columns,width>=835?2:1);
    assert.equal(await d.locator('.vn-row').count(),13);
    assert.equal(await d.locator('.vn-row button').count(),0);
    assert.equal(await d.locator('[data-vw-countdown]').innerText(),'23 h 00 min');
    if(process.env.VIVE_CENTER_CAPTURE)await d.screenshot({path:process.env.VIVE_CENTER_CAPTURE+'/'+width+'-'+theme+'.png'});
    await d.locator('[data-vn-filter="alerts"]').click();
    assert.equal(await d.locator('.vw-inbox').isVisible(),false);
    await d.locator('[data-vn-filter="all"]').click();
    await d.locator('[data-vtime-open]').click();
    await p.locator('.vt-dialog[open]').waitFor();
    const y=await scroll.evaluate(el=>el.scrollTop);
    await p.locator('.vt-dialog [data-vt-close]').click();
    assert.equal(await scroll.evaluate(el=>el.scrollTop),y);
    assert.equal(await d.locator('[data-vn-filter="all"]').getAttribute('aria-pressed'),'true');
    await d.locator('[data-vn-jump="wrapped"]').click();
    assert.equal(await d.locator('.vn-alerts').isVisible(),false);
    assert.ok(await d.locator('.vw-archive').evaluate(el=>el.open));
    const archive=d.locator('.vw-archive [data-vwrapped="year"]');
    await archive.click();
    await p.locator('.vw-dialog[open]').waitFor();
    const archiveY=await scroll.evaluate(el=>el.scrollTop);
    await p.keyboard.press('Escape');
    await p.locator('.vw-dialog[open]').waitFor({state:'detached'});
    assert.equal(await scroll.evaluate(el=>el.scrollTop),archiveY);
    assert.equal(await d.locator('[data-vn-filter="wrapped"]').getAttribute('aria-pressed'),'true');
    await d.locator('[data-vn-filter="all"]').click();
    await d.locator('[data-vn-jump="alerts"]').click();
    assert.equal(await d.locator('.vn-row').count(),13);
    await d.locator('.vn-row[data-act]').first().click();
    await d.waitFor({state:'detached'});
    await p.locator('#transactionForm').waitFor({state:'visible'});
    await p.evaluate(()=>closeModal());
    await launch.click();
    await d.locator('[data-v994-clear]').click();
    assert.match(await d.locator('.vn-rows').innerText(),/No tienes notificaciones pendientes/);
    await d.locator('[data-vn-close]').click();
    await d.waitFor({state:'detached'});
    assert.equal(await launch.evaluate(el=>document.activeElement===el),true);
    assert.equal(await launch.getAttribute('aria-label'),'Notificaciones: 0 avisos');
    await launch.click();
    await d.locator('.vn-header').evaluate(header=>{
     header.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',clientX:100,clientY:10}));
     header.dispatchEvent(new PointerEvent('pointerup',{pointerType:'touch',clientX:105,clientY:100}));
    });
    await d.waitFor({state:'detached'});
    assert.deepEqual(errors,[]);
    console.log('✓ Centro de Notificaciones · '+width+'×'+height+' · '+theme);
   }finally{await ctx.close()}
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
