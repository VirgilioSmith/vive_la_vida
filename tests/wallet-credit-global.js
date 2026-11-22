'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const open=require('./harness');
const GLOBAL='__vive_wallet_credit_global__';
const engine=process.env.WALLET_BROWSER==='webkit'?webkit:chromium;
const moneyText=s=>Number(s.replace(/[^\d.\-]/g,''));

(async()=>{
 const browser=await engine.launch({headless:true,...(process.env.WALLET_EXECUTABLE?{executablePath:process.env.WALLET_EXECUTABLE}:{})});
 try{
  for(const theme of ['light','black']){
   process.env.TOUCH='1';process.env.THEME=theme;process.env.PALHEX='#087b72';
   const {ctx,p}=await open(browser,390,844);
   const errors=[];p.on('pageerror',e=>errors.push(e.message));
   try{
    const fixture=await p.evaluate(()=>{
     const t=window.__T,d=t.dbg(),[a,b]=d.cards;
     if(!b)d.cards.push({...a,id:'wallet-test-card-2',name:'Tarjeta 2'});
     const [first,second]=d.cards;
     d.cards=[first,second];d.transactions=[];d.statements=[];d.settings.fx=60;
     Object.assign(first,{limitDOP:100000,limitUSD:1000,openingDOP:20000,openingUSD:100,archived:false});
     Object.assign(second,{limitDOP:200000,limitUSD:2000,openingDOP:50000,openingUSD:300,archived:false});
     t.inv();t.go('wallet');
     return {first:first.id,second:second.id};
    });
    const faces=p.locator('.v68-wallet-gallery .v68-wallet-face');
    const selected=p.locator('.v68-wallet-gallery .v68-wallet-face.selected');
    const waitSelected=async id=>{try{await p.waitForFunction(id=>document.querySelector('.v68-wallet-gallery .v68-wallet-face.selected')?.dataset.id===id,id,{timeout:10000})}catch(e){console.log('Carrusel:',await p.locator('.v68-wallet-gallery').evaluate(el=>({scrollLeft:el.scrollLeft,width:el.clientWidth,scrollWidth:el.scrollWidth,selected:[...el.children].map(c=>({id:c.dataset.id,left:c.getBoundingClientRect().left,selected:c.classList.contains('selected')}))})));throw e}};
    await waitSelected(fixture.first);
    await p.waitForTimeout(700);
    assert.equal(await selected.getAttribute('data-id'),fixture.first,'Apertura habitual');
    assert.equal(await faces.count(),3);
    assert.equal(await faces.first().getAttribute('data-id'),GLOBAL);
    assert.equal(await p.locator('.v68-wallet-dots button').count(),3);
    assert.equal(await p.locator('.v266-activity').count(),1);
    // Simula el deslizamiento del carrusel hacia la primera tarjeta.
    // Desplazamiento horizontal del navegador, sin forzar la selección mediante JS.
    const rail=await p.locator('.v68-wallet-gallery').boundingBox();
    await p.mouse.move(rail.x+rail.width/2,rail.y+rail.height/2);
    await p.mouse.wheel(-rail.width,0);
    await waitSelected(GLOBAL);
    const read=async s=>moneyText(await p.locator(s).innerText());
    const parts=async s=>p.locator(s).allTextContents().then(v=>v.map(moneyText));
    await p.getByRole('heading',{name:'Estado de tu crédito global'}).waitFor();
    assert.equal(await read('.v565-primary > strong'),386000);
    assert.equal(await read('.v565-secondary > b'),94000);
    assert.equal(await read('.v1244-limits > strong'),480000);
    assert.deepEqual(await parts('.v565-primary .v550-currency-breakdown b'),[230000,2600]);
    assert.deepEqual(await parts('.v565-secondary .v550-currency-breakdown b'),[70000,400]);
    assert.deepEqual(await parts('.v1244-ccy > span'),[300000,3000]);
    assert.equal(await read('.v1244-gauge b'),19.6);
    assert.equal(await p.locator('.v266-activity,.v266-wallet-actions,.v1244-cutbox,.v371-card-return,.v933-wallet-advance').count(),0);
    assert.equal(await p.evaluate(()=>window.__T.dbg().cards.length),2,'No crea producto financiero');
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    if(process.env.WALLET_SCREENSHOT)await p.screenshot({path:process.env.WALLET_SCREENSHOT+'-'+theme+'.png'});
    // Volver a una tarjeta real conserva sus acciones y su historial.
    await p.locator('.v68-wallet-dots button').nth(2).click();
    await waitSelected(fixture.second);
    await p.locator('.v266-activity').waitFor();
    assert.equal(await p.locator('.v266-wallet-actions button').count(),4);
    await p.waitForTimeout(400);
    await p.evaluate(()=>window.__T.go('overview'));
    await p.evaluate(()=>window.__T.go('wallet'));
    await waitSelected(fixture.second);
    await p.waitForTimeout(400);
    assert.equal(await selected.getAttribute('data-id'),fixture.second);
    await p.locator('.v68-wallet-dots button').first().click();
    await waitSelected(GLOBAL);
    // El saldo cambia automáticamente al actualizar los datos de una tarjeta.
    await p.evaluate(()=>{const t=window.__T;t.dbg().cards[0].openingDOP+=10000;t.inv();t.go('wallet')});
    await p.getByRole('heading',{name:'Estado de tu crédito global'}).waitFor();
    assert.equal(await read('.v565-secondary > b'),104000);
    assert.equal(await read('.v565-primary > strong'),376000);
    assert.equal(await p.locator('.v266-activity').count(),0);
    // El sobregiro en una tarjeta no consume el disponible de otra.
    await p.evaluate(()=>{const t=window.__T;t.dbg().cards[0].openingDOP=150000;t.inv();t.go('wallet')});
    assert.equal(await read('.v565-secondary > b'),224000);
    assert.deepEqual(await parts('.v565-primary .v550-currency-breakdown b'),[150000,2600]);
    assert.equal(await read('.v565-primary > strong'),306000);
    assert.deepEqual(errors,[]);
    console.log('OK Crédito Global '+theme+' · carrusel, importes, utilización, actualización y navegación');
   }finally{await ctx.close()}
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
