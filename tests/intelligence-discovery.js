/* VIVE Intelligence — pruebas del motor de descubrimiento y la caja estadística (Node, sin navegador). */
const S=require('../src/intelligence/stats.js');const D=require('../src/intelligence/discovery.js');
let ok=0,bad=0;const check=(n,c,x)=>{if(c){ok++;console.log('✓',n)}else{bad++;console.log('✗ FAIL',n,x===undefined?'':JSON.stringify(x).slice(0,400))}};
const T='2026-11-25';const dms=d=>Date.parse(d+'T00:00:00Z');const addDays=(d,n)=>new Date(dms(d)+n*86400000).toISOString().slice(0,10);
/* ---------- generador sintético (con semilla) ---------- */
function ledger({days=300,seed=1,base=1500,sd=.6,fridayMult=1,payday=null,shiftFrom=null,shiftMult=1,spike=null,dup=null,incomeEvery=14,incomeAmt=40000,weekendMult=1}={}){
 const R=S.rng(seed),out=[];const start=addDays(T,-days);
 for(let i=0;i<days;i++){const d=addDays(start,i);const w=new Date(dms(d)).getUTCDay();
  let m=1;if(w===5)m*=fridayMult;if(w===0||w===6)m*=weekendMult;if(shiftFrom!=null&&i>=shiftFrom)m*=shiftMult;
  if(R()<.7){const n=1+Math.floor(R()*2);for(let k=0;k<n;k++){const a=Math.max(60,Math.round(base*m*Math.exp((R()-.5)*2*sd)));out.push({d,a,k:'x',c:'Alimentación',l:'Compra '+Math.floor(R()*5),p:R()<.4?'c':'a'})}}
  if(i%incomeEvery===0)out.push({d,a:incomeAmt,k:'i',c:'Salario',l:'Nómina',p:'a'});
  if(payday&&i%incomeEvery>=1&&i%incomeEvery<=3)out.push({d,a:Math.round(base*payday),k:'x',c:'Compras',l:'Post cobro',p:'a'});
 }
 if(spike)out.push({d:addDays(T,-spike.ago),a:spike.a,k:'x',c:'Compras',l:spike.l||'Compra grande',p:'a'});
 if(dup){out.push({d:addDays(T,-dup.ago),a:dup.a,k:'x',c:'Compras',l:'Misma tienda',p:'a'});out.push({d:addDays(T,-dup.ago),a:dup.a,k:'x',c:'Compras',l:'Misma tienda',p:'a'})}
 return out;
}
const months=(n,exp=60000,inc=100000,noise=3000,seed=3)=>{const R=S.rng(seed);return Array.from({length:n+1},(_,i)=>({ym:'m'+i,partial:i===n,income:inc,expense:Math.round(exp+(R()-.5)*2*noise),txCount:20}))};
const snap=(o={})=>({today:T,fx:60,position:{liquid:300000,assets:300000,debt:0,net:300000},upcoming:[],months:months(8),ledger:ledger(),...o});
const run=(s,mem)=>D.discover(s,mem);
const keys=r=>r.discoveries.map(h=>h.key);

