'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const open=require('./harness');
const evidence=process.env.BANKS_VISUAL_DIR||process.env.WALLET_VISUAL_DIR;
const go=(page,route)=>page.evaluate(route=>window.__T.go(route),route);
const money=async locator=>Number((await locator.innerText()).replace(/[^0-9.\-]/g,''));

async function inspectPrevious(browser){
 if(!process.env.CI||!evidence)return;
 // Captura de referencia a partir del código publicado antes del rediseño universal.
 const sha='9ae7ffb51bdef591f46f5cdf8c73b623f47050b8';
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vive-bancos-previo-'));
 const previous=process.env.ROOT;
 try{
  execFileSync('git',['fetch','--no-tags','--depth=1','origin',sha],{stdio:'ignore'});
  const archive=execFileSync('git',['archive',sha,'index.html','src','vendor','assets','manifest.webmanifest'],{maxBuffer:80*1024*1024});
  execFileSync('tar',['-xf','-','-C',root],{input:archive});
  process.env.ROOT=root;
  for(const [width,height] of [[1672,941],[390,844]]){
   const {ctx,p}=await open(browser,width,height);
   try{
    await go(p,'banks');
    await p.locator(width<791?'.vBanks-mobile':'.vBanksPc').waitFor();
    await p.screenshot({path:path.join(evidence,`antes-bancos-${width}.png`)});
    await go(p,'wallet');
    await p.locator(width<791?'.v68-wallet':'.vWalletPc').waitFor();
    await p.screenshot({path:path.join(evidence,`antes-wallet-${width}.png`)});
   }finally{await ctx.close();}
  }
 }finally{
  if(previous===undefined)delete process.env.ROOT;else process.env.ROOT=previous;
  fs.rmSync(root,{recursive:true,force:true});
 }
}
async function fixture(page){
 return page.evaluate(()=>{
  const t=window.__T,db=t.dbg(),[bank]=db.banks,[card]=db.cards,[loan]=db.loans;
  const date=t.fn.today(),opened=t.fn.plusMonths(date,-1),maturity=t.fn.plusMonths(date,12);
  db.settings.fx=60;
  db.banks=[{...bank,id:'bank-a',name:'Banco Alfa',kind:'Banco',archived:false},{...bank,id:'bank-b',name:'Banco General',kind:'Banco',archived:false}];
  db.accounts=[
   {id:'acc-a',bankId:'bank-a',kind:'savings',name:'Ahorros Alfa',currency:'DOP',opening:100000,opened,archived:false},
   {id:'acc-b',bankId:'bank-b',kind:'savings',name:'Ahorros General',currency:'USD',opening:1000,opened,archived:false},
   {id:'cash',kind:'cash',name:'Efectivo fuera de bancos',currency:'DOP',opening:99999,opened,archived:false}
  ];
  db.cards=[
   {...card,id:'card-a',bankId:'bank-a',name:'Visa Alfa',last4:'1234',network:'Visa',opened,limitDOP:100000.37,limitUSD:1000.02,openingDOP:0,openingUSD:0,annualFeeAmount:4500,annualFeeCurrency:'DOP',archived:false},
   {...card,id:'card-b',bankId:'bank-b',name:'Mastercard General',last4:'5678',network:'Mastercard',opened,limitDOP:200000,limitUSD:0,openingDOP:0,openingUSD:0,annualFeeAmount:3000,annualFeeCurrency:'DOP',archived:false}
  ];
  const sampleLoan={...loan,currency:'DOP',principal:12000,rate:5,firstDue:t.fn.plusMonths(date,1),originationDate:date,term:12,archived:false};
  db.loans=[{...sampleLoan,id:'loan-a',name:'Préstamo Alfa',bankId:'bank-a'},{...sampleLoan,id:'loan-b',name:'Préstamo General',bankId:'bank-b'}];
  db.certificates=[
   {id:'cert-a',bankId:'bank-a',name:'Certificado Alfa',currency:'DOP',principal:40000,rate:8,startDate:date,maturityDate:maturity,taxPct:0,capitalMode:'pending',archived:false},
   {id:'cert-b',bankId:'bank-b',name:'Certificado General',currency:'USD',principal:500,startDate:date,maturityDate:maturity,taxPct:0,capitalMode:'already',archived:false}
  ];
  db.statements=[];
  db.transactions=[
   {id:'fund-a',certificateId:'cert-a',accountId:'acc-a',type:'certificate_funding',amount:40000,currency:'DOP'},
   {id:'purchase-a',cardId:'card-a',type:'card_charge',amount:1000,currency:'DOP',category:'Alimentación'},
   {id:'purchase-b',cardId:'card-a',type:'card_charge',amount:100,currency:'USD',category:'Alimentación',fxRateSnapshot:58},
   {id:'refund',cardId:'card-a',type:'card_refund',amount:200,currency:'DOP',originalPurchaseId:'purchase-a'},
   {id:'reward',cardId:'card-a',type:'card_reward',amount:11320,currency:'DOP'},
   {id:'charge-b',cardId:'card-b',type:'card_charge',amount:500,currency:'DOP',category:'Transporte'}
  ].map(tx=>({...tx,date,created:date+'T12:00:00Z'}));
  t.inv();t.go('banks');
  return {account:t.fn.getAccountBalance(db.accounts[0]),ledger:JSON.stringify(db.transactions)};
 });
}
async function testBanks(browser,width){
 const mobile=width<791;
 const previousTouch=process.env.TOUCH;
 if(mobile)process.env.TOUCH='1';else delete process.env.TOUCH;
 const {ctx,p}=await open(browser,width,mobile?844:941);
 if(previousTouch===undefined)delete process.env.TOUCH;else process.env.TOUCH=previousTouch;
 try{
  const errors=[];p.on('pageerror',err=>errors.push(err.message));
  const seeded=await fixture(p);
  assert.equal(seeded.account,60000,'La constitución se descuenta de los fondos.');
  const root=p.locator('.vBanksPc');
  await root.waitFor();
  assert.equal(await p.locator('main.world-banks .inner-menu').count(),0,'No debe repetirse el menú interno de Bancos.');
  if(!mobile){
   assert.equal(await root.locator('.vBanks-certificates [data-act="addCertificate"]').count(),1,'Se puede crear un certificado desde Bancos.');
   assert.equal(await root.locator('.vBanksPc-bank-totals dt').allTextContents().then(x=>x.join('|')),'Fondos|Deudas|Posición neta');
   assert.ok(await root.locator('.vBanksPc-consumption-rows > div').count()<=4,'Tres categorías destacadas y Otros.');
   if(width>=1280)assert.ok(await p.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+3),'Bancos PC no debe tener scrolling general.');
  }
  const selector=root.locator('.vBanks-mobile-selector');
  const choose=async id=>{
   if(mobile){
    await selector.click();
    const picker=p.getByRole('dialog',{name:'Seleccionar institución'});
    await picker.locator(`.v789-picker-row[data-value="${id}"]`).click();
    const confirm=picker.locator('.v789-picker-confirm');
    if(await confirm.isVisible())await confirm.click();
   }else await root.locator(`.vBanksPc-bank[data-id="${id}"]`).click();
  };
  const view=async()=>{
   const fs=mobile?root.locator('.vBanks-mobile-hero dl dd'):root.locator('.vBanksPc-metric strong');
   return mobile?[await money(root.locator('.vBanks-mobile-net > div:first-child strong')),...await Promise.all([0,1,2].map(i=>money(fs.nth(i))))]:Promise.all([0,1,2,3].map(i=>money(fs.nth(i))));
  };
  const netTotal=await view();
  assert.equal(netTotal[1],120000);
  assert.equal(netTotal[3],360002);
  assert.equal(netTotal[0],netTotal[1]+70000-netTotal[2]);
  assert.equal(await root.locator('.vBanks-certificates dl dd').first().innerText(),'RD$70,000');
  assert.equal(await root.locator('.vBanks-certificates dl dd').nth(1).innerText(),'8.00%');
  if(mobile)assert.match(await selector.innerText(),/Todos los bancos/);
  else assert.equal(await root.locator('.vBanksPc-bank').first().getAttribute('aria-pressed'),'true');
  const checkFit=()=>root.evaluate(el=>el.scrollWidth<=el.clientWidth+2&&document.documentElement.scrollWidth<=innerWidth+2);
  assert.ok(await checkFit(),'El tablero debe caber a '+width+'px.');
  if(!mobile&&width===1672)assert.ok(await root.evaluate(el=>{
   const [banks,products,insights]=[...el.querySelector('.vBanksPc-grid').children].map(x=>x.getBoundingClientRect());
   return banks.right<products.left&&products.right<insights.left&&Math.abs(banks.top-insights.top)<2;
  }),'El mockup PC muestra tres columnas debajo de los KPI.');
  if(mobile)assert.ok(await root.evaluate(el=>{
   const seq=['.vBanks-mobile-head','.vBanks-mobile-selector','.vBanks-mobile-hero','.vBanks-mobile-products','.v371-card-return','.v1301-insight','.vBanks-certificates'];
   const top=seq.map(k=>el.querySelector(k).getBoundingClientRect().top);
   return top.every((y,i)=>!i||y>top[i-1]);
  }),'El orden móvil coincide con la referencia.');
  if(!mobile&&width>=1280)assert.ok(await p.evaluate(()=>document.scrollingElement.scrollHeight<=innerHeight+3),'Bancos PC debe caber sin scroll general a '+width+'px.');
  if(!mobile)assert.ok(await p.evaluate(()=>{
   const el=document.querySelector('main.vBanksPc-world .v371-return-values');
   return !!el&&getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length===4;
  }),'El mockup PC conserva cuatro columnas de retorno en una fila.');
  if(!mobile)assert.ok(await p.evaluate(()=>{
   const subtitle=document.querySelector('main.vBanksPc-world .topbar .top-sub');
   const tiles=document.querySelector('main.vBanksPc-world .v371-return-tile');
   return (!subtitle||getComputedStyle(subtitle).display==='none')&&(!tiles||getComputedStyle(tiles).backgroundColor==='rgba(0, 0, 0, 0)');
  }),'La cabecera no debe duplicarse y el retorno usa divisores sin rellenos en PC.');
  if(mobile)assert.ok(await root.locator('.vBanks-mobile-tiles').evaluate(el=>{
   const cols=getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean);
   return cols.length===2&&[...el.querySelectorAll('strong')].every(x=>getComputedStyle(x).whiteSpace==='nowrap');
  }),'Los importes móviles deben ser legibles en un mosaico de dos columnas.');
  if(evidence)await p.screenshot({path:path.join(evidence,`bancos-${width}.png`),fullPage:true,animations:'disabled'});
  const usage=root.locator('.v1301-insight');
  assert.match(await usage.innerText(),/Alimentación/);
  assert.match(await usage.innerText(),/Transporte/);
  await usage.locator('summary').click();
  assert.equal(await usage.evaluate(el=>el.open),false);
  await usage.locator('summary').press('Enter');
  assert.equal(await usage.evaluate(el=>el.open),true);
  await choose('bank-a');
  const a=await view();
  assert.equal(a[1],60000);
  assert.equal(a[0],100000-a[2]);
  assert.equal(await root.locator('.vBanks-certificates dl dd').first().innerText(),'RD$40,000');
  assert.match(await usage.locator('.vBanksPc-consumption-amount').innerText(),/6,600/);
  assert.match(await usage.locator('.vBanksPc-consumption-amount small').innerText(),/800\.00.*100\.00/);
  assert.doesNotMatch(await usage.innerText(),/Transporte/);
  assert.deepEqual(await root.locator('.v371-return-tile strong').allTextContents(),['RD$4,500.00','RD$11,320.00','+RD$6,820.00','+151.6%']);
  await root.getByRole('button',{name:'Beneficios y retorno'}).click();
  const ledger=root.getByRole('region',{name:'Tabla de beneficios por tarjeta'});
  assert.equal(await ledger.locator('table').count(),1);
  assert.equal(await ledger.locator('option[value="card-b"]').count(),0);
  await ledger.getByRole('button',{name:'Registrar beneficio'}).click();
  await p.locator('#v144CashbackForm').waitFor();
  await p.keyboard.press('Escape');
  await root.getByRole('button',{name:'Volver al resumen'}).click();
  const openProduct=async (kind,id)=>{
   await root.locator(`[data-act="banksPcProducts"][data-id="${kind}"]`).first().click();
   if(!mobile){
    assert.equal(await root.locator('.vBanksPc-bank-list').count(),0,'La sección reemplaza el tablero.');
    if(kind==='cards'){
     assert.equal(await root.locator('.vWalletPc').count(),1);
     assert.equal(await root.getByRole('button',{name:'Seleccionar Mastercard General'}).count(),0);
     await root.locator(`[data-act="walletPcSelect"][data-id="${id}"]`).first().click();
     await root.getByRole('button',{name:'Explorar el ciclo',exact:true}).click();
    }else if(kind==='loans'){
     const loan=root.locator('.v1265-loan');
     assert.match(await loan.innerText(),/Capital original/i);
     assert.match(await loan.innerText(),/Cuota/i);
     assert.equal(await root.getByText('Tu cartera de préstamos',{exact:true}).count(),0);
     await loan.locator(`[data-act="loanDetails"][data-id="${id}"]`).click();
    }else await root.locator(`[data-act="banksOpenProduct"][data-id="${id}"]`).click();
   }else await root.locator(`[data-act="banksOpenProduct"][data-id="${id}"]`).click();
   assert.equal(await p.evaluate(()=>window.__T.ui().page),'banks');
   return root.getByRole('region',{name:'Detalle del producto'});
  };
  const closeProduct=async(detail,bankId)=>{
   await detail.locator('[data-act="banksCloseProduct"]').click();
   if(!mobile){
    await root.getByRole('button',{name:'Volver al resumen'}).click();
    assert.equal(await root.locator(`.vBanksPc-bank[data-id="${bankId}"]`).getAttribute('aria-pressed'),'true');
   }
  };
  for(const [kind,id,title] of [['accounts','acc-a','Ahorros Alfa'],['cards','card-a','Visa Alfa'],['certificates','cert-a','Certificado Alfa']]){
   const detail=await openProduct(kind,id);
   await detail.getByRole('heading',{name:title,exact:true}).waitFor();
   if(!mobile&&kind==='accounts'){
    await detail.getByText('Evolución del saldo',{exact:true}).click();
    await detail.getByRole('img',{name:'Evolución del saldo'}).waitFor();
    await detail.getByRole('heading',{name:'Actividad reciente'}).waitFor();
   }
   if(!mobile&&kind==='certificates')await detail.getByRole('heading',{name:'Rendimiento y vencimiento'}).waitFor();
   await closeProduct(detail,'bank-a');
  }
  await choose('bank-b');
  const b=await view();
  assert.equal(b[1],60000);
  assert.equal(b[0],90000-b[2]);
  assert.equal(await root.locator('.vBanks-certificates dl dd').nth(1).innerText(),'—');
  const detail=await openProduct('loans','loan-b');
  await detail.getByRole('heading',{name:'Préstamo General',exact:true}).waitFor();
  if(!mobile){
   await detail.getByRole('button',{name:'Amortización',exact:true}).click();
   await detail.getByRole('heading',{name:'Amortización inteligente'}).waitFor();
   await detail.getByRole('button',{name:'Historial real',exact:true}).click();
   await detail.getByRole('button',{name:'Simulador de abonos',exact:true}).click();
   await detail.locator('#loanSimAmount').waitFor();
  }
  await closeProduct(detail,'bank-b');
  await choose('__all_banks__');
  const back=await view();
  assert.deepEqual(back,netTotal);
  assert.ok(netTotal.every((n,i)=>Math.abs(n-a[i]-b[i])<=1),'Consolidado igual a la suma de instituciones, con redondeo visual.');
  assert.equal(await p.evaluate(()=>JSON.stringify(window.__T.dbg().transactions)),seeded.ledger);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
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
 if(evidence)fs.mkdirSync(evidence,{recursive:true});
 await inspectPrevious(browser);
 for(const width of [1672,1440,1280,1024,390,320])await testBanks(browser,width);
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
