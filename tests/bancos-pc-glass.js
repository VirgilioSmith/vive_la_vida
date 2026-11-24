'use strict';
/* Bancos PC · Premium Liquid Glass: 4 KPI (Ingresos | Egresos | Resultado neto | Fondos), variaciones sin flechas,
   Mis bancos, Mis productos, Beneficios y retorno, Consumo por tipo. Valida Claro/Black, acentos, resoluciones,
   consola, desbordes, y que Wallet PC y Bancos móvil no cambian. Capturas en docs/auditoria/bancos-pc-glass/. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const open=require('./harness');
const OUT=path.join(__dirname,'..','docs','auditoria','bancos-pc-glass');

async function fixture(p){
 await p.evaluate(()=>{
  const t=window.__T,d=t.dbg();
  const month=t.fn.today().slice(0,7);
  const [y,m]=month.split('-').map(Number);
  const prev=(m===1?(y-1)+'-12':y+'-'+String(m-1).padStart(2,'0'));
  const acc=d.accounts.find(a=>a.currency==='DOP')||d.accounts[0];
  d.transactions=[
   {id:'k1',type:'income',date:month+'-03',amount:10000,currency:'DOP',accountId:acc.id,category:'Salario',created:month+'-03T10:00:00Z'},
   {id:'k2',type:'income',date:prev+'-03',amount:8000,currency:'DOP',accountId:acc.id,category:'Salario',created:prev+'-03T10:00:00Z'},
   {id:'k3',type:'expense',date:month+'-04',amount:4000,currency:'DOP',accountId:acc.id,category:'Hogar',created:month+'-04T10:00:00Z'},
   {id:'k4',type:'expense',date:prev+'-04',amount:5000,currency:'DOP',accountId:acc.id,category:'Hogar',created:prev+'-04T10:00:00Z'}
  ];
  d.transactions.push({id:'k5',type:'card_charge',date:month+'-05',amount:2000,currency:'DOP',cardId:d.cards[0].id,category:'Hogar',created:month+'-05T10:00:00Z'});
  d.settings.month=month;t.inv();t.go('banks');
 });
 await p.waitForSelector('.vBanksPc-kpi');
}

async function run(browser,{theme,palhex,width,height,shot}){
 delete process.env.TOUCH;process.env.THEME=theme;
 if(palhex)process.env.PALHEX=palhex;else delete process.env.PALHEX;
 const {ctx,p}=await open(browser,width,height);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const tag=`${theme}${palhex?' '+palhex:''} ${width}x${height}`;
 const ok=(c,msg)=>assert.ok(c,`[${tag}] ${msg}`);
 await p.evaluate(()=>window.__T.go('overview'));
 await fixture(p);
 // 2 · cuatro KPI en orden
 const labels=await p.locator('.vBanksPc-kpi>div>span:first-child').allInnerTexts();
 assert.deepEqual(labels,['Ingresos','Egresos','Resultado neto','Fondos'],`[${tag}] orden de KPI`);
 ok(!(await p.locator('.vBanksPc-metric',{hasText:'Límite total'}).count()),'no hay KPI de Límite total');
 const vals=await p.locator('.vBanksPc-kpi>div>strong').allInnerTexts();
 ok(/10,000/.test(vals[0])&&/6,000/.test(vals[1])&&/4,000/.test(vals[2]),`importes del período: ${vals}`);
 // 3-4 · variaciones sin flechas, % y absoluto correctos
 const rows=await p.locator('.vBanksPc-var-row').allInnerTexts();
 ok(/\+25\.0%/.test(rows[0])&&/\+RD\$2,000/.test(rows[0]),`ingresos +25% / +2,000: ${rows[0]}`);
 ok(/\+20\.0%/.test(rows[1])&&/\+RD\$1,000/.test(rows[1]),`egresos +20% / +1,000: ${rows[1]}`);
 ok(/\+33\.3%/.test(rows[2])&&/\+RD\$1,000/.test(rows[2]),`resultado +33.3% / +1,000: ${rows[2]}`);
 ok(rows.every(r=>!/[▲▼↑↓]/.test(r)),'las variaciones no usan flechas');
 ok(await p.locator('.vBanksPc-var-row svg').count()===0,'sin iconos de flecha en las cápsulas');
 ok(await p.locator('.vBanksPc-var.good,.vBanksPc-var-abs.good').count()>=4&&await p.locator('.vBanksPc-var.bad,.vBanksPc-var-abs.bad').count()>=2,'tonos semánticos favorables y desfavorables');
 const egresosTone=await p.locator('.vBanksPc-kpi').nth(1).locator('.vBanksPc-var').getAttribute('class');
 ok(/bad/.test(egresosTone),'un aumento de egresos es desfavorable (rojo)');
 // 5 · Mis bancos y selección
 const bankCount=await p.locator('.vBanksPc-bank').count();
 ok(bankCount>=2,'lista de instituciones');
 if(width>=1440)ok(/100%/.test(await p.locator('.vBanksPc-bank').first().innerText()),'Todos los bancos 100%');
 const firstBank=p.locator('.vBanksPc-bank').nth(1);
 await firstBank.click();await p.waitForTimeout(250);
 ok((await p.locator('.vBanksPc-bank').nth(1).getAttribute('aria-pressed'))==='true','selección activa');
 await p.locator('.vBanksPc-bank').first().click();await p.waitForTimeout(250);
 // 6 · productos
 const tiles=await p.locator('.vBanksPc-overview-tile').count();
 assert.equal(tiles,4,`[${tag}] cuatro categorías`);
 ok(/Total: \d+ producto/.test(await p.locator('.vBanksPc-mp-total').innerText()),'total de productos');
 await p.locator('.vBanksPc-overview-tile[data-id="cards"]').click();await p.waitForTimeout(300);
 ok(await p.locator('.vBanksPc-lane').count()===1,'Tarjetas abre su detalle contextual');
 const row=p.locator('.vBanksPc-lane .vBanksPc-product').first();
 if(await row.count()){await row.click();await p.waitForTimeout(500);ok(await p.locator('.vBanks-detail').count()>0,'la tarjeta abre su vista');await p.evaluate(()=>document.querySelector('[data-act="banksCloseProduct"]')?.click());await p.waitForTimeout(300)}
 await p.locator('.vBanksPc-product-filter [data-id="all"]').click();await p.waitForTimeout(250);
 // 7 · beneficios
 const ret=await p.locator('.vBanksPc-insights .v371-return-tile small').allInnerTexts();
 ok(ret.includes('Retorno neto')&&ret.includes('Retorno %')&&ret.includes('Anualidad')&&ret.includes('Beneficios'),`etiquetas de beneficios: ${ret}`);
 // 8 · consumo
 ok(await p.locator('.vBanksPc-consumption-total').count()===1,'consumo total');
 ok((await p.locator('.vBanksPc-consumption-rows>div').count())>=1,'categorías de consumo');
 // 9 · detalle de beneficios (navegación)
 await p.evaluate(()=>document.querySelector('[data-v144-action="open-benefits"]')?.click());await p.waitForTimeout(500);
 ok(await p.locator('.vBanksPc-workspace').count()>0,'abre el detalle de beneficios');
 await p.evaluate(()=>document.querySelector('[data-act="banksPcCloseBenefits"]')?.click());await p.waitForTimeout(300);
 await p.evaluate(()=>{const t=window.__T;t.go('overview');t.go('banks')});await p.waitForSelector('.vBanksPc-kpi');
 // 14-15 · desbordes
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'sin desborde horizontal');
 ok(await p.evaluate(()=>[...document.querySelectorAll('.vBanksPc-kpi>div>strong,.vBanksPc-var,.vBanksPc-var-abs,.vBanksPc-overview-metric strong')].every(e=>e.scrollWidth<=e.clientWidth+1)),'importes y cápsulas sin recortes');
 ok(await p.evaluate(()=>[...document.querySelectorAll('.vBanksPc-var-row')].every(r=>r.scrollWidth<=r.clientWidth+1)),'cápsulas de variación dentro de su tarjeta');
 ok(errors.length===0,'errores de consola: '+errors.join(' | '));
 if(shot){fs.mkdirSync(OUT,{recursive:true});await p.screenshot({path:path.join(OUT,shot)})}
 await ctx.close();
}

module.exports=async function bancosPcGlass(browser){
 const base=[{theme:'light',width:1672,height:941,shot:'claro-1672.png'},{theme:'black',width:1672,height:941,shot:'black-1672.png'},
  {theme:'light',palhex:'#e0457b',width:1672,height:941,shot:'claro-rosa-1672.png'},{theme:'black',palhex:'#16a085',width:1672,height:941,shot:'black-verde-1672.png'}];
 for(const cfg of base)await run(browser,cfg);
 for(const [w,h] of [[1280,800],[1440,900],[1920,1080],[2000,1176]])await run(browser,{theme:'light',width:w,height:h,shot:`claro-${w}.png`});
 // Wallet PC y Bancos móvil permanecen intactos
 delete process.env.PALHEX;process.env.THEME='light';
 {const {ctx,p}=await open(browser,1672,941);await p.evaluate(()=>{window.__T.go('overview');window.__T.go('wallet')});await p.waitForSelector('.vWalletPc');
  assert.equal(await p.locator('.vBanksPc-kpi').count(),0,'Wallet PC no usa los KPI de Bancos');
  assert.ok(await p.locator('.vWalletPc-stat').count()>=3,'Wallet PC conserva sus KPI');
  fs.mkdirSync(OUT,{recursive:true});await p.screenshot({path:path.join(OUT,'wallet-pc-referencia.png')});await ctx.close()}
 process.env.TOUCH='1';
 {const {ctx,p}=await open(browser,390,844);await p.evaluate(()=>window.__T.go('banks'));await p.waitForSelector('.vBanks-mobile');
  assert.equal(await p.locator('.vBanksPc-kpi').count(),0,'Bancos móvil no usa los KPI de PC');
  assert.ok(await p.locator('.vBanks-mobile-hero').count()===1,'Bancos móvil conserva su hero');
  await p.screenshot({path:path.join(OUT,'bancos-movil-intacto.png')});await ctx.close()}
 delete process.env.TOUCH;
 console.log('Bancos PC Premium Liquid Glass validado con Playwright (Claro/Black, acentos, 5 resoluciones, Wallet PC y Bancos móvil intactos).');
};
if(require.main===module)(async()=>{const b=await chromium.launch();try{await module.exports(b)}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
