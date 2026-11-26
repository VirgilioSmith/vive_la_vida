/* VIVE Intelligence — capa estratégica: «prueba definitiva» (11 escenarios reproducibles) + propiedades. Node, sin navegador. */
const S=require('../src/intelligence/stats.js');const D=require('../src/intelligence/discovery.js');const G=require('../src/intelligence/strategy.js');
const fs=require('fs');
let ok=0,bad=0;const check=(n,c,x)=>{if(c){ok++;console.log('✓',n)}else{bad++;console.log('✗ FAIL',n,x===undefined?'':JSON.stringify(x).slice(0,500))}};
const T='2026-11-25';const dms=d=>Date.parse(d+'T00:00:00Z');const addDays=(d,n)=>new Date(dms(d)+n*86400000).toISOString().slice(0,10);
function ledger({days=300,seed=1,base=1500,sd=.4,incomeEvery=14,incomeAmt=40000,trend=0,extra=()=>[]}={}){
 const R=S.rng(seed),out=[];const start=addDays(T,-days);
 for(let i=0;i<days;i++){const d=addDays(start,i);const m=1+trend*i;
  if(R()<.7){const n=1+Math.floor(R()*2);for(let k=0;k<n;k++)out.push({d,a:Math.max(60,Math.round(base*m*Math.exp((R()-.5)*2*sd))),k:'x',c:'Alimentación',l:'c',p:R()<.4?'c':'a'})}
  if(i%incomeEvery===0)out.push({d,a:incomeAmt,k:'i',c:'Salario',l:'Nómina',p:'a'});
  for(const e of extra(i,d,R))out.push(e)}
 return out}
const months=(n,f)=>Array.from({length:n+1},(_,i)=>({ym:'m'+i,partial:i===n,income:100000,expense:60000,txCount:20,expenseBy:{},...(f?f(i):{})}));
const snap=(o={})=>({today:T,fx:60,position:{liquid:300000,assets:300000,debt:0,net:300000},cardDebtDop:0,loanInstallmentsDop:0,recurringMonthlyDop:0,upcoming:[],months:months(8),ledger:ledger(),...o});
const run=(s,mem)=>D.discover(s,mem);
const hasKey=(r,pre)=>[...r.discoveries,...r.internal].some(h=>h.key.startsWith(pre));
const twice=(s)=>{const a=run(s,{});const m=JSON.parse(JSON.stringify(a.mem));for(const k of Object.keys(m.hyp))m.hyp[k].seen=[addDays(T,-1)];return run(s,m)};

/* ===== A · estadística nueva ===== */
const up=Array.from({length:30},(_,i)=>100+i*3+((i*7)%5));const flat=Array.from({length:30},(_,i)=>100+((i*7)%5));
check('Mann–Kendall detecta tendencia monótona',(()=>{const r=S.mannKendall(up);return r&&r.p<.001&&r.tau>.8})());
check('Mann–Kendall no ve tendencia en datos estacionarios',(()=>{const r=S.mannKendall(flat);return r&&r.p>.05})());
check('Theil–Sen estima la pendiente',Math.abs(S.sen(up)-3)<.6,S.sen(up));

/* ===== B · prueba definitiva: 11 escenarios ===== */
/* 1 · indicadores normales por separado, combinación atípica */
{const L=ledger({days:200,seed:2,extra:(i,d)=>i===190?[{d,a:2600,k:'x',c:'Ocio',l:'a',p:'a'},{d,a:30,k:'x',c:'Ocio',l:'b',p:'a'},{d,a:30,k:'x',c:'Ocio',l:'b',p:'a'},{d,a:30,k:'x',c:'Ocio',l:'b',p:'a'},{d,a:30,k:'x',c:'Ocio',l:'b',p:'a'},{d,a:30,k:'x',c:'Ocio',l:'b',p:'a'}]:[]});
 const F=D.buildFeatures(snap({ledger:L}),D.Memory.empty());const h=G.shadow(F,snap({ledger:L}),{},D.confidence);
 check('1 · combinación atípica sin ningún indicador extremo: o se detecta con evidencia multivariable o no se afirma nada (nunca falsa alarma)',h.every(x=>x.type!=='atypical-combination'||(x.evidence.length>=4&&/Isolation Forest/.test(x.method))));}
