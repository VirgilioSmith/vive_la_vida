'use strict';
/* Deducciones de nómina: ISR/ARS = gasto; AFP = ahorro previsional (no gasto); préstamo de nómina = intereses/cargos gasto +
   capital reducción de deuda (no gasto). Sin tocar saldos ni movimientos. Cubre los 8 escenarios del requerimiento. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const open=require('./harness');
(async()=>{
 const b=await chromium.launch();delete process.env.TOUCH;process.env.THEME='light';
 const {ctx,p}=await open(b,1440,900);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.evaluate(()=>window.__T.go('overview'));
 const R=await p.evaluate(()=>{
  const t=window.__T,F=t.fn,d=t.dbg(),month=F.today().slice(0,7),prev=F.plusMonths(month+'-01',-1).slice(0,7),acc=d.accounts.find(a=>a.currency==='DOP')||d.accounts[0];
  const out={};const tx=()=>d.transactions;
  d.incomeSchedules=[{id:'s1',name:'Nómina',kind:'formal',currency:'DOP',frequency:'monthly',companyDeductions:[]}];
  const mk=(id,date,snap)=>{const ded=snap.afp+snap.sfs+snap.isr+(snap.generalOther||0)+snap.companyItems.reduce((a,c)=>a+c.amount,0);return {id,type:'income',date,amount:snap.gross-ded,currency:'DOP',accountId:acc.id,category:'Salario y nómina',incomeScheduleId:'s1',payrollSnapshot:snap,created:date+'T10:00:00Z'}};
  const snap=(o={})=>({gross:50000,afp:1512,sfs:1677,isr:1079,other:0,generalOther:0,companyItems:[],...o});
  const run=()=>{t.inv();F.v45PayrollHistoricalRows;const m=F.vExpMonth(month);return {total:m.total,pay:m.pay,prev:m.prev,cap:m.cap,by:{...m.by},flowInc:F.vFlowIncomeMonth(month),inc:F.monthlyTotals(+month.slice(0,4),+month.slice(5,7)).income}};
  t.ui().month=month;
  // 1 · ISR + ARS (sin AFP ni préstamo): gasto = 1,079 + 1,677
  d.transactions=[mk('p1',month+'-05',snap({afp:0}))];out.s1=run();
  const ledger0=JSON.stringify(d.transactions),bal0=F.getAccountBalance(acc);
  // 2 · AFP: ahorro previsional, fuera del gasto
  d.transactions=[mk('p1',month+'-05',snap())];out.s2=run();
  // 3 · préstamo de nómina sin desglose: el total cuenta como gasto en Deudas e intereses (conservador, marcado sin desglosar)
  d.transactions=[mk('p1',month+'-05',snap({companyItems:[{name:'Préstamo nómina',amount:1079}]}))];out.s3=run();
  // 4 · préstamo con intereses/cargos 179 y capital 900
  d.transactions=[mk('p1',month+'-05',snap({companyItems:[{name:'Préstamo nómina',amount:1079,interest:179}]}))];out.s4=run();
  // 5 · deducciones registradas antes no cambian al editar la programación
  d.incomeSchedules[0].companyDeductions=[{name:'Cooperativa',amount:9999}];out.s5=run();
  // 6 · cambio de salario: mes anterior con otro bruto, mantiene su propio comprobante
  d.transactions=[mk('p0',prev+'-05',snap({gross:40000,isr:500,sfs:1000,afp:1200})),mk('p1',month+'-05',snap())];t.inv();
  out.s6={prev:F.vExpMonth(prev).total,cur:F.vExpMonth(month).total,prevAfp:F.vExpMonth(prev).prev};
  // 7 · editar y borrar nómina: se recalcula solo
  d.transactions[1].payrollSnapshot.isr=2000;d.transactions[1].amount-=921;out.s7a=run();
  d.transactions=d.transactions.filter(x=>x.id!=='p1');out.s7b=run();
  // 8 · Mes / Año / Histórico: suma de meses
  d.transactions=[mk('p0',prev+'-05',snap({gross:40000,isr:500,sfs:1000,afp:1200})),mk('p1',month+'-05',snap())];t.inv();
  out.s8={sum:F.vExpMonth(prev).total+F.vExpMonth(month).total};
  // integridad: bruto − deducciones = neto = depósito
  const x=d.transactions[1],ps=x.payrollSnapshot,ded=ps.afp+ps.sfs+ps.isr+ps.generalOther+ps.companyItems.reduce((a,c)=>a+c.amount,0);
  out.integ={net:ps.gross-ded,deposit:x.amount};
  d.transactions=[mk('p1',month+'-05',snap({afp:0}))];out.same={led:JSON.stringify(d.transactions)===ledger0,bal:F.getAccountBalance(acc)===bal0};
  return out;
 });
 const eq=(a,b,m)=>assert.equal(Math.round(a*100)/100,b,m);
 eq(R.s1.total,2756,'1 · ISR 1,079 + ARS 1,677 = gasto 2,756');eq(R.s1.pay,2756,'1 · retenciones gasto = 2,756');eq(R.s1.flowInc,R.s1.inc+2756,'1 · ingreso de Flujo = neto + retenciones gasto');
 eq(R.s2.total,2756,'2 · AFP no suma a gastos');eq(R.s2.prev,1512,'2 · AFP = ahorro previsional 1,512');
 eq(R.s3.total,2756+1079,'3 · préstamo sin desglose = gasto completo (conservador)');eq(R.s3.by['Deudas e intereses'],1079,'3 · en Deudas e intereses');
 eq(R.s4.total,2756+179,'4 · solo intereses y cargos 179 son gasto');eq(R.s4.cap,900,'4 · capital 900 reduce deuda, no gasto');
 eq(R.s5.total,R.s4.total,'5 · editar la programación no cambia comprobantes ya registrados');
 eq(R.s6.prev,1500,'6 · mes previo con su propio salario: 500 + 1,000');eq(R.s6.cur,2756,'6 · mes actual intacto');eq(R.s6.prevAfp,1200,'6 · AFP previa 1,200');
 eq(R.s7a.total,2000+1677,'7 · editar ISR recalcula');eq(R.s7b.total,0,'7 · borrar nómina elimina todas sus deducciones');
 eq(R.s8.sum,1500+2756,'8 · Mes + Mes = Año/Histórico acumulado');
 assert.equal(R.integ.net,R.integ.deposit,'bruto − deducciones = neto = depósito');
 assert.ok(R.same.led&&R.same.bal,'sin cambios en movimientos ni saldos');
 assert.deepEqual(errors,[],'sin errores de consola');
 await ctx.close();await b.close();console.log('nomina-deducciones: OK (8 escenarios + integridad)');
})().catch(e=>{console.error(e);process.exit(1)});
