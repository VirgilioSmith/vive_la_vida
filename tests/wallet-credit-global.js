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
    await waitSelected(fixture.second);
    await p.waitForTimeout(700);
    assert.equal(await selected.getAttribute('data-id'),fixture.second,'Apertura en tarjeta individual de mayor límite');
    assert.equal(await faces.count(),3);
    assert.equal(await faces.first().getAttribute('data-id'),GLOBAL);
    const cardOrder=()=>faces.evaluateAll(els=>els.map(el=>el.dataset.id));
    const dotOrder=()=>p.locator('.v68-wallet-dots button').evaluateAll(els=>els.map(el=>el.dataset.id));
    assert.deepEqual(await cardOrder(),[GLOBAL,fixture.second,fixture.first]);
    assert.deepEqual(await dotOrder(),await cardOrder());
    assert.equal(await p.locator('.v68-wallet-dots button').count(),3);
    assert.equal(await p.locator('.v266-activity').count(),1);
    // Simula el deslizamiento del carrusel hacia la primera tarjeta.
    // Desplazamiento horizontal del navegador, sin forzar la selección mediante JS.
    if(engine===webkit){
     // Playwright no implementa mouse.wheel en WebKit móvil.
     await p.locator('.v68-wallet-dots button').first().tap();
    }else{
     const rail=await p.locator('.v68-wallet-gallery').boundingBox();
     await p.mouse.move(rail.x+rail.width/2,rail.y+rail.height/2);
     await p.mouse.wheel(-rail.width,0);
    }
    await waitSelected(GLOBAL);
    const read=async s=>moneyText(await p.locator(s).innerText());
    const parts=async s=>p.locator(s).allTextContents().then(v=>v.map(moneyText));
    await p.getByRole('heading',{name:'Estado de tus créditos generales'}).waitFor();
    assert.equal(await read('.v565-primary > strong'),386000);
    assert.equal(await read('.v565-secondary > b'),94000);
    assert.equal(await read('.v1244-limits > strong'),480000);
    assert.deepEqual(await parts('.v565-primary .v550-currency-breakdown b'),[230000,2600]);
    assert.deepEqual(await parts('.v565-secondary .v550-currency-breakdown b'),[70000,400]);
    assert.deepEqual(await parts('.v1244-ccy > span'),[300000,3000]);
    assert.equal(await read('.v1244-gauge b'),19.6);
    assert.equal(await p.locator('.v266-activity').count(),0);
    assert.equal(await p.locator('.v266-wallet-actions button').count(),4);
    for(const section of ['.v1244-cutbox','.v371-card-return','.v266-wallet-note'])assert.equal(await p.locator(section).count(),1);
    assert.equal(await p.locator('.v933-wallet-advance').count(),0,'Widget eliminado del DOM');
    assert.equal(await p.evaluate(()=>window.__T.dbg().cards.length),2,'No crea producto financiero');
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    if(process.env.WALLET_SCREENSHOT)await p.screenshot({path:process.env.WALLET_SCREENSHOT+'-'+theme+'.png'});
    // Volver a una tarjeta real conserva sus acciones y su historial.
    await p.locator('.v68-wallet-dots button').nth(2).click();
    await waitSelected(fixture.first);
    await p.locator('.v266-activity').waitFor();
    assert.equal(await p.locator('.v266-wallet-actions button').count(),4);
    // Corte conserva el detalle del ciclo, bajo Wallet, y permite regresar.
    await p.locator('.v266-wallet-actions [data-act="goCard"]').click();
    await p.locator('.v1190-card').waitFor();
    assert.ok(await p.getByRole('heading',{name:'Estado del ciclo'}).count()>0);
    assert.equal(await p.locator('.vive-mobile-dock [data-id="wallet"]').getAttribute('aria-current'),'page');
    assert.equal(await p.locator('.v375-cards-bank').count(),0);
    await p.getByRole('button',{name:'Volver a Wallet'}).click();
    await waitSelected(fixture.first);
    await p.locator('.vive-mobile-dock [data-id="banks"]').click();
    assert.equal(await p.locator('.v206-banks-switch [data-v206-tab="cards"]').count(),0);
    for(const tab of ['banks','accounts','loans','certificates'])assert.equal(await p.locator('.v206-banks-switch [data-v206-tab="'+tab+'"]').count(),1);
    await p.evaluate(()=>window.__T.go('cards'));
    await waitSelected(fixture.first);
    assert.equal(await p.evaluate(()=>window.__T.ui().page),'wallet');
    assert.equal(await p.locator('.v375-cards-bank').count(),0);
    await p.waitForTimeout(400);
    await p.evaluate(()=>window.__T.go('overview'));
    await p.evaluate(()=>window.__T.go('wallet'));
    await waitSelected(fixture.first);
    await p.waitForTimeout(400);
    assert.equal(await selected.getAttribute('data-id'),fixture.first);
    await p.locator('.v68-wallet-dots button').first().click();
    await waitSelected(GLOBAL);
    // El saldo cambia automáticamente al actualizar los datos de una tarjeta.
    await p.evaluate(()=>{const t=window.__T;t.dbg().cards[0].openingDOP+=10000;t.inv();t.go('wallet')});
    await p.getByRole('heading',{name:'Estado de tus créditos generales'}).waitFor();
    assert.equal(await read('.v565-secondary > b'),104000);
    assert.equal(await read('.v565-primary > strong'),376000);
    assert.equal(await p.locator('.v266-activity').count(),0);
    // El sobregiro en una tarjeta no consume el disponible de otra.
    await p.evaluate(()=>{const t=window.__T;t.dbg().cards[0].openingDOP=150000;t.inv();t.go('wallet')});
    assert.equal(await read('.v565-secondary > b'),224000);
    assert.deepEqual(await parts('.v565-primary .v550-currency-breakdown b'),[150000,2600]);
    assert.equal(await read('.v565-primary > strong'),306000);
    // Mayor límite en RD$ no equivale necesariamente a mayor límite consolidado.
    await p.evaluate(()=>{const t=window.__T;t.dbg().cards[0].limitDOP=250000;t.inv();t.go('wallet')});
    assert.deepEqual(await cardOrder(),[GLOBAL,fixture.second,fixture.first]);
    await p.locator('.v68-wallet-dots button').nth(1).click();
    await waitSelected(fixture.second);
    // Si cambia el límite, se actualiza el orden sin cambiar la tarjeta seleccionada.
    await p.evaluate(()=>{const t=window.__T;t.dbg().cards[0].limitDOP=270000;t.inv();t.go('wallet')});
    assert.deepEqual(await cardOrder(),[GLOBAL,fixture.first,fixture.second]);
    assert.deepEqual(await dotOrder(),await cardOrder());
    await p.waitForTimeout(400);
    assert.equal(await selected.getAttribute('data-id'),fixture.second);
    assert.deepEqual(await p.evaluate(()=>window.__T.dbg().cards.map(c=>c.id)),[fixture.first,fixture.second],'No reordena los registros originales');
    // Cortes, beneficios y avances globales calculados con dos tarjetas y ambas monedas.
    const cuts=await p.evaluate(()=>{
     const t=window.__T,d=t.dbg(),[a,b]=d.cards,date=t.fn.today(),accountId=d.accounts[0].id;
     d.settings.fx=60;t.ui().month=date.slice(0,7);
     Object.assign(a,{annualFeeAmount:1000,annualFeeCurrency:'DOP',openingBilledDOP:a.openingDOP,openingBilledUSD:a.openingUSD});
     Object.assign(b,{annualFeeAmount:20,annualFeeCurrency:'USD',openingBilledDOP:b.openingDOP,openingBilledUSD:b.openingUSD});
     const tx=(id,type,cardId,currency,amount,extra={})=>({id,type,cardId,currency,amount,date,created:date+'T12:00:00Z',note:'Prueba Wallet',...extra});
     d.transactions=[
      tx('wallet-fee-a','card_charge',a.id,'DOP',1200,{chargeKind:'annual_fee'}),
      tx('wallet-reward-a','bank_reward',a.id,'DOP',600,{accountId}),
      tx('wallet-reward-b','bank_reward',b.id,'USD',40,{accountId}),
      tx('wallet-advance-a','card_advance',a.id,'DOP',1065,{advanceNet:1000,advanceFee:65,advanceFeePct:6.5,toAccountId:accountId}),
      tx('wallet-advance-b','card_advance',b.id,'USD',106.5,{advanceNet:100,advanceFee:6.5,advanceFeePct:6.5,toAccountId:d.accounts.find(x=>x.currency==='USD')?.id||accountId})
     ];
     t.inv();t.go('wallet');
     return ['DOP','USD'].map(ccy=>d.cards.reduce((s,c)=>s+t.cs(c.id,ccy).billed,0));
    });
    await p.locator('.v68-wallet-dots button').first().click();
    await waitSelected(GLOBAL);
    assert.deepEqual(await parts('.v1244-pill em'),cuts);
    assert.match(await p.locator('.v1244-cuthead strong').innerText(),/CORTES ATRASADOS/);
    assert.deepEqual(await parts('.v371-return-tile strong'),[2400,3000,600,25]);
    // El widget informativo ya no existe, incluso con avances registrados.
    const absent=async()=>assert.equal(await p.locator('.v933-wallet-advance,[aria-label="Avance de efectivo del mes"]').count(),0);
    await absent();
    for(const id of [fixture.first,fixture.second]){
     await p.locator('.v68-wallet-dots button[data-id="'+id+'"]').click();
     await waitSelected(id);
     await absent();
     assert.equal(await p.locator('.v266-wallet-actions [data-v900-action="advance"]').count(),1,'Conserva la acción operativa');
    }
    await p.locator('.v68-wallet-dots button').first().click();
    await waitSelected(GLOBAL);
    await absent();
    assert.equal(await p.locator('.v266-activity').count(),0);
    // El corte global abre el desglose real por tarjeta y moneda.
    await p.locator('.v266-wallet-actions [data-mode="cuts"]').click();
    const cutDialog=p.locator('.v176-card-insight-modal');
    await cutDialog.waitFor();
    assert.equal(await cutDialog.locator('.v176-credit-row').count(),4);
    await cutDialog.locator('.v176-credit-row[data-id="'+fixture.first+'"]').first().click();
    await p.locator('.v1190-card').waitFor();
    assert.equal(await p.evaluate(()=>window.__T.ui().cardId),fixture.first);
    await p.getByRole('button',{name:'Volver a Wallet'}).click();
    await waitSelected(GLOBAL);
    const picker=p.locator('.v789-product-backdrop');
    const choose=async id=>{await picker.waitFor();assert.equal(await picker.locator('.v789-picker-row').count(),2);assert.equal(await picker.locator('[data-value="'+GLOBAL+'"]').count(),0);await picker.locator('[data-value="'+id+'"]').click();await picker.locator('.v789-picker-confirm').click()};
    const closeForm=async()=>{await p.locator('#modal-root [data-act="closeModal"]').first().evaluate(el=>el.click());await p.waitForTimeout(200)};
    await p.locator('.v1244-pill[data-ccy="USD"]').click();
    await choose(fixture.first);
    await p.locator('#modal-root form [name="cardId"]').first().waitFor({state:'attached'});
    assert.equal(await p.locator('#modal-root form [name="cardId"]').first().inputValue(),fixture.first);
    await closeForm();
    await p.locator('.v266-wallet-actions [data-mode="pay"]').click();
    await choose(fixture.second);
    await p.locator('#modal-root form [name="cardId"]').first().waitFor({state:'attached'});
    assert.equal(await p.locator('#modal-root form [name="cardId"]').first().inputValue(),fixture.second);
    await closeForm();
    await p.locator('.v266-wallet-actions [data-mode="advance"]').click();
    await choose(fixture.second);
    await p.locator('#v900AdvanceForm').waitFor();
    assert.equal(await p.locator('#v900AdvanceForm [name="cardId"]').inputValue(),fixture.second);
    await closeForm();
    await p.locator('.v266-wallet-actions [data-mode="edit"]').click();
    await choose(fixture.first);
    await p.locator('#cardForm').waitFor();
    assert.equal(await p.locator('#cardForm [name="name"]').inputValue(),await p.evaluate(()=>window.__T.dbg().cards[0].name));
    await closeForm();
    assert.equal(await p.evaluate(()=>window.__T.dbg().transactions.length),5,'Las consultas y formularios sin confirmar no crean transacciones');
    await p.locator('.v371-return-action').click();
    assert.equal(await p.evaluate(()=>window.__T.ui().v144BenefitsCard),'all');
    await p.locator('#v230BenefitsWorkspace').waitFor();
    await p.getByRole('button',{name:'Volver a Wallet'}).click();
    await waitSelected(GLOBAL);
    // Consumo real: compras históricas, meses sin actividad y cargos no computables.
    await p.evaluate(()=>{
     const t=window.__T,d=t.dbg(),[a,b]=d.cards,now=t.fn.today();
     const first=t.fn.plusMonths(now.slice(0,7)+'-01',-14),previous=t.fn.plusMonths(now.slice(0,7)+'-01',-2);
     const row=(id,type,c,currency,amount,date=now,extra={})=>({id,type,cardId:c.id,currency,amount,date,created:date+'T12:00:00Z',...extra});
     d.transactions=[row('h1','card_charge',a,'DOP',10000,first),row('h2','card_charge',a,'DOP',1000),row('h3','card_charge',a,'USD',100),row('h4','card_charge',b,'USD',500,previous),row('h5','card_charge',b,'DOP',1000),row('payment','card_payment',a,'DOP',50000),row('fee','card_charge',a,'DOP',2000,now,{chargeKind:'annual_fee'}),row('insurance','card_charge',b,'USD',25,now,{chargeKind:'insurance'}),row('interest','card_charge',a,'USD',20,now,{chargeKind:'interest'}),row('advance','card_advance',b,'DOP',10000),row('refund','card_refund',b,'DOP',50),row('reward','card_reward',a,'DOP',100)];
     t.inv();t.go('wallet');
    });
    assert.equal(await faces.first().getAttribute('aria-label'),'Seleccionar Créditos generales');
    const hist=p.locator('.v1301-history'),graph=hist.locator('.v1301-chart');
    assert.deepEqual(await parts('.v1301-history-total strong,.v1301-history-total b'),[12000,600]);
    assert.deepEqual(await parts('.v1301-history-stats > div:nth-child(2) strong,.v1301-history-stats > div:nth-child(2) b'),[800,40]);
    assert.deepEqual(await parts('[data-v1301-dop],[data-v1301-usd]'),[2000,100]);
    assert.equal(await graph.getAttribute('aria-valuemax'),'14','Incluye todos los meses y cruza años');
    assert.equal(await graph.getAttribute('aria-valuenow'),'14');
    assert.equal(await hist.locator('.v1301-dot').count(),1);
    assert.equal(await graph.locator('.v1301-line').evaluate(el=>getComputedStyle(el).fill),'none');
    assert.equal(await hist.evaluate(el=>el.previousElementSibling.classList.contains('v371-card-return')),true);
    await graph.scrollIntoViewIfNeeded();
    const box=await graph.boundingBox();
    await graph.tap({position:{x:box.width*44/320+1,y:box.height/2}});
    assert.equal(await graph.getAttribute('aria-valuenow'),'0');
    assert.deepEqual(await parts('[data-v1301-dop],[data-v1301-usd]'),[10000,0]);
    await p.mouse.move(box.x+box.width*44/320+1,box.y+box.height/2);await p.mouse.down();
    await p.mouse.move(box.x+box.width*310/320,box.y+box.height/2,{steps:10});await p.mouse.up();
    assert.equal(await graph.getAttribute('aria-valuenow'),'14');
    assert.deepEqual(await parts('[data-v1301-dop],[data-v1301-usd]'),[2000,100]);
    await graph.focus();await p.keyboard.press('ArrowLeft');
    assert.deepEqual(await parts('[data-v1301-dop],[data-v1301-usd]'),[0,0]);
    await p.keyboard.press('End');
    const consumption=p.locator('.v1301-distribution[data-v1301-kind="consumption"]'),limits=p.locator('.v1301-distribution[data-v1301-kind="limits"]');
    assert.equal(await consumption.getAttribute('open'),null);
    for(const item of [consumption,limits]){
     await item.locator('summary').tap();assert.notEqual(await item.getAttribute('open'),null);
     assert.equal(await item.locator('.v1301-stack i').count(),2);
     assert.equal(await item.locator('.v1301-mini .credit-network').count(),2);
     assert.equal(await item.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
     assert.equal(await item.locator('.v1301-distribution-body').innerText().then(t=>t.includes('%')),false);
    }
    assert.deepEqual(await consumption.locator('.v1301-rank').evaluateAll(els=>els.map(e=>e.dataset.cardId)),[fixture.second,fixture.first]);
    assert.deepEqual(await limits.locator('.v1301-rank').evaluateAll(els=>els.map(e=>e.dataset.cardId)),[fixture.first,fixture.second]);
    assert.equal(moneyText(await consumption.locator('.v1301-total strong').innerText()),48000);
    assert.deepEqual(await consumption.locator('.v1301-equivalent').allTextContents().then(a=>a.map(moneyText)),[31000,17000]);
    assert.equal(moneyText(await limits.locator('.v1301-total strong').innerText()),650000);
    for(const item of [consumption,limits]){await item.locator('summary').tap();assert.equal(await item.getAttribute('open'),null)}
    for(const [id,amounts] of [[fixture.first,[11000,100]],[fixture.second,[1000,500]]]){
     await p.locator('.v68-wallet-dots button[data-id="'+id+'"]').click();await waitSelected(id);
     assert.deepEqual(await parts('.v1301-history-total strong,.v1301-history-total b'),amounts);
     assert.equal(await p.locator('.v1301-distribution').count(),0);
    }
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    assert.deepEqual(errors,[]);
    console.log('OK Créditos generales '+theme+' · carrusel, importes, distribución, histórico, interacción y navegación');
   }finally{await ctx.close()}
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