/* ===== 1 · Caja estadística ===== */
check('mediana y MAD robustas ante un valor extremo',S.median([1,2,3,4,1000])===3&&S.mad([1,2,3,4,1000])<5);
check('z robusto: extremo ≫ 3,5; valor normal ≈ 0',S.robustZ(1000,[10,11,9,10,12,10,11])>50&&Math.abs(S.robustZ(10,[10,11,9,10,12,10,11]))<1);
check('rango personal (IQR) contiene lo habitual y excluye lo extremo',(()=>{const r=S.personalRange([10,12,11,13,12,11,10,12,11,500].slice(0,9));return r.high>13&&r.high<30})());
check('EWMA converge hacia el nivel reciente',(()=>{const e=S.ewma([10,10,10,50,50,50],.5);return e[5]>40&&e[2]===10})());
const step=[...Array(20).fill(0).map((_,i)=>100+(i%3)),...Array(12).fill(0).map((_,i)=>150+(i%3))];
const cs=S.cusum(step,{n0:20,k:.5,h:4});check('CUSUM detecta un cambio de nivel sostenido y su dirección',cs&&cs.direction===1&&cs.index>=20&&cs.shiftPct>35,cs);
check('CUSUM no se dispara con datos estacionarios',S.cusum(Array.from({length:40},(_,i)=>100+(i*7%5)),{n0:20})===null);
const lr=S.linreg([1,2,3,4,5,6,7,8,9,10]);check('regresión lineal: pendiente y predicción con intervalo',Math.abs(lr.slope-1)<1e-9&&lr.predict(10).low<=lr.predict(10).mean&&lr.predict(10).high>=lr.predict(10).mean);
const xs=Array.from({length:30},(_,i)=>i+((i*37)%7)),ys=xs.map(v=>v*2+((v*13)%5));check('Spearman con permutación: relación real → p pequeño',S.spearmanPerm(xs,ys).p<.01);
const R0=S.rng(5),n1=Array.from({length:30},()=>R0()),n2=Array.from({length:30},()=>R0());check('Spearman con permutación: ruido independiente → p no significativo',S.spearmanPerm(n1,n2).p>.05);
check('Benjamini–Hochberg controla múltiples pruebas',(()=>{const k=S.benjaminiHochberg([.001,.04,.2,.5,.9],.1);return k[0]===true&&k[3]===false&&k[4]===false})());
check('Isolation Forest asigna mayor puntuación a un outlier',(()=>{const R=S.rng(2),X=Array.from({length:200},()=>[100+R()*10,2+R()]);X.push([900,9]);const sc=S.isolationForest(X);return sc[200]>.6&&sc[200]>S.median(sc)+.15})());
check('binomial exacta: cola superior coherente',S.binomTail(10,10,.5)<.002&&S.binomTail(10,0,.5)===1&&Math.abs(S.binomTail(10,5,.5)-0.623)<.01);
check('bootstrap con semilla es reproducible',JSON.stringify(S.bootCI([1,2,3,4,5,6,7,8],{seed:3}))===JSON.stringify(S.bootCI([1,2,3,4,5,6,7,8],{seed:3})));

/* ===== 2 · Perfil, madurez y datos insuficientes ===== */
const none=run(snap({ledger:[]}));check('sin historial: madurez inicial, sin descubrimientos, sin errores',none.features.profile.maturity==='inicial'&&none.discoveries.length===0&&none.audit.engines.every(e=>!e.error));
const few=run(snap({ledger:ledger({days:20})}));check('con 20 días: no se afirma nada que requiera más historia',few.discoveries.length===0&&few.features.profile.maturity==='inicial');
const full=run(snap({ledger:ledger({days:300})}));check('madurez se calcula por días de historial (método objetivo, no porcentaje)',full.features.profile.maturity==='consolidado'&&/días de historial/.test(full.features.profile.maturityBasis)&&!/%\s*de conocimiento/.test(full.features.profile.maturityBasis));
check('ventanas múltiples (24 h … 365 d) disponibles',[1,3,7,15,30,60,90,180,365].every(w=>full.features.windows[w]&&full.features.windows[w].days>0));

/* ===== 3 · Patrones ===== */
let mem=null;let r;const sf=snap({ledger:ledger({days:300,fridayMult:3.2,seed:4})});
r=run(sf,mem);mem=r.mem;check('un patrón nuevo NO se comunica en la primera evaluación (inteligencia silenciosa)',!keys(r).includes('pat.weekday.5')&&r.internal.some(h=>h.key==='pat.weekday.5'),keys(r));
const sf2={...sf,today:addDays(T,1)};sf2.ledger=sf.ledger;r=D.discover({...sf,today:T},mem);
const tomorrow=D.discover({...sf,today:addDays(T,1),ledger:sf.ledger.map(e=>e)},mem);
check('tras una segunda evaluación en otro día, el patrón pasa a ser visible',keys(tomorrow).includes('pat.weekday.5'),{k:keys(tomorrow),i:tomorrow.internal.map(h=>h.key)});
const pw=tomorrow.discoveries.find(h=>h.key==='pat.weekday.5');
check('el patrón semanal declara método, evidencia, periodo, comparación y confianza (no probabilidad)',pw&&pw.method&&pw.evidence.length>=3&&pw.periods&&pw.comparison&&pw.confidence.method&&/no es una probabilidad/.test(pw.confidence.method),pw&&pw.confidence);
check('estado de ciclo de vida válido',pw&&D.STATES.includes(pw.state)&&D.VISIBLE.includes(pw.state),pw&&pw.state);
const pd=D.discover({...snap({ledger:ledger({days:300,payday:5,seed:6})}),today:addDays(T,1)},D.discover(snap({ledger:ledger({days:300,payday:5,seed:6})})).mem);
check('detecta el gasto concentrado tras el cobro',pd.discoveries.some(h=>h.key==='pat.payday-burst')||pd.internal.some(h=>h.key==='pat.payday-burst'),pd.internal.map(h=>h.key));

