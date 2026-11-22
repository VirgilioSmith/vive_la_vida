// Ejecuta el código contable real de app.js sin navegador ni datos remotos.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../../src/app.js'),'utf8');
const between=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)+a.length));
const code=[between('function adjustmentCard(value)','function legacyTransactionForm'),between('function validReferences(v,type)','function saveTx'),between('function saveTx(v,editId','function nextRecurringDate'),between('function v102CardStatusRaw','const monthStats'),between('function v12CardHistorical','function v14HistoricalAvailable')].join('\n');
const test=new Function(code+`
 const c={id:'c',opened:'2026-01-01',openingDOP:1000,openingUSD:100,limitDOP:2000,limitUSD:500,cutDay:12,dueDay:30};
 const a={id:'a',currency:'DOP'};
 const db={cards:[c],accounts:[a],transactions:[],statements:[],settings:{fx:60}};
 const card=id=>db.cards.find(c=>c.id===id),account=id=>db.accounts.find(a=>a.id===id),num=x=>Number(x)||0,rnd=x=>Math.round(Number(x)*100)/100,today=()=> '2026-11-21',isHidden=x=>x.archived;
 const v115CardTransactions=(id,ccy)=>db.transactions.filter(t=>t.cardId===id&&t.currency===ccy),lastCut=()=> '2026-11-12',nextCut=()=> '2026-12-12',cutFor=(date)=>date<='2026-11-12'?'2026-11-12':'2026-12-12',cardDue=()=> '2026-12-30',personalLoan=()=>null,v169CardCycleLedger=()=>({}),lastCutAt=lastCut,addDays=x=>x;
 const cardStatus=v102CardStatusRaw,uuid=()=>String(db.transactions.length+1),normalizePaymentChannel=()=>'',SERVICE_PRESETS={},MAX_MONEY=1e9,document={getElementById:()=>null},persist=()=>true,closeModal=()=>{},render=()=>{},toast=()=>{},setTimeout=()=>{},v99Invalidate=()=>{};
 const adjust=(currency,amount)=>saveTx({type:'adjustment',accountId:'card:c',currency,amount,date:today(),note:'Diferencia de saldo'});
 const periodStart=()=> '2026-11-01',periodEnd=()=> '2026-11-30',getAccountBalance=()=>1000,fx=(x,ccy)=>x*(ccy==='USD'?60:1);
 const before=v102MonthlyTotalsRaw(2026,11),t1=adjust('DOP',250),t2=adjust('USD',-25),after=v102MonthlyTotalsRaw(2026,11);
 return {t1,t2,before,after,dop:cardStatus(c,'DOP').debt,usd:cardStatus(c,'USD').debt,hist:v12CardHistorical(c,'USD',today()),invalid:()=>adjust('XYZ',20),account:()=>saveTx({type:'adjustment',accountId:'a',currency:'USD',amount:-5,date:today(),note:'Diferencia de saldo'})};
`);
const result=test();
assert.equal(result.dop,1250);assert.equal(result.usd,75);assert.equal(result.hist,75);
assert.deepEqual(result.before,result.after);
assert.equal(result.t1.accountId,'');assert.equal(result.t1.cardId,'c');assert.equal(result.t1.type,'adjustment');assert.equal(result.t2.amount,-25);
assert.throws(result.invalid,/moneda habilitada/);
const bank=result.account();assert.equal(bank.accountId,'a');assert.equal(bank.cardId,'');assert.equal(bank.currency,'DOP');
console.log('OK: ajustes reales de tarjeta RD$/US$, referencias, saldo actual e histórico, cuenta bancaria y validación de moneda');