/* 2 · mejora aparente que oculta deterioro */
{const mm=months(8,i=>({expenseBy:{Vivienda:20000+i*2500,Servicios:5000,Ocio:20000-i*1200,Comida:15000-i*800},income:100000}));
 const r=twice(snap({months:mm}));check('2 · gasto variable baja pero el fijo sube: se detecta la paradoja (no se celebra el ahorro aparente)',hasKey(r,'paradox.spend-down-fixed-up'),r.internal.map(h=>h.key));
 const sh=[...r.discoveries,...r.internal].find(h=>h.key==='paradox.spend-down-fixed-up');check('2 · la paradoja no se resuelve automáticamente: ofrece alternativas y no ordena actuar',sh&&sh.alternatives.length>=2&&!/debes|tienes que/i.test(sh.summary),sh&&sh.summary);}
/* 3 · anomalía que es oportunidad */
{const L=ledger({days:150,seed:4,extra:(i,d)=>i===140?[{d,a:240000,k:'i',c:'Bono',l:'Bono',p:'a'}]:[]});const r=run(snap({ledger:L}),{});
 const h=[...r.discoveries,...r.internal].find(x=>x.key.startsWith('shadow.income-anomaly'));check('3 · ingreso muy superior: se clasifica como oportunidad, no como problema',h&&h.valence==='opportunity'&&/oportunidad/i.test(h.title),h&&h.title);}
/* 4 · cambio lento que CUSUM no ve */
{const L=ledger({days:300,seed:5,trend:.008,sd:.25});const F=D.buildFeatures(snap({ledger:L}),D.Memory.empty());const h=G.shadow(F,snap({ledger:L}),{},D.confidence).find(x=>x.type==='slow-trend');
 check('4 · deriva gradual del gasto: Mann–Kendall + Theil–Sen la detectan con p y pendiente visibles',h&&h.evidence.some(e=>/Mann|Valor p/.test(e[0]))&&h.valence==='risk',h&&h.title);
 const flatL=ledger({days:300,seed:5,trend:0,sd:.25});const Ff=D.buildFeatures(snap({ledger:flatL}),D.Memory.empty());
 check('4 · sin deriva: no se inventa una tendencia',!G.shadow(Ff,snap({ledger:flatL}),{},D.confidence).some(x=>x.type==='slow-trend'));}
/* 5 · coincidencia azarosa */
{let falses=0;for(let seed=21;seed<27;seed++){const r=twice(snap({ledger:ledger({days:240,seed})}));falses+=r.discoveries.filter(h=>h.engine==='correlation').length}
 check('5 · series independientes (6 semillas): ninguna correlación espuria llega al usuario',falses===0,falses);}
/* 6 · predicción anterior incorrecta → abstención */
{const mem={pred:[1,2,3,4,5].map(i=>({t:'spend',for:'2026-0'+i,pred:60000,lo:58000,hi:62000,naive:60000,actual:90000,err:30000,naiveErr:30000,hit:0}))};
 const ab=G.abstain(mem,'spend');check('6 · tras 5 predicciones fallidas el sistema se abstiene y dice por qué',ab.abstain&&/acertó/.test(ab.reason),ab);
 const perf=G.performance(mem);check('6 · desempeño real: error absoluto medio y cobertura medidos, no declarados',perf.n===5&&perf.mae===30000&&perf.coverage===0,perf);
 const good={pred:[1,2,3,4,5].map(i=>({t:'spend',for:'m'+i,pred:60000,lo:50000,hi:70000,naive:61000,actual:61000,err:1000,naiveErr:3000,hit:1}))};check('6 · con buen desempeño no se abstiene',!G.abstain(good,'spend').abstain);}