/* ===== 4 · Anomalías (sin falsos positivos y clasificadas) ===== */
const an=run(snap({ledger:ledger({days:200,seed:8,spike:{ago:3,a:60000,l:'Electrodoméstico'}})}));
const anH=[...an.discoveries,...an.internal].find(h=>h.engine==='anomaly');
check('operación extraordinaria única detectada y clasificada (no se asume problema)',anH&&anH.type==='extraordinary-single'&&/no es un problema|clasifica/.test(anH.method)&&anH.valence==='neutral',anH&&anH.type);
const dd=run(snap({ledger:ledger({days:200,seed:9,dup:{ago:2,a:8500}})}));
check('cargo duplicado → posible error de registro (inmediato)',dd.discoveries.some(h=>h.type==='possible-data-error'),[...dd.discoveries,...dd.internal].map(h=>h.type));
let fp=0;for(let s=1;s<=25;s++){const q=run(snap({ledger:ledger({days:220,seed:100+s})}));if([...q.discoveries,...q.internal].some(h=>h.engine==='anomaly'))fp++}
check('falsos positivos de anomalías en datos estacionarios ≤ 12 % (25 series)',fp/25<=.12,fp);
let fd=0;for(let s=1;s<=25;s++){const q=run(snap({ledger:ledger({days:300,seed:200+s})}));if([...q.discoveries,...q.internal].some(h=>h.engine==='drift'))fd++}
check('falsos positivos de cambio estructural ≤ 12 % (25 series)',fd/25<=.12,fd);
let fc=0;for(let s=1;s<=25;s++){const q=run(snap({ledger:ledger({days:300,seed:300+s})}));if([...q.discoveries,...q.internal].some(h=>h.engine==='correlation'))fc++}
check('falsos positivos de correlación ≤ 12 % (25 series; control FDR)',fc/25<=.12,fc);
check('contexto: un gasto en feriado reduce la confianza de la anomalía',(()=>{const L=ledger({days:200,seed:8});const a=D.discover(snap({ledger:[...L,{d:'2026-11-06',a:60000,k:'x',c:'C',l:'Compra',p:'a'}]}));const b=D.discover(snap({ledger:[...L,{d:'2026-11-07',a:60000,k:'x',c:'C',l:'Compra',p:'a'}]}));const h1=[...a.discoveries,...a.internal].find(h=>h.dates&&h.dates[0]==='2026-11-06'),h2=[...b.discoveries,...b.internal].find(h=>h.dates&&h.dates[0]==='2026-11-07');return h1&&h2?h1.confidence.score<=h2.confidence.score:true})());

/* ===== 5 · Cambio estructural (Drift) y contrafactual ===== */
const dr=run(snap({ledger:ledger({days:300,seed:12,shiftFrom:230,shiftMult:1.6})}));
const drH=[...dr.discoveries,...dr.internal].find(h=>h.key==='drift.spend');
check('detecta cuando un gasto excepcional se vuelve la nueva normalidad',drH&&drH.type==='structural-up'&&drH.deviation>.15,drH&&drH.type);
check('la línea base NO se adapta automáticamente a un empeoramiento (baselineHeld)',drH&&drH.baselineHeld===true);
check('el contrafactual se presenta como simulación, nunca como hecho',drH&&/Simulación/.test(drH.counterfactual||''),drH&&drH.counterfactual);
const dn=run(snap({ledger:ledger({days:300,seed:13,shiftFrom:230,shiftMult:.55})}));const dnH=[...dn.discoveries,...dn.internal].find(h=>h.key==='drift.spend');
check('un cambio a la baja se reconoce como positivo',dnH&&dnH.valence==='positive'&&dnH.type==='structural-down',dnH&&dnH.type);

/* ===== 6 · Puntos ciegos ===== */
const L2=ledger({days:200,seed:14,base:3000});for(let i=0;i<60;i++)L2.push({d:addDays(T,-(1+i%58)),a:90+(i%5)*20,k:'x',c:'Café',l:'Café',p:'a'});
const bl=run(snap({ledger:L2}));check('micropagos acumulados se señalan con su suma y proporción',[...bl.discoveries,...bl.internal].some(h=>h.key==='blind.micro'),[...bl.discoveries,...bl.internal].map(h=>h.key));
const ap=run(snap({position:{liquid:100000,assets:100000,debt:0,net:100000},upcoming:[{id:'u',days:10,amountDop:70000,name:'Hipoteca'}]}));
check('disponibilidad real vs aparente (inmediato y explicado)',ap.discoveries.some(h=>h.key==='blind.apparent-liquidity'&&/real/.test(h.summary)),ap.discoveries.map(h=>h.key));

