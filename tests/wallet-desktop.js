'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const open=require('./harness');

module.exports=async function walletDesktop(browser){
 delete process.env.TOUCH;process.env.THEME='light';
 const {ctx,p}=await open(browser,1672,941);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const money=async selector=>Number((await p.locator(selector).innerText()).replace(/[^\d.\-]/g,''));
 const evidence=process.env.WALLET_VISUAL_DIR;
 if(evidence)fs.mkdirSync(evidence,{recursive:true});
 const snap=async name=>{if(evidence)await p.screenshot({path:path.join(evidence,name+'.png'),fullPage:true,animations:'disabled'})};
 const overflow=()=>p.evaluate(()=>[...(document.documentElement.scrollWidth>innerWidth+1?['documento']:[]),...Array.from(document.querySelectorAll('.vWalletPc-stat,.vWalletPc-grid > section,.vWalletPc-right > section')).filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.className)]);
 try{
  const fixture=await p.evaluate(()=>{
   const t=window.__T,d=t.dbg(),base=d.cards[0],banks=d.banks.filter(b=>!b.archived);
   if(banks.length<2)throw Error('La demo requiere dos bancos');
   const [a,b]=banks;
   const first={...base,id:'pc-card-a',bankId:a.id,name:'Tarjeta A',last4:'1234',limitDOP:100000,limitUSD:1000,openingDOP:0,openingUSD:0,annualFeeAmount:4500,annualFeeCurrency:'DOP',cutDay:1,dueDay:28,archived:false};
   const second={...first,id:'pc-card-b',bankId:b.id,name:'Tarjeta B',last4:'5678',limitDOP:200000,limitUSD:2000};
   d.cards=[first,second];d.statements=[];d.settings.fx=60;
   const charge=(id,c,currency,amount,extra={})=>({id,cardId:c.id,type:'card_charge',currency,amount,date:'2021-01-01',created:'2021-01-01T12:00:00Z',...extra});
   const one=charge('pc-tx-1',first,'DOP',10000);
   d.transactions=[one,{...one},charge('pc-tx-2',first,'USD',100,{fxRateSnapshot:58}),charge('pc-tx-3',second,'DOP',4000),{id:'pc-reward',cardId:first.id,type:'card_reward',amount:11320,currency:'DOP',date:t.fn.today()}];
   t.inv();
   const funds=bankId=>d.accounts.filter(a=>a.kind!=='cash'&&!a.archived&&!d.banks.find(b=>b.id===a.bankId)?.archived&&(!bankId||a.bankId===bankId)).reduce((s,a)=>s+t.fn.getAccountBalance(a)*(a.currency==='USD'?60:1),0);
   return {banks:[a,b].map(b=>({id:b.id,name:b.name,funds:funds(b.id)})),funds:funds(null),cards:d.cards.map(c=>{const dop=t.cs(c.id,'DOP'),usd=t.cs(c.id,'USD');return {id:c.id,name:c.name,limit:c.limitDOP+c.limitUSD*60,debt:dop.debt+usd.debt*60,dop:dop.billed,usd:usd.billed}})};
  });
  await p.evaluate(()=>window.__T.go('wallet'));
  const wallet=p.locator('.vWalletPc-strategic');await wallet.waitFor();
  const global=wallet.getByRole('button',{name:/Créditos generales/});
  const select=bank=>wallet.getByRole('button',{name:'Seleccionar '+bank.name,exact:true});
  const sum=key=>fixture.cards.reduce((s,c)=>s+c[key],0);
  assert.equal(await p.getByRole('heading',{name:'Tu universo financiero'}).count(),1);
  assert.equal(await global.getAttribute('aria-pressed'),'true');
  assert.equal(await wallet.locator('.vWalletPc-stat').count(),3);
  assert.equal(await wallet.locator('.vWalletPc-stat.is-available div>span').innerText(),'Balance disponible');
  assert.equal(await money('.vWalletPc-stat.is-available strong'),Math.round(fixture.funds));
  assert.equal(await money('.vWalletPc-stat.is-limit strong'),480000);
  assert.equal(await money('.vWalletPc-stat.is-debt strong'),Math.round(sum('debt')));
  assert.equal(await money('.vWalletPc-state-main .vWalletPc-ring strong'),Number((100*sum('debt')/480000).toFixed(1)));
  assert.equal(await wallet.locator('.vWalletPc-recent,.vWalletPc-chart,.vWalletPc-product-links,.wallet-return-actions').count(),0);
  assert.equal(await wallet.locator('.vWalletPc-limit-row').count(),2);
  assert.deepEqual(await wallet.locator('.wallet-consumption-share').allTextContents(),['79.8%','20.2%']);
  await wallet.getByRole('button',{name:'Ver importes de consumo histórico'}).click();
  const consumption=p.getByRole('dialog',{name:'Consumo histórico'});
  await consumption.waitFor();
  assert.equal(await money('.v176-credit-total b'),19800);
  await consumption.getByRole('button',{name:'Cerrar'}).click();
  const benefits=wallet.getByRole('button',{name:'Beneficios y retorno'});
  assert.deepEqual(await wallet.locator('.v371-return-tile strong').allTextContents(),['RD$9,000.00','RD$11,320.00','+RD$2,320.00','+25.8%']);
  await snap('wallet-pc-consolidado-1672');
  for(let i=0;i<2;i++){
   const bank=fixture.banks[i],card=fixture.cards[i];
   await select(bank).click();
   assert.equal(await select(bank).getAttribute('aria-pressed'),'true');
   assert.equal(await money('.vWalletPc-stat.is-limit strong'),card.limit);
   assert.equal(await money('.vWalletPc-stat.is-debt strong'),Math.round(card.debt));
   assert.equal(await money('.vWalletPc-stat.is-available strong'),Math.round(bank.funds));
   assert.equal(await wallet.locator('.vWalletPc-limit-row').count(),1);
   assert.equal(await wallet.locator('.vWalletPc-recent-list button').count(),i===0?3:1);
   assert.equal(await wallet.locator('.vWalletPc-recent-list button[data-id="pc-tx-3"]').count(),i===1?1:0);
   await snap('wallet-pc-banco-'+i);
   await wallet.getByRole('button',{name:'Ver detalle de '+card.name}).click();
   await p.getByRole('button',{name:'Volver a Wallet'}).click();
   assert.equal(await select(bank).getAttribute('aria-pressed'),'true');
   await benefits.click();
   const ledger=p.getByRole('region',{name:'Tabla de beneficios por tarjeta'});
   await ledger.waitFor();
   assert.equal(await ledger.locator('tbody tr').count(),1);
   await ledger.getByRole('button',{name:'Registrar beneficio',exact:true}).click();
   await p.locator('#v144CashbackForm').waitFor();
   await p.locator('#modal-root [data-act="closeModal"]').first().click();
   await ledger.getByRole('button',{name:'Registrar anualidad y seguros'}).click();
   await p.locator('#annualFeeForm').waitFor();
   await p.locator('#modal-root [data-act="closeModal"]').first().click();
   await p.getByRole('button',{name:'Volver a Wallet'}).click();
  }
  // Multiple cards in one bank: one selector, scoped totals and five unique latest records.
  await p.evaluate(()=>{
   const t=window.__T,d=t.dbg(),a=d.cards[0];d.cards.push({...a,id:'pc-card-c',name:'Tarjeta C',last4:'9999'});
   for(let i=0;i<6;i++)d.transactions.push({id:'pc-extra-'+i,cardId:'pc-card-c',type:'card_charge',currency:'DOP',amount:100,date:'2021-02-0'+(i+1),created:'2021-02-0'+(i+1)+'T12:00:00Z'});
   t.inv();t.go('wallet');
  });
  await select(fixture.banks[0]).click();
  assert.equal(await wallet.locator('.vWalletPc-product-list button').count(),3);
  assert.equal(await wallet.locator('.vWalletPc-limit-row').count(),2);
  assert.equal(await money('.vWalletPc-stat.is-limit strong'),320000);
  assert.equal(await wallet.locator('.vWalletPc-recent-list button').count(),5);
  await wallet.getByRole('button',{name:/Ver todos/}).click();
  assert.equal(await p.evaluate(()=>window.__T.ui().bankScope),fixture.banks[0].id);
  assert.equal(await p.evaluate(()=>window.__T.ui().page),'register');
  await p.evaluate(()=>{const t=window.__T,d=t.dbg();d.cards.pop();d.transactions=d.transactions.filter(x=>!x.id.startsWith('pc-extra-'));t.inv();t.go('wallet')});
  await global.click();
  assert.equal(await wallet.locator('.vWalletPc-recent').count(),0);
  await wallet.getByRole('button',{name:'Ver estado consolidado del crédito'}).click();
  await p.locator('.v176-card-insight-modal .close').click();
  for(const [key,label] of [['dop','pesos'],['usd','dólares']]){
   const button=wallet.getByRole('button',{name:'Ver cortes pendientes en '+label});
   assert.equal(Number((await button.innerText()).replace(/[^\d.\-]/g,'')),Number(sum(key).toFixed(2)));
   if(await button.isEnabled()){await button.click();await p.locator('.v176-card-insight-modal .close').click()}
  }
  const navigation=p.getByRole('navigation',{name:'Módulos financieros'});
  for(const [width,height] of [[1920,1080],[1440,900],[1280,800],[1024,768]]){
   await p.setViewportSize({width,height});
   await navigation.locator('button[data-id="overview"]').click();
   await navigation.locator('button[data-id="wallet"]').click();
   assert.equal(await global.getAttribute('aria-pressed'),'true');
   await p.waitForTimeout(100);
   await snap('wallet-pc-'+width);
   assert.deepEqual(await overflow(),[],'Desborde a '+width+'px');
  }
  for(const theme of ['light','black']){
   const apply=palette=>p.evaluate(({theme,palette})=>{const t=window.__T;Object.assign(t.dbg().settings,{theme,paletteChoice:'custom',paletteHex:palette});t.go('wallet')},{theme,palette});
   const style=()=>wallet.locator('.vWalletPc-stat.is-limit').evaluate(e=>{const s=getComputedStyle(e);return [getComputedStyle(document.body).getPropertyValue('--v424-accent-strong').trim(),s.backdropFilter||s.webkitBackdropFilter]});   // el motor Liquid Glass unifica el cristal; la paleta se refleja en el acento
   await apply('#087b72');const teal=await style();
   await apply('#a63758');const coral=await style();
   assert.notEqual(teal[0],coral[0]);
   await snap('wallet-pc-'+theme);
  }
  assert.deepEqual(errors,[]);
  console.log('OK Wallet PC estratégico: 3 KPI, 2 bancos, agrupación, movimientos, cortes, beneficios, consumo, 4 resoluciones y 2 temas');
 }finally{await ctx.close()}
};
