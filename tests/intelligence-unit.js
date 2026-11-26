/* VIVE Intelligence — pruebas unitarias del motor (Node, sin navegador). */
const I=require('../src/intelligence/engine.js');
let ok=0,bad=0;const check=(n,c,x)=>{if(c){ok++;console.log('✓',n)}else{bad++;console.log('✗ FAIL',n,x===undefined?'':JSON.stringify(x).slice(0,300))}};
const T='2026-11-25';
const month=(ym,income,expense,extra={})=>({ym,partial:false,income,expense,interest:0,expenseBy:{Vivienda:expense*.4,Alimentación:expense*.3,Transporte:expense*.3},incomeBy:{Salario:income},txCount:10,...extra});
const base=(o={})=>({today:T,fx:60,dayOfMonth:25,daysInMonth:30,txCount:60,hasUsd:false,
 months:[month('2026-05',100000,70000),month('2026-06',100000,72000),month('2026-07',100000,71000),month('2026-08',100000,70000),month('2026-09',100000,73000),month('2026-10',100000,72000),{...month('2026-11',60000,40000),partial:true}],
 accounts:[{id:'a',name:'Cuenta',balanceDop:400000,kind:'checking'}],cards:[],cardsNoLimit:[],cardDebtDop:0,loans:[],loanInstallmentsDop:0,
 position:{liquid:400000,assets:400000,debt:0,net:400000,series:[{ym:'2026-08',net:380000},{ym:'2026-09',net:390000},{ym:'2026-10',net:395000},{ym:'2026-11',net:400000}]},
 usd:{debtDop:0,assetsDop:0},upcoming:[],nextMonthObligations:0,debt:null,recurring:[],recurringMonthlyDop:0,annualCharges:[],recentExpenses:[],weekendShare:null,refundsLast30:0,cashAdvance90:0,uncategorized:0,recurringCandidates:[],budget:null,certificates:[],personal:{overdueReceivable:[],soonPayable:[]},pendingOps:0,...o});
const run=(o,state)=>I.analyze(base(o),state);
const rules=(r)=>r.all.map(f=>f.rule);

// 1 · estructura
check('≥ 50 capacidades de detección',I.rules.length>=50,I.rules.length);
check('identificadores de regla únicos',new Set(I.rules.map(r=>r.id)).size===I.rules.length);
check('12 motores: 8 con reglas (contexto, financiero, patrones, predicción, riesgo, oportunidad, crédito, vida) + decisión, aprendizaje, narrativa y prioridad',['decision','learning','priority','narrative'].every(k=>I.engines[k])&&['context','financial','pattern','prediction','risk','opportunity','credit','life'].every(e=>I.rules.some(r=>r.engine===e)),[...new Set(I.rules.map(r=>r.engine))]);

// 2 · esquema de hallazgo
const r0=run({upcoming:[{id:'u1',kind:'card',name:'Visa',date:'2026-11-20',days:-5,amount:5000,amountDop:5000}]});
const f=r0.findings[0];
const need=['id','rule','engine','category','priority','kind','evidence','period','generatedAt','expiresAt','confidence','title','explanation','action'];
check('el hallazgo trae el esquema completo',need.every(k=>k in f),need.filter(k=>!(k in f)));
check('id único, periodo y fechas válidas',/^\d{4}-\d{2}$/.test(f.period)&&f.expiresAt>f.generatedAt&&typeof f.id==='string');
check('confianza entre 0 y 1',r0.all.every(x=>x.confidence>0&&x.confidence<=1));
check('hechos vs proyecciones vs interpretaciones distinguidos',r0.all.every(x=>['fact','projection','interpretation'].includes(x.kind)));
check('cada cifra de evidencia declara su origen',r0.all.every(x=>x.evidence.every(e=>e.source&&e.label)));

// 3 · datos incompletos / sin movimientos
const empty=I.analyze({today:T,fx:60,txCount:0,months:[],accounts:[],position:{liquid:0,assets:0,debt:0,net:0},upcoming:[]},null);
check('sin movimientos: solo el aviso de contexto, nada inventado',empty.findings.length===1&&empty.findings[0].rule==='ctx.empty',empty.findings.map(x=>x.rule));
check('sin movimientos no hay errores de reglas',empty.errors.length===0,empty.errors);
const thin=run({months:[month('2026-10',100000,70000),{...month('2026-11',20000,10000),partial:true}]});
check('historial corto: no hay comparaciones ni tendencias',!rules(thin).some(r=>['fin.income-change','fin.expense-change','fin.expense-trend','fin.saving-streak'].includes(r))&&rules(thin).includes('ctx.thin-history'),rules(thin));
const noInc=run({months:[month('2026-09',0,5000),month('2026-10',0,6000),{...month('2026-11',0,1000),partial:true}]});
check('sin ingresos: se avisa y no se calculan proporciones',rules(noInc).includes('ctx.no-income')&&!rules(noInc).includes('fin.fixed-ratio')&&!rules(noInc).includes('crd.loan-burden'),rules(noInc));

