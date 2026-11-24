'use strict';
/* Movimientos: los costos de préstamos (intereses, seguros, comisiones) son localizables en la búsqueda universal (acentos, plurales y
   sinónimos), no se devuelven operaciones que no coinciden, y el mismo desglose alimenta Egresos sin duplicar el capital. Datos de prueba aislados. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');const open=require('./harness');
(async()=>{
 const b=await chromium.launch();delete process.env.TOUCH;process.env.THEME='light';
 for(const [w,touch] of [[1440,0],[390,1]]){
  if(touch)process.env.TOUCH='1';else delete process.env.TOUCH;
  const {ctx,p}=await open(b,w,900);const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const base=await p.evaluate(()=>{const t=window.__T,F=t.fn,d=t.dbg(),month=F.today().slice(0,7),acc=d.accounts.find(a=>a.currency==='DOP')||d.accounts[0],loan=d.loans[0];
   const before=F.vExpMonth(month).by['Deudas e intereses']||0;
   d.transactions=[{id:'lp1',type:'loan_payment',date:month+'-10',amount:11650,currency:'DOP',accountId:acc.id,loanId:loan.id,interest:1200,insurance:300,fee:150,note:'Cuota mensual',created:month+'-10T10:00:00Z'},
    {id:'lp2',type:'loan_payment',date:month+'-11',amount:5000,currency:'DOP',accountId:acc.id,loanId:loan.id,note:'Abono a capital',created:month+'-11T10:00:00Z'},
    {id:'ex1',type:'expense',date:month+'-12',amount:3000,currency:'DOP',accountId:acc.id,category:'Alimentación',subcategory:'Supermercado',created:month+'-12T10:00:00Z'}];
   t.ui().month=month;t.ui().expenseRange='month';t.inv();
   const after=F.vExpMonth(month);return {before,costo:(after.by['Deudas e intereses']||0),ledger:JSON.stringify(d.transactions)}});
  // contabilidad: solo intereses + seguro + comisión (1,650) son gasto; el capital no se duplica
  assert.equal(Math.round(base.costo-base.before),1650,'intereses+seguros+comisiones = 1,650 como gasto (capital fuera)');
  await p.evaluate(()=>window.__T.go('register'));await p.waitForSelector('#searchTx,#v708-search-input');
  const SEL=w>800?'#searchTx':'#v708-search-input';const find=async q=>{await p.fill(SEL,q);await p.waitForTimeout(400);return p.evaluate(()=>document.querySelector('#page').innerText)};
  const hit=async(q,txt)=>{const t=await find(q);return new RegExp(txt,'i').test(t)};
  for(const q of ['Costo de préstamos','Costos de préstamos','Préstamo','Interés','Intereses','Comisión','Comisiones','Seguro de préstamo','seguros'])assert.ok(await hit(q,'11,650|Cuota mensual'),`[${w}] «${q}» encuentra la cuota con costos`);
  // sin coincidencia real no se inventan resultados; la cuota sin desglose no es un «interés»
  await p.fill(w>800?'#searchTx':'#v708-search-input','interés');await p.waitForTimeout(350);
  const txt=await p.evaluate(()=>document.querySelector('#page').innerText||'');
  assert.ok(!/Supermercado|Abono a capital|5,000\.00|3,000\.00/i.test(txt),`[${w}] «interés» no devuelve operaciones sin ese costo`);
  await p.fill(w>800?'#searchTx':'#v708-search-input','zzzzqq');await p.waitForTimeout(300);
  assert.ok(!/11,650|Cuota mensual|Supermercado/.test(await p.evaluate(()=>document.querySelector('#page').innerText||'')),`[${w}] sin coincidencias → vacío`);
  assert.equal(await p.evaluate(()=>JSON.stringify(window.__T.dbg().transactions)),base.ledger,'la búsqueda no modifica el libro');
  assert.deepEqual(errs,[],'consola');
  await ctx.close();
 }
 await b.close();console.log('movimientos-costos-prestamo: OK');
})().catch(e=>{console.error(e);process.exit(1)});
