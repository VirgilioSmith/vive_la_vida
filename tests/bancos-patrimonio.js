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
async function testBanks(browser,width,theme='light'){
 const mobile=width<791;
 const previousTouch=process.env.TOUCH;
 const previousTheme=process.env.THEME;
 process.env.THEME=theme;
 if(mobile)process.env.TOUCH='1';else delete process.env.TOUCH;
 const {ctx,p}=await open(browser,width,mobile?844:941);
 if(previousTouch===undefined)delete process.env.TOUCH;else process.env.TOUCH=previousTouch;
 if(previousTheme===undefined)delete process.env.THEME;else process.env.THEME=previousTheme;
 try{
  const errors=[];p.on('pageerror',err=>errors.push(err.message));
  const seeded=await fixture(p);
  assert.equal(seeded.account,60000,'La constitución se descuenta de los fondos.');
  const root=p.locator('.vBanksPc');
  await root.waitFor();
  const certDd=async i=>{await root.locator('.vBanksPc-overview-tile[data-id="certificates"]').click();const v=await root.locator('.vBanks-certificates dl dd').nth(i).innerText();await root.locator('.vBanksPc-product-filter [data-id="all"]').click();return v};
  assert.equal(await p.locator('main.world-banks .inner-menu').count(),0,'No debe repetirse el menú interno de Bancos.');
  if(!mobile){
   await root.locator('.vBanksPc-overview-tile[data-id="certificates"]').click();
   assert.equal(await root.locator('.vBanksPc-lane [data-act="addCertificate"]').count(),1,'Se puede crear un certificado desde Bancos.');
   await root.locator('.vBanksPc-product-filter [data-id="all"]').click();
   assert.equal(await root.locator('.vBanksPc-product-filter button').count(),5,'El selector PC debe ofrecer Productos, Cuentas, Tarjetas, Préstamos y Certificados.');
   assert.equal(await root.locator('.vBanksPc-product-filter [aria-pressed="true"]').getAttribute('data-id'),'all');
   assert.match(await root.locator('.vBanksPc-bank').first().innerText(),/Todos los bancos/);
   assert.equal(await root.locator('.vBanksPc-overview-tile').count(),4,'Productos resume cuatro categorías sin listar productos individuales.');
   assert.equal(await root.locator('.vBanksPc-lanes').count(),0,'Productos no debe repetir los listados de detalle.');
   assert.match(await root.locator('.vBanksPc-overview-tile[data-id="cards"]').innerText(),/Deuda utilizada\s+RD\$6,500 · 1\.8%/);
   assert.match(await root.locator('.vBanksPc-overview-tile[data-id="accounts"]').innerText(),/RD\$120,000/);
   assert.match(await root.locator('.vBanksPc-overview-tile[data-id="loans"]').innerText(),/Cuota RD\$[\d,]+ · Avance \d+%/);
   assert.match(await root.locator('.vBanksPc-overview-tile[data-id="certificates"]').innerText(),/RD\$70,000/);
   assert.match(await root.locator('.vBanksPc-mp-total').innerText(),/Total: \d+ productos/);
   assert.ok(await root.locator('.vBanksPc-consumption-rows > div').count()>=1,'Se muestran todas las categorías de consumo.');
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
   if(mobile){const fs=root.locator('.vBanks-mobile-hero dl dd');return [await money(root.locator('.vBanks-mobile-net > div:first-child strong')),...await Promise.all([0,1,3].map(i=>money(fs.nth(i))))];}
   // PC (maqueta): posición neta desde «Mis bancos», fondos desde el KPI, deuda = deuda de tarjetas (resumen) + saldo de préstamos (detalle).
   if(!(await root.locator('.vBanksPc-overview-tile').count()))await root.locator('.vBanksPc-product-filter [data-id="all"]').click();
   const net=await money(root.locator('.vBanksPc-bank[aria-pressed="true"] > b'));
   const funds=await money(root.locator('.vBanksPc-kpi strong').nth(3));
   const cardDebt=Number((await root.locator('.vBanksPc-overview-tile[data-id="cards"] .vBanksPc-overview-metric strong').innerText()).split('·')[0].replace(/[^0-9.\-]/g,''));
   await root.locator('.vBanksPc-overview-tile[data-id="loans"]').click();
   const loanRows=await root.locator('.vBanksPc-lane .vBanksPc-product > b').allInnerTexts();
   await root.locator('.vBanksPc-product-filter [data-id="all"]').click();
   const loanDebt=loanRows.reduce((n,t)=>n+Number(t.replace(/[^0-9.\-]/g,'')),0);
   return [net,funds,cardDebt+loanDebt,0];
  };
  const netTotal=await view();
  assert.equal(netTotal[1],120000);
  if(mobile)assert.equal(netTotal[3],360002);
  assert.equal(netTotal[0],netTotal[1]+70000-netTotal[2]);
  if(mobile){
   assert.equal(await root.locator('.vBanks-mobile-hero dl dd').nth(2).innerText(),'RD$70,000');
   assert.equal(await root.locator('.vBanks-mobile-tiles > button').count(),4);
   assert.deepEqual(await root.locator('.vBanks-mobile-tiles > button > small').allTextContents(),['2','2','2','2']);
   assert.deepEqual(await root.locator('.vBanks-mobile-tiles > button > strong').allTextContents(),['RD$120,000',await root.locator('.vBanks-mobile-tiles > button[data-id="cards"] strong').innerText(),'RD$24,000','RD$70,000']);
   assert.equal(await root.locator('.vBanks-certificates,.v1301-insight').count(),0);
   assert.doesNotMatch(await root.innerText(),/Movimientos recientes|Actividad reciente|Consumo por tipo/);
   assert.match(await root.locator('.vBanks-limit-split').innerText(),/RD\$300,000.*US\$1,000/);
   assert.equal(await p.getByRole('navigation',{name:'Navegación móvil'}).getByRole('button').count(),5);
   assert.equal(await p.getByRole('navigation',{name:'Navegación móvil'}).getByRole('button',{name:'Bancos'}).getAttribute('aria-current'),'page');
   assert.equal(await p.locator('.vive-mobile-top').isVisible(),false,'Portada sin cabecera duplicada.');
   assert.equal(await p.locator('.v249-register-fab').isVisible(),false,'El registro flotante no tapa el retorno.');
   assert.equal(await p.locator('.v708-movements-fab').isVisible(),false,'Movimientos flotantes no tapan los productos.');
   assert.equal(await root.locator('.vBanks-mobile-net > div > small').first().evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');
   await choose('__banks_tools__');
   assert.equal(await p.locator('.vive-mobile-top').isVisible(),true,'Las herramientas generales siguen disponibles.');
   await choose('__banks_tools__');
   assert.equal(await p.locator('.vive-mobile-top').isVisible(),false);
   await p.evaluate(()=>window.scrollTo(0,0));
  }else{
   assert.equal(await certDd(0),'RD$70,000');
   assert.equal(await certDd(1),'8.00%');
  }
  if(mobile)assert.match(await selector.innerText(),/Todos los bancos/);
  else assert.equal(await root.locator('.vBanksPc-bank').first().getAttribute('aria-pressed'),'true');
  const checkFit=()=>root.evaluate(el=>el.scrollWidth<=el.clientWidth+2&&document.documentElement.scrollWidth<=innerWidth+2);
  assert.ok(await checkFit(),'El tablero debe caber a '+width+'px.');
  if(!mobile){
    const metrics=await root.locator('.vBanksPc-metric').evaluateAll(nodes=>nodes.map(el=>({top:Math.round(el.getBoundingClientRect().top),value:el.querySelector('strong')?.innerText||'',width:el.getBoundingClientRect().width})));
    assert.equal(metrics.length,4,'Bancos PC muestra cuatro indicadores: Ingresos, Egresos, Resultado neto y Fondos.');
    assert.equal(new Set(metrics.map(x=>x.top)).size,width>=1181?1:2,'Las filas de indicadores coinciden con Wallet PC.');
    assert.ok(metrics.every(x=>x.width>0&&x.value.length>0),'Importes completos visibles.');
    const bars=root.locator('.vBanksPc-consumption-rows .vBanksPc-meter i');
    if(await bars.count())assert.ok(await bars.first().evaluate(el=>{
      const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
      return rect.width>0&&rect.height>=5&&style.backgroundImage.includes('gradient');
    }),'Barras de consumo con relleno visible.');
    assert.doesNotMatch(await root.locator('.vBanksPc-var-row').allInnerTexts().then(x=>x.join(' ')),/[▲▼↑↓]/,'Las variaciones no usan flechas.');
  }
  if(!mobile)assert.ok(await root.evaluate((el,wide)=>{
   const [banks,products,insights]=[...el.querySelector('.vBanksPc-grid').children].map(x=>x.getBoundingClientRect());
   return banks.right<products.left&&Math.abs(banks.top-products.top)<2&&(wide
    ?products.right<insights.left&&Math.abs(banks.top-insights.top)<2
    :Math.abs(banks.left-insights.left)<2&&insights.top>=Math.max(banks.bottom,products.bottom));
  },width>=1121),'Las columnas responden como Wallet PC.');
  if(mobile)assert.ok(await root.evaluate(el=>{
   const seq=['.vBanks-mobile-head','.vBanks-mobile-selector','.vBanks-mobile-hero','.vBanks-mobile-products','.vBanks-mobile-return'];
   const top=seq.map(k=>el.querySelector(k).getBoundingClientRect().top);
   return top.every((y,i)=>!i||y>top[i-1]);
  }),'El orden móvil coincide con la referencia.');
  if(!mobile&&width>=1280)assert.ok(await p.evaluate(()=>document.scrollingElement.scrollHeight<=innerHeight+3),'Bancos PC debe caber sin scroll general a '+width+'px.');
  if(!mobile)assert.ok(await p.evaluate(()=>{
   const el=document.querySelector('main.vBanksPc-world .v371-return-values');
   return !!el&&getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length===2;
  }),'Beneficios y retorno PC usa cuadrícula 2×2 sin cifras superpuestas.');
  if(!mobile)assert.ok(await p.evaluate(()=>{
   const subtitle=document.querySelector('main.vBanksPc-world .topbar .top-sub');
   const tiles=document.querySelector('main.vBanksPc-world .v371-return-tile');
   return !!subtitle&&getComputedStyle(subtitle).display!=='none'&&(!tiles||getComputedStyle(tiles).backgroundColor==='rgba(0, 0, 0, 0)');
  }),'Bancos PC muestra su subtítulo y las celdas de retorno usan fondo transparente.');
  if(mobile)assert.ok(await root.locator('.vBanks-mobile-tiles').evaluate(el=>{
   const cols=getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean);
   return cols.length===2&&[...el.querySelectorAll('strong')].every(x=>getComputedStyle(x).textOverflow!=='ellipsis'&&x.scrollWidth<=x.clientWidth+1);
  }),'Los importes móviles deben ser legibles en un mosaico de dos columnas.');
  const checkUsage=async bankId=>{
   const expected=await p.evaluate(bankId=>{
    const t=window.__T,db=t.dbg(),cards=db.cards.filter(c=>!bankId||c.bankId===bankId),rate=db.settings.fx;
    const debt=cards.reduce((s,c)=>s+t.cs(c.id,'DOP').debt+t.cs(c.id,'USD').debt*rate,0);
    const limit=cards.reduce((s,c)=>s+c.limitDOP+c.limitUSD*rate,0);
    return {debt,percent:limit>0?Math.max(0,debt/limit*100):null};
   },bankId);
   assert.equal(await root.locator('.vBanks-mobile-utilization strong').innerText(),expected.percent===null?'—':expected.percent.toFixed(1)+'%');
   assert.equal(await money(root.locator('.vBanks-mobile-tiles [data-id="cards"] strong')),Math.round(expected.debt));
   if(expected.percent!==null)assert.ok(await root.locator('.vBanks-mobile-utilization .vBanksPc-meter').evaluate((el,percent)=>Math.abs(el.firstElementChild.getBoundingClientRect().width/el.getBoundingClientRect().width*100-Math.min(100,percent))<.6,expected.percent));
  };
  const checkAmounts=()=>root.evaluate(el=>[...el.querySelectorAll('.vBanks-mobile-hero :is(dd,strong,.vBanks-limit-split), .vBanks-mobile-tiles strong, .vBanks-mobile-return strong, .vBanks-return-percent')].every(x=>{
   const r=document.createRange();r.selectNodeContents(x);const a=x.getBoundingClientRect(),b=r.getBoundingClientRect();
   return getComputedStyle(x).textOverflow!=='ellipsis'&&x.scrollWidth<=x.clientWidth+2&&b.right<=a.right+2&&b.left>=a.left-2;
  }));
  if(mobile){await checkUsage(null);assert.ok(await checkAmounts(),'Importes completos y visibles.');}
  if(evidence)await p.screenshot({path:path.join(evidence,`bancos-${width}${theme==='black'?'-black':''}.png`),fullPage:true,animations:'disabled'});
  const usage=root.locator('.v1301-insight');
  if(!mobile){
  assert.match(await usage.innerText(),/Alimentación/);
  assert.match(await usage.innerText(),/Transporte/);
  assert.equal(await usage.evaluate(el=>el.open),true,'Consumo por tipo permanece siempre visible.');
  assert.equal(await usage.locator('.v1301-disclose-arrow').isVisible(),false,'Sin flecha de plegado.');
  }
  await choose('bank-a');
  const a=await view();
  if(!mobile){
    const rows=await root.locator('.vBanksPc-metric').evaluateAll(nodes=>new Set(nodes.map(el=>Math.round(el.getBoundingClientRect().top))).size);
    assert.equal(rows,width>=1181?1:2,'Cambiar de banco conserva las filas de KPI.');
  }

  if(!mobile){
   assert.match(await root.locator('.vBanksPc-overview-tile[data-id="accounts"]').innerText(),/RD\$60,000/);
   assert.match(await root.locator('.vBanksPc-overview-tile[data-id="cards"]').innerText(),/Deuda utilizada\s+RD\$6,000 · 3\.7%/);
  }
  assert.equal(a[1],60000);
  assert.equal(a[0],100000-a[2]);
  if(mobile){
   assert.equal(await root.locator('.vBanks-mobile-hero dl dd').nth(2).innerText(),'RD$40,000');
   await checkUsage('bank-a');
   assert.deepEqual(await root.locator('.vBanks-return-main strong,.vBanks-return-percent,.vBanks-return-secondary strong').allTextContents(),['+RD$6,820.00','+151.6%','RD$4,500.00','RD$11,320.00']);
   assert.equal(await root.locator('.vBanks-return-main.positive').count(),1);
  }else{
  assert.equal(await certDd(0),'RD$40,000');
  assert.match(await usage.locator('.vBanksPc-consumption-amount').innerText(),/6,600/);
  assert.match(await usage.locator('.vBanksPc-consumption-amount small').innerText(),/800\.00.*100\.00/);
  assert.doesNotMatch(await usage.innerText(),/Transporte/);
  assert.deepEqual(await root.locator('.v371-return-tile strong').allTextContents(),['RD$4,500.00','RD$11,320.00','+RD$6,820.00','+151.6%']);
  }
  if(!mobile){
   const selectCategory=async key=>{const tile=root.locator(`.vBanksPc-overview-tile[data-id="${key}"]`);if(await tile.count())await tile.click();else await root.locator(`.vBanksPc-product-filter button[data-id="${key}"]`).click()};
   const shown=()=>root.locator('.vBanksPc-lanes .vBanksPc-product').allTextContents();
   // La categoría no debe reemplazar las tres columnas del centralizador.
   for(const [kind,name] of [['accounts','Ahorros Alfa'],['cards','Visa Alfa'],['loans','Préstamo Alfa'],['certificates','Certificado Alfa']]){
    await selectCategory(kind);
    assert.equal(await root.locator('.vBanksPc-bank-list').count(),1);
    assert.equal(await root.locator('.vBanksPc-insights').count(),1);
    assert.equal(await root.locator('.vBanksPc-product-filter [aria-pressed="true"]').getAttribute('data-id'),kind);
    assert.equal(await root.locator('.vBanksPc-lane').count(),1);
    assert.equal(await root.locator('.vBanksPc-lanes .vBanksPc-product').count(),1);
    assert.match((await shown()).join(' '),new RegExp(name));
   }
   // Banco y categoría independientes: al cambiar la institución, se mantiene Tarjetas.
   await selectCategory('cards');
   await choose('bank-b');
   assert.equal(await root.locator('.vBanksPc-product-filter [aria-pressed="true"]').getAttribute('data-id'),'cards');
   assert.match((await shown()).join(' '),/Mastercard General/);
   assert.doesNotMatch((await shown()).join(' '),/Visa Alfa/);
   assert.equal(await root.locator('.vBanksPc-lanes .vBanksPc-product').count(),1);
   await choose('bank-a');
   assert.equal(await root.locator('.vBanksPc-product-filter [aria-pressed="true"]').getAttribute('data-id'),'cards');
   await selectCategory('all');
   assert.equal(await root.locator('.vBanksPc-overview-tile').count(),4);
   assert.equal(await root.locator('.vBanksPc-lanes .vBanksPc-product').count(),0);
   // Desde las tarjetas-resumen se entra a la lista real y sus opciones de alta y detalle.
   await root.locator('.vBanksPc-overview-tile[data-id="cards"]').click();
   assert.equal(await root.locator('.vBanksPc-product-filter [aria-pressed="true"]').getAttribute('data-id'),'cards');
   assert.equal(await root.locator('.vBanksPc-lanes .vBanksPc-product').count(),1);
   assert.equal(await root.locator('.vBanksPc-lane [data-act="addCard"]').count(),1);
   await selectCategory('all');
  }
  await root.getByRole('button',{name:'Beneficios y retorno'}).click();
  const ledger=root.getByRole('region',{name:'Tabla de beneficios por tarjeta'});
  assert.equal(await ledger.locator('table').count(),1);
  if(!mobile){
    const heroAnnual=root.locator('.v57-benefits .hero-actions [data-act="annualFee"]');
    assert.equal(await heroAnnual.count(),1,'La cabecera ejecutiva de Beneficios incluye el acceso a anualidades.');
    assert.match(await root.locator('.v57-benefits .v46-global-secondary').innerText(),/1/,'El encabezado respeta el banco elegido.');
    const annual=ledger.locator('button[data-act="annualFee"]');
    assert.equal(await annual.count(),1,'Anualidad accesible con una tarjeta seleccionada en Bancos PC.');
    if(evidence&&[1440,1024].includes(width))await p.screenshot({path:path.join(evidence,'bancos-beneficios-'+width+'.png'),animations:'disabled'});
    await annual.click();
    await p.locator('#annualFeeForm').waitFor();
    assert.match(await p.locator('#annualFeeForm').innerText(),/Anualidad y seguros/);
    await p.keyboard.press('Escape');
  }
  if(mobile){
   await ledger.getByRole('button',{name:'Registrar anualidad y seguros'}).click();
   await p.locator('#annualFeeForm').waitFor();
   await p.keyboard.press('Escape');
  }

  assert.equal(await ledger.locator('option[value="card-b"]').count(),0);
  await ledger.getByRole('button',{name:'Registrar beneficio'}).click();
  await p.locator('#v144CashbackForm').waitFor();
  await p.keyboard.press('Escape');
  await root.getByRole('button',{name:'Volver al resumen'}).click();
  const openProduct=async (kind,id)=>{
   if(mobile&&await root.locator('.vBanks-back').count())await root.locator('.vBanks-back').click();
   await root.locator(`[data-act="banksPcProducts"][data-id="${kind}"]:visible`).first().click();
   if(!mobile){
    assert.equal(await root.locator('.vBanksPc-bank-list').count(),1,'El filtro conserva el tablero de tres columnas.');
    assert.equal(await root.locator('.vBanksPc-lane').count(),1,'Solo muestra la categoría elegida.');
   }
   await root.locator(`[data-act="banksOpenProduct"][data-id="${id}"]`).click();
   assert.equal(await p.evaluate(()=>window.__T.ui().page),'banks');
   return root.getByRole('region',{name:'Detalle del producto'});
  };
  const closeProduct=async(detail,bankId)=>{
   await detail.locator('[data-act="banksCloseProduct"]').click();
   if(!mobile){
    assert.equal(await root.locator(`.vBanksPc-bank[data-id="${bankId}"]`).getAttribute('aria-pressed'),'true');
    assert.equal(await root.locator('.vBanksPc-bank-list').count(),1);
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
  if(mobile){
   assert.equal(await root.locator('.vBanks-mobile-hero dl dd').nth(2).innerText(),'RD$30,000');
   assert.equal(await root.locator('.vBanks-return-main.negative').count(),1);
   await checkUsage('bank-b');
  }else assert.equal(await certDd(1),'—');
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
  if(mobile){
   await p.evaluate(()=>{
    const t=window.__T,db=t.dbg();db.accounts[0].opening=9876543210;db.cards[0].limitDOP=123456789;db.cards[0].openingDOP=234567890;t.inv();t.go('banks');
   });
   await checkUsage(null);
   assert.ok(await checkFit()&&await checkAmounts(),'Los montos grandes no se cortan a '+width+'px.');
   if(evidence)await p.screenshot({path:path.join(evidence,`bancos-importes-${width}-${theme}.png`),fullPage:true,animations:'disabled'});
   await p.evaluate(()=>{const t=window.__T,db=t.dbg();db.cards.forEach(c=>{c.limitDOP=0;c.limitUSD=0});t.inv();t.go('banks');});
   await checkUsage(null);
   assert.equal(await root.locator('.vBanks-mobile-utilization .vBanksPc-meter i').count(),0);
  }
  if(!mobile){
    await p.evaluate(()=>{
      const t=window.__T,db=t.dbg(),date=t.fn.today(),prior=t.fn.plusMonths(date,-1);
      const rule=(id,from,limitDOP,limitUSD)=>({id:'test-'+id+'-'+from,clave:'tarjeta.condiciones',sujeto:id,desde:from,creada:from+'T00:00:00Z',valor:{limitDOP,limitUSD}});
      db.ruleVersions=[
        rule('card-a',prior,80000.37,1000.02),rule('card-a',date,100000.37,1000.02),
        rule('card-b',prior,200000,0),rule('card-b',date,200000,0)
      ];
      t.inv();t.go('banks');
    });
    // El límite total ya no es KPI superior: permanece accesible en la vista de Tarjetas.
    await root.locator('.vBanksPc-overview-tile[data-id="cards"]').click();
    assert.match(await root.locator('.vBanksPc-limit-strip').innerText(),/Límite total\s*RD\$/,'El límite global sigue visible en Tarjetas.');
    await choose('bank-a');
    assert.match(await root.locator('.vBanksPc-limit-strip').innerText(),/Límite total\s*RD\$/,'El límite por banco sigue visible en Tarjetas.');
    await root.locator('.vBanksPc-product-filter [data-id="all"]').click();
    await choose('__all_banks__');
    assert.ok(await checkFit(),'El comparativo histórico no introduce desbordes.');
  }

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
  assert.equal(await p.getByRole('region',{name:'Créditos y patrimonio'}).count(),0,'Patrimonio ya no incluye «Exposición financiera».');
  assert.equal(await p.locator('[data-act="navigate"][data-id="payments"]').count(),0);
  await go(p,'payments');
  assert.equal(await p.evaluate(()=>window.__T.ui().page),'patrimony');
  const screenshots=process.env.BANKS_VISUAL_DIR||process.env.WALLET_VISUAL_DIR;
  if(screenshots)await p.screenshot({path:path.join(screenshots,'patrimonio-'+width+'.png'),animations:'disabled'});
 } finally { await ctx.close(); }
}

async function testDesktopDashboardScroll(browser){
 const {ctx,p}=await open(browser,1784,956);
 try{
  await fixture(p);
  await p.evaluate(()=>{
   const t=window.__T,db=t.dbg(),date=t.fn.today();
   for(const [index,category] of ['Hogar','Transporte','Servicios básicos'].entries()){
    db.transactions.push({id:'scroll-purchase-'+index,type:'card_charge',cardId:'card-a',category,amount:12,currency:'USD',fxRateSnapshot:61,date});
   }
   t.inv();
   t.go('banks');
  });
  await p.locator('.vBanksPc-bank[data-id="bank-a"]').click();
  const insights=p.locator('.vBanksPc-insights');
  const rows=insights.locator('.vBanksPc-consumption-rows > div');
  assert.equal(await rows.count(),4);
  const geometry=()=>insights.evaluate(el=>({
   overflow:getComputedStyle(el).overflowY,
   bottom:el.getBoundingClientRect().bottom,
   last:el.querySelector('.vBanksPc-consumption-rows > div:last-child').getBoundingClientRect().bottom,
   innerHeight,
   scrollHeight:document.scrollingElement.scrollHeight,
   scrollTop:document.scrollingElement.scrollTop
  }));
  const tall=await geometry();
  assert.equal(tall.overflow,'visible','La columna derecha carece de scroll interno.');
  assert.ok(tall.last<=tall.bottom&&tall.bottom<=tall.innerHeight+1,'El panel de consumo se ve completo en PC.');
  assert.ok(tall.scrollHeight<=tall.innerHeight+1,'La página cabe en el alto disponible.');
  await p.setViewportSize({width:1280,height:600});
  const short=await geometry();
  assert.ok(short.scrollHeight>short.innerHeight,'La página puede desplazarse cuando falta espacio.');
  await rows.last().scrollIntoViewIfNeeded();
  const scrolled=await geometry();
  assert.equal(scrolled.overflow,'visible');
  assert.ok(scrolled.last<=scrolled.innerHeight,'La última categoría es alcanzable (visible o con scroll general).');
 }finally{await ctx.close();}
}

async function banksAndPatrimony(browser){
 if(evidence)fs.mkdirSync(evidence,{recursive:true});
 await inspectPrevious(browser);
 await testDesktopDashboardScroll(browser);
 for(const width of [1672,1440,1280,1024,390,320,430])await testBanks(browser,width);
 await testBanks(browser,390,'black');
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
