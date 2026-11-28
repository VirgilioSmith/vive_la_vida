/* Los motores originales deben conservar profundidad y evidencia dentro de una selección. */
const assert=require('node:assert/strict');
const Discovery=require('../src/intelligence/discovery.js');
const Intelligence=require('../src/intelligence/engine.js');
const Stats=require('../src/intelligence/stats.js');

const today='2026-11-25';
const addDays=(date,offset)=>new Date(Date.parse(date)+offset*86400000).toISOString().slice(0,10);
const random=Stats.rng(4);
const ledger=Array.from({length:300},(_,index)=>{
 const d=addDays(today,index-300);
 const weekday=new Date(d).getUTCDay();
 const a=Math.round((weekday===5||weekday===6?4800:1000)*(.85+random()*.3));
 return {d,k:'x',a,p:'c',c:'Compras',l:'Comercio visible'};
});
const months=Array.from({length:10},(_,index)=>({ym:`2026-${String(index+1).padStart(2,'0')}`,
 txCount:24,income:100000,expense:99500+(index%3-1)*700,expenseBy:{Compras:99500}}));
const snapshot={today,ledger,months};
const options={scopeKey:'scope-a',only:['pattern','shadow']};
const scoped=Discovery.discover(snapshot,null,options);
const results=(result)=>[...result.discoveries,...result.internal];
const weekdays=(result)=>result.discoveries.filter(finding=>finding.type==='weekday-peak');

assert.deepEqual(weekdays(scoped).map(finding=>finding.key).sort(),['scope-a::pat.weekday.5','scope-a::pat.weekday.6']);
assert(weekdays(scoped).every(finding=>finding.seenDays>=2&&finding.evidence.length>=3&&finding.method&&finding.science.temporal));
assert.deepEqual(Discovery.discover(snapshot,null,{...options,scopeKey:'scope-b'}).discoveries.map(finding=>finding.scopeKey),
 scoped.discoveries.map(()=> 'scope-b'));
assert.deepEqual(Discovery.discover({today,ledger:[]},null,options).discoveries,[]);

const legacyFirst=Discovery.discover(snapshot,null,{only:['pattern']});
const legacyNext={...snapshot,today:addDays(today,1)};
assert.equal(weekdays(legacyFirst).length,0);
assert.equal(weekdays(Discovery.discover(legacyNext,legacyFirst.mem,{only:['pattern']})).length,1);
assert.equal(weekdays(Discovery.discover(legacyNext,legacyFirst.mem,{only:['pattern'],exhaustive:true})).length,2);

const forecast=Discovery.discover(snapshot,null,{...options,only:['prediction']});
assert(results(forecast).some(finding=>finding.key==='scope-a::pred.next-month-spend'&&finding.kind==='projection'));
const closed=Discovery.discover({...snapshot,
 ledger:[...ledger,{d:today,k:'i',a:450000,p:'a',l:'Fuera del corte'}],
 months:[...months,{ym:'2026-11',partial:false,income:450000,expense:1,txCount:80},
  {ym:'2026-12',income:999999,expense:1,txCount:80}],
},null,{...options,closedPeriod:true,only:['pattern','prediction','shadow','lens']});
assert.equal(closed.features.windows[30].income,0);
assert(!results(closed).some(finding=>finding.kind==='projection'||finding.engine==='prediction'));
assert.deepEqual(closed.lens,{});
assert.deepEqual(closed.digest,[]);
assert.equal(closed.strategy,null);

const globalMemory=Discovery.Memory.empty();
globalMemory.w.pattern=.4;
globalMemory.disabled['pattern.weekday-peak']=true;
globalMemory.excludeDates.push(...ledger.slice(-50).map(entry=>entry.d));
const originalMemory=JSON.stringify(globalMemory);
const fromMemory=Discovery.discover(snapshot,globalMemory,options);
assert.equal(JSON.stringify(globalMemory),originalMemory);
assert.deepEqual(fromMemory.mem,Discovery.Memory.empty());
assert.deepEqual(weekdays(fromMemory).map(finding=>finding.key),weekdays(scoped).map(finding=>finding.key));
assert.deepEqual(weekdays(Discovery.discover(snapshot,{prefs:{off:{spending:true}}},options)),[]);

const insight=weekdays(scoped)[0];
const feedback=Discovery.feedback(globalMemory,insight,'exception',today);
assert.equal(feedback.exc[insight.key].scopeKey,options.scopeKey);
assert.equal(JSON.stringify(globalMemory),originalMemory);
assert.deepEqual({...feedback,exc:{}},globalMemory);
assert(!weekdays(Discovery.discover(snapshot,feedback,options)).some(finding=>finding.key===insight.key));
assert.equal(weekdays(Discovery.discover(snapshot,feedback,{...options,scopeKey:'scope-b'})).length,2);
assert.equal(weekdays(Discovery.discover(snapshot,feedback,{...options,feedbackToday:addDays(today,366)})).length,2);
assert.deepEqual(Discovery.feedback(feedback,insight,'never',today),feedback);
let bounded=feedback;
for(let index=0;index<36;index++){
 const scopeKey='filter-'+index;
 bounded=Discovery.feedback(bounded,{...insight,scopeKey,key:scopeKey+'::pat.weekday.5'},'known',today);
}
assert.equal(Object.keys(bounded.exc).length,32);

const wallet={module:'cards',subject:'cartera-visible',today,period:today.slice(0,7)};
const cards=[{id:'ambar',name:'Ámbar',debt:76000,limit:100000},{id:'coral',name:'Coral',debt:3000,limit:100000}];
const due=Array.from({length:7},(_,index)=>({id:'due-'+index,name:'Ámbar',kind:'card',
 date:addDays(today,index-2),days:index-2,amount:900+index,currency:'DOP'}));
const cardReadings=Intelligence.contextual(wallet,{cards,due},null);
assert.equal(cardReadings.filter(finding=>finding.rule==='active.due').length,7);
assert(cardReadings.some(finding=>finding.rule==='active.credit-target'&&finding.kind==='projection'&&finding.title.includes('Ámbar')));
assert(cardReadings.some(finding=>finding.rule==='active.credit-concentration'&&finding.title.includes('Ámbar')));
const selectedCard=Intelligence.contextual({...wallet,subject:'coral',name:'Coral'},{cards:[cards[1]]},null);
assert(!JSON.stringify(selectedCard).includes('Ámbar'));

const registers=Discovery.discover({...snapshot,months:months.map((month,index)=>index===9?
 {...month,expense:150000,expenseBy:{Compras:150000}}:month)},null,
 {scopeKey:'movimientos',only:['lens'],lenses:['register']});
assert.deepEqual(Object.keys(registers.lens),['register']);
assert(registers.lens.register.some(finding=>finding.key==='movimientos::lens.register.category-growth'));
console.log('✓ Profundidad contextual, períodos cerrados, retroalimentación aislada y lentes estratégicas');