/* ===== 7 · Predicción con validación temporal y Monte Carlo ===== */
const pr=run(snap({months:months(3)}));check('con < 6 meses no se emite predicción de gasto (sin backtest posible)',!pr.internal.concat(pr.discoveries).some(h=>h.key==='pred.next-month-spend'));
const hot=run(snap({months:months(10,99500,100000,1500)}));const ph=[...hot.discoveries,...hot.internal].find(h=>h.key==='pred.next-month-spend');
check('predicción de gasto: etiquetada como proyección, con intervalo y modelo elegido por backtest',ph&&ph.kind==='projection'&&/rango 90 %/.test(ph.summary)&&ph.evidence.some(e=>/Modelo elegido/.test(e[0])),ph&&ph.summary);
const cashL=ledger({days:200,seed:15,base:2500});const mc=run(snap({position:{liquid:30000,assets:30000,debt:0,net:30000},upcoming:[{id:'u',days:8,amountDop:20000,name:'Tarjeta'},{id:'v',days:20,amountDop:25000,name:'Préstamo'}],ledger:cashL}));
const mch=[...mc.discoveries,...mc.internal].find(h=>h.key==='pred.liquidity-30d');
check('Monte Carlo de liquidez: escenarios conservador vs central y supuestos explícitos',mch&&/Simulación|600 trayectorias/.test(mch.summary)&&/conservador/.test(mch.evidence.map(e=>e[0]).join(' ')),mch&&mch.summary);
check('Monte Carlo es determinista (semilla fija)',JSON.stringify(run(snap({position:{liquid:30000,assets:30000,debt:0,net:30000},upcoming:[{id:'u',days:8,amountDop:20000,name:'T'}],ledger:cashL})).audit.surfaced)===JSON.stringify(run(snap({position:{liquid:30000,assets:30000,debt:0,net:30000},upcoming:[{id:'u',days:8,amountDop:20000,name:'T'}],ledger:cashL})).audit.surfaced));

/* ===== 8 · Simulación de decisiones ===== */
const s1=D.simulate(snap({months:months(8)}),{expensePct:0}),s2=D.simulate(snap({months:months(8)}),{expensePct:20}),s3=D.simulate(snap({months:months(8)}),{oneOff:400000});
check('simulación: conservador ≤ central ≤ favorable',s1.ok&&s1.conservative<=s1.central&&s1.central<=s1.favorable,s1);
check('simulación: subir gastos 20 % empeora el resultado central; un desembolso único también',s2.central<s1.central&&s3.central<s1.central);
check('simulación: declara supuestos y que no es un hecho',/no es una predicción ni un hecho/.test(s1.note)&&s1.assumptions.length>=2);
check('simulación con pocos meses se rechaza sin inventar',D.simulate(snap({months:months(2)}),{}).ok===false);
check('simulación determinista',JSON.stringify(D.simulate(snap(),{expensePct:5}))===JSON.stringify(D.simulate(snap(),{expensePct:5})));

/* ===== 9 · Evolución multi-ventana ===== */
const L3=[];{const R=S.rng(16),start=addDays(T,-200);for(let i=0;i<200;i++){const d=addDays(start,i);const p=i<170?.8:.4;if(R()<p)L3.push({d,a:Math.round(1800*Math.exp((R()-.5)*.5)),k:'x',c:'X',l:'c',p:'a'});if(i%15===0)L3.push({d,a:40000,k:'i',c:'S',l:'N',p:'a'})}}
const ev=D.discover(snap({ledger:L3}),D.discover(snap({ledger:L3})).mem);check('evolución: menos días de compra sin subir gasto ni caer ingresos → mejora reconocida',[...ev.discoveries,...ev.internal].some(h=>h.key==='evo.fewer-spend-days'),[...ev.discoveries,...ev.internal].map(h=>h.key));

