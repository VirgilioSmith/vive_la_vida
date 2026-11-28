'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const open=require('./harness');
process.env.FREEZE='2026-11-28T13:00:00Z';
(async()=>{
 const browser=await (process.env.WRAPPED_BROWSER==='webkit'?webkit:chromium).launch();
 try{
  for(const [width,height,theme] of [[320,780,'light'],[390,844,'black'],[844,390,'light'],[1100,800,'black'],[1920,1080,'light']]){
   process.env.THEME=theme;
   if(width<800)process.env.TOUCH='1';else delete process.env.TOUCH;
   const {p,ctx}=await open(browser,width,height);
   const errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.evaluate(()=>{
    const db=window.__T.dbg();
    db.accounts=[{id:'historical-usd',name:'Histórica USD',opened:'2025-02-01',opening:300,currency:'USD',kind:'savings'},
     {id:'next-account',name:'Cuenta posterior',opened:'2026-03-01',opening:1700,currency:'DOP',kind:'savings'}];
    db.cards=[];db.loans=[{id:'history-loan',name:'Préstamo histórico',currency:'DOP',principal:1000,startDate:'2025-02-01',firstDue:'2025-03-01'}];db.personalLoans=[];db.certificates=[];
    db.transactions=[
     {id:'first',date:'2025-02-12',type:'income',accountId:'historical-usd',amount:200,currency:'USD'},
     {id:'later',date:'2025-03-01',type:'income',accountId:'historical-usd',amount:450,currency:'USD'},
     {id:'pay-1',date:'2025-02-15',type:'loan_payment',loanId:'history-loan',principal:400,amount:450,interest:50,currency:'DOP'},
     {id:'pay-2',date:'2025-02-17',type:'loan_payment',loanId:'history-loan',principal:600,amount:625,interest:25,currency:'DOP'},
     {id:'pending',date:'2025-02-10',type:'income',accountId:'historical-usd',amount:999,currency:'USD',postingStatus:'pending'}
    ];
    window.__T.inv();
    window.__T.go('patrimony');
   });
   await p.locator('[data-vtime-open]:visible').last().click();
   const d=p.locator('.vt-dialog[open]');
   await p.emulateMedia({reducedMotion:'reduce'});
   assert.equal(await d.evaluate(el=>el.getBoundingClientRect().width),width);
   await d.locator('[data-vt-controls]').click();
   await d.locator('[data-vt-field="date"]').fill('2025-02-15');
   await d.locator('[data-vt-field="baseline"]').fill('2026-11-28');
   assert.match(await d.locator('.vt-hero .vt-delta').innerText(),/−|-/);
   assert.doesNotMatch(await d.locator('.vt-hero .vt-delta').innerText(),/%/);
   assert.equal(await d.locator('.vt-compare .vt-zero').count(),1);
   await d.locator('[data-vt-step="1"]').click();
   assert.equal(await d.locator('[data-vt-field="date"]').inputValue(),'2025-02-16');
   await p.keyboard.press('ArrowLeft');
   assert.equal(await d.locator('[data-vt-field="date"]').inputValue(),'2025-02-15');
   await d.locator('[data-vt-field="currency"]').selectOption('USD');
   const snap=await p.evaluate(()=>ViveTimeHost.snapshot('2025-02-15','USD'));
   assert.equal(snap.net,500);
   assert.equal(snap.flows.income,200);
   const loan=await p.evaluate(()=>[ViveTimeHost.snapshot('2025-02-15','DOP'),ViveTimeHost.snapshot('2025-02-17','DOP')]);
   assert.equal(loan[0].loans,600);
   assert.equal(loan[0].flows.expense,50);
   assert.equal(loan[1].loans,0);
   assert.equal(await p.evaluate(()=>ViveTimeHost.snapshot('2025-01-31','USD')),null);
   assert.match(await d.locator('.vt-hero h2').innerText(),/500/);
   assert.ok(await d.evaluate(e=>e.scrollWidth<=e.clientWidth+1));
   assert.ok(await d.locator('.vt-compare svg').isVisible());
   await d.locator('[data-vt-field="metric"]').selectOption('utilization');
   assert.match(await d.locator('.vt-evolution').innerText(),/No hay datos verificables/);
   await d.locator('[data-vt-field="metric"]').selectOption('net');
   await d.locator('[data-vt-field="date"]').fill('2025-03-17');
   await d.locator('.vt-chart-frame button[data-vt-date="2025-02-28"]').click();
   assert.equal(await d.locator('[data-vt-field="date"]').inputValue(),'2025-02-28');
   await d.locator('[data-vt-field="date"]').fill('2025-02-15');
   assert.match(await d.locator('.vt-position').innerText(),/Períodos distintos/);
   if(process.env.VIVE_TIME_CAPTURE)await d.screenshot({path:process.env.VIVE_TIME_CAPTURE+'/'+width+'-'+theme+'.png'});
   await d.locator('.vt-timeline summary').click();
   await d.locator('.vt-timeline button').filter({hasText:'Histórica USD'}).waitFor({state:'visible'});
   await d.locator('.vt-timeline button').filter({hasText:'Capital liquidado · Préstamo histórico'}).waitFor({state:'visible'});
   await d.locator('[data-vt-wrapped="month"]').click();
   const w=p.locator('.vw-dialog[open]');
   assert.equal(await w.getAttribute('data-kind'),'month');
   assert.match(await w.locator('.vw-scene-head small').innerText(),/2025/);
   await w.locator('[data-vw-travel]').click();
   assert.equal(await d.locator('[data-vt-field="date"]').inputValue(),'2025-02-28');
   await p.keyboard.press('Escape');
   assert.deepEqual(errors,[]);
   await ctx.close();
   console.log('✓ Time Machine ↔ Wrapped · '+width+' px');
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
