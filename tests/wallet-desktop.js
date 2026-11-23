'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const open=require('./harness');

module.exports=async function walletDesktop(browser){
 delete process.env.TOUCH;
 process.env.THEME='light';
 const {ctx,p}=await open(browser,1672,941);
 const errors=[];
 p.on('pageerror',error=>errors.push(error.message));
 const font=selector=>p.locator(selector).first().evaluate(el=>{
  const s=getComputedStyle(el);
  return [s.fontFamily,s.fontSize,s.fontWeight,s.lineHeight,s.letterSpacing];
 });
 const amount=async selector=>Number((await p.locator(selector).innerText()).replace(/[^\d.\-]/g,''));
 const overflow=()=>p.evaluate(()=>{
  const root=document.documentElement,panels=document.querySelectorAll('.vWalletPc-stat,.vWalletPc-grid > section,.vWalletPc-right > section');
  return [...(root.scrollWidth>innerWidth+1?[['documento',root.scrollWidth,innerWidth]]:[]),
   ...Array.from(panels).filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>[el.className,el.scrollWidth,el.clientWidth])];
 });
 try{
  await p.evaluate(()=>window.__T.go('cards'));
  const baseTitle=await font('.top-title');
  const baseHeading=await font('.v256-cards-list-head h2');
  const expected=await p.evaluate(()=>{
   const t=window.__T,d=t.dbg();
   const [a]=d.cards,first={...a,id:'pc-card-a',name:'Tarjeta A',last4:'1234',limitDOP:100000,limitUSD:1000,openingDOP:0,openingUSD:0,annualFeeAmount:4500,annualFeeCurrency:'DOP',cutDay:1,dueDay:28,archived:false};
   const second={...first,id:'pc-card-b',name:'Tarjeta B',last4:'5678',limitDOP:200000,limitUSD:2000};
   d.cards=[first,second];d.statements=[];d.settings.fx=60;
   const charge=(id,card,currency,amount,extra={})=>({id,cardId:card.id,type:'card_charge',currency,amount,date:'2021-01-01',created:'2021-01-01T12:00:00Z',...extra});
   const aDop=charge('pc-tx-1',first,'DOP',10000);
   d.transactions=[aDop,{...aDop},charge('pc-tx-2',first,'USD',100,{fxRateSnapshot:58}),charge('pc-tx-3',second,'DOP',4000),{
    id:'pc-reward',cardId:first.id,type:'card_reward',amount:11320,currency:'DOP',date:t.fn.today()
   }];
   t.inv();
   return d.cards.map(c=>{
    const dop=t.cs(c.id,'DOP'),usd=t.cs(c.id,'USD');
    return {name:c.name,limit:c.limitDOP+c.limitUSD*60,debt:dop.debt+usd.debt*60,available:dop.available+usd.available*60,dop:dop.billed,usd:usd.billed};
   });
  });
  await p.getByRole('button',{name:/^Wallet:/}).click();
  const wallet=p.locator('.vWalletPc');
  await wallet.waitFor();
  assert.equal(await p.getByRole('heading',{name:'Tu universo financiero'}).count(),1);
  assert.deepEqual(await font('.top-title'),baseTitle);
  assert.equal((await font('.vWalletPc-state h2'))[0],baseHeading[0]);
  assert.equal((await font('.vWalletPc-state h2'))[2],baseHeading[2]);
  assert.equal(await wallet.getByRole('button',{name:/Créditos generales/}).getAttribute('aria-pressed'),'true');
  const sum=key=>expected.reduce((total,row)=>total+row[key],0);
  assert.equal(await amount('.vWalletPc-stat.is-limit strong'),480000);
  assert.equal(await amount('.vWalletPc-stat.is-debt strong'),Math.round(sum('debt')));
  assert.equal(await amount('.vWalletPc-stat.is-available strong'),Math.round(sum('available')));
  assert.equal(await amount('.vWalletPc-stat.is-usage strong'),Number((100*sum('debt')/480000).toFixed(1)));
  assert.equal(await amount('.vWalletPc-chart-total strong'),19800);
  assert.equal(await p.locator('.vWalletPc-limit-row').count(),2);
  assert.equal(await wallet.locator('.vWalletPc-legend .vWalletPc-product-mark').count(),2);
  assert.equal(await wallet.locator('.wallet-consumption-split').innerText(),'RD$14,000.00 · US$100.00');
  const slices=p.locator('.vWalletPc-chart circle[role="button"]');
  assert.equal(await slices.count(),2);
  const portions=await slices.evaluateAll(all=>all.map(el=>parseFloat(el.getAttribute('stroke-dasharray'))));
  assert.ok(Math.abs(portions[0]-100*15800/19800)<1e-8);
  assert.ok(Math.abs(portions[0]+portions[1]-100)<1e-8);

  const evidence=process.env.WALLET_VISUAL_DIR;
  if(evidence)fs.mkdirSync(evidence,{recursive:true});
  const navigation=p.getByRole('navigation',{name:'Módulos financieros'});
  const destination=id=>navigation.locator(`button[data-id="${id}"]`);
  const railGeometry=()=>navigation.evaluate(el=>{
   const rail=el.closest('aside').getBoundingClientRect();
   const main=document.querySelector('main.main').getBoundingClientRect();
   return {left:rail.left,width:rail.width,mainLeft:main.left};
  });
  for(const [width,height] of [[1672,941],[1440,900],[1280,800],[1024,768]]){
   await p.setViewportSize({width,height});
   await destination('overview').click();
   const compactRail=await railGeometry();
   assert.ok(compactRail.width>0&&compactRail.width<110,'Inicio usa la barra lateral compacta');
   for(const page of ['register','banks','wallet']){
    await destination(page).click();
    await p.locator(`main.world-${page}`).waitFor();
    assert.equal(await destination(page).getAttribute('aria-current'),'page');
    assert.deepEqual(await railGeometry(),compactRail,`Navegación de ${page} a ${width}px`);
   }
   assert.deepEqual(await overflow(),[],'Desborde en escritorio a '+width+'px');
   if(evidence)await p.screenshot({path:path.join(evidence,'wallet-pc-'+width+'.png'),fullPage:true,animations:'disabled'});
  }
  const benefits=wallet.locator('.vWalletPc-return');
  const benefitLink=benefits.getByRole('button',{name:'Beneficios y retorno'});
  const returnValues=()=>benefits.locator('.v371-return-tile strong').allTextContents();
  assert.deepEqual(await returnValues(),['RD$9,000.00','RD$11,320.00','+RD$2,320.00','+25.8%']);
  await benefitLink.click();
  const benefitsLedger=p.getByRole('region',{name:'Tabla de beneficios por tarjeta'});
  await benefitsLedger.waitFor();
  assert.equal(await benefitsLedger.locator('table').count(),1);
  await p.getByRole('button',{name:'Volver a Wallet'}).click();
  await benefitLink.waitFor();
  await p.locator('.vWalletPc-chart').scrollIntoViewIfNeeded();
  const arc=await slices.first().evaluate(el=>{
   const svg=el.ownerSVGElement,point=svg.createSVGPoint(),angle=2*Math.PI*parseFloat(el.getAttribute('stroke-dasharray'))/200;
   point.x=60+50*Math.cos(angle);point.y=60+50*Math.sin(angle);
   const transformed=point.matrixTransform(el.getScreenCTM());
   return {x:transformed.x,y:transformed.y};
  });
  await p.mouse.click(arc.x,arc.y);
  assert.equal(await amount('.vWalletPc-chart-total strong'),15800);
  await slices.first().press('Enter');
  assert.equal(await amount('.vWalletPc-chart-total strong'),19800);

  for(const {name,limit,debt,available} of expected){
   const card=wallet.getByRole('button',{name:'Seleccionar '+name,exact:true});
   await card.click();
   assert.equal(await card.getAttribute('aria-pressed'),'true');
   assert.equal(await amount('.vWalletPc-stat.is-limit strong'),limit);
   assert.equal(await amount('.vWalletPc-stat.is-debt strong'),Math.round(debt));
   assert.equal(await amount('.vWalletPc-stat.is-available strong'),Math.round(available));
   assert.equal(await p.locator('.vWalletPc-limit-row').count(),0);
  }
  await wallet.getByRole('button',{name:'Seleccionar Tarjeta A',exact:true}).click();
  assert.deepEqual(await returnValues(),['RD$4,500.00','RD$11,320.00','+RD$6,820.00','+151.6%']);
  await benefitLink.click();
  assert.equal(await benefitsLedger.locator('select[data-v144-filter="card"]').inputValue(),'pc-card-a');
  await p.getByRole('button',{name:'Volver a Wallet'}).click();
  assert.equal(await wallet.getByRole('button',{name:'Seleccionar Tarjeta A',exact:true}).getAttribute('aria-pressed'),'true');
  await wallet.getByRole('button',{name:'Seleccionar Tarjeta B',exact:true}).click();
  await wallet.getByRole('button',{name:'Registrar beneficio',exact:true}).click();
  await p.locator('#v144CashbackForm').waitFor();
  await p.locator('#modal-root [data-act="closeModal"]').first().click();
  await wallet.getByRole('button',{name:'Anualidad y seguros',exact:true}).click();
  await p.locator('#annualFeeForm').waitFor();
  await p.locator('#modal-root [data-act="closeModal"]').first().click();
  await wallet.getByRole('button',{name:'Explorar el ciclo',exact:true}).click();
  await p.getByRole('button',{name:'Volver a Wallet'}).click();
  assert.equal(await wallet.getByRole('button',{name:'Seleccionar Tarjeta B',exact:true}).getAttribute('aria-pressed'),'true');
  await wallet.getByRole('button',{name:/Créditos generales/}).click();
  assert.equal(await wallet.locator('.vWalletPc-cuts > p').count(),0);
  await wallet.getByRole('button',{name:'Ver estado consolidado del crédito'}).click();
  await p.locator('.v176-card-insight-modal .close').click();
  for(const [key,label] of [['dop','pesos'],['usd','dólares']]){
   const button=wallet.getByRole('button',{name:'Ver cortes pendientes en '+label});
   assert.equal(Number((await button.innerText()).replace(/[^\d.\-]/g,'')),Number(sum(key).toFixed(2)));
   if(await button.isEnabled()){
    await button.click();
    const cuts=p.getByRole('dialog',{name:'Composición del portafolio de tarjetas'});
    await cuts.waitFor();
    assert.equal(await cuts.locator('.v176-credit-row').count(),expected.filter(row=>row[key]>.005).length);
    await cuts.locator('.close').click();
   }
  }
  await wallet.getByRole('button',{name:'Ver importes de consumo histórico'}).click();
  await p.getByRole('dialog',{name:'Consumo histórico'}).getByRole('button',{name:'Cerrar'}).click();
  await p.getByRole('button',{name:'Buscar movimientos, tarjetas o comercios'}).click();
  await p.getByRole('dialog',{name:'Buscador global vive el hoy'}).waitFor();
  await p.keyboard.press('Escape');
  for(const [label,page] of [['Cuentas','accounts'],['Préstamos','loans'],['Certificados','certificates']]){
   await wallet.getByRole('button',{name:label,exact:true}).click();
   assert.equal(await p.evaluate(()=>window.__T.ui().page),page);
   await p.getByRole('button',{name:/^Wallet:/}).click();
  }
  const limitPanel=wallet.locator('.vWalletPc-stat.is-limit');
  const appearance=()=>limitPanel.evaluate(el=>{
   const s=getComputedStyle(el);
   return {background:s.backgroundImage,fill:s.backgroundColor,blur:s.backdropFilter||s.webkitBackdropFilter};
  });
  for(const theme of ['light','black']){
   const set=palette=>p.evaluate(({theme,palette})=>{
    const t=window.__T,d=t.dbg();
    Object.assign(d.settings,{theme,paletteChoice:'custom',paletteHex:palette});
    t.go('wallet');
   },{theme,palette});
   await set('#087b72');
   const teal=await appearance();
   await set('#a63758');
   const coral=await appearance();
   assert.notEqual(coral.background,teal.background,'El acento actualiza el cristal de Wallet');
   assert.equal(coral.fill,theme==='light'?'rgba(255, 255, 255, 0.35)':'rgba(35, 37, 45, 0.39)');
   assert.equal(coral.blur,'blur(28px) saturate(1.4)');
   assert.equal(await amount('.vWalletPc-stat.is-limit strong'),480000);
  }
  assert.deepEqual(errors,[]);
  console.log('OK Wallet PC · 4 resoluciones, Claro y Black, acentos, gráficos, cortes y navegación');
 }finally{
  await ctx.close();
 }
};
