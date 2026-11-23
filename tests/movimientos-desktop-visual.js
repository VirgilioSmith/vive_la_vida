/* V864: Movimientos PC — porcentajes reales, iconografía y primera pantalla visible. */
'use strict';
process.env.FREEZE='2026-11-23T15:00:00Z';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const open=require('./harness');
(async()=>{
 const browser=await chromium.launch();
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
     T.inv();T.go('register');
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
    assert.equal(k.metrics,4,'Cuatro KPI');
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
   }finally{await ctx.close()}
  }
  console.log('OK Movimientos PC: proporciones y variaciones');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