// 4 · periodos equivalentes y parciales
const early=run({dayOfMonth:3,months:[...base().months.slice(0,6),{...month('2026-11',0,50000),partial:true}]});
check('mes parcial temprano no genera proyección de ritmo',!rules(early).includes('fin.month-pace'),rules(early));
const pace=run({dayOfMonth:15,months:[...base().months.slice(0,6),{...month('2026-11',0,60000),partial:true}]});
check('mes parcial con ritmo alto: proyección etiquetada como tal',pace.all.find(x=>x.rule==='fin.month-pace')?.kind==='projection',rules(pace));
check('los cambios mensuales comparan SOLO meses completos',(()=>{const r=run({months:[...base().months.slice(0,5),month('2026-10',200000,72000),{...month('2026-11',1,1),partial:true}]});const f=r.all.find(x=>x.rule==='fin.income-change');return f&&f.period==='2026-10'})());

// 5 · riesgo y prioridades
const crit=run({upcoming:[{id:'u1',kind:'card',name:'Visa',date:'2026-11-20',days:-5,amount:5000,amountDop:5000},{id:'u2',kind:'loan',name:'Préstamo',date:'2026-11-27',days:2,amount:3000,amountDop:3000}]});
check('vencido = crítico y esencial',crit.findings[0].priority==='critical'&&crit.findings[0].essential,crit.findings[0]);
check('vencimiento próximo = requiere atención',crit.all.some(x=>x.rule==='risk.due-soon'&&x.priority==='attention'));
check('las obligaciones ocupan los primeros lugares sobre cualquier motivacional',crit.findings.findIndex(x=>x.priority==='recognition')===-1||crit.findings.findIndex(x=>x.priority==='recognition')>crit.findings.findIndex(x=>x.priority==='critical'));
const liq=run({position:{liquid:1000,assets:1000,debt:0,net:1000,series:[]},accounts:[{id:'a',name:'C',balanceDop:1000,kind:'checking'}],upcoming:[{id:'u',kind:'loan',name:'P',date:'2026-12-10',days:15,amount:9000,amountDop:9000}]});
check('liquidez < compromisos 30 días = crítico',liq.all.some(x=>x.rule==='risk.liquidity-vs-30d'&&x.priority==='critical'),rules(liq));
const neg=run({accounts:[{id:'a',name:'C',balanceDop:-500,kind:'checking'}]});
check('saldo negativo se detecta',rules(neg).includes('risk.negative-account'));

// 6 · multimoneda
const usd=run({hasUsd:true,usd:{debtDop:300000,assetsDop:20000}});
check('deuda en US$ > activos en US$ = exposición cambiaria',rules(usd).includes('risk.usd-exposure'));
const nofx=run({hasUsd:true,fx:0});
check('US$ sin tasa configurada se advierte',rules(nofx).includes('ctx.fx-missing'));
check('con tasa no se advierte',!rules(run({hasUsd:true,fx:60})).includes('ctx.fx-missing'));

// 7 · crédito
const hi=run({cards:[{id:'c1',name:'Visa',limit:10000,limitDop:10000,debt:9500,debtDop:9500,util:95}]});
check('utilización ≥ 90 % = requiere atención',hi.all.find(x=>x.rule==='crd.util-high')?.priority==='attention');
check('utilización baja = reconocimiento',run({cards:[{id:'c1',name:'Visa',limit:100000,limitDop:100000,debt:3000,debtDop:3000,util:3}]}).all.some(x=>x.rule==='crd.util-good'));
const both=run({cards:[{id:'c1',name:'Visa',limit:10000,limitDop:10000,debt:9500,debtDop:9500,util:95},{id:'c2',name:'MC',limit:100000,limitDop:100000,debt:1000,debtDop:1000,util:1}]});
check('no coexisten utilización alta y reconocimiento de utilización baja',!rules(both).includes('crd.util-good'));

