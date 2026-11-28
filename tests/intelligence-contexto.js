/* El contexto debe limitar tanto el anuncio como la hoja ampliada. */
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const open=require('./harness.js');

async function current(p){
 return p.evaluate(()=>{
  const { scope,findings }=window.__viveIntel.active();
  return {page:scope.page,entity:scope.entity,titles:findings.map(f=>f.title),text:findings.map(f=>f.explanation+' '+JSON.stringify(f.evidence)).join(' ')};
 });
}
async function verifySheet(p,titles){
 await p.locator('.vi-strip').click();
 const rendered=await p.locator('.vi-sheet .vi-card h4').allTextContents();
 assert.deepEqual([...rendered].sort(),[...titles].sort());
 await p.keyboard.press('Escape');
}
(async()=>{
 const browser=await (process.env.INTELLIGENCE_BROWSER==='webkit'?webkit:chromium).launch();
 try{
  for(const [width,height] of [[1440,900],[390,844]]){
   if(width===390)process.env.TOUCH='1';else delete process.env.TOUCH;
   const {p,ctx}=await open(browser,width,height);
   const errors=[];
   p.on('pageerror',err=>errors.push(err.message));
   await p.waitForFunction(()=>!!window.ViveIntelUI);
   const fixture=await p.evaluate(()=>{
    const {dbg}=window.__T;
    const data=dbg(),[a,b]=data.banks,[first,second]=data.cards;
    first.name='Tarjeta Ámbar';second.name='Tarjeta Coral';first.bankId=a.id;second.bankId=b.id;
    const date=today(),account=data.accounts.find(x=>x.bankId===a.id)||data.accounts[0];
    const id='intel-movement-alpha';
    data.transactions.push(
     {id,date,type:'expense',accountId:account.id,currency:'DOP',amount:15391,note:'Almendra Contextual',category:'Alimentos',reviewed:true},
     {id:'intel-movement-beta',date,type:'expense',accountId:account.id,currency:'DOP',amount:6778,note:'Granada Contextual',category:'Alimentos',reviewed:true},
     {id:'intel-movement-prior',date:'2024-01-15',type:'expense',accountId:account.id,currency:'DOP',amount:6212,note:'Almendra Contextual',category:'Alimentos',reviewed:true});
    const currentMonth=date.slice(0,7);
    const recurringId='intel-subscription-alpha';
    data.recurring.push({id:recurringId,name:'Suscripción Ámbar',amount:117,currency:'DOP',frequency:'monthly',category:'Servicios de prueba',active:true});
    data.transactions.push(
     {id:'intel-charge-current',recurringId,date,type:'expense',accountId:account.id,currency:'DOP',amount:117,note:'Suscripción Ámbar'},
     {id:'intel-charge-prior',recurringId,date:'2024-01-15',type:'expense',accountId:account.id,currency:'DOP',amount:91,note:'Suscripción Ámbar'});
    window.__viveIntel.invalidate();
    return {bank:a.id,card:first.id,movement:id,currentMonth};
   });
   const go=page=>p.evaluate(page=>window.__viveIntel.go(page),page);
   await go('banks');
   if(width===390){
    await p.locator('[data-act="banksPicker"]').first().click();
    const picker=p.locator('dialog.v827-picker-backdrop');
    await picker.locator(`.v789-picker-row[data-value="${fixture.bank}"]`).click();
    await picker.locator('.v789-picker-confirm').click();
   }else{
    await p.locator(`[data-act="bankDetails"][data-id="${fixture.bank}"]`).first().evaluate(el=>el.click());
   }
   await p.locator('[data-act="banksPcProducts"][data-id="cards"]').first().evaluate(el=>el.click());
   const bank=await current(p);
   assert.ok(bank.titles.some(x=>x.includes('Ámbar')));
   assert.ok(!JSON.stringify(bank).includes('Coral'));
   await p.locator(`[data-act="banksOpenProduct"][data-kind="cards"][data-id="${fixture.card}"]`).first().evaluate(el=>el.click());
   const card=await current(p);
   assert.equal(card.entity,fixture.card);
   assert.ok(!JSON.stringify(card).includes('Coral'));
   await verifySheet(p,card.titles);

   await p.locator('.vi-strip').click();
   await go('register');
   assert.equal(await p.locator('.vi-sheet').count(),0);
   if(width===390)await p.evaluate(()=>window.v708OpenMovements('list'));
   const search=p.locator(width===390?'#v708-search-input':'#searchTx');
   await search.fill('Granada Contextual');
   await p.waitForFunction(()=>window.__viveIntel.active().findings.some(f=>f.title.includes('6,778')));
   let moves=await current(p);
   assert.equal(moves.titles.length,1);
   assert.match(moves.titles[0],/6,778/);
   await verifySheet(p,moves.titles);
   await search.fill('Sin coincidencia para Intelligence');
   await p.waitForFunction(()=>!document.querySelector('.vi-strip'));
   assert.deepEqual((await current(p)).titles,[]);
   if(width===390){
    await p.evaluate(id=>window.v708OpenDetail(id),fixture.movement);
    moves=await current(p);
    assert.match(moves.titles[0],/15,391/);
    assert.ok(!JSON.stringify(moves).includes('6,778'));
    await verifySheet(p,moves.titles);
   }
   await go('recurring');
   if(width===390){
    await p.locator('[data-v911-tab="historial"]').click();
    const subscriptions=await current(p);
    assert.ok(subscriptions.titles.some(x=>x.includes('Ámbar')&&x.includes('mayor')));
    await verifySheet(p,subscriptions.titles);
   }else{
    const period=p.locator('#page #monthFilter');
    await period.fill('2024-01');
    await p.waitForFunction(()=>window.__viveIntel.active().scope.period==='2024-01');
    let subscriptions=await current(p);
    assert.match(subscriptions.text,/91\.00/);
    assert.doesNotMatch(subscriptions.text,/117\.00/);
    await period.fill(fixture.currentMonth);
    await p.waitForFunction(m=>window.__viveIntel.active().scope.period===m,fixture.currentMonth);
    subscriptions=await current(p);
    assert.match(subscriptions.text,/117\.00/);
    assert.doesNotMatch(subscriptions.text,/91\.00/);
    await verifySheet(p,subscriptions.titles);
   }
   await go('pressure');
   const day=p.locator('[data-v360-pressure-day]').first();
   const date=await day.getAttribute('data-v360-pressure-day');
   await day.evaluate(el=>el.click());
   const overlay=await p.evaluate(()=>{
    const active=window.__viveIntel.active();
    return {period:active.scope.period,attached:!!active.scope.overlay,stripOutside:!!document.querySelector('#app .vi-strip')};
   });
   assert.deepEqual(overlay,{period:date,attached:true,stripOutside:false});
   await p.locator('[data-v361-pressure-close]').last().click();
   assert.equal(await p.locator('#v361-pressure-day-dialog').count(),0);

   await go('mobilehub');
   assert.equal(await p.locator('.vi-strip').count(),0);
   assert.deepEqual(errors,[]);
   console.log('✓ '+width+' px · banco, tarjeta, búsqueda, detalle, suscripciones, calendario y períodos sin fugas');
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