/* 7 · excepción que se vuelve hábito */
{const L=ledger({days:200,seed:6,extra:(i,d)=>(i>=165&&i%6===0)?[{d,a:20000,k:'x',c:'Ocio',l:'Evento',p:'a'}]:[]});const F=D.buildFeatures(snap({ledger:L}),D.Memory.empty());
 check('7 · gasto extraordinario que se repite deja de ser excepción',G.shadow(F,snap({ledger:L}),{},D.confidence).some(x=>x.type==='exception-to-habit'));}
/* 8 · el usuario corrige */
{let mem={fb:[]};for(let i=0;i<6;i++)mem.fb.push({engine:'pattern',a:'incorrect'});mem.fb.push({engine:'pattern',a:'correct'});const thr=G.calibrate(mem);
 check('8 · tasa de falsos positivos reportada por el usuario eleva el umbral del motor afectado',thr.pattern>0&&!thr.anomaly,thr);
 check('8 · el benchmark informa la tasa real (6/7) sin puntuación global',G.benchmark(mem).falsosPositivosPorMotor.pattern===.86&&!('score' in G.benchmark(mem)));}
/* 9 · sin información suficiente */
{const s=snap({ledger:ledger({days:25,seed:7}),months:months(2)});const r=run(s,{});
 check('9 · con 25 días: sin hallazgos estratégicos ni afirmaciones',r.discoveries.length===0&&!r.internal.some(h=>h.engine==='shadow'&&h.state==='priority'));
 const F=D.buildFeatures(s,D.Memory.empty());const hz=G.horizon(s,F);check('9 · los futuros alternativos se niegan a construirse con < 60 días y lo explican',hz.ok===false&&/60 días/.test(hz.reason),hz);
 check('9 · el gobierno de modelos no promueve nada sin backtest suficiente',(()=>{const g=G.govern({},[1,2,3]);return g.ok===false&&g.champion==='naive'})());}
/* 10 · modelo complejo peor que el simple */
{const R=S.rng(9);const noise=Array.from({length:14},()=>60000+(R()-.5)*30000);const m1={};const g1=G.govern(m1,noise);
 check('10 · en datos ruidosos sin estructura el campeón sigue siendo el modelo simple (o el ingenuo)',g1.ok&&['naive','media3','median3'].includes(g1.champion)||g1.champion==='naive',g1.champion);
 const trendS=Array.from({length:16},(_,i)=>40000+i*3000);const m2={};const g2=G.govern(m2,trendS);
 check('10 · en datos con tendencia clara un retador sí supera ≥ 10 % y se promueve con versión y rastro',g2.ok&&g2.champion!=='naive'&&g2.version===2&&m2.models.spend.history.length===1,g2);
 const bad=G.govern(JSON.parse(JSON.stringify(m2)),Array.from({length:16},(_,i)=>(i%2?90000:20000)));check('10 · si el campeón se degrada, se revierte (rollback) y queda registrado',bad.event&&bad.event.rolledBack!=null||bad.champion==='naive'||bad.champion!==g2.champion,bad);}
/* 11 · descubrimiento desde variables separadas */
{const up=[{name:'Tarjeta',days:3,amountDop:60000},{name:'Préstamo',days:4,amountDop:45000},{name:'Seguro',days:5,amountDop:20000},{name:'Renta',days:19,amountDop:15000}];
 const s=snap({upcoming:up,position:{liquid:200000,assets:200000,debt:0,net:200000}});const r=run(s,{});
 const h=[...r.discoveries,...r.internal].find(x=>x.key==='shadow.timing-cluster');
 check('11 · el total alcanza pero los vencimientos coinciden en 5 días: se detecta «cuándo», no «cuánto»',h&&/cuándo coinciden/.test(h.title)&&h.immediate,h&&h.title);}

