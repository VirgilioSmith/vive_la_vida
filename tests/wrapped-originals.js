'use strict';
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const open=require('./harness');
process.env.FREEZE='2026-11-28T13:00:00Z';

(async()=>{
 const browser=await (process.env.WRAPPED_BROWSER==='webkit'?webkit:chromium).launch();
 try{
  for(const width of [390,1440]){
   if(width===390)process.env.TOUCH='1';else delete process.env.TOUCH;
   const {p,ctx}=await open(browser,width,844);
   await p.emulateMedia({reducedMotion:'reduce'});
   const errors=[];p.on('pageerror',e=>errors.push(e.message));
   try{
    await p.evaluate(()=>{
     const db=window.__T.dbg(),id='originals-loan';
     db.loans.push({id,name:'Préstamo de prueba',currency:'DOP',principal:90000,startDate:'2026-06-01',firstDue:'2026-06-27'});
     for(let i=0;i<6;i++)db.transactions.push({
      id:'originals-payment-'+i,loanId:id,type:'loan_payment',date:'2026-'+String(i+6).padStart(2,'0')+'-27',
      principal:15000,amount:15000,currency:'DOP'
     });
     db.transactions.push({id:'originals-daily-income',date:'2026-11-27',type:'income',accountId:db.accounts[0].id,
      amount:2500,currency:'DOP',category:'Otros ingresos'});
     window.__T.inv();
     window.__T.go('overview');
    });
    const bell=p.locator('.vn-dialog');
    await p.locator('[data-vn-open]:visible').first().click();
    const special=bell.locator('.vw-special-new [data-vwrapped="special"]');
    await special.waitFor({state:'visible'});
    assert.equal(await special.locator('[data-vw-countdown]').count(),0);
    await special.click();
    const dialog=p.locator('.vw-dialog[open]');
    assert.equal(await dialog.getAttribute('data-kind'),'special');
    assert.equal(await dialog.locator('.vw-scene').evaluate(el=>getComputedStyle(el).animationName),'none');
    if(process.env.VIVE_ORIGINALS_CAPTURE)await dialog.screenshot({path:process.env.VIVE_ORIGINALS_CAPTURE+'/'+width+'.png'});
    assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    assert.equal(await dialog.locator('.vw-period-nav').count(),0);
    await p.keyboard.press('ArrowRight');
    assert.equal(await dialog.getAttribute('data-scene'),'milestone');
    await p.keyboard.press('Escape');
    await dialog.waitFor({state:'detached'});
    await bell.locator('[data-vn-filter="wrapped"]').click();
    const archive=bell.locator('.vw-archive');
    await archive.locator('summary').click();
    assert.equal(await special.count(),0);
    await archive.locator('[data-vwrapped="special"]').click();
    assert.equal(await dialog.getAttribute('data-scene'),'milestone');
    await dialog.locator('[data-vw-next]').click();
    await dialog.locator('[data-vw-next]').click();
    await dialog.waitFor({state:'detached'});
    await bell.locator('[data-vn-filter="wrapped"]').click();
    if(!await archive.evaluate(el=>el.open))await archive.locator('summary').click();
    await archive.locator('[data-vwrapped="special"]').click();
    assert.equal(await dialog.getAttribute('data-scene'),'cover');
    await dialog.locator('[data-vw-travel]').click();
    assert.equal(await p.locator('.vt-dialog [data-vt-field="date"]').inputValue(),'2026-11-27');
    await p.keyboard.press('Escape');
    await p.locator('.vt-dialog').waitFor({state:'detached'});
    assert.equal(await dialog.getAttribute('data-scene'),'cover');
    await p.keyboard.press('Escape');
    await bell.locator('[data-vn-filter="wrapped"]').click();
    if(!await archive.evaluate(el=>el.open))await archive.locator('summary').click();
    await archive.locator('[data-vwrapped="day"]').click();
    await dialog.locator('[data-vw-next]').click();
    const dailyScene=await dialog.getAttribute('data-scene');
    assert.notEqual(dailyScene,'cover');
    await p.keyboard.press('Escape');
    await dialog.waitFor({state:'detached'});
    await bell.locator('[data-vn-filter="wrapped"]').click();
    await bell.locator('.vw-resume').click();
    assert.equal(await dialog.getAttribute('data-kind'),'day');
    assert.equal(await dialog.getAttribute('data-scene'),dailyScene);
    await p.keyboard.press('Escape');
    assert.deepEqual(errors,[]);
    console.log('✓ Originals · especial, reanudación, replay y Time Machine · '+width+' px');
   }finally{await ctx.close()}
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
