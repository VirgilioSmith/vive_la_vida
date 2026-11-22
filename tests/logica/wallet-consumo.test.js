'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../src/app.js'),'utf8');
const code=source.slice(source.indexOf('function v1301WalletConsumption('),source.indexOf('function v1301WalletRanked('));
const calculate=new Function('db','cards',`
 const today=()=> '2026-11-22',num=x=>Number(x)||0;
 const dateObj=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
 const dateStr=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 const v99Memo=(_key,fn)=>fn();
 ${code}
 return v1301WalletConsumption(cards);
`);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const a={id:'a'},b={id:'b'},cards=[a,b];
const tx=(id,type,cardId,currency,amount,date='2026-11-22',extra={})=>({id,type,cardId,currency,amount,date,...extra});

test('consumo neto: compras históricas, suscripciones, cuotas registradas, Apple Pay, reembolsos y exclusiones',()=>{
 const old=tx('old','card_charge','a','DOP',150.25,'1999-01-15',{chargeKind:'purchase'});
 const apple=tx('apple','card_charge','a','USD',10.11,'2026-11-03',{applePayEventId:'e1',fxRateSnapshot:58.75});
 const fee=tx('fee','card_charge','a','DOP',40,'2026-11-01',{chargeKind:'annual_fee'});
 const db={settings:{fx:60},transactions:[old,{...old},apple,{...apple,id:'apple-copy'},fee,
  tx('sub','card_charge','a','DOP',25.10,'2026-11-02',{recurringId:'r'}),
  tx('quota1','card_charge','b','DOP',50.05,'2026-10-05'),tx('quota2','card_charge','b','DOP',50.05,'2026-11-05'),
  tx('refund','card_refund','a','DOP',50.25,'2026-11-05',{originalPurchaseId:'old'}),
  tx('fee-refund','card_refund','a','DOP',40,'2026-11-05',{originalPurchaseId:'fee'}),
  tx('legacy-refund','card_refund','b','USD',2.01,'2026-11-05',{fxRateSnapshot:62.1}),
  tx('paid','card_payment','a','DOP',100),tx('reward','card_reward','a','DOP',99),tx('transfer','transfer','a','DOP',100),
  tx('adjustment','adjustment','a','DOP',100),tx('advance','card_advance','a','DOP',100),
  tx('insurance','card_charge','a','DOP',100,'2026-11-01',{chargeKind:'insurance'}),
  tx('renewal','card_charge','a','DOP',100,'2026-11-01',{chargeKind:'renewal'}),
  tx('fee-legacy','card_charge','a','DOP',100,'2026-11-01',{category:'Deudas e intereses',subcategory:'Comisión'}),
  tx('future','card_charge','a','DOP',999,'2026-11-23')]};
 const before=JSON.stringify(db),result=calculate(db,cards),first=calculate(db,[a]),second=calculate(db,[b]);
 near(first.totals.DOP,125.1);near(first.totals.USD,10.11);
 near(second.totals.DOP,100.1);near(second.totals.USD,-2.01);
 near(result.totals.DOP,225.2);near(result.totals.USD,8.1);
 near(result.totals.equivalent,225.2+10.11*58.75-2.01*62.1);
 for(const k of ['DOP','USD','equivalent'])near(result.totals[k],first.totals[k]+second.totals[k]);
 near(result.months.get('1999-01').DOP,150.25);
 near(result.months.get('2026-10').DOP,50.05);
 near(result.months.get('2026-11').DOP,24.9);
 near(result.months.get('2026-11').USD,8.1);
 assert.equal(result.months.has('2026-09'),false);
 assert.equal(JSON.stringify(db),before);
});

test('tasa de registro, fallback explícito y ausencia de tasa sin inventar equivalencias',()=>{
 const db={settings:{fx:60},transactions:[tx('legacy','card_charge','a','USD',1.01),tx('historic','card_charge','b','USD',2.03,'2001-02-03',{fxRateSnapshot:50.05})]};
 const result=calculate(db,cards);near(result.totals.equivalent,1.01*60+2.03*50.05);assert.equal(result.totals.missingFx,false);
 db.settings.fx=0;const missing=calculate(db,cards);assert.equal(missing.totals.missingFx,true);near(missing.totals.USD,3.04);
 assert.equal(missing.byCard.get('a').missingFx,true);assert.equal(missing.byCard.get('b').missingFx,false);
});
