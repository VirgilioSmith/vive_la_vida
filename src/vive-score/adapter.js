/* VIVE SCORE · adaptador de LECTURA. Convierte los datos existentes de vive el hoy en una «carga» (payload)
   para el motor. No escribe en la base, no modifica tarjetas, préstamos, movimientos ni ingresos.
   Solo crédito: tarjetas, préstamos y su historial de pagos. Los ingresos y los gastos fijos se entregan
   únicamente para el módulo de capacidad de endeudamiento. El score NO usa cuentas ni saldos; para la capacidad se entrega solo un agregado de liquidez (dinero que se mantiene ≥30 días). */
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
 // Entidades NO financieras (telefonía, comercios, etc.): sus adelantos y financiamientos no se reportan a los burós, así que no puntúan.
 const reported=x=>{const bk=x?.bankId?b.bank(x.bankId):null;return !bk||b.isFinancial(bk)!==false};
 let overdue=[];try{overdue=(b.upcoming()||[]).filter(u=>u&&u.date<today&&(u.kind==='card'||u.kind==='loan'))}catch(_){}
 const dpd=(kind,ref)=>{const d=overdue.filter(u=>u.kind===kind&&String(u.ref)===String(ref)).map(u=>u.date).sort()[0];return d?Math.max(0,daysBetween(d,today)):0};
 const since90=addDays(today,-90);
 const cards=[],unrated=[];
 for(const c of db.cards||[]){
  if(!c||hidden(c)||isDebit(c)||!reported(c))continue;   // entidad no financiera: no entra para nada
  const before=cards.length;
  for(const ccy of ['DOP','USD']){
   const limit=num(ccy==='USD'?c.limitUSD:c.limitDOP);let st;try{st=b.cardStatus(c,ccy)}catch(_){continue}
   const debt=Math.max(0,num(st.debt));if(!(limit>0)&&!(debt>0))continue;
   const adv=(db.transactions||[]).filter(t=>t.type==='card_advance'&&t.cardId===c.id&&(t.currency||'DOP')===ccy&&t.date>=since90&&t.date<=today).reduce((a,t)=>a+num(t.amount),0);
   cards.push({id:c.id+'-'+ccy,productId:c.id,name:(c.name||'Tarjeta')+((c.limitDOP>0&&c.limitUSD>0)?' · '+ccy:''),bank:b.bank(c.bankId)?.name||'',network:c.network||'',currency:ccy,limit,balance:debt,
    min:Math.max(0,num(st.minimum)),statementBalance:Math.max(0,num(st.billed)||debt),advance:Math.min(debt,adv),daysPastDue:dpd('card',c.id),
    status:'active',reported:reported(c),opened:ym(b.acquiredOnOf(c,'card')),apr:num(ccy==='USD'?c.aprUSD:c.aprDOP),reportedAt:today});
  }
  // Tarjeta sin límite ni saldo todavía: no puede puntuar utilización, pero SÍ cuenta como apertura y como antigüedad.
  if(cards.length===before)unrated.push({kind:'card',id:c.id,productId:c.id,name:c.name||'Tarjeta',bank:b.bank(c.bankId)?.name||'',opened:ym(b.acquiredOnOf(c,'card')),reason:'sin límite ni saldo'});
 }
 const loans=[];
 for(const l of db.loans||[]){
  if(!l||hidden(l)||!reported(l))continue;let ls,orig;try{ls=b.loanStatus(l);orig=b.fullOriginalLoan(l)||{}}catch(_){continue}
  const closed=!!ls.settled||num(ls.balance)<=0.005;
  loans.push({id:String(l.id),productId:l.id,name:l.name||'Préstamo',bank:b.bank(l.bankId)?.name||'',currency:l.currency||'DOP',
   type:/hipotec|vivienda|inmueble|mortgage/i.test([l.kind,l.type,l.loanType,l.name].join(' '))?'hipotecario':'personal',
   original:Math.max(num(orig.principal||orig.amount||l.amount||l.principal),num(ls.balance)),balance:Math.max(0,num(ls.balance)),due:Math.max(0,num(ls.installment)),
   apr:num(l.rate),variable:l.rateType==='variable'||l.variableRate===true,opened:ym(b.acquiredOnOf(l,'loan')),daysPastDue:dpd('loan',l.id),status:closed?'closed':'active',reported:reported(l)});
 }
 // Ingresos recurrentes: SOLO para capacidad de endeudamiento. Todo en base MENSUAL y en RD$:
 // la nómina de la app devuelve el monto POR PAGO (quincenal = mitad del mes), por eso se multiplica por los pagos al mes.
 const EXTRA_FORMAL=new Set(['salary','commission','incentive','bonus','overtime','retroactive']);   // se reportan en nómina
 const since=(()=>{const [y,m]=today.slice(0,7).split('-').map(Number),d=new Date(Date.UTC(y,m-1-5,1));return d.toISOString().slice(0,7)})();
 const incomes=[];
 for(const s of db.incomeSchedules||[]){
  if(!s||s.active===false)continue;
  const k=b.monthlyFactor(s.frequency)||1;let pr=null;try{pr=b.payroll(s,s.nextDue||today)}catch(_){}
  const dop=v=>b.xconvert(num(v)*k,s.currency||'DOP','DOP');
  const gross=pr?dop(pr.gross):b.xconvert(num(s.grossMonthly),s.currency||'DOP','DOP'),net=pr?dop(pr.net):gross;
  const months=new Set((db.transactions||[]).filter(t=>String(t.scheduleKey||'').startsWith('income:'+s.id+':')).map(t=>ym(t.date)));
  // Ingresos laborales adicionales (bonos, comisiones, horas extra…): últimos 6 meses cerrados o en curso.
  const extra=(db.transactions||[]).filter(t=>t.type==='income'&&t.laborExtra===true&&String(t.incomeScheduleId)===String(s.id)&&ym(t.date)>=since&&t.date<=today&&(s.kind!=='formal'||EXTRA_FORMAL.has(t.laborExtraKind||'salary')));
  const extraMonths=new Set(extra.map(t=>ym(t.date))),extraTotal=extra.reduce((a,t)=>a+b.xconvert(num(t.amount),t.currency||'DOP','DOP'),0);
  incomes.push({id:String(s.id),name:s.name||'Ingreso',kind:s.kind==='formal'?'formal':'informal',frequency:s.frequency||'monthly',gross,afp:pr?dop(pr.afp):0,sfs:pr?dop(pr.sfs):0,isr:pr?dop(pr.isr):0,other:pr?dop(pr.other):0,net,
   recurrenceMonths:months.size,verified:months.size>0,extra:{total6:extraTotal,months:extraMonths.size,count:extra.length}});
 }
 // Gastos fijos recurrentes: SOLO para capacidad. onCard evita duplicarlos con el pago de tarjeta.
 const fixed=[];
 for(const r of b.activeRecurring()||[]){
  let amount=0;try{amount=num(b.monthlyEquivalent(r.amount,r.currency,r.frequency))}catch(_){amount=num(r.amount)}
  fixed.push({id:String(r.id),name:r.name||'Pago recurrente',kind:'subscription',amount,onCard:String(r.source||'').startsWith('card:')});
 }
 // Destino del dinero (SOLO capacidad): en qué se va el dinero en efectivo y por transferencia/débito, promedio de los últimos 3 meses cerrados.
 // No usa saldos ni ahorros: solo los gastos registrados. Se evitan malas lecturas: pagos de tarjeta y préstamo ya son cuotas,
 // las compras con tarjeta se reflejan en su pago, las transferencias entre cuentas propias no son gasto y lo recurrente ya está en gastos fijos.
 const ESSENTIAL=new Set(['Alimentación','Vivienda','Servicios básicos','Transporte','Salud','Educación','Familia e hijos','Seguros','Impuestos y comisiones']);
 const monthsBack=(n)=>{const [y,m]=today.slice(0,7).split('-').map(Number);const out=[];for(let i=1;i<=n;i++){const d=new Date(Date.UTC(y,m-1-i,1));out.push(d.toISOString().slice(0,7))}return out};
 const spendTypes=new Set(['expense','card_charge']);
 let win=monthsBack(3);
 /* Si ninguno de los últimos 3 meses cerrados tiene gastos (p. ej. la app se empezó a usar este mes), se usa el mes en curso hasta hoy. */
 if(!(db.transactions||[]).some(t=>t&&!t.deleted&&spendTypes.has(t.type)&&win.includes(ym(t.date))))win=[today.slice(0,7)];
 const inWin=t=>win.includes(ym(t.date));
 const isCashAcc=a=>!!a&&(a.kind==='cash'||/efectivo/i.test(String(a.name||'')));
 const cardCat={},cat={},used=new Set(),excl={cardCharges:0,cardPayments:0,loanPayments:0,transfers:0,recurring:0,debtInterest:0};
 for(const t of db.transactions||[]){
  if(!t||t.deleted||!inWin(t))continue;const amt=b.xconvert(num(t.amount),t.currency||'DOP','DOP');
  if(t.type==='card_charge'){
   if(t.recurringId||String(t.scheduleKey||'').startsWith('recurring:')||t.category==='Suscripciones'){excl.recurring+=amt;continue}
   if(t.category==='Deudas e intereses'){excl.debtInterest+=amt;continue}
   const c=t.category||'Otros gastos',row=cardCat[c]||(cardCat[c]={category:c,kind:ESSENTIAL.has(c)?'essential':'variable',total:0,n:0});row.total+=amt;row.n++;used.add(ym(t.date));continue}
  if(t.type==='card_payment'){excl.cardPayments+=amt;continue}
  if(t.type==='loan_payment'){excl.loanPayments+=amt;continue}
  if(t.type==='transfer'){excl.transfers+=amt;continue}
  if(t.type!=='expense')continue;
  if(t.recurringId||String(t.scheduleKey||'').startsWith('recurring:')||t.category==='Suscripciones'){excl.recurring+=amt;continue}
  if(t.category==='Deudas e intereses'){excl.debtInterest+=amt;continue}
  const c=t.category||'Otros gastos',row=cat[c]||(cat[c]={category:c,kind:ESSENTIAL.has(c)?'essential':'variable',cash:0,bank:0,n:0});
  if(isCashAcc(b.account?b.account(t.accountId):null))row.cash+=amt;else row.bank+=amt;row.n++;used.add(ym(t.date));
 }
 const k=Math.max(1,used.size),rows=Object.values(cat).map(r=>({category:r.category,kind:r.kind,cash:r.cash/k,bank:r.bank/k,total:(r.cash+r.bank)/k,count:r.n})).sort((a,c)=>c.total-a.total);
 const cardRows=Object.values(cardCat).map(r=>({category:r.category,kind:r.kind,total:r.total/k,count:r.n})).sort((a,c)=>c.total-a.total);
 const sum=(f)=>rows.filter(f).reduce((a,r)=>a+r.total,0);
 const spending={months:win,monthsUsed:used.size,categories:rows,essentialMonthly:sum(r=>r.kind==='essential'),variableMonthly:sum(r=>r.kind!=='essential'),cardCategories:cardRows,cardMonthly:cardRows.reduce((a,r)=>a+r.total,0),cashMonthly:rows.reduce((a,r)=>a+r.cash,0),bankMonthly:rows.reduce((a,r)=>a+r.bank,0),excluded:Object.fromEntries(Object.entries(excl).map(([n,v])=>[n,v/k]))};
 /* Liquidez estable (solo capacidad): lo que se ha mantenido en cuentas y efectivo durante los últimos 30 días = el saldo más bajo de ese periodo
    en cada cuenta (si lo sacaste o lo gastaste, deja de contar). Se convierte a pesos con el tipo de cambio de la app. */
 let liquidity=null;
 try{if(b.balanceAt){let held=0,now=0,n=0;const days=[0,3,6,9,12,15,18,21,24,27,30].map(k=>addDays(today,-k));
  for(const a of db.accounts||[]){if(!a||hidden(a))continue;const f=(a.currency==='USD'?(fx>0?fx:60):1);let low=Infinity,cur=0;
   for(const d of days){if(a.opened&&a.opened>d)continue;const v=num(b.balanceAt(a,d))*f;if(d===today)cur=v;low=Math.min(low,v)}
   if(!Number.isFinite(low))continue;held+=Math.max(0,low);now+=Math.max(0,cur);n++}
  liquidity={held30:Math.round(held),now:Math.round(now),accounts:n,days:30}}}catch(_){liquidity=null}
 /* Posibles movimientos duplicados en tarjetas (mismo producto, fecha, importe y descripción) en los últimos 90 días. Solo se avisa: nunca se corrige ni se omite un movimiento. */
 const dupMap=new Map();
 for(const t of db.transactions||[]){if(!t||t.deleted||!t.cardId||!(t.type==='card_charge'||t.type==='card_payment')||t.date<since90||t.date>today)continue;
  const k=[t.type,t.cardId,t.date,num(t.amount),String(t.merchant||t.note||'').trim().toLowerCase()].join('|');dupMap.set(k,(dupMap.get(k)||0)+1)}
 const duplicates=[...dupMap.entries()].filter(([,n])=>n>1).slice(0,10).map(([k,n])=>{const [type,card,date,amount]=k.split('|');return {type,cardId:card,date,amount:Number(amount),count:n}});
 return {version:1,today,fx:fx>0?fx:60,cards,loans,unrated,incomes,fixed,spending,liquidity,duplicates};
}
window.ViveScoreAdapter=Object.freeze({read});
})();