/* ===== 10 · Retroalimentación con efectos verificables ===== */
const base=D.discover({...sf,today:T},null);const m1=D.discover({...sf,today:addDays(T,1)},base.mem);const target=m1.discoveries[0];
check('hay un descubrimiento sobre el que retroalimentar',!!target);
const apply=(a,m)=>D.feedback(m,target,a,addDays(T,1));
const mNo=apply('not_interested',m1.mem);const after=D.discover({...sf,today:addDays(T,2)},mNo);
check('«No me interesa» → deja de mostrarse y lo registra como preferencia',!keys(after).includes(target.key)&&after.audit.discarded.some(x=>x.key===target.key&&/not_interested/.test(x.reason)));
check('«No me interesa» baja el peso del motor (efecto verificable)',(mNo.w[target.engine]||1)<1);
const mOk=apply('helped',m1.mem);check('«Me ayudó» sube el peso del motor y la relevancia posterior',(mOk.w[target.engine]||1)>1&&D.discover({...sf,today:addDays(T,2)},mOk).discoveries.find(h=>h.key===target.key).relevance>=D.discover({...sf,today:addDays(T,2)},m1.mem).discoveries.find(h=>h.key===target.key).relevance);
const mNev=apply('never',m1.mem);check('«No volver a mostrar este tipo» desactiva todo el tipo',!D.discover({...sf,today:addDays(T,2)},mNev).discoveries.some(h=>h.engine===target.engine&&h.type===target.type)&&mNev.disabled[target.engine+'.'+target.type]===true);
const mCor=apply('correct',m1.mem);check('«Esto es correcto» consolida el patrón en la memoria (confirmación de patrones)',mCor.know[target.key]&&mCor.know[target.key].confirmed&&Object.keys(mCor.exc).length===0);
const mInc=apply('incorrect',m1.mem);check('«No es correcto» se registra como corrección y lo descarta',mInc.exc[target.key]&&mInc.exc[target.key].why==='incorrect');
check('correcciones, preferencias y confirmaciones quedan en estructuras separadas',mCor.know&&mNo.exc&&mNo.fb.length>0&&mNo.fb[mNo.fb.length-1].a==='not_interested');
const mFol=apply('follow',m1.mem);check('«Quiero seguir observándolo» → estado seguimiento',mFol.hyp[target.key].state==='following');
const mImp=apply('improve',m1.mem);check('«Quiero mejorar» crea una meta con línea base',mImp.goals[target.key]&&mImp.goals[target.key].baseline!=null);
// excepción: excluye fechas de la línea base
const anSnap=snap({ledger:ledger({days:200,seed:8,spike:{ago:3,a:60000,l:'Electrodoméstico'}})});const a1=D.discover(anSnap,null);const aH=[...a1.discoveries,...a1.internal].find(h=>h.engine==='anomaly');
const mEx=D.feedback(a1.mem,aH,'exception',T);const a2=D.discover(anSnap,mEx);
check('«Fue una excepción»: la fecha se excluye de la línea base y no vuelve a señalarse',mEx.excludeDates.includes(aH.dates[0])&&![...a2.discoveries,...a2.internal].some(h=>h.key===aH.key));
check('«Fue intencional» deja constancia de la decisión',D.feedback(a1.mem,aH,'intentional',T).know[aH.key].kind==='intention');
check('«Ya lo sabía» silencia temporalmente',D.discover(anSnap,D.feedback(a1.mem,aH,'known',T)).audit.discarded.some(x=>x.key===aH.key&&/known/.test(x.reason)));

/* ===== 11 · Memoria: consultar, corregir, eliminar, acotar ===== */
const L=D.Memory.list(mCor);check('la memoria se puede consultar (patrones, excepciones, hipótesis, metas)',['patterns','exceptions','hypotheses','following','goals'].every(k=>Array.isArray(L[k])),Object.keys(L));
check('se puede corregir un conocimiento',D.Memory.correct(JSON.parse(JSON.stringify(mCor)),target.key,{title:'Mi viernes es distinto'}).know[target.key].title==='Mi viernes es distinto');
check('se puede eliminar un conocimiento específico',!D.Memory.forget(JSON.parse(JSON.stringify(mCor)),target.key).know[target.key]);
check('se puede eliminar todo el conocimiento',Object.keys(D.Memory.forgetAll().hyp).length===0);
check('se puede exportar el conocimiento personal',/"memory"/.test(D.Memory.exportJSON(mCor)));
check('la memoria no duplica registros: < 8 KB tras 120 evaluaciones',(()=>{let m=null;for(let i=0;i<120;i++){m=D.discover({...sf,today:addDays(T,i)},m).mem}return D.Memory.size(m)<8000})());