/* ===== C · capacidades ===== */
const S0=snap({ledger:ledger({days:300,seed:11}),loans:[{id:'l1',name:'Préstamo auto',balanceDop:400000,installmentDop:12000,rate:14}],loanInstallmentsDop:12000,cardDebtDop:20000,upcoming:[{name:'Tarjeta',days:5,amountDop:20000},{name:'Préstamo',days:9,amountDop:12000}]});
const F0=D.buildFeatures(S0,D.Memory.empty());
const lm=G.lifeModel(S0,F0);check('primeros principios: la liquidez se descompone y la suma cuadra con la liquidez visible',Math.abs(lm.items.reduce((s,i)=>s+i.amount,0)-lm.liquid)<1&&lm.items.length===4&&lm.assumptions.length>=3,lm);
const hz=G.horizon(S0,F0);check('horizonte: 5 futuros × 7 horizontes, cada uno con p10 ≤ p50 ≤ p90',hz.ok&&Object.keys(hz.futures).length===5&&Object.values(hz.futures).every(f=>Object.values(f.horizons).length===7&&Object.values(f.horizons).every(v=>v.p10<=v.p50&&v.p50<=v.p90)));
check('horizonte: cada futuro declara supuestos; mejora ≥ continuidad ≥ adverso (mediana a 365 d)',Object.values(hz.futures).every(f=>f.assumptions)&&hz.futures.improvement.horizons[365].p50>=hz.futures.continuity.horizons[365].p50&&hz.futures.continuity.horizons[365].p50>=hz.futures.adverse.horizons[365].p50);
check('horizonte: determinista (misma semilla → mismo resultado)',JSON.stringify(G.horizon(S0,F0))===JSON.stringify(hz));
check('horizonte: avisa cuando el horizonte supera el historial',G.horizon(snap({ledger:ledger({days:100,seed:12})}),D.buildFeatures(snap({ledger:ledger({days:100,seed:12})}),D.Memory.empty())).limits!==undefined);
const ch=G.chain(S0,F0,{label:'Nuevo préstamo',monthly:8000,down:30000});check('consecuencias de 1.º a 4.º orden con números y supuestos',['first','second','third','fourth'].every(k=>ch[k]&&ch[k].text)&&/Gastar o endeudarse no es malo/.test(ch.positives)&&ch.assumptions.length>=3,ch);
check('4.º orden: la decisión empeora (o iguala) la disponibilidad central a 365 días',ch.fourth.numbers.p50_365_despues<=ch.fourth.numbers.p50_365_antes);
const dl=G.decisionLab(S0,F0);check('laboratorio de decisiones: las 5 alternativas con costos, incertidumbre, reversibilidad y flexibilidad',dl.ok&&dl.alternatives.length===5&&dl.alternatives.every(a=>a.benefits.length&&a.uncertainties.length&&a.reversibility&&a.flexibility&&a.futureImpact)&&dl.alternatives.some(a=>a.id==='none'));
check('laboratorio: no ejecuta nada (sin funciones de escritura ni verbos imperativos de pago)',!/\bpagar ahora|transferir ahora|ejecutar\b/i.test(JSON.stringify(dl)));
const gr=G.graph(S0,F0,{},[]);check('grafo: nodos y aristas acotados, cada arista con evidencia, incertidumbre y vigencia',gr.nodes.length<=40&&gr.edges.length<=80&&gr.edges.length>0&&gr.edges.every(e=>e.evidence>=1&&e.uncertainty&&e.validUntil&&e.source),gr.stats);
check('grafo: consultas de vecinos y caminos',gr.neighbors('usuario').length>0&&(()=>{const o=gr.neighbors('usuario')[0].other;const p=gr.path('usuario',o);return p&&p.length===2})());
const sci=(()=>{const h={type:'weekday-peak',key:'pat.weekday.5'};return G.science(h,F0,S0)})();check('científico: pone a prueba explicaciones alternativas y reporta estado',sci.alternatives.length>=2&&['provisional','refutada'].includes(sci.status),sci);
const refutable=G.science({type:'structural-up',key:'x'},D.buildFeatures(snap({ledger:ledger({days:200,seed:3})}),D.Memory.empty()),S0);check('científico: sin evidencia de cambio no se confirma',refutable.status!=='confirmada');
const fakeH={confidence:{score:.7},evidence:[[1,2],[1,2],[1,2]],impact:5000,valence:'risk',category:'spending',alternatives:['a','b'],ifContinues:'x',science:{alternatives:[{tested:true}],refuted:false}};
const co=G.council(fakeH,{mem:{declared:{priorities:['Experiencias']}}});check('consejo interno: 8 perspectivas + síntesis, con disenso explícito y sin agentes generativos',co.votes.length===8&&co.votes.some(v=>v.role==='Escéptico')&&co.votes.some(v=>v.role==='Sintetizador'),co.votes.map(v=>v.role));
check('consejo: el humanista usa las prioridades declaradas (o se abstiene si no hay)',co.votes.find(v=>v.role==='Humanista').verdict==='reserva'&&G.council(fakeH,{mem:{}}).votes.find(v=>v.role==='Humanista').verdict==='abstención');
check('consejo: si el escéptico refuta, el veredicto es descartar',G.council({...fakeH,science:{refuted:true,reason:'r',alternatives:[{tested:true}]}},{mem:{}}).verdict==='descartar');
const cu=G.curiosity(S0,F0,{},{discoveries:[],internal:[]});check('curiosidad: separa lo conocido de lo desconocido y pregunta como máximo UNA cosa',cu.known.length&&cu.unknown.length&&cu.ask&&cu.ask.id==='priorities'&&cu.ask.why,cu.ask);
const mem2=G.answer({},'priorities',['Libertad','Familia'],T);check('responder una pregunta actualiza la memoria y no se vuelve a preguntar',mem2.declared.priorities.length===2&&G.curiosity(S0,F0,mem2,null).ask==null||(G.curiosity(S0,F0,mem2,null).ask||{}).id!=='priorities');