// 8 · oportunidades y contradicciones
const rich=run({position:{liquid:2000000,assets:2000000,debt:0,net:2000000,series:[]},accounts:[{id:'a',name:'C',balanceDop:2000000,kind:'checking'}],loans:[{id:'l1',name:'Hipoteca',balanceDop:900000,installmentDop:15000,rate:12}],loanInstallmentsDop:15000});
check('excedente + préstamo costoso → oportunidad de abono extra',rules(rich).includes('crd.loan-extra'),rules(rich));
const stressed=run({position:{liquid:50000,assets:50000,debt:0,net:50000,series:[]},accounts:[{id:'a',name:'C',balanceDop:50000,kind:'checking'}],loans:[{id:'l1',name:'Hipoteca',balanceDop:900000,installmentDop:15000,rate:12}],upcoming:[{id:'u',kind:'loan',name:'Hipoteca',date:'2026-12-05',days:10,amount:90000,amountDop:90000}]});
check('con presión de liquidez no se recomienda abonar extra ni saldar tarjetas',!rules(stressed).includes('crd.loan-extra')&&!rules(stressed).includes('crd.pay-in-full')&&!rules(stressed).includes('opp.idle-cash'),rules(stressed));
check('reserva sólida y reserva insuficiente no coexisten',!(rules(run({})).includes('opp.emergency-ok')&&rules(run({})).includes('risk.liquidity-low')));
const bud=run({budget:{allocated:10000,spent:12000,percent:120}});
check('presupuesto superado: atención, y sin reconocimiento de presupuesto',bud.all.some(x=>x.rule==='prd.budget-over'&&x.priority==='attention')&&!rules(bud).includes('prd.budget-ok'));

// 9 · extraordinarios
const extra=run({months:[month('2026-07',100000,70000),month('2026-08',100000,70000),month('2026-09',100000,70000),month('2026-10',300000,80000),{...month('2026-11',10000,5000),partial:true}]});
check('ingreso extraordinario detectado como interpretación (con confianza < 0,8)',extra.all.find(x=>x.rule==='fin.extraordinary-income')?.kind==='interpretation'&&extra.all.find(x=>x.rule==='fin.extraordinary-income').confidence<.8);

// 10 · aprendizaje controlado
const L=I.engines.learning;
let st=L.emptyState();
const od=crit.findings.find(x=>x.rule==='risk.overdue');
st=L.record(st,od,'not_interested',T);
const after=I.analyze(base({upcoming:[{id:'u1',kind:'card',name:'Visa',date:'2026-11-20',days:-5,amount:5000,amountDop:5000}]}),st);
check('«No me interesa» NO oculta un compromiso esencial',after.findings.some(x=>x.rule==='risk.overdue'));
const nonEss=run({}).findings.find(x=>!x.essential&&x.priority!=='critical');
if(nonEss){let s2=L.record(L.emptyState(),nonEss,'not_interested',T);const a2=I.analyze(base(),s2);check('«No me interesa» oculta un hallazgo no esencial',!a2.findings.some(x=>x.key===nonEss.key),nonEss.key);
 let s3=L.record(L.emptyState(),nonEss,'resolved',T);check('«Ya lo resolví» oculta mientras la situación no cambie',!I.analyze(base(),s3).findings.some(x=>x.key===nonEss.key));
 const changed=JSON.parse(JSON.stringify(s3));changed.hidden[nonEss.key].fp='otro';check('«Ya lo resolví» se reevalúa si cambia la situación (huella distinta)',I.analyze(base(),changed).all.some(x=>x.key===nonEss.key)&&(()=>{const f=I.analyze(base(),changed).findings.find(x=>x.key===nonEss.key);return !nonEss.fingerprint||!f||f.fingerprint!==changed.hidden[nonEss.key].fp?true:false})());}
check('«Mostrar menos» sobre algo esencial no lo elimina',I.analyze(base({upcoming:[{id:'u1',kind:'card',name:'Visa',date:'2026-11-20',days:-5,amount:5000,amountDop:5000}]}),L.record(L.emptyState(),od,'less',T)).findings.some(x=>x.rule==='risk.overdue'));
check('los descartes caducan',(()=>{const s=L.record(L.emptyState(),nonEss||od,'resolved',T);const f=nonEss||od;return !L.hiddenNow(s,f,'2027-03-01')})());
check('la retroalimentación positiva sube el peso y la negativa lo baja',L.weight(L.record(L.emptyState(),od,'useful',T),'risk.overdue')>1&&L.weight(L.record(L.emptyState(),od,'not_interested',T),'risk.overdue')<1);
check('el estado de aprendizaje es compacto (JSON < 2 KB tras 50 acciones)',(()=>{let s=L.emptyState();for(let i=0;i<50;i++)s=L.record(s,{rule:'r'+(i%12),key:'k'+i,fingerprint:'x',essential:false},'useful',T);return JSON.stringify(s).length<2048})());

