/* V864: Movimientos PC — porcentajes reales, iconografía y primera pantalla visible. */
'use strict';
process.env.FREEZE='2026-11-23T15:00:00Z';
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const open=require('./harness');
async function verifyFilters(p){
 const [first,second]=await p.evaluate(()=>{
  const T=window.__T,db=T.dbg(),first=db.accounts.find(a=>a.currency==='DOP');
  const second={...first,id:'ledger-filter-second',name:'Cuenta de prueba secundaria',currency:'DOP'};
  db.accounts.push(second);
  const entry=(id,type,amount,accountId,extra={})=>({id,type,amount,currency:'DOP',accountId,date:'2026-11-22',note:id,reviewed:true,...extra});
  db.transactions=[
   entry('Ingreso filtrable','income',1000,first.id),
   entry('Compra filtrable','expense',250,first.id,{category:'Compras'}),
   entry('Transferencia filtrable','transfer',180,first.id,{toAccountId:second.id,targetAmount:180,transferFee:5}),
   entry('Ingreso en dólares','income',10,second.id,{currency:'USD',fxRateSnapshot:60}),
   entry('Gasto fuera del mes','expense',99,first.id,{date:'2026-10-22'})
  ];
  T.inv();T.go('register');
  return [first.id,second.id];
 });
 const amount=async key=>(await p.locator('.movement-metric-'+key+' strong').innerText()).replace(/[^0-9-]/g,'');
 assert.equal(await amount('count'),'4');
 await p.locator('[data-act=ledgerProducts]').click();
 const dialog=p.getByRole('dialog',{name:'Productos financieros'});
 await dialog.locator('[data-value="accounts:'+first+'"]').click();
 await dialog.locator('[data-value="accounts:'+second+'"]').click();
 await dialog.getByRole('button',{name:'Aplicar selección'}).click();
 assert.equal(await amount('transfer'),'180','Una transferencia vinculada a las dos cuentas solo se suma una vez');
 await p.locator('#ledgerCurrency').selectOption('DOP');
 assert.equal(await amount('count'),'3');
 assert.equal(await amount('income'),'1000');
 assert.equal(await amount('expense'),'255','La comisión de la transferencia se contabiliza como gasto');
 assert.equal(await amount('net'),'745');
 await p.locator('#typeFilter').selectOption('expense');
 assert.equal(await amount('count'),'1');
 assert.equal(await amount('expense'),'250');
 assert.equal(await amount('income'),'0');
 assert.equal(await p.locator('tbody tr[data-movement-type]').count(),1);
 const downloaded=p.waitForEvent('download');
 await p.locator('#ledger-world [data-act=csv]').click();
 const result=await downloaded;
 const csv=fs.readFileSync(await result.path(),'utf8');
 assert.match(csv,/Compra filtrable/);
 assert.doesNotMatch(csv,/Transferencia filtrable|Ingreso filtrable|Gasto fuera del mes/);
 const shell=await p.locator('#app > .shell').elementHandle();
 await p.evaluate(()=>{window.__viveIntel.go('banks');window.__viveIntel.go('register')});
 assert.equal(await p.evaluate(el=>el===document.querySelector('#app > .shell'),shell),true);
 assert.equal(await p.locator('#typeFilter').inputValue(),'expense');
 await p.locator('[data-act=ledgerClear]').click();
 assert.equal(await amount('count'),'5');
 await p.locator('#txPeriod').selectOption('range');
 await p.locator('#ledgerFrom').fill('2026-10-22');
 await p.locator('#ledgerTo').fill('2026-10-22');
 assert.equal(await amount('count'),'1');
 assert.equal(await amount('expense'),'99');
 const input=await p.locator('#searchTx').elementHandle();
 await p.locator('#searchTx').fill('Sin coincidencias');
 assert.equal(await amount('count'),'0');
 assert.equal(await p.evaluate(el=>el===document.activeElement,input),true);
 console.log('Filtros, navegación, resumen, gráfico y CSV alineados');
}
(async()=>{
 const browser=await (process.env.MOVEMENTS_BROWSER==='webkit'?webkit:chromium).launch();
 const dir=path.resolve(__dirname,'../test-results/movimientos-desktop');
 fs.mkdirSync(dir,{recursive:true});
 let failures=0;
 try{
  for(const [width,height] of [[1680,866],[1440,900],[1280,800]]){
   const {ctx,p}=await open(browser,width,height);
   const errors=[];p.on('pageerror',e=>errors.push(e.message));
   try{
    await p.evaluate(()=>{
     const T=window.__T,db=T.dbg(),account=db.accounts.find(x=>!x.archived&&x.currency==='DOP');
     if(!account)throw Error('Falta cuenta DOP en el entorno de prueba');
     const mk=(id,type,amount,date)=>({id:'v864-'+id,type,amount,currency:'DOP',date,accountId:account.id,category:type==='income'?'Otros ingresos':'Otros gastos',subcategory:'',reviewed:true});
     db.transactions=[
      mk('prev-income','income',1000,'2026-10-20'),
      mk('prev-expense','expense',300,'2026-10-21'),
      mk('cur-income','income',1200,'2026-11-21'),
      mk('cur-expense','expense',240,'2026-11-22'),
      ...Array.from({length:12},(_,i)=>mk('adjust-'+i,'adjustment',0,'2026-11-22'))
     ];
     T.inv();T.ui().txPeriod='month';T.ui().ledgerMonth='2026-11';T.go('register');
    });
    await p.locator('#ledger-world.movement-desktop .movement-metric').first().waitFor();
    const k=await p.evaluate(()=>{
     const root=document.querySelector('#ledger-world.movement-desktop');
     const el=name=>root.querySelector('.movement-metric-'+name);
     const main=root.closest('main'),more=root.querySelector('.v51-desk-more');
     return {metrics:root.querySelectorAll('.movement-metric').length,
      income:el('income')?.querySelector('.movement-variation')?.textContent.trim(),
      expense:el('expense')?.querySelector('.movement-variation')?.textContent.trim(),
      net:el('net')?.querySelector('.movement-variation')?.textContent.trim(),
      count:el('count')?.querySelector('.movement-variation')?.textContent.trim(),
      sparkline:!!root.querySelector('.movement-net-sparkline path[stroke]'),
      iconos:root.querySelectorAll('tbody .movement-row-icon svg').length,
      visibleRows:root.querySelectorAll('tbody tr[data-movement-type]').length,
      more:!!more,
      moreBottom:more?.getBoundingClientRect().bottom||0,
      documentHeight:document.scrollingElement.scrollHeight,
      pageHeight:window.innerHeight,
      bodyWidth:document.scrollingElement.scrollWidth,
      windowWidth:window.innerWidth,
      mainBottom:main?.getBoundingClientRect().bottom};
    });
    console.log(width+'x'+height,JSON.stringify(k));
    assert.equal(k.metrics,5,'Cinco KPI');
    assert.match(k.income||'',/20\.0%/,'Ingreso +20%');
    assert.match(k.expense||'',/20\.0%/,'Egreso -20%');
    assert.match(k.net||'',/37\.1%/,'Neto comparado incluso si tiene signo distinto');
    assert.match(k.count||'',/600\.0%/,'Cantidad comparada');
    assert.ok(k.sparkline,'Gráfico del balance');
    assert.equal(k.iconos,k.visibleRows,'Un pictograma por cada movimiento visible');
    assert.ok(k.documentHeight<=height+3,'El documento completo cabe sin scroll inicial');
    assert.ok(k.more,'Acceso a más movimientos');
    assert.ok(k.moreBottom<=height+3,'Botón Ver más visible sin desplazar la pantalla');
    assert.ok(k.bodyWidth<=width+3,'Sin desbordamiento horizontal');
    assert.deepEqual(errors,[],'Sin errores JS');
    await p.screenshot({path:path.join(dir,'movimientos-'+width+'x'+height+'.png'),animations:'disabled'});
    const before=await p.locator('#ledger-world.movement-desktop tbody>tr').count();
    await p.locator('.v51-desk-more').click();
    await p.waitForTimeout(200);
    const after=await p.locator('#ledger-world.movement-desktop tbody>tr').count();
    assert.ok(after>before,'Ver más conserva su acción');
    if(width===1440)await verifyFilters(p);
   }finally{await ctx.close()}
  }
  console.log('OK Movimientos PC: proporciones y variaciones');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