/* ===== D · integración con discover() ===== */
const R1=run(S0,{});check('discover(): incluye revisión estratégica sin errores de motor y con 9 motores',R1.strategy&&R1.audit.engines.every(e=>!e.error)&&R1.audit.engines.filter(e=>e.id!=='strategy').length===9,R1.audit.engines.filter(e=>e.error));
check('discover(): memoria < 8 KB tras varias ejecuciones y registro de predicciones acotado',(()=>{let m={};for(let i=0;i<6;i++){const s=snap({ledger:ledger({days:300,seed:11}),today:addDays(T,i)});s.today=addDays(T,i);m=run(s,m).mem}return JSON.stringify(m).length<8192&&(m.pred||[]).length<=14})());
check('discover(): ≤ 1 pregunta pendiente al usuario',R1.strategy.curiosity.ask===null||typeof R1.strategy.curiosity.ask.id==='string');
check('discover(): presupuesto de cómputo (< 400 ms con 300 días)',R1.audit.ms<400,R1.audit.ms);
check('discover(): no depende de red (el código estratégico no contiene fetch/XMLHttpRequest/WebSocket)',!/fetch\(|XMLHttpRequest|WebSocket|sendBeacon/.test(fs.readFileSync(__dirname+'/../src/intelligence/strategy.js','utf8')));
check('discover(): determinista con la misma memoria',JSON.stringify(run(S0,{}).discoveries.map(h=>h.key))===JSON.stringify(run(S0,{}).discoveries.map(h=>h.key)));
check('discover(): cada hallazgo mostrado lleva ciencia y consejo (cuando aplica)',R1.discoveries.every(h=>h.council&&h.council.votes.length===8));
check('benchmark: reporta nulos en lo que no tiene datos (sin puntuación ficticia)',(()=>{const b=D.strategic(S0,{}).benchmark();return b.predicciones.n===0&&b.utilidadPercibida===null&&/Sin puntuación global/.test(b.nota)})());
check('strategic(): API bajo demanda disponible',(()=>{const a=D.strategic(S0,{});return a.horizon().ok&&a.decisionLab().ok&&a.graph().nodes.length>0&&a.lifeModel().items.length===4})());
console.log(`\nINTELLIGENCE STRATEGY: ${ok} verificaciones aprobadas${bad?`, ${bad} FALLARON`:''}`);process.exit(bad?1:0);