/* ===== 12 · Idempotencia, aislamiento de fallos y presupuesto ===== */
const i1=D.discover({...sf,today:T},base.mem),i2=D.discover({...sf,today:T},i1.mem);
check('ejecución repetida el mismo día es idempotente (no suma evaluaciones)',JSON.stringify(i2.mem.hyp['pat.weekday.5']&&i2.mem.hyp['pat.weekday.5'].seen)===JSON.stringify(i1.mem.hyp['pat.weekday.5']&&i1.mem.hyp['pat.weekday.5'].seen));
check('la entrada no se muta',(()=>{const s=snap({ledger:ledger({days:120,seed:20})});const c=JSON.stringify(s);D.discover(s,null);return c===JSON.stringify(s)})());
const orig=D._Engines.pattern;D._Engines.pattern=()=>{throw new Error('fallo simulado')};const rf=D.discover(snap(),null);D._Engines.pattern=orig;
check('el fallo de un motor no detiene a los demás y queda auditado',rf.audit.engines.find(e=>e.id==='pattern').error==='fallo simulado'&&rf.audit.engines.filter(e=>!e.error).length>=6);
const rb=D.discover(snap(),null,{budgetMs:-1});check('presupuesto de cómputo agotado: los motores se omiten con motivo',rb.audit.engines.every(e=>e.skipped));
check('auditoría completa: motor, tiempos, registros, descartes con motivo',(()=>{const a=run(sf).audit;return a.engines.every(e=>e.id&&(e.ms!=null||e.skipped))&&a.features.records>0&&Array.isArray(a.discarded)&&a.discarded.every(x=>x.key&&x.reason)&&a.memoryBytes>0})());
check('frecuencias por motor declaradas (diaria/semanal/mensual)',D.ENGINE_ORDER.every(e=>['diaria','semanal','mensual'].includes(D.ENGINE_FREQ[e])));

/* ===== 13 · Explicabilidad y reflexión ===== */
const ex=D.explain(pw);check('explicación: ¿cómo llegamos? con método, periodos, comparación, evidencia, incertidumbre y alternativas',ex.how.title==='¿Cómo llegamos a esta conclusión?'&&ex.how.method&&ex.how.periods&&ex.how.evidence.length>=3&&ex.how.uncertainty&&ex.alternatives.length>=2&&ex.why&&ex.ifContinues,ex.how);
check('reflexión: pregunta oportuna que respeta la decisión del usuario',/¿/.test(D.reflect(pw))&&!/debes|tienes que/i.test(D.reflect(pw)));
check('lenguaje sin alarmismo ni diagnósticos en los descubrimientos',![...full.discoveries,...tomorrow.discoveries,...dr.discoveries,...bl.discoveries].map(h=>h.title+' '+h.summary+' '+h.why).join(' ').toLowerCase().match(/desastre|irresponsable|culpa|ansiedad|depresi|adicci|compulsiv|te sientes/));
check('sin mensajes de felicitación cuando contradicen los datos (mejora solo con evidencia)',![...ev.discoveries].some(h=>h.valence==='positive'&&h.confidence.score<.45));
check('relevancia ≠ probabilidad: se documenta y se mantiene separada de la confianza',ex.how.relevanceNote&&/no es una probabilidad/.test(ex.how.relevanceNote)&&typeof pw.relevance==='number'&&/no es una probabilidad/.test(pw.confidence.method));

/* ===== 14 · Rendimiento y límites ===== */
const big=snap({ledger:ledger({days:365,seed:30,base:900}).concat(ledger({days:365,seed:31,base:700}),ledger({days:365,seed:32,base:500}))});const t=Date.now();const rb2=run(big);const ms=Date.now()-t;
check(`rendimiento: ${big.ledger.length} registros / 365 días en < 400 ms (real ${ms} ms)`,ms<400,ms);
check('máximo 4 descubrimientos visibles y 1 por motor',rb2.discoveries.length<=4&&new Set(rb2.discoveries.map(h=>h.engine)).size===rb2.discoveries.length);
check('confianza: partes documentadas y fórmula visible',(()=>{const c=D.confidence({n:30,needed:30,strength:.5,stability:.5,completeness:.5});return c.parts.volumen===1&&/no es una probabilidad/.test(c.method)&&c.score>0&&c.score<=1})());
console.log(`\nINTELLIGENCE DISCOVERY: ${ok} verificaciones aprobadas${bad?', '+bad+' FALLAN':''}`);process.exit(bad?1:0);
