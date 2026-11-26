'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('playwright');
const open=require('./harness');
const GLOBAL='__vive_wallet_credit_global__';
const engine=process.env.WALLET_BROWSER==='webkit'?webkit:chromium;
const moneyText=s=>Number(s.replace(/[^\d.\-]/g,''));

(async()=>{
 const browser=await engine.launch({headless:true,...(process.env.WALLET_EXECUTABLE?{executablePath:process.env.WALLET_EXECUTABLE}:{})});
 try{
  await require('./wallet-desktop')(browser);
  if(engine===chromium)await require('./bancos-patrimonio')(browser);
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
    const openTools=async()=>{assert.ok(await p.locator('.wallet-mobile-summary .v266-wallet-actions').isVisible(),'Acciones superiores ocultas')};
    const noConsumptionHistory=async()=>{
     assert.equal(await p.locator('.v1301-history,.v1301-chart,[data-v1301-month],[data-v1301-points]').count(),0,'El widget no existe en el DOM');
     for(const label of ['Histórico de consumo','Evolución del consumo','Promedio mensual'])assert.equal(await p.locator('.v68-wallet').getByText(label,{exact:true}).count(),0);
    };
    const waitSelected=async id=>{try{await p.waitForFunction(id=>document.querySelector('.v68-wallet-gallery .v68-wallet-face.selected')?.dataset.id===id,id,{timeout:10000})}catch(e){console.log('Carrusel:',await p.locator('.v68-wallet-gallery').evaluate(el=>({scrollLeft:el.scrollLeft,width:el.clientWidth,scrollWidth:el.scrollWidth,selected:[...el.children].map(c=>({id:c.dataset.id,left:c.getBoundingClientRect().left,selected:c.classList.contains('selected')}))})));throw e}};
    await waitSelected(GLOBAL);
    await p.waitForTimeout(700);
    assert.equal(await selected.getAttribute('data-id'),GLOBAL,'Apertura en Créditos generales (diseño aprobado)');
    assert.equal(await faces.count(),3);
    assert.equal(await faces.first().getAttribute('data-id'),GLOBAL);
    const cardOrder=()=>faces.evaluateAll(els=>els.map(el=>el.dataset.id));
    const dotOrder=()=>p.locator('.v68-wallet-dots button').evaluateAll(els=>els.map(el=>el.dataset.id));
    assert.deepEqual(await cardOrder(),[GLOBAL,fixture.second,fixture.first]);
    assert.deepEqual(await dotOrder(),await cardOrder());
    assert.equal(await p.locator('.v68-wallet-dots button').count(),3);
    assert.equal(await p.locator('.v266-activity').count(),0);
    await noConsumptionHistory();
    // Simula el deslizamiento del carrusel hacia la primera tarjeta.
    // Desplazamiento horizontal del navegador, sin forzar la selección mediante JS.
    if(engine===webkit){
     // Playwright no implementa mouse.wheel en WebKit móvil.
     await openTools();await p.locator('.v68-wallet-dots button').first().tap();
    }else{
     await openTools();const rail=await p.locator('.v68-wallet-gallery').boundingBox();
     await p.mouse.move(rail.x+rail.width/2,rail.y+rail.height/2);
     await p.mouse.wheel(-rail.width,0);
    }
    await waitSelected(GLOBAL);
    const read=async s=>moneyText(await p.locator(s).innerText());
    const parts=async s=>p.locator(s).allTextContents().then(v=>v.map(moneyText));
    await p.getByRole('heading',{name:'Estado del crédito',exact:true}).waitFor();
    await noConsumptionHistory();
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
    await openTools();await p.locator('.v68-wallet-dots button').nth(2).click();
    await waitSelected(fixture.first);
    assert.equal(await p.locator('.v266-activity').count(),0);
    assert.equal(await p.locator('.v266-wallet-actions button').count(),4);
    // Corte conserva el detalle del ciclo, bajo Wallet, y permite regresar.
    await openTools();await p.locator('.v266-wallet-actions [data-act="goCard"]').click();
    await p.locator('.v1190-card').waitFor();
    assert.ok(await p.getByRole('heading',{name:'Estado del ciclo'}).count()>0);
    assert.equal(await p.locator('.vive-mobile-dock [data-id="wallet"]').getAttribute('aria-current'),'page');
    assert.equal(await p.locator('.v375-cards-bank').count(),0);
    await p.getByRole('button',{name:'Volver a Wallet'}).click();
    await waitSelected(fixture.first);
    await p.locator('.vive-mobile-dock [data-id="banks"]').click();
    assert.equal(await p.locator('.vBanks-mobile-selector').count(),1);
    assert.deepEqual(await p.locator('.vBanks-mobile-tiles button').evaluateAll(buttons=>buttons.map(button=>button.dataset.id)),['accounts','cards','loans','certificates']);
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
    await openTools();await p.locator('.v68-wallet-dots button').first().click();
    await waitSelected(GLOBAL);
    // El saldo cambia automáticamente al actualizar los datos de una tarjeta.
    await p.evaluate(()=>{const t=window.__T;t.dbg().cards[0].openingDOP+=10000;t.inv();t.go('wallet')});
    await p.getByRole('heading',{name:'Estado del crédito',exact:true}).waitFor();
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
    await openTools();await p.locator('.v68-wallet-dots button').nth(1).click();
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
    await openTools();await p.locator('.v68-wallet-dots button').first().click();
    await waitSelected(GLOBAL);
    assert.deepEqual(await parts('.v1244-pill em'),cuts);
    assert.match(await p.locator('.v1244-cuthead strong').innerText(),/CORTES ATRASADOS/);
    assert.deepEqual(await parts('.v371-return-tile strong'),[2400,3000,600,25]);
    // El widget informativo ya no existe, incluso con avances registrados.
    const absent=async()=>assert.equal(await p.locator('.v933-wallet-advance,[aria-label="Avance de efectivo del mes"]').count(),0);
    await absent();
    for(const id of [fixture.first,fixture.second]){
     await openTools();await p.locator('.v68-wallet-dots button[data-id="'+id+'"]').click();
     await waitSelected(id);
     await absent();
     assert.equal(await p.locator('.v266-wallet-actions [data-v900-action="advance"]').count(),1,'Conserva la acción operativa');
    }
    await openTools();await p.locator('.v68-wallet-dots button').first().click();
    await waitSelected(GLOBAL);
    await absent();
    assert.equal(await p.locator('.v266-activity').count(),0);
    // El corte global abre el desglose real por tarjeta y moneda.
    await openTools();await p.locator('.v266-wallet-actions [data-mode="cuts"]').click();
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
    await openTools();await p.locator('.v266-wallet-actions [data-mode="pay"]').click();
    await choose(fixture.second);
    await p.locator('#modal-root form [name="cardId"]').first().waitFor({state:'attached'});
    assert.equal(await p.locator('#modal-root form [name="cardId"]').first().inputValue(),fixture.second);
    await closeForm();
    await openTools();await p.locator('.v266-wallet-actions [data-mode="advance"]').click();
    await choose(fixture.second);
    await p.locator('#v900AdvanceForm').waitFor();
    assert.equal(await p.locator('#v900AdvanceForm [name="cardId"]').inputValue(),fixture.second);
    await closeForm();
    await openTools();await p.locator('.v266-wallet-actions [data-mode="edit"]').click();
    await choose(fixture.first);
    await p.locator('#cardForm').waitFor();
    assert.equal(await p.locator('#cardForm [name="name"]').inputValue(),await p.evaluate(()=>window.__T.dbg().cards[0].name));
    await closeForm();
    assert.equal(await p.locator('.v1244-cuthead > .wallet-cut-status').count(),1);
    const glass=await p.locator('.v1244-state').evaluate(el=>{
     const css=getComputedStyle(el);
     return [css.backdropFilter||css.webkitBackdropFilter,css.borderTopLeftRadius];
    });
    assert.ok(parseInt(glass[1],10)>=20,'Radio Liquid Glass aprobado');   // el motor Liquid Glass gestiona el desenfoque a nivel de contenedor
    await p.getByRole('button',{name:'Registrar beneficio',exact:true}).click();
    await choose(fixture.first);
    await p.locator('#v144CashbackForm').waitFor();
    await closeForm();
    await p.getByRole('button',{name:'Anualidad y seguros',exact:true}).click();
    await choose(fixture.second);
    await p.locator('#annualFeeForm').waitFor();
    await closeForm();
    assert.equal(await p.evaluate(()=>window.__T.dbg().transactions.length),5,'Las consultas y formularios sin confirmar no crean transacciones');
    await p.locator('.v371-return-action').click();
    assert.equal(await p.evaluate(()=>window.__T.ui().v144BenefitsCard),'all');
    await p.locator('.wallet-benefits-mobile').waitFor();
    assert.equal(await p.locator('.wallet-benefits-cards button').count(),2);
    await p.locator('.wallet-benefits-cards button').first().click();
    assert.equal(await p.locator('.wallet-benefits-cards button[aria-pressed="true"]').count(),1);
    await p.getByRole('button',{name:'Ver todas las tarjetas'}).click();
    assert.equal(await p.locator('.wallet-benefits-cards button[aria-pressed="true"]').count(),0);
    await p.getByRole('button',{name:'Volver a Wallet'}).click();
    await waitSelected(GLOBAL);
    // Consumo real: compras históricas, meses sin actividad y cargos no computables.
    await p.evaluate(()=>{
     const t=window.__T,d=t.dbg(),[a,b]=d.cards,now=t.fn.today();
     // Logos reales se leen de las entidades emisoras, nunca del diseño de la tarjeta.
     const logo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT6sAAAAASUVORK5CYII=';
     for(const c of [a,b]){const bank=d.banks.find(x=>x.id===c.bankId);if(bank)bank.logo=logo;}
     const first=t.fn.plusMonths(now.slice(0,7)+'-01',-14),previous=t.fn.plusMonths(now.slice(0,7)+'-01',-2);
     const row=(id,type,c,currency,amount,date=now,extra={})=>({id,type,cardId:c.id,currency,amount,date,created:date+'T12:00:00Z',...extra});
     d.transactions=[row('h1','card_charge',a,'DOP',10000,first),row('h2','card_charge',a,'DOP',1000),row('h3','card_charge',a,'USD',100),row('h4','card_charge',b,'USD',500,previous),row('h5','card_charge',b,'DOP',1000),row('payment','card_payment',a,'DOP',50000),row('fee','card_charge',a,'DOP',2000,now,{chargeKind:'annual_fee'}),row('insurance','card_charge',b,'USD',25,now,{chargeKind:'insurance'}),row('interest','card_charge',a,'USD',20,now,{chargeKind:'interest'}),row('advance','card_advance',b,'DOP',10000),row('refund','card_refund',b,'DOP',50),row('reward','card_reward',a,'DOP',100)];
     t.inv();t.go('wallet');
    });
    assert.equal(await faces.first().getAttribute('aria-label'),'Seleccionar Créditos generales');
    await noConsumptionHistory();
    const consumption=p.locator('.v1301-distribution[data-v1301-kind="consumption"]'),state=p.locator('.v1244-state'),limits=state.locator('.v1301-limit-breakdown');
    assert.equal(await consumption.evaluate(el=>el.previousElementSibling.classList.contains('v371-card-return')),true,'Sin panel ni espacio reservado entre beneficios y consumo');
    assert.equal(await state.locator('h2').innerText(),'Estado del crédito');
    assert.equal(await p.locator('.v1301-distribution[data-v1301-kind="limits"]').count(),0);
    assert.equal(await p.getByText('Distribución del crédito',{exact:true}).count(),0);
    assert.equal(await p.getByText('Límite por tarjeta',{exact:true}).count(),0);
    assert.equal(await limits.count(),1);
    assert.equal(await state.locator('.v1244-limits').count(),1);
    assert.deepEqual(await state.evaluate(el=>[...el.children].map(c=>c.className)),['v266-panel-heading','v1244-main','v1301-limit-breakdown','v1244-cutbox']);
    assert.deepEqual(await state.locator('.v1244-main').evaluate(el=>[...el.children].map(c=>c.classList.contains('v1244-gauge')?'gauge':c.className)),['gauge','v1244-limits']);
    assert.ok(await state.evaluate(el=>{const main=el.querySelector('.v1244-main').getBoundingClientRect(),rank=el.querySelector('.v1301-limit-breakdown').getBoundingClientRect(),cuts=el.querySelector('.v1244-cutbox').getBoundingClientRect();return main.bottom<=rank.top&&rank.bottom<=cuts.top&&el.scrollWidth<=el.clientWidth+1}),'Desglose después del límite y antes de los cortes, sin desbordamiento');
    assert.notEqual(await consumption.getAttribute('open'),null,'El consumo se muestra al entrar en Créditos generales');
    await consumption.locator('summary').tap();assert.equal(await consumption.getAttribute('open'),null);
    const expandConsumption=async()=>{if(await consumption.getAttribute('open')===null)await consumption.locator('summary').tap();};
    await expandConsumption();
    for(const item of [consumption,limits]){
     assert.equal(await item.locator('.v1301-stack').count(),0);
     assert.equal(await item.locator('.v1301-bank .bank-photo-mark img').count(),2);
     assert.equal(await item.locator('.v1301-mini,.credit-network').count(),0);
     assert.equal(await item.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
     assert.equal(await item.locator('.v1301-ranked').innerText().then(t=>t.includes('%')),item===consumption);
     const columns=await item.locator('.v1301-equivalent').evaluateAll(els=>els.map(el=>({x:el.getBoundingClientRect().x,right:el.getBoundingClientRect().right})));
     assert.ok(columns.every(c=>Math.abs(c.x-columns[0].x)<1&&Math.abs(c.right-columns[0].right)<1),'Equivalentes alineados');
    }
    assert.equal(await limits.locator('.v1301-donut').count(),0);
    assert.equal(await consumption.locator('.v1301-donut').count(),0);
    const donutColors=()=>consumption.locator('.v1301-rank').evaluateAll(rows=>Object.fromEntries(rows.map(row=>[row.dataset.cardId,{bar:getComputedStyle(row.querySelector('.v1301-meter i')).backgroundColor}])));
    const colors=await donutColors();
    const slices=await consumption.locator('.v1301-rank').evaluateAll(els=>els.map(e=>({id:e.dataset.cardId,share:parseFloat(e.querySelector('.v1301-meter i').style.width)})));
    assert.deepEqual(slices.map(s=>s.id),[fixture.second,fixture.first]);
    assert.ok(Math.abs(slices[0].share-30950/47950*100)<1e-8);
    assert.ok(Math.abs(slices.reduce((s,x)=>s+x.share,0)-100)<1e-8);
    assert.deepEqual(await consumption.locator('.v1301-rank').evaluateAll(els=>els.map(e=>e.dataset.cardId)),[fixture.second,fixture.first]);
    assert.deepEqual(await limits.locator('.v1301-rank').evaluateAll(els=>els.map(e=>e.dataset.cardId)),[fixture.first,fixture.second]);
    assert.equal(moneyText(await consumption.locator('.v1301-total strong').innerText()),47950);
    assert.deepEqual(await consumption.locator('.v1301-equivalent').allTextContents().then(a=>a.map(moneyText)),[30950,17000]);
    assert.equal(moneyText(await state.locator('.v1244-limits strong').innerText()),650000);
    assert.deepEqual(await limits.locator('.v1301-equivalent').allTextContents().then(a=>a.map(moneyText)),[330000,320000]);
    await consumption.locator('summary').tap();assert.equal(await consumption.getAttribute('open'),null);
    // Importes fraccionarios: redondear solo al mostrar, sin modificar datos ni proporciones.
    await p.evaluate(()=>{const t=window.__T,d=t.dbg();for(const c of d.cards){c.limitDOP+=.49;c.limitUSD+=.01}for(const tx of d.transactions){if(['h2','h5'].includes(tx.id))tx.amount+=.49;if(['h3','h4'].includes(tx.id))tx.amount+=.01}t.inv();t.go('wallet')});
    await expandConsumption();
    for(const item of [consumption,limits]){
     const amounts=await item.locator('.v1301-total strong,.v1301-split span,.v1301-equivalent').allTextContents();
     assert.ok(amounts.every(v=>/^(RD\$|US\$)[\d,]+$/.test(v)),'Sin decimales en ningún importe');
    }
    assert.equal(moneyText(await consumption.locator('.v1301-total strong').innerText()),47952);
    assert.equal(moneyText(await state.locator('.v1244-limits strong').innerText()),650002);
    assert.match(await state.locator('.v1244-limits strong').innerText(),/^RD\$[\d,]+$/);
    assert.ok((await state.locator('.v1244-ccy span').allTextContents()).every(v=>/^(RD\$|US\$)[\d,]+$/.test(v)));
    assert.deepEqual(await consumption.locator('.v1301-total .v1301-split span').allTextContents().then(a=>a.map(moneyText)),[11951,600]);
    assert.deepEqual(await state.locator('.v1244-ccy span').allTextContents().then(a=>a.map(moneyText)),[470001,3000]);
    assert.deepEqual(await limits.locator('.v1301-equivalent').allTextContents().then(a=>a.map(moneyText)),[330001,320001]);
    const share=await consumption.locator('.v1301-rank .v1301-meter i').first().evaluate(el=>parseFloat(el.style.width));
    assert.ok(Math.abs(share-(30951.09/47952.18*100))<1e-8,'Participación calculada con los centavos');
    assert.deepEqual(await donutColors(),colors);
    const restored=await p.evaluate(()=>{
     const t=window.__T,d=t.dbg(),tx=d.transactions.find(x=>x.id==='h2'),amount=tx.amount;
     tx.amount+=50000;t.inv();t.go('wallet');return amount;
    });
    await expandConsumption();
    assert.equal(await consumption.locator('.v1301-rank').first().getAttribute('data-card-id'),fixture.first);
    assert.deepEqual(await donutColors(),colors,'El color permanece al cambiar la clasificación');
    await p.evaluate(amount=>{const t=window.__T,d=t.dbg();d.transactions.find(x=>x.id==='h2').amount=amount;t.inv();t.go('wallet')},restored);
    assert.deepEqual(await p.evaluate(()=>window.__T.dbg().cards.map(c=>[c.limitDOP,c.limitUSD])),[[270000.49,1000.01],[200000.49,2000.01]]);
    const historicMovements=await p.evaluate(()=>JSON.stringify(window.__T.dbg().transactions));
    for(const id of [fixture.first,fixture.second]){
     await openTools();await p.locator('.v68-wallet-dots button[data-id="'+id+'"]').click();await waitSelected(id);
     await noConsumptionHistory();
     assert.equal(await p.locator('.v1301-distribution').count(),0);
     assert.equal(await state.locator('h2').innerText(),'Estado del crédito');
     assert.equal(await limits.count(),0);
     assert.equal(await state.locator('.v1244-cutbox').count(),1);
     assert.equal(await p.locator('.v266-activity').count(),0);
     assert.equal(await p.locator('.v371-card-return + .v266-wallet-note').count(),1,'Sin espacio reservado para actividad');
    }
    assert.equal(await p.evaluate(()=>JSON.stringify(window.__T.dbg().transactions)),historicMovements,'Conserva todos los movimientos históricos');
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    assert.deepEqual(errors,[]);
    // Cuatro emisores consumiendo: comprobar colores, proporciones y aspecto móvil.
    await p.evaluate(()=>{
     const t=window.__T,d=t.dbg(),base=d.cards[0],tx=d.transactions.find(x=>x.id==='h2');
     for(const [i,amount] of [[3,21000],[4,9000]]){
      const id='wallet-color-test-'+i;d.cards.push({...base,id,name:'Tarjeta '+i});
      d.transactions.push({...tx,id:'wallet-color-tx-'+i,cardId:id,amount});
     }
     t.inv();t.go('wallet');
    });
    await openTools();await p.locator('.v68-wallet-dots button[data-id="'+GLOBAL+'"]').tap();await waitSelected(GLOBAL);
    await noConsumptionHistory();
    await expandConsumption();
    const four=await donutColors();
    assert.equal(Object.keys(four).length,4);
    assert.equal(new Set(Object.values(four).map(c=>c.bar)).size,4);
    assert.equal(await consumption.locator('.v1301-donut').count(),0);
    assert.equal(await consumption.locator('.v1301-rank').count(),4);
    assert.equal(await consumption.locator('.v1301-share').count(),4);
    assert.equal(await limits.locator('.v1301-rank').count(),4);
    assert.ok(await consumption.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    if(process.env.WALLET_VISUAL_DIR){
     fs.mkdirSync(process.env.WALLET_VISUAL_DIR,{recursive:true});
     await consumption.screenshot({path:process.env.WALLET_VISUAL_DIR+'/'+theme+'.png',animations:'disabled'});
     await state.screenshot({path:process.env.WALLET_VISUAL_DIR+'/estado-'+theme+'.png',animations:'disabled'});
    }
    // Sin consumo también cuenta la tarjeta, pero no añade un segmento ficticio.
    await p.evaluate(()=>{const t=window.__T,d=t.dbg();d.transactions=d.transactions.filter(x=>x.id!=='wallet-color-tx-4');t.inv();t.go('wallet')});
    await expandConsumption();
    assert.equal(await consumption.locator('.v1301-rank').count(),4);
    assert.equal(await consumption.locator('.v1301-share').last().innerText(),'0.0%');
    assert.equal((await donutColors())['wallet-color-test-4'].bar,four['wallet-color-test-4'].bar);
    // Auditoría independiente: importes conocidos, fechas antiguas, tasas históricas y duplicados.
    await p.evaluate(()=>{
     const t=window.__T,d=t.dbg(),[a,b]=d.cards,now=t.fn.today(),old='2000-01-01';
     d.cards=[a,b];d.statements=[];d.settings.fx=60;
     Object.assign(a,{limitDOP:1000,limitUSD:100,openingDOP:0,openingUSD:0,cutDay:1,dueDay:20});
     Object.assign(b,{limitDOP:100,limitUSD:0,openingDOP:0,openingUSD:0,cutDay:1,dueDay:20});
     const row=(id,type,card,currency,amount,date=now,extra={})=>({id,type,cardId:card.id,currency,amount,date,created:date+'T12:00:00Z',...extra});
     const apple=row('audit-apple','card_charge',a,'USD',10.1,now,{applePayEventId:'audit-event',fxRateSnapshot:58.5});
     const purchase=row('audit-old','card_charge',a,'DOP',1600.25,old);
     d.transactions=[purchase,{...purchase},row('audit-refund','card_refund',a,'DOP',100.25,old,{originalPurchaseId:purchase.id}),row('audit-pay','card_payment',a,'DOP',100,old),row('audit-reward','card_reward',a,'DOP',10,old),row('audit-sub','card_charge',a,'DOP',200,now,{recurringId:'subscription'}),apple,{...apple,id:'audit-apple-copy'},row('audit-advance','card_advance',a,'DOP',200),row('audit-fee','card_charge',a,'DOP',50,now,{chargeKind:'annual_fee'}),row('audit-interest','card_charge',a,'DOP',20,now,{chargeKind:'interest'}),row('audit-adjustment','adjustment',a,'DOP',50),row('audit-b','card_charge',b,'DOP',300,old),row('audit-b-refund','card_refund',b,'DOP',25,old,{originalPurchaseId:'audit-b'}),row('audit-usd','card_charge',b,'USD',20.05,old,{fxRateSnapshot:62.33}),row('audit-future','card_charge',a,'DOP',999999,'2099-01-01')];
     t.inv();t.go('wallet');
    });
    const ledgerSnapshot=await p.evaluate(()=>JSON.stringify(window.__T.dbg().transactions));
    const individual=[];
    for(const [id,debt,available,limit,debtParts,limitParts] of [[fixture.first,2516,5394,7000,[1910,10.1],[1000,100]],[fixture.second,1478,0,100,[275,20.05],[100,0]]]){
     await openTools();await p.locator('.v68-wallet-dots button[data-id="'+id+'"]').click();await waitSelected(id);
     await noConsumptionHistory();
     assert.equal(await read('.v565-secondary > b'),debt);
     assert.equal(await read('.v565-primary > strong'),available);
     assert.equal(await read('.v1244-limits > strong'),limit);
     assert.deepEqual(await parts('.v565-secondary .v550-currency-breakdown b'),debtParts);
     assert.deepEqual(await parts('.v1244-ccy > span'),limitParts);
     assert.equal(await read('.v1244-gauge b'),Number((100*debt/limit).toFixed(1)));
     individual.push({debt,available,limit,cuts:await parts('.v1244-pill em')});
    }
    assert.equal(individual[0].cuts[0],(await p.evaluate(()=>window.__T.fn.today().endsWith('-01')))?1910:1390);
    assert.deepEqual(individual[1].cuts,[275,20.05]);
    await openTools();await p.locator('.v68-wallet-dots button[data-id="'+GLOBAL+'"]').tap();await waitSelected(GLOBAL);
    assert.equal(await read('.v565-secondary > b'),3994);
    assert.equal(await read('.v565-primary > strong'),5394);
    assert.equal(await read('.v1244-limits > strong'),7100);
    assert.deepEqual(await parts('.v1244-pill em'),[individual[0].cuts[0]+individual[1].cuts[0],individual[0].cuts[1]+individual[1].cuts[1]]);
    await expandConsumption();
    assert.deepEqual(await parts('.v1301-total .v1301-split span'),[1975,30]);
    assert.equal(await read('.v1301-total strong'),3816);
    const auditSlices=await consumption.locator('.v1301-rank .v1301-meter i').evaluateAll(els=>els.map(e=>parseFloat(e.style.width)));
    assert.ok(Math.abs(auditSlices[0]-100*(1700+10.1*58.5)/(1975+10.1*58.5+20.05*62.33))<1e-8);
    assert.ok(Math.abs(auditSlices.reduce((s,x)=>s+x,0)-100)<1e-8);
    assert.equal(await p.evaluate(()=>JSON.stringify(window.__T.dbg().transactions)),ledgerSnapshot,'Auditoría no altera los movimientos originales');
    assert.deepEqual(errors,[]);
    console.log('OK Créditos generales '+theme+' · carrusel, importes, consumo por tarjeta, histórico de consumo eliminado, movimientos y navegación');
   }finally{await ctx.close()}
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
