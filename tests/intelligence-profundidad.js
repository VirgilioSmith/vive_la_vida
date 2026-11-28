/* Regresión: profundidad contextual sin fugas ni límites de presentación. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const window={};
const context=vm.createContext({window});
for(const name of ['stats','strategy','discovery','engine']){
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/intelligence',name+'.js'),'utf8'),context);
}
const api=window.ViveIntelligence;
const scope=(module,subject)=>({today:'2026-11-28',module,subject,key:module+':'+subject,name:subject});
const run=(m,s,data)=>api.contextual(scope(m,s),data);
const a={id:'A',name:'Ámbar',debt:900,limit:1000};
const due=Array.from({length:6},(_,i)=>({id:'A',name:'Ámbar',kind:'card',currency:'DOP',amount:100+i,date:'2026-11-'+(22+i),days:-6+i}));
let f=run('cards','Ámbar',{cards:[a],due});
assert.equal(f.length,8);assert.equal(new Set(f.map(x=>x.key)).size,8);
assert.equal(f.filter(x=>x.priority==='critical').length,6);
f=run('cards','Consolidado',{cards:[{...a,debt:800},{...a,debt:200},{id:'B',name:'Coral',debt:100,limit:1000}]});
assert.equal(f.filter(x=>x.rule==='active.credit-target').length,1);
assert.ok(f.some(x=>x.rule==='active.credit-concentration'));
assert.match(f.find(x=>x.rule==='active.credit-target').evidence[2].value,/400/);
f=run('cards','Ámbar',{cards:[a],globalCredit:1800});
assert.equal(f.length,3);assert.ok(!JSON.stringify(f).includes('Coral'));
assert.match(f.find(x=>x.rule==='active.credit-global-share').title,/50/);
f=run('recurring','Todos',{subscriptions:[{id:'s1',name:'Servicio A',monthly:200},{id:'s2',name:'Servicio A',monthly:100}],charges:['s1','s2'].flatMap((id,i)=>[{service:id,name:id,amount:100+i,currency:'DOP',date:'2026-11-01'},{service:id,name:id,amount:80+i,currency:'DOP',date:'2026-10-01'}])});
assert.equal(f.filter(x=>x.rule==='active.subscription-change').length,2);
assert.ok(f.some(x=>x.rule==='pat.subscription-duplicate'));assert.ok(f.some(x=>x.rule==='active.subscription-annual'));assert.ok(f.length>4);
f=run('analytics','2026',{series:Array.from({length:8},(_,i)=>({period:'2026-'+String(i+1).padStart(2,'0'),complete:true,income:10000,expense:2000+800*i})),seriesLabel:'Resultado del período'});
assert.ok(f.some(x=>x.rule==='active.legacy-savings-rate'));assert.ok(f.some(x=>x.rule==='active.legacy-net-trend'));
assert.equal(run('register','Sin coincidencias',{}).length,0);
assert.equal(run('register','Búsqueda',{movements:[{income:0,expense:6778,category:'Alimentos',label:'Granada',date:'2026-11-28'}]}).length,1);
f=run('loans','Préstamo A',{loans:[{id:'l1',name:'Préstamo A',balanceDop:10000,installmentDop:1000,remaining:13}]});
assert.match(f.find(x=>x.rule==='active.loan-horizon').title,/13/);
f=run('banks','Banco A',{position:{funds:1000,invested:2000,debt:1500,net:1500}});
assert.match(f.find(x=>x.rule==='active.bank-leverage').title,/50/);
f=run('benefits','Tarjeta A',{benefits:{paid:100,received:50}});
assert.match(f.find(x=>x.rule==='active.benefit-efficiency').evidence[2].value,/-50/);
console.log('✓ Profundidad contextual, aislamiento, prioridades, escenarios, referencias agregadas y lentes históricas');