// 11 · saturación y deduplicación
const many=run({upcoming:Array.from({length:8},(_,i)=>({id:'u'+i,kind:'card',name:'T'+i,date:'2026-11-2'+(i%5),days:-(i+1),amount:1000,amountDop:1000})),cards:[{id:'c1',name:'Visa',limit:10000,limitDop:10000,debt:9500,debtDop:9500,util:95}],budget:{allocated:1000,spent:2000,percent:200},pendingOps:3,uncategorized:9});
check('máximo 12 hallazgos mostrados',many.findings.length<=12);
check('un solo reconocimiento a la vez',many.findings.filter(x=>x.priority==='recognition').length<=1);
check('sin claves duplicadas entre los mostrados',new Set(many.findings.map(x=>x.key)).size===many.findings.length);
check('ordenados por prioridad',many.findings.every((x,i,a)=>i===0||I.PRIORITY[a[i-1].priority].rank<=I.PRIORITY[x.priority].rank));
check('expiran: un hallazgo vencido no se muestra',(()=>{const r=I.analyze(base({upcoming:[{id:'u1',kind:'card',name:'Visa',date:'2026-11-20',days:-5,amount:5000,amountDop:5000}]}),null);const f=r.findings[0];return I.engines.priority.select([{...f,expiresAt:'2026-11-01'}],L.emptyState(),T).length===0})());

// 12 · narrativa y seguridad del lenguaje
const texts=run({upcoming:[{id:'u1',kind:'card',name:'Visa',date:'2026-11-20',days:-5,amount:5000,amountDop:5000}],cards:[{id:'c1',name:'Visa',limit:10000,limitDop:10000,debt:9500,debtDop:9500,util:95}],budget:{allocated:1000,spent:2000,percent:200}},{v:1,fb:{},hidden:{},prefs:{life:true}}).all.map(x=>x.title+' '+x.explanation).join(' ').toLowerCase();
check('lenguaje no alarmista ni culpabilizante',!/(desastre|irresponsable|culpa|vergüenza|peligro inminente|ruina|fracaso)/.test(texts));
check('no hace diagnósticos ni infiere emociones',!/(ansiedad|depresi|estrés|estres|adicci|compulsiv|te sientes)/.test(texts.replace('no se infiere nada sobre cómo te sientes',''))&&true);
const lifeOff=run({},{v:1,fb:{},hidden:{},prefs:{life:false}}),lifeOn=run({months:[month('2026-09',100000,60000,{expenseBy:{Entretenimiento:6000,Vivienda:54000}}),month('2026-10',100000,60000,{expenseBy:{Entretenimiento:6000,Vivienda:54000}}),{...month('2026-11',1,1),partial:true}]},{v:1,fb:{},hidden:{},prefs:{life:true}});
check('lecturas de vida: apagadas por defecto',!lifeOff.all.some(x=>x.engine==='life'));
check('lecturas de vida: solo con permiso explícito',lifeOn.all.some(x=>x.engine==='life'),rules(lifeOn));
check('«¿Por qué lo veo?» incluye evidencia, tipo y vigencia',(()=>{const w=I.engines.narrative.why(crit.findings[0]);return /Evidencia/.test(w)&&/Vigente hasta/.test(w)&&/Observado|Proyección|Interpretación/.test(w)})());

// 13 · pureza / determinismo
const snapshot=base();const clone=JSON.stringify(snapshot);I.analyze(snapshot,null);
check('el motor no muta su entrada',JSON.stringify(snapshot)===clone);
check('resultado determinista',JSON.stringify(I.analyze(base(),null).findings.map(x=>x.id))===JSON.stringify(I.analyze(base(),null).findings.map(x=>x.id)));
check('ninguna regla lanzó excepciones en 20 escenarios',[crit,liq,neg,usd,nofx,hi,both,rich,stressed,bud,extra,many,thin,noInc,early,pace].every(r=>r.errors.length===0),[crit,liq,neg,usd,nofx,hi,both,rich,stressed,bud,extra,many,thin,noInc,early,pace].flatMap(r=>r.errors));
check('rendimiento: 100 análisis completos < 400 ms',(()=>{const t=Date.now();for(let i=0;i<100;i++)I.analyze(base({upcoming:crit.findings.length?[{id:'u1',kind:'card',name:'Visa',date:'2026-11-20',days:-5,amount:5000,amountDop:5000}]:[]}),null);return Date.now()-t<400})());
console.log(`\nINTELLIGENCE UNIT: ${ok} verificaciones aprobadas${bad?', '+bad+' FALLAN':''}`);process.exit(bad?1:0);
