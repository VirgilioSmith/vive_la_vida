/* Regresión de profundidad sobre el motor original restaurado. */
const assert=require('node:assert/strict'),I=require('../src/intelligence/engine.js');
const snapshot={today:'2026-11-28',fx:60,txCount:3,months:[],cards:[{id:'A-DOP',productId:'A',name:'Ámbar',limit:1000,limitDop:1000,debtDop:900,util:90},{id:'B-DOP',productId:'B',name:'Coral',limit:1000,limitDop:1000,debtDop:100,util:10}],recurring:[{id:'a',name:'Servicio A',monthlyDop:200},{id:'b',name:'Servicio B',monthlyDop:100}],position:{liquid:1000,assets:1000,debt:1000,net:0}};
const run=I.analyze(snapshot,null,{exhaustive:true});
const target=run.all.find(x=>x.rule==='crd.util-target');
assert.equal(target.entity.id,'A');
assert.match(target.evidence[2].value,/600/);
assert.ok(run.all.some(x=>x.rule==='crd.portfolio-concentration'));
assert.equal(run.all.filter(x=>x.rule==='pat.subscription-annual').length,2);
const noFx=I.analyze({...snapshot,fx:0,hasUsd:true},null,{exhaustive:true});
assert.ok(!noFx.all.some(x=>['crd.util-target','crd.portfolio-concentration','pat.subscription-annual'].includes(x.rule)));
const list=Array.from({length:20},(_,i)=>({...target,key:'test-'+i,priority:'info',engine:'credit'}));
assert.equal(I.engines.priority.select(list,I.engines.learning.normalize(null),snapshot.today,{exhaustive:true}).length,20);
assert.equal(I.engines.priority.select(list,I.engines.learning.normalize(null),snapshot.today,{}).length,2);
console.log('OK profundidad original: escenarios, concentración, FX y prioridad exhaustiva.');
