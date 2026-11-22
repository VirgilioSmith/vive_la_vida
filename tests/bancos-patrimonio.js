'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const open = require('./harness');

const amount = async locator => Number((await locator.innerText()).replace(/[^0-9.\-]/g,''));
const go = (page,route) => page.evaluate(route => window.__T.go(route),route);

async function testBanks(browser){
 const {ctx,p} = await open(browser,1672,941);
 try {
  const errors=[];
  p.on('pageerror',error=>errors.push(error.message));
  await p.evaluate(()=>{
   const t=window.__T, db=t.dbg(), [bank]=db.banks, [card]=db.cards;
   const date=t.fn.today();
   db.settings.fx=60;
   db.banks=[{...bank,id:'bank-a',name:'Banco Alfa',archived:false,kind:'Banco'},{...bank,id:'bank-b',name:'Banco Beta',archived:false,kind:'Banco'}];
   db.cards=[
    {...card,id:'card-a',bankId:'bank-a',name:'Visa Alfa',last4:'1234',network:'Visa',opened:date,limitDOP:100000.37,limitUSD:1000.02,openingDOP:0,openingUSD:0,annualFeeAmount:4500,annualFeeCurrency:'DOP',archived:false},
    {...card,id:'card-b',bankId:'bank-b',name:'Mastercard Beta',last4:'5678',network:'Mastercard',opened:date,limitDOP:200000,limitUSD:0,openingDOP:0,openingUSD:0,annualFeeAmount:3000,annualFeeCurrency:'DOP',archived:false},
   ];
   db.accounts=[]; db.loans=[]; db.certificates=[]; db.statements=[];
   db.transactions=[
    {id:'purchase-a',cardId:'card-a',type:'card_charge',amount:1000,currency:'DOP',category:'Alimentación'},
    {id:'purchase-b',cardId:'card-a',type:'card_charge',amount:100,currency:'USD',category:'Alimentación',fxRateSnapshot:58},
    {id:'refund',cardId:'card-a',type:'card_refund',amount:200,currency:'DOP',originalPurchaseId:'purchase-a'},
    {id:'reward',cardId:'card-a',type:'card_reward',amount:11320,currency:'DOP'},
    {id:'charge-beta',cardId:'card-b',type:'card_charge',amount:500,currency:'DOP',category:'Transporte'},
   ].map(tx=>({...tx,date,created:date+'T12:00:00Z'}));
   t.inv();t.go('banks');
  });
  const bank=p.locator('.vBanksPc');
  await bank.waitFor();
  assert.equal(await p.getByRole('heading',{name:'Tu posición bancaria'}).count(),1);
  assert.equal(await bank.locator('.vBanksPc-metric').count(),4);
  assert.equal(await amount(bank.locator('.vBanksPc-metric strong').last()),360002);
  assert.equal(await bank.getByRole('button',{name:/Banco Alfa/}).getAttribute('aria-pressed'),'true');
  assert.equal(await p.locator('.module-switch-tab[data-id="cards"]').count(),0);
  const details=bank.locator('.v1301-insight');
  assert.equal(await details.locator('.vBanksPc-consumption-amount b').innerText(),'RD$6,600');
  assert.match(await details.locator('.vBanksPc-consumption-amount small').innerText(),/800\.00.*100\.00/);
  assert.equal(await details.evaluate(el=>el.open),true);
  await details.locator('summary').click();
  assert.equal(await details.evaluate(el=>el.open),false);
  await details.locator('summary').press('Enter');
  assert.equal(await details.evaluate(el=>el.open),true);
  assert.deepEqual(await bank.locator('.v371-return-tile strong').allTextContents(),['RD$4,500.00','RD$11,320.00','+RD$6,820.00','+151.6%']);

  const screenshots=process.env.BANKS_VISUAL_DIR||process.env.WALLET_VISUAL_DIR;
  if(screenshots)fs.mkdirSync(screenshots,{recursive:true});
  for(const [width,height] of [[1672,941],[1440,900],[1280,800],[1024,768],[820,900]]){
   await p.setViewportSize({width,height});
   assert.ok(await bank.evaluate(root=>root.scrollWidth<=root.clientWidth+2 && document.documentElement.scrollWidth<=innerWidth+2),'Desborde a '+width+' px');
   if(screenshots)await p.screenshot({path:path.join(screenshots,'bancos-'+width+'.png'),animations:'disabled'});
  }
  await p.setViewportSize({width:1440,height:900});
  await bank.getByRole('button',{name:/Visa Alfa/}).click();
  await bank.getByRole('heading',{name:'Visa Alfa',exact:true}).waitFor();
  const benefits=bank.getByRole('button',{name:'Beneficios y retorno'});
  await benefits.click();
  const ledger=bank.getByRole('region',{name:'Tabla de beneficios por tarjeta'});
  await ledger.waitFor();
  assert.equal(await ledger.locator('table').count(),1);
  assert.equal(await ledger.locator('select[data-v144-filter="card"]').inputValue(),'card-a');
  assert.equal(await ledger.locator('option[value="card-b"]').count(),0);
  await ledger.getByRole('button',{name:'Registrar beneficio'}).click();
  await p.locator('#v144CashbackForm').waitFor();
  await p.keyboard.press('Escape');
  await bank.getByRole('button',{name:'Volver a la tarjeta'}).click();
  await bank.getByRole('button',{name:'Volver a Banco Alfa'}).click();
  await bank.getByRole('button',{name:/Banco Beta/}).click();
  await bank.getByRole('heading',{name:'Banco Beta',exact:true}).waitFor();
  assert.equal(await bank.getByRole('button',{name:/Visa Alfa/}).count(),0);
  assert.equal(await bank.locator('.v371-return-tile.negative').count(),2);
  assert.match(await details.innerText(),/Transporte/);
  assert.deepEqual(errors,[]);
 } finally { await ctx.close(); }
}

async function testPatrimony(browser,width){
 const {ctx,p}=await open(browser,width,900);
 try {
  await go(p,'vision');
  assert.equal(await p.evaluate(()=>window.__T.ui().page),'patrimony');
  await p.getByRole('heading',{name:'Tu posición neta',exact:true}).waitFor();
  const exposure=p.getByRole('region',{name:'Créditos y patrimonio'});
  assert.equal(await exposure.getByText('Exposición financiera',{exact:true}).count(),1);
  assert.equal(await exposure.getByText('Utilización de crédito por moneda',{exact:true}).count(),1);
  assert.equal(await exposure.getByText('Calendario y exposición a vencimientos',{exact:true}).count(),1);
  assert.equal(await p.locator('[data-act="navigate"][data-id="payments"]').count(),0);
  await exposure.getByRole('button',{name:'Abrir calendario'}).click();
  assert.equal(await p.evaluate(()=>window.__T.ui().page),'pressure');
  await go(p,'payments');
  assert.equal(await p.evaluate(()=>window.__T.ui().page),'patrimony');
  const screenshots=process.env.BANKS_VISUAL_DIR||process.env.WALLET_VISUAL_DIR;
  if(screenshots)await p.screenshot({path:path.join(screenshots,'patrimonio-'+width+'.png'),animations:'disabled'});
 } finally { await ctx.close(); }
}

async function banksAndPatrimony(browser){
 await testBanks(browser);
 await testPatrimony(browser,1440);
 await testPatrimony(browser,390);
 console.log('Bancos PC y Patrimonio móvil/web validados con Playwright.');
}
module.exports=banksAndPatrimony;

if(require.main===module)(async()=>{
 const browser=await chromium.launch();
 try { await banksAndPatrimony(browser); }
 finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
