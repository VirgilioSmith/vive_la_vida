const { chromium } = require('playwright');const open=require('/home/user/vive_la_vida/tests/harness.js');
(async()=>{const b=await chromium.launch();process.env.TOUCH='';const {p}=await open(b,1440,900);
await p.evaluate(()=>window.__T.go('score'));await new Promise(r=>setTimeout(r,2000));
const fr=p.frames().find(f=>f.url().includes('frame.html'));
for(let i=0;i<7;i++){await fr.evaluate(()=>document.querySelector('[data-q-act="next"]')?.click());await new Promise(r=>setTimeout(r,100))}await fr.evaluate(()=>document.querySelector('[data-q-act="finish"]')?.click());await new Promise(r=>setTimeout(r,800));
const out=await fr.evaluate(()=>{
 const base=JSON.parse(JSON.stringify(current()));
 const sc=s=>{const e=evaluateRaw(s);return {score:e.score,pts:e.points,util:e.util,cap:{dti:e.capacity.dti,margin:e.capacity.margin,newQuota:e.capacity.newQuota}}};
 const mut=f=>{const s=JSON.parse(JSON.stringify(base));f(s);return sc(s)};
 const R={};
 R.base={score:sc(base).score,cards:base.cards.map(c=>({n:c.name,cur:c.currency,lim:c.limit,bal:c.balance,dpd:c.daysPastDue})),loans:base.loans.map(l=>({n:l.name,bal:l.balance,orig:l.original,dpd:l.daysPastDue})),fx:base.txRate,recordMonths:base.recordMonths,historyMonths:base.historyMonths,dpdTrue:Math.max(0,...base.cards.concat(base.loans).map(x=>x.daysPastDue))};
 // E1 mora vigente
 R.dpdSweep=[0,1,15,29,30,60,90,180,365,672].map(d=>({dpd:d,...mut(s=>{s.cards.forEach(c=>c.daysPastDue=0);s.loans.forEach(l=>l.daysPastDue=0);s.cards[0].daysPastDue=d})}).score).map((v,i)=>[[0,1,15,29,30,60,90,180,365,672][i],v]);
 // contraste: 1 mora de 60d declarada en cuestionario
 R.late60q=mut(s=>{s.cards.forEach(c=>c.daysPastDue=0);s.loans.forEach(l=>l.daysPastDue=0);s.late60=1}).score;
 R.noLate=mut(s=>{s.cards.forEach(c=>c.daysPastDue=0);s.loans.forEach(l=>l.daysPastDue=0)}).score;
 // utilización sweep (una tarjeta DOP)
 const one=(u)=>mut(s=>{s.cards=[{...s.cards[0],currency:'DOP',limit:100000,balance:100000*u,min:0,advance:0,daysPastDue:0}];s.loans=[];s.cards.forEach(c=>c.status='active')});
 R.utilSweep=[0,.01,.05,.09,.2,.29,.4,.49,.6,.75,.9,1,1.2].map(u=>[u,one(u).score,one(u).pts.owed]);
 // pagar tarjeta completo
 R.payFull=[one(.5).score,one(0).score];
 // préstamo nuevo
 const withLoan=(prog)=>mut(s=>{s.loans=[{id:'L1',name:'P',currency:'DOP',type:'personal',original:100000,balance:100000*(1-prog),due:3000,status:'active',daysPastDue:0}]});
 R.loan={none:mut(s=>{s.loans=[]}).score,new0:withLoan(0).score,half:withLoan(.5).score,paid95:withLoan(.95).score};
 // sin tarjetas, solo préstamo
 R.loanOnly=mut(s=>{s.cards=[];s.loans=[{id:'L1',name:'P',currency:'DOP',type:'personal',original:100000,balance:100000,due:3000,status:'active',daysPastDue:0}]});
 // ingresos / liquidez no mueven score
 R.income0=mut(s=>{s.formal=0;s.informal=0;s.otherFormal=0}).score;
 R.incomeHuge=mut(s=>{s.formal=5000000}).score;
 R.liqHuge=mut(s=>{s.liquidity={held30:99999999,now:99999999}}).score;
 R.expenses=mut(s=>{s.expenses=[{id:'x',name:'x',amount:900000,onCard:false}]}).score;
 // cambio FX
 R.fx=[40,60,80].map(f=>[f,mut(s=>{s.txRate=f}).score]);
 // antigüedad
 R.age=[0,6,12,24,60,120].map(m=>[m,mut(s=>{s.historyMonths=m;s.avgHistoryMonths=m*.7;s.recordMonths=Math.min(24,m)}).score]);
 R.evidence1=mut(s=>{s.recordMonths=1}).score;R.evidence24=mut(s=>{s.recordMonths=24}).score;
 // sin datos
 R.empty=mut(s=>{s.cards=[];s.loans=[]});
 // determinismo
 R.det=[sc(base).score===sc(base).score,JSON.stringify(sc(base))===JSON.stringify(sc(JSON.parse(JSON.stringify(base))))];
 // máximo teórico
 R.max=Object.values(WEIGHTS).reduce((a,b)=>a+b,0);
 // pesos: máx de cada parte
 R.partsMax=Object.fromEntries(Object.entries(evaluateRaw(base).parts).map(([k,v])=>[k,v.reduce((a,x)=>a+x.max,0)]));
 // moras cuestionario sweep
 R.lateSweep=[0,1,2,3].map(n=>[n,mut(s=>{s.cards.forEach(c=>c.daysPastDue=0);s.loans.forEach(l=>l.daysPastDue=0);s.late30=n}).score]);
 // reportes: score con evidencia 1 mes y perfecto
 R.perfect1m=mut(s=>{s.cards=[{...s.cards[0],currency:'DOP',limit:300000,balance:0,min:0,advance:0,daysPastDue:0}];s.loans=[];s.recordMonths=1;s.historyMonths=2;s.avgHistoryMonths=2});
 R.newbie=mut(s=>{s.cards=[{...s.cards[0],currency:'DOP',limit:20000,balance:1000,min:0,advance:0,daysPastDue:0}];s.loans=[];s.recordMonths=1;s.historyMonths=1;s.avgHistoryMonths=1;s.new0to6=1});
 return R});
console.log(JSON.stringify(out,null,1));await b.close()})();
