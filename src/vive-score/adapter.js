/* VIVE SCORE · adaptador de LECTURA. Convierte los datos existentes de vive el hoy en una «carga» (payload)
   para el motor. No escribe en la base, no modifica tarjetas, préstamos, movimientos ni ingresos.
   Solo crédito: tarjetas, préstamos y su historial de pagos. Los ingresos y los gastos fijos se entregan
   únicamente para el módulo de capacidad de endeudamiento. NO se leen cuentas de ahorro ni saldos. */
(function(){
'use strict';
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const ym=v=>/^\d{4}-\d{2}/.test(String(v||''))?String(v).slice(0,7):'';
const daysBetween=(a,b)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);
const isDebit=c=>/debit|debito/.test(String([c.type,c.cardType,c.kind].join(' ')).toLowerCase());
const addDays=(d,n)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};

function read(){
 const b=window.__viveScoreBridge;if(!b)return null;
 const db=b.db(),today=b.today(),fx=num(db.settings?.fx)||0;
 const hidden=x=>!!(x?.archived||(x?.bankId&&b.bank(x.bankId)?.archived));
 let overdue=[];try{overdue=(b.upcoming()||[]).filter(u=>u&&u.date<today&&(u.kind==='card'||u.kind==='loan'))}catch(_){}
 const dpd=(kind,ref)=>{const d=overdue.filter(u=>u.kind===kind&&String(u.ref)===String(ref)).map(u=>u.date).sort()[0];return d?Math.max(0,daysBetween(d,today)):0};
 const since90=addDays(today,-90);
 const cards=[];
 for(const c of db.cards||[]){
  if(!c||hidden(c)||isDebit(c))continue;
  for(const ccy of ['DOP','USD']){
   const limit=num(ccy==='USD'?c.limitUSD:c.limitDOP);let st;try{st=b.cardStatus(c,ccy)}catch(_){continue}
   const debt=Math.max(0,num(st.debt));if(!(limit>0)&&!(debt>0))continue;
   const adv=(db.transactions||[]).filter(t=>t.type==='card_advance'&&t.cardId===c.id&&(t.currency||'DOP')===ccy&&t.date>=since90&&t.date<=today).reduce((a,t)=>a+num(t.amount),0);
   cards.push({id:c.id+'-'+ccy,productId:c.id,name:(c.name||'Tarjeta')+((c.limitDOP>0&&c.limitUSD>0)?' · '+ccy:''),bank:b.bank(c.bankId)?.name||'',network:c.network||'',currency:ccy,limit,balance:debt,
    min:Math.max(0,num(st.minimum)),statementBalance:Math.max(0,num(st.billed)||debt),advance:Math.min(debt,adv),daysPastDue:dpd('card',c.id),
    status:'active',opened:ym(b.acquiredOnOf(c,'card')),apr:num(ccy==='USD'?c.aprUSD:c.aprDOP),reportedAt:today});
  }
 }
 const loans=[];
 for(const l of db.loans||[]){
  if(!l||hidden(l))continue;let ls,orig;try{ls=b.loanStatus(l);orig=b.fullOriginalLoan(l)||{}}catch(_){continue}
  const closed=!!ls.settled||num(ls.balance)<=0.005;
  loans.push({id:String(l.id),productId:l.id,name:l.name||'Préstamo',bank:b.bank(l.bankId)?.name||'',currency:l.currency||'DOP',
   type:/hipotec|vivienda|inmueble|mortgage/i.test([l.kind,l.type,l.loanType,l.name].join(' '))?'hipotecario':'personal',
   original:Math.max(num(orig.principal||orig.amount||l.amount||l.principal),num(ls.balance)),balance:Math.max(0,num(ls.balance)),due:Math.max(0,num(ls.installment)),
   apr:num(l.rate),variable:l.rateType==='variable'||l.variableRate===true,opened:ym(b.acquiredOnOf(l,'loan')),daysPastDue:dpd('loan',l.id),status:closed?'closed':'active'});
 }
 // Ingresos recurrentes: SOLO para capacidad de endeudamiento.
 const incomes=[];
 for(const s of db.incomeSchedules||[]){
  if(!s||s.active===false)continue;let net=0;try{net=num(b.payroll(s,s.nextDue||today).net)}catch(_){net=num(s.netMonthly||s.grossMonthly)}
  const months=new Set((db.transactions||[]).filter(t=>String(t.scheduleKey||'').startsWith('income:'+s.id+':')).map(t=>ym(t.date)));
  incomes.push({id:String(s.id),name:s.name||'Ingreso',kind:s.kind==='formal'?'formal':'informal',net:b.xconvert(net,s.currency||'DOP','DOP'),recurrenceMonths:months.size,verified:months.size>0});
 }
 // Gastos fijos recurrentes: SOLO para capacidad. onCard evita duplicarlos con el pago de tarjeta.
 const fixed=[];
 for(const r of b.activeRecurring()||[]){
  let amount=0;try{amount=num(b.monthlyEquivalent(r.amount,r.currency,r.frequency))}catch(_){amount=num(r.amount)}
  fixed.push({id:String(r.id),name:r.name||'Pago recurrente',kind:'subscription',amount,onCard:String(r.source||'').startsWith('card:')});
 }
 return {version:1,today,fx:fx>0?fx:60,cards,loans,incomes,fixed};
}
window.ViveScoreAdapter=Object.freeze({read});
})();
