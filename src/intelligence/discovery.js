/* ============================================================================
   VIVE · INTELLIGENCE — motor de descubrimiento adaptativo (fase 2–5, local).
   Flujo: datos → características (una sola vez) → motores → hipótesis → validación estadística →
          confianza → priorización → silencio/comunicación → retroalimentación → memoria.

   Motores operativos y probados:
     pattern (día de la semana, ventana posterior al cobro) · anomaly (z robusto + Isolation Forest + contexto)
     drift (CUSUM) · blindspot (micropagos, disponibilidad real vs aparente) · correlation (Spearman + permutación + FDR)
     prediction (selección por backtest temporal, intervalos; Monte Carlo de liquidez) · evolution (multi-ventana)
     sequence (cobro → gasto grande, prueba binomial) · counterfactual (simulación, nunca hecho)
     simulation (bajo demanda) · confidence · priority · reflection · memory/learning
   Planificados (NO operativos): behavior avanzado, relaciones con bienestar/garaje/metas (la app no guarda esos datos).
   Sin DOM, sin red, sin temporizadores. Determinista (aleatoriedad con semilla).
   ========================================================================== */
(function(root){
 'use strict';
 const S=(typeof require==='function'&&typeof module==='object')?require('./stats.js'):root.ViveStats;
 const ST=()=>(typeof require==='function'&&typeof module==='object')?require('./strategy.js'):root.ViveStrategy;
 const VERSION='3.0.0';
 const DAY=86400000;
 const num=x=>Number.isFinite(Number(x))?Number(x):0;
 const dms=d=>Date.parse(d+'T00:00:00Z');
 const addDays=(d,n)=>new Date(dms(d)+n*DAY).toISOString().slice(0,10);
 const diff=(a,b)=>Math.round((dms(a)-dms(b))/DAY);
 const wd=d=>new Date(dms(d)).getUTCDay();            // 0=domingo
 const fmt=v=>'RD$'+Math.round(Math.abs(num(v))).toLocaleString('es-DO');
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const WD=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
 const HOLIDAYS=['01-01','01-06','01-21','02-27','05-01','08-16','09-24','11-06','12-25']; // feriados de fecha fija (RD)
 const isHoliday=d=>HOLIDAYS.includes(d.slice(5));

 /* ---------- Estados del ciclo de vida ---------- */
 const STATES=['observation','hypothesis','learning','following','pattern','discovery','opportunity','anticipation','positive','risk','priority','resolved','discarded'];
 const VISIBLE=new Set(['pattern','discovery','opportunity','anticipation','positive','risk','priority','following']);

 /* ==========================================================================
    MEMORIA — conocimiento derivado (no duplica registros). Consultable, corregible y eliminable.
    ========================================================================== */
 const Memory={
  empty(){return {v:2,hyp:{},know:{},exc:{},prefs:{},disabled:{},w:{},goals:{},excludeDates:[],fb:[],audit:{runs:0,last:null}}},
  norm(m){const e=Memory.empty();if(!m||typeof m!=='object')return e;return Object.assign(e,m,{hyp:m.hyp||{},know:m.know||{},exc:m.exc||{},prefs:m.prefs||{},disabled:m.disabled||{},w:m.w||{},goals:m.goals||{},excludeDates:Array.isArray(m.excludeDates)?m.excludeDates:[],fb:Array.isArray(m.fb)?m.fb:[],audit:m.audit||{runs:0,last:null}})},
  /* poda: mantiene el conocimiento acotado (< ~8 KB) */
  prune(m,today){
   for(const k of Object.keys(m.hyp)){const h=m.hyp[k];if(diff(today,h.last)>30&&!m.know[k])delete m.hyp[k]}
   const ks=Object.keys(m.hyp);if(ks.length>40)ks.sort((a,b)=>m.hyp[a].last.localeCompare(m.hyp[b].last)).slice(0,ks.length-40).forEach(k=>delete m.hyp[k]);
   for(const k of Object.keys(m.exc))if(m.exc[k].until&&m.exc[k].until<today)delete m.exc[k];
   m.excludeDates=[...new Set(m.excludeDates)].filter(d=>diff(today,d)<400).slice(-60);
   m.fb=m.fb.slice(-30);
   return m;
  },
  size:m=>JSON.stringify(m).length,
  /* consultas y gestión */
  list(m){return {patterns:Object.entries(m.know).filter(([,v])=>v.kind==='pattern').map(([k,v])=>({key:k,...v})),
    exceptions:Object.entries(m.exc).map(([k,v])=>({key:k,...v})),
    hypotheses:Object.entries(m.hyp).filter(([k,h])=>!m.know[k]&&['hypothesis','observation','learning'].includes(h.state)).map(([k,h])=>({key:k,...h})),
    following:Object.entries(m.hyp).filter(([,h])=>h.state==='following').map(([k,h])=>({key:k,...h})),
    goals:Object.entries(m.goals).map(([k,v])=>({key:k,...v})),prefs:m.prefs,disabled:m.disabled,weights:m.w}},
  forget(m,key){delete m.hyp[key];delete m.know[key];delete m.exc[key];delete m.goals[key];return m},
  forgetAll(){return Memory.empty()},
  correct(m,key,patch){if(m.know[key])Object.assign(m.know[key],patch,{corrected:true});return m},
  exportJSON(m){return JSON.stringify({exportedAt:new Date().toISOString(),version:VERSION,memory:m},null,1)}
 };

 /* ==========================================================================
    CARACTERÍSTICAS — se calculan UNA vez por ejecución y las reutilizan todos los motores
    ========================================================================== */
 function buildFeatures(snap,mem){
  const t0=Date.now();const today=snap.today,end=addDays(today,-1);           // solo días completos
  const led=(snap.ledger||[]).filter(e=>e&&e.d<=end);
  const excl=new Set(mem.excludeDates||[]);
  const first=led.length?led.reduce((m,e)=>e.d<m?e.d:m,led[0].d):null;
  const span=first?diff(end,first)+1:0;
  const N=Math.min(span,365);const start=addDays(end,-(N-1));
  const day={};for(let i=0;i<N;i++)day[addDays(start,i)]={x:0,n:0,i:0,max:0,card:0,acct:0,small:0};
  const amounts=[];
  for(const e of led){const r=day[e.d];if(!r)continue;
   if(e.k==='x'){r.x+=e.a;if(e.a>0){r.n++;r.max=Math.max(r.max,e.a);amounts.push(e.a);if(e.p==='c')r.card+=e.a;else r.acct+=e.a}}
   else if(e.k==='i')r.i+=e.a;}
  const dates=Object.keys(day).sort();
  const days=dates.map(d=>({d,...day[d],wd:wd(d),ex:excl.has(d)}));
  const active=days.filter(r=>r.x>0).length;
  const coverage=N?active/N:0;
  // semanas completas (lunes a domingo) hacia atrás
  const weeks=[];{let i=days.length-1;while(i>=0&&days[i].wd!==0)i--;           // terminar en domingo
   for(let e=i;e-6>=0;e-=7){const w=days.slice(e-6,e+1);weeks.unshift({start:w[0].d,x:S.sum(w.map(r=>r.x)),n:S.sum(w.map(r=>r.n)),i:S.sum(w.map(r=>r.i)),card:S.sum(w.map(r=>r.card)),acct:S.sum(w.map(r=>r.acct)),weekend:w.filter(r=>r.wd===0||r.wd===6).reduce((s,r)=>s+r.x,0),small:0})}}
  const smallT=Math.min(500,S.quantile(amounts,.25)||0);
  for(const e of led){if(e.k==='x'&&e.a>0&&e.a<=smallT){const w=weeks.find(w=>e.d>=w.start&&e.d<=addDays(w.start,6));if(w)w.small++}}
  const incomes=led.filter(e=>e.k==='i'&&e.a>0);const medInc=S.median(incomes.map(e=>e.a));
  const paydays=[...new Set(incomes.filter(e=>e.a>=Math.max(1000,medInc*.5)).map(e=>e.d))].sort();
  // ventanas múltiples (24 h … histórico)
  const windows={};for(const w of [1,3,7,15,30,60,90,180,365]){const sl=days.slice(-w);windows[w]={days:sl.length,spend:S.sum(sl.map(r=>r.x)),count:S.sum(sl.map(r=>r.n)),income:S.sum(sl.map(r=>r.i)),spendDays:sl.filter(r=>r.x>0).length}}
  const nz=days.filter(r=>r.x>0&&!r.ex).map(r=>r.x);
  const profile={historyDays:span,coverage:+coverage.toFixed(2),weeks:weeks.length,records:led.length,
   dailyRange:nz.length>=10?S.personalRange(nz):null,medianTicket:S.median(amounts),
   maturity:span<30?'inicial':span<90?'en formación':span<180?'básico':span<365?'consolidado':'amplio',
   maturityBasis:`Se calcula solo con los días de historial (${span}) y la proporción de días con actividad (${Math.round(coverage*100)} %); no es un porcentaje de conocimiento.`};
  return {today,end,days,weeks,paydays,windows,profile,amounts,medInc,ms:Date.now()-t0};
 }

 /* ==========================================================================
    CONFIANZA — puntuación de evidencia (0–1). NO es una probabilidad.
    ========================================================================== */
 function confidence({n,needed,strength,stability,completeness}){
  const size=clamp(n/needed),str=clamp(strength),stab=clamp(stability==null?.6:stability),comp=clamp(completeness==null?.7:completeness);
  const score=+(.35*size+.30*str+.20*stab+.15*comp).toFixed(2);
  return {score,level:score>=.75?'alta':score>=.55?'media':'baja',parts:{volumen:+size.toFixed(2),fuerza:+str.toFixed(2),estabilidad:+stab.toFixed(2),calidad:+comp.toFixed(2)},
   method:'0,35·volumen + 0,30·fuerza del efecto + 0,20·estabilidad + 0,15·calidad de datos. Es una puntuación de evidencia; no es una probabilidad.'};
 }

 /* ==========================================================================
    MOTORES — cada uno devuelve hipótesis {key,engine,type,…}; los fallos de uno no afectan a los demás
    ========================================================================== */
 const H=(o)=>Object.assign({kind:'fact',valence:'neutral',urgency:.2,impact:0,modules:['overview'],category:'habits',alternatives:[],evidence:[],minSeen:2},o);

 const Engines={};
 Engines.shadow=(F,snap,mem)=>{const st=ST();return st?st.shadow(F,snap,mem,confidence):[]};
 /* --- Pattern: día de la semana y ventana posterior al cobro --- */
 Engines.pattern=F=>{
  const out=[];const d=F.days.filter(r=>!r.ex);if(F.profile.historyDays<70)return out;
  const all=S.mean(d.map(r=>r.x));if(!(all>0))return out;
  for(let w=0;w<7;w++){const v=d.filter(r=>r.wd===w).map(r=>r.x);if(v.length<10)continue;const m=S.mean(v);if(m<all*1.6)continue;
   const ci=S.bootCI(v,{seed:3+w});const lowAbove=ci&&S.mean(v)>0&&ci.high>=0&&S.quantile(v,.5)>all*0.5;
   const bm=(function(){const R=S.rng(100+w);const bs=[];for(let i=0;i<300;i++)bs.push(S.mean(S.bootstrap(v,v.length,R)));return S.quantile(bs,.05)})();
   if(!(bm>all*1.25))continue;
   const impact=(m-all)*4.3;if(impact<1500)continue;
   out.push(H({key:'pat.weekday.'+w,engine:'pattern',type:'weekday-peak',category:'spending',title:`Tus ${WD[w]}s concentran más gasto`,
    summary:`En promedio gastas ${fmt(m)} los ${WD[w]}s, frente a ${fmt(all)} en un día cualquiera (${(m/all).toFixed(1)}×).`,
    observed:m,baseline:all,deviation:m/all-1,impact,confidence:confidence({n:v.length,needed:20,strength:Math.min(1,(m/all-1.25)/1.5+.4),stability:bm/all>1.4?.9:.65,completeness:F.profile.coverage+.3}),
    evidence:[['Promedio los '+WD[w]+'s',fmt(m)],['Promedio diario general',fmt(all)],['Días analizados',String(v.length)],['Límite inferior (90 %)',fmt(bm)]],
    method:'Media por día de la semana con intervalo bootstrap (300 remuestreos). Se exige que el límite inferior supere 1,25× el promedio general.',
    periods:`${d.length} días completos`,comparison:'frente al promedio diario de tus demás días',recurrence:`${v.length} ${WD[w]}s observados`,
    why:'Saber en qué día se concentra el gasto permite planificar antes ese día.',ifContinues:`Equivale a unos ${fmt(impact)} al mes por encima de un día típico.`,
    alternatives:['Anticipar el presupuesto del día','Mover compras grandes a otro día','Dejarlo igual si es intencional'],action:{label:'Ver movimientos',target:'register'},modules:['register','overview']}))}
  // posterior al cobro
  if(F.paydays.length>=3){const all3=all*3;const sums=[];for(const p of F.paydays){const i=F.days.findIndex(r=>r.d===p);if(i<7||i+2>=F.days.length)continue;sums.push(F.days[i].x+F.days[i+1].x+F.days[i+2].x)}
   if(sums.length>=3){const m=S.median(sums);const above=sums.filter(s=>s>all3*1.3).length/sums.length;
    if(m>all3*1.5&&above>=.7){const impact=(m-all3)*(30/ (S.mean(F.paydays.slice(1).map((p,i)=>diff(p,F.paydays[i])))||30));
     out.push(H({key:'pat.payday-burst',engine:'pattern',type:'post-payday',category:'spending',title:'Tu dinero se adelanta a tu cobro',
      summary:`En los 3 días siguientes a cobrar sueles gastar ${fmt(m)}, ${(m/all3).toFixed(1)}× lo normal de 3 días (${fmt(all3)}).`,observed:m,baseline:all3,deviation:m/all3-1,impact,
      confidence:confidence({n:sums.length,needed:8,strength:Math.min(1,(m/all3-1)/1.5),stability:above,completeness:F.profile.coverage+.3}),
      evidence:[['Gasto mediano en los 3 días tras cobrar',fmt(m)],['Gasto típico de 3 días',fmt(all3)],['Cobros analizados',String(sums.length)],['Cobros con gasto elevado',Math.round(above*100)+' %']],
      method:'Mediana del gasto de las 72 h posteriores a cada ingreso de nómina frente a 3× el promedio diario; se exige repetición en ≥ 70 % de los cobros.',periods:`${sums.length} ciclos de cobro`,comparison:'frente a tus días sin cobro',recurrence:`${Math.round(above*100)} % de los cobros`,
      why:'Un gasto concentrado justo después de cobrar suele dejar menos margen hacia el final del ciclo.',ifContinues:'Si se mantiene, la liquidez del final del ciclo seguirá siendo la más baja.',alternatives:['Separar al cobrar lo que cubre compromisos','Repartir las compras grandes en el ciclo','Es intencional'],
      action:{label:'Ver presupuesto',target:'budget'},modules:['overview','income','register']}))}}}
  return out;
 };
 /* --- Anomaly: z robusto + Isolation Forest (consenso) con contexto --- */
 Engines.anomaly=(F,snap,mem)=>{
  const out=[];const d=F.days;if(F.profile.historyDays<45)return out;
  const base=d.filter(r=>r.x>0&&!r.ex);if(base.length<20)return out;
  const X=base.map(r=>[r.x,r.n,r.max,r.wd]);const sc=S.isolationForest(X,{seed:13});const iso=new Map(base.map((r,i)=>[r.d,sc[i]]));
  const vals=base.map(r=>r.x);const cutoff=addDays(F.end,-13);
  const flagged=[];for(const r of base){if(r.d<cutoff)continue;const z=S.robustZ(r.x,vals);if(z>=3.5&&(iso.get(r.d)||0)>=.6)flagged.push({...r,z,iso:iso.get(r.d)})}
  if(!flagged.length)return out;
  const ledger=(snap.ledger||[]);
  for(const f of flagged){
   const tx=ledger.filter(e=>e.d===f.d&&e.k==='x'&&e.a>0).sort((a,b)=>b.a-a.a);
   const dup=tx.some((e,i)=>tx.findIndex((o,j)=>j!==i&&o.a===e.a&&String(o.l||'')===String(e.l||''))>=0&&e.a>=1000);
   const dominant=tx[0]&&tx[0].a/f.x>=.7;
   const ctxNotes=[];if(f.wd===0||f.wd===6)ctxNotes.push('fin de semana');if(isHoliday(f.d))ctxNotes.push('feriado');if(F.paydays.some(p=>diff(f.d,p)>=0&&diff(f.d,p)<=2))ctxNotes.push('días posteriores a un cobro');
   const kind=dup?'possible-data-error':dominant?'extraordinary-single':'broad-increase';
   const cls={'possible-data-error':'Posible duplicado o error de registro','extraordinary-single':'Operación extraordinaria única','broad-increase':'Aumento generalizado del gasto del día'}[kind];
   const conf=confidence({n:base.length,needed:60,strength:Math.min(1,f.z/8),stability:f.iso,completeness:F.profile.coverage+.3});if(ctxNotes.length)conf.score=+Math.max(.3,conf.score-.1).toFixed(2);
   out.push(H({key:'anom.day.'+f.d,engine:'anomaly',type:kind,category:'spending',title:kind==='possible-data-error'?`Dos cargos idénticos el ${f.d.slice(8)}/${f.d.slice(5,7)}`:`Un día fuera de tu rango habitual: ${f.d.slice(8)}/${f.d.slice(5,7)}`,
    summary:`${fmt(f.x)} en un día; tu mediana de días con gasto es ${fmt(S.median(vals))}. Clasificación: ${cls}${ctxNotes.length?' · contexto: '+ctxNotes.join(', '):''}.`,observed:f.x,baseline:S.median(vals),deviation:f.z,impact:f.x-S.median(vals),dates:[f.d],
    confidence:conf,evidence:[['Gasto del día',fmt(f.x)],['Mediana personal',fmt(S.median(vals))],['z robusto',f.z.toFixed(1)],['Aislamiento (Isolation Forest)',f.iso.toFixed(2)],['Mayor movimiento del día',tx[0]?fmt(tx[0].a)+' · '+(tx[0].l||'sin detalle'):'—']],
    method:'Un día se marca solo si coinciden dos métodos: z robusto (mediana/MAD) ≥ 3,5 e Isolation Forest ≥ 0,60 (64 árboles, semilla fija). Una anomalía no es un problema por sí misma: se clasifica.',
    periods:`${base.length} días con gasto`,comparison:'frente a tu propia distribución diaria',recurrence:'evento puntual',valence:kind==='possible-data-error'?'neutral':'neutral',
    why:kind==='possible-data-error'?'Un duplicado distorsiona tus saldos y tus indicadores.':'Entender si fue una excepción o el inicio de un cambio evita sacar conclusiones equivocadas.',ifContinues:'Si no se repite, no cambia tu patrón; si se repite, se evaluará como cambio de comportamiento.',
    alternatives:kind==='possible-data-error'?['Revisar y eliminar el duplicado','Es correcto (dos compras iguales)']:['Marcar como excepción (no altera tu línea base)','Marcar como intencional','Seguir observándolo'],
    action:{label:'Ver movimientos',target:'register'},modules:['register','overview'],urgency:.4,minSeen:1,immediate:kind==='possible-data-error',kind:'fact'}))}
  return out.slice(0,2);
 };
 /* --- Drift: cambio estructural con CUSUM sobre el gasto semanal y la frecuencia --- */
 Engines.drift=(F,snap,mem)=>{
  const out=[];const w=F.weeks.slice(-40);if(w.length<16)return out;
  const spend=w.map(x=>x.x);const c=S.cusum(spend,{n0:Math.floor(w.length*.5),k:.6,h:5});
  if(c&&c.shiftPct!=null&&Math.abs(c.shiftPct)>=15){const weeksSince=w.length-(c.start);if(weeksSince>=4){
   const up=c.direction>0;const cum=S.sum(w.slice(c.start).map(x=>x.x-c.baseline));
   out.push(H({key:'drift.spend',engine:'drift',type:up?'structural-up':'structural-down',category:'spending',title:up?'Tu normalidad de gasto está cambiando':'Estás gastando menos de forma sostenida',
    summary:`Desde la semana del ${w[c.start].start.slice(8)}/${w[c.start].start.slice(5,7)} tu gasto semanal pasó de ≈${fmt(c.baseline)} a ≈${fmt(c.after)} (${c.shiftPct>0?'+':''}${Math.round(c.shiftPct)} %), durante ${weeksSince} semanas.`,
    observed:c.after,baseline:c.baseline,deviation:c.shiftPct/100,impact:Math.abs(c.after-c.baseline)*4.3,valence:up?'risk':'positive',
    confidence:confidence({n:weeksSince,needed:8,strength:Math.min(1,Math.abs(c.shiftPct)/40),stability:clamp(weeksSince/10),completeness:F.profile.coverage+.3}),
    evidence:[['Gasto semanal base',fmt(c.baseline)],['Gasto semanal reciente',fmt(c.after)],['Semanas sostenido',String(weeksSince)],['Variación',Math.round(c.shiftPct)+' %']],
    method:'CUSUM bilateral sobre el gasto semanal estandarizado con tu propia línea base (primera mitad del historial; k=0,6σ, h=5σ). Se exige ≥ 4 semanas y ≥ 15 % de cambio.',
    periods:`${w.length} semanas completas`,comparison:'frente a tu línea base anterior',recurrence:`${weeksSince} semanas seguidas`,
    counterfactual:up?`Simulación: si tu gasto semanal hubiera seguido en su rango habitual (≈${fmt(c.baseline)}), tendrías ≈${fmt(cum)} más que hoy.`:null,
    why:up?'Un comportamiento que era excepcional y ya es habitual cambia tu capacidad de ahorro sin que cambie tu ingreso.':'Mantener esta reducción libera margen para tus metas.',ifContinues:up?`Equivale a ≈${fmt(Math.abs(c.after-c.baseline)*4.3)} más al mes.`:'Aumenta tu margen de ahorro mensual.',
    alternatives:up?['Confirmar que es tu nueva normalidad','Marcar como intencional','Fijar una meta para volver al rango anterior']:['Mantenerlo','Redirigir ese margen a una meta'],
    action:{label:'Ver categorías',target:'categories'},modules:['overview','register','budget'],urgency:up?.5:.2,
    baselineHeld:up}))}}
  // frecuencia de consumo
  const fr=w.map(x=>x.n);const cf=S.cusum(fr,{n0:Math.floor(w.length*.5),k:.6,h:5});
  if(cf&&cf.shiftPct!=null&&cf.direction<0&&Math.abs(cf.shiftPct)>=20&&w.length-cf.start>=4&&!out.some(h=>h.type==='structural-up')){
   const spendNow=S.median(spend.slice(cf.start));const spendBase=S.median(spend.slice(0,Math.floor(w.length*.5)));
   if(spendNow<=spendBase*1.05)out.push(H({key:'drift.frequency-down',engine:'drift',type:'frequency-down',category:'habits',title:'Estás comprando con menos frecuencia',summary:`Tus compras semanales bajaron de ≈${Math.round(cf.baseline)} a ≈${Math.round(cf.after)} (${Math.round(cf.shiftPct)} %) sin que suba el gasto total.`,
    observed:cf.after,baseline:cf.baseline,deviation:cf.shiftPct/100,impact:0,valence:'positive',confidence:confidence({n:w.length-cf.start,needed:8,strength:Math.min(1,Math.abs(cf.shiftPct)/40),stability:.7,completeness:F.profile.coverage+.3}),
    evidence:[['Compras por semana (antes)',cf.baseline.toFixed(1)],['Compras por semana (ahora)',cf.after.toFixed(1)],['Gasto semanal mediano',fmt(spendNow)]],method:'CUSUM sobre el número de compras semanales; se confirma que el gasto total no aumentó.',periods:`${w.length} semanas`,comparison:'frente a tu frecuencia anterior',recurrence:`${w.length-cf.start} semanas`,
    why:'Un cambio de frecuencia suele preceder cambios de gasto.',ifContinues:'Si se mantiene, reduce el gasto fragmentado.',alternatives:['Mantenerlo','Es temporal'],action:{label:'Ver movimientos',target:'register'},modules:['overview','register'],urgency:.1}))}
  return out;
 };
 /* --- Blind spot: micropagos y disponibilidad real vs aparente --- */
 Engines.blindspot=(F,snap)=>{
  const out=[];const last60=F.days.slice(-60);const spend=S.sum(last60.map(r=>r.x));
  const led=(snap.ledger||[]).filter(e=>e.k==='x'&&e.a>0&&e.d>=addDays(F.end,-59));
  const thr=Math.min(500,S.quantile(F.amounts,.25)||0);
  if(thr>0&&led.length>=30){const small=led.filter(e=>e.a<=thr);const tot=S.sum(small.map(e=>e.a));const share=spend>0?tot/spend:0;const monthly=tot/2;
   if(small.length>=15&&share>=.04&&monthly>=1500)out.push(H({key:'blind.micro',engine:'blindspot',type:'micro-payments',category:'spending',title:'Pequeños pagos, impacto mayor del que parece',
    summary:`${small.length} pagos de ${fmt(thr)} o menos sumaron ${fmt(tot)} en 60 días (≈${fmt(monthly)} al mes, ${Math.round(share*100)} % de tu gasto).`,observed:tot,baseline:thr,deviation:share,impact:monthly,
    confidence:confidence({n:small.length,needed:40,strength:Math.min(1,share/.12),stability:.7,completeness:F.profile.coverage+.3}),
    evidence:[['Pagos pequeños (60 días)',String(small.length)],['Umbral de «pequeño»',fmt(thr)],['Suma',fmt(tot)],['Parte de tu gasto',Math.round(share*100)+' %']],method:'Pagos ≤ el menor entre RD$500 y tu percentil 25; se reporta cuando suman ≥ 4 % del gasto y ≥ RD$1.500 al mes.',
    periods:'últimos 60 días',comparison:'frente a tu gasto total del periodo',recurrence:`${small.length} pagos`,why:'Individualmente parecen insignificantes; juntos pesan.',ifContinues:`Al ritmo actual, ≈${fmt(monthly*12)} al año.`,
    alternatives:['Agruparlos en una categoría con presupuesto','Revisar cuáles son prescindibles','Es intencional'],action:{label:'Ver presupuesto',target:'budget'},modules:['register','overview','budget'],urgency:.15}))}
  const ap=num(snap.position?.liquid),ob=(snap.upcoming||[]).filter(u=>u.days>=0&&u.days<=30).reduce((s,u)=>s+num(u.amountDop),0);
  if(ap>0&&ob>0){const real=Math.max(0,ap-ob);if(real/ap<.6)out.push(H({key:'blind.apparent-liquidity',engine:'blindspot',type:'apparent-vs-real',category:'liquidity',title:'Tu dinero disponible es menor al que ves en tus cuentas',summary:`Tus cuentas suman ${fmt(ap)}, pero ${fmt(ob)} ya están comprometidos en 30 días: disponibilidad real ≈ ${fmt(real)} (${Math.round(real/ap*100)} %).`,
   observed:real,baseline:ap,deviation:real/ap-1,impact:ob,valence:'risk',confidence:confidence({n:30,needed:30,strength:Math.min(1,(1-real/ap)),stability:.8,completeness:.9}),evidence:[['Liquidez aparente',fmt(ap)],['Compromisos 30 días',fmt(ob)],['Disponibilidad real',fmt(real)]],method:'Liquidez actual menos vencimientos registrados de los próximos 30 días (misma fuente que Presión financiera).',
   periods:'próximos 30 días',comparison:'liquidez aparente vs real',recurrence:'estado actual',why:'Decidir con el saldo aparente puede dejarte sin margen cuando llegan los vencimientos.',ifContinues:'Sin nuevos ingresos, ese es el margen con el que contarías.',alternatives:['Reservar lo comprometido','Revisar el calendario de pagos'],action:{label:'Ver compromisos',target:'pressure'},modules:['overview','banks','pressure'],urgency:.7,minSeen:1,immediate:true,kind:'fact'}))}
  return out;
 };
 /* --- Correlation: Spearman + permutación + FDR (relaciones, nunca causalidad) --- */
 Engines.correlation=(F)=>{
  const out=[];const w=F.weeks.slice(-52);if(w.length<16)return out;
  const col=k=>w.map(x=>x[k]),lag=(a,l)=>l?a.slice(0,-l):a,lead=(a,l)=>l?a.slice(l):a;
  const wkShare=w.map(x=>x.x>0?x.weekend/x.x:0);
  const tests=[['Ingresos de la semana','Gasto de la semana',lag(col('i'),0),lead(col('x'),0),'income-spend0'],
   ['Ingresos de la semana','Gasto de la semana siguiente',lag(col('i'),1),lead(col('x'),1),'income-spend1'],
   ['Ingresos de la semana','Número de compras',col('i'),col('n'),'income-count'],
   ['Parte del gasto en fin de semana','Gasto de la semana siguiente',lag(wkShare,1),lead(col('x'),1),'weekend-next'],
   ['Gasto con tarjeta','Gasto de la semana siguiente',lag(col('card'),1),lead(col('x'),1),'card-next']];
  const res=tests.map((t,i)=>({...t,...S.spearmanPerm(t[2],t[3],{perms:800,seed:21+i})}));
  const keep=S.benjaminiHochberg(res.map(r=>r.p),.1);
  res.forEach((r,i)=>{if(!keep[i]||Math.abs(r.rho)<.45||r.n<16)return;
   out.push(H({key:'corr.'+r[4],engine:'correlation',type:'weekly-correlation',category:'habits',kind:'hypothesis',title:'Hay una coincidencia que merece observarse',
    summary:`${r[0]} y «${r[1].toLowerCase()}» se mueven ${r.rho>0?'juntos':'en sentido contrario'} (ρ = ${r.rho.toFixed(2)}, ${r.n} semanas). Es una relación estadística, no una causa demostrada.`,observed:r.rho,baseline:0,deviation:r.rho,impact:0,
    confidence:confidence({n:r.n,needed:30,strength:Math.min(1,Math.abs(r.rho)/.7),stability:1-r.p,completeness:F.profile.coverage+.3}),evidence:[['Variable A',r[0]],['Variable B',r[1]],['Correlación de Spearman',r.rho.toFixed(2)],['Valor p (permutación, 800)',r.p.toFixed(3)],['Semanas',String(r.n)]],
    method:'Spearman con valor p por permutación y control de falsos descubrimientos Benjamini–Hochberg (q = 0,10) sobre las 5 relaciones evaluadas. Se exige |ρ| ≥ 0,45 y ≥ 16 semanas.',periods:`${r.n} semanas`,comparison:'frente a lo esperable por azar (permutaciones)',recurrence:'relación temporal',
    why:'Una relación repetida puede ayudarte a anticipar tu propio comportamiento.',ifContinues:'Necesita más evidencia antes de considerarla un patrón.',alternatives:['Seguir observándola','No me interesa','Puede ser estacionalidad (ciclo de cobro)'],action:{label:'Ver flujo',target:'income'},modules:['overview','income'],urgency:.05,minSeen:3}))});
  return out;
 };
 /* --- Prediction: selección de modelo por backtest temporal + Monte Carlo de liquidez --- */
 Engines.prediction=(F,snap)=>{
  const out=[];const ms=(snap.months||[]).filter(m=>!m.partial&&m.txCount>0).map(m=>({e:num(m.expense),i:num(m.income)}));
  const ex=ms.map(m=>m.e);const inc=ms.map(m=>m.i).filter(v=>v>0);
  let model=null;
  if(ex.length>=6){const cand={naive:a=>a[a.length-1],media3:a=>S.mean(a.slice(-3)),ewma:a=>S.ewma(a,.5).slice(-1)[0]};const errs={};
   for(const [k,f] of Object.entries(cand)){errs[k]=[];for(let t=3;t<ex.length;t++)errs[k].push(Math.abs(ex[t]-f(ex.slice(0,t))))}
   const mae=k=>S.mean(errs[k]);let best='naive';for(const k of Object.keys(cand))if(mae(k)<mae(best)*.95)best=k;
   const resid=[];for(let t=3;t<ex.length;t++)resid.push(ex[t]-cand[best](ex.slice(0,t)));
   model={name:best,mae:mae(best),naiveMae:mae('naive'),pred:cand[best](ex),sigma:Math.max(S.stdev(resid),S.mad(resid)),n:ex.length-3};
  }
  if(model&&inc.length>=3){const income=S.median(inc);const z=(income-model.pred)/(model.sigma||1);const P=1-normCdf(z);
   if(P>=.25&&model.pred+model.sigma>income*.95)out.push(H({key:'pred.next-month-spend',engine:'prediction',type:'spend-vs-income',category:'spending',kind:'projection',title:'Tu gasto del próximo mes podría acercarse a tus ingresos',
    summary:`Proyección: gasto ≈ ${fmt(model.pred)} (rango 90 %: ${fmt(model.pred-1.64*model.sigma)}–${fmt(model.pred+1.64*model.sigma)}) frente a un ingreso mediano de ${fmt(income)}. Probabilidad estimada de que lo supere: ${Math.round(P*100)} %.`,
    observed:model.pred,baseline:income,deviation:model.pred/income-1,impact:Math.max(0,model.pred-income),valence:'risk',
    confidence:confidence({n:model.n,needed:9,strength:model.mae<model.naiveMae?.8:.5,stability:1-clamp(model.sigma/(model.pred||1)),completeness:.8}),
    evidence:[['Modelo elegido',model.name+' (por backtest temporal)'],['Error medio del modelo',fmt(model.mae)],['Error del modelo ingenuo',fmt(model.naiveMae)],['Meses usados',String(ex.length)]],
    method:'Se comparan 3 modelos (último mes, media de 3 meses, EWMA 0,5) con validación temporal rodante; se usa el de menor error y solo si mejora ≥ 5 % al ingenuo. El intervalo sale de los errores históricos.',periods:`${ex.length} meses completos`,comparison:'frente a tu ingreso mediano',recurrence:'proyección',
    why:'Anticipar el mes con intervalos permite decidir antes de que ocurra.',ifContinues:'Si ocurre, tu margen de ahorro sería mínimo o negativo.',alternatives:['Ajustar categorías variables','Esperar: es una proyección','Revisar ingresos esperados'],action:{label:'Ver presupuesto',target:'budget'},modules:['overview','budget'],urgency:.45,minSeen:2}))}
  // Monte Carlo de liquidez a 30 días
  const cashDays=F.days.slice(-90).map(r=>r.acct);if(cashDays.filter(v=>v>0).length>=15&&num(snap.position?.liquid)>0){
   const R=S.rng(77),liq=num(snap.position.liquid);const sched={};for(const u of snap.upcoming||[]){if(u.days>=1&&u.days<=30)sched[u.days]=(sched[u.days]||0)+num(u.amountDop)}
   let nextIncome=null;if(F.paydays.length>=3){const gaps=F.paydays.slice(1).map((p,i)=>diff(p,F.paydays[i]));const g=Math.round(S.median(gaps));const idx=Math.max(1,Math.min(30,g-diff(F.today,F.paydays[F.paydays.length-1])));if(g>0&&g<=45)nextIncome={day:idx,amt:S.median((snap.ledger||[]).filter(e=>e.k==='i'&&F.paydays.includes(e.d)).map(e=>e.a))}}
   const run=(withIncome)=>{let bad=0;const firsts=[];for(let s=0;s<600;s++){let b=liq,first=0;for(let d=1;d<=30;d++){b-=cashDays[Math.floor(R()*cashDays.length)];b-=sched[d]||0;if(withIncome&&nextIncome&&d===nextIncome.day)b+=nextIncome.amt;if(b<0&&!first){first=d}}if(first){bad++;firsts.push(first)}}return {p:bad/600,day:firsts.length?S.median(firsts):null}};
   const cons=run(false),cent=nextIncome?run(true):null;
   if(cons.p>=.2)out.push(H({key:'pred.liquidity-30d',engine:'prediction',type:'liquidity-pressure',category:'liquidity',kind:'projection',title:'Días de posible presión de liquidez',
    summary:`Simulación de 30 días (600 trayectorias): sin nuevos ingresos hay ${Math.round(cons.p*100)} % de trayectorias donde tu liquidez se agota${cons.day?`, típicamente hacia el día ${cons.day}`:''}${cent?`; contando tu cobro habitual, baja a ${Math.round(cent.p*100)} %`:''}.`,observed:cons.p,baseline:0,deviation:cons.p,impact:0,valence:'risk',
    confidence:confidence({n:cashDays.filter(v=>v>0).length,needed:45,strength:cons.p>=.5?.9:.6,stability:.6,completeness:F.profile.coverage+.3}),evidence:[['Liquidez actual',fmt(liq)],['Vencimientos próximos 30 días',fmt(S.sum(Object.values(sched)))],['Escenario conservador (sin ingresos)',Math.round(cons.p*100)+' %'],['Escenario central (con tu cobro habitual)',cent?Math.round(cent.p*100)+' %':'sin ciclo de cobro detectable']],
    method:'Monte Carlo: gasto diario con cargo a cuentas remuestreado de tus últimos 90 días + vencimientos registrados; semilla fija. No es una probabilidad calibrada: es una estimación con supuestos explícitos.',periods:'próximos 30 días',comparison:'conservador vs central',recurrence:'proyección',
    why:'Ver los días críticos antes de que lleguen deja tiempo para decidir.',ifContinues:'Sin cambios, podrías necesitar mover fechas o reducir gasto variable.',alternatives:['Reducir gasto variable','Priorizar pagos por fecha','Esperar ingresos'],action:{label:'Ver compromisos',target:'pressure'},modules:['overview','pressure','banks'],urgency:.8,minSeen:1,immediate:cons.p>=.5}))}
  return out;
 };
 function normCdf(z){const t=1/(1+.2316419*Math.abs(z)),d=.3989423*Math.exp(-z*z/2),p=d*t*(.3193815+t*(-.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-p:p}
 /* --- Evolution: multi-ventana (30 vs 30 previos vs 90) --- */
 Engines.evolution=(F)=>{
  const out=[];if(F.profile.historyDays<90)return out;
  const a=F.days.slice(-30),b=F.days.slice(-60,-30);const fa=a.filter(r=>r.x>0).length,fb=b.filter(r=>r.x>0).length,sa=S.sum(a.map(r=>r.x)),sb=S.sum(b.map(r=>r.x)),ia=S.sum(a.map(r=>r.i)),ib=S.sum(b.map(r=>r.i));
  if(fb>=8&&fa<=fb*.8&&sa<=sb*1.05&&(ia>=ib*.9)){
   out.push(H({key:'evo.fewer-spend-days',engine:'evolution',type:'improving',category:'habits',title:'Estás mejorando sin darte cuenta',summary:`En los últimos 30 días compraste en ${fa} días frente a ${fb} en los 30 anteriores (${Math.round((fa/fb-1)*100)} %), con gasto ${sa<=sb?'menor o igual':'similar'} (${fmt(sa)} vs ${fmt(sb)}) y sin caída de ingresos.`,
    observed:fa,baseline:fb,deviation:fa/fb-1,impact:Math.max(0,sb-sa),valence:'positive',confidence:confidence({n:60,needed:60,strength:Math.min(1,(1-fa/fb)/.4),stability:.7,completeness:F.profile.coverage+.3}),
    evidence:[['Días con compras (30 d)',String(fa)],['Días con compras (30 d previos)',String(fb)],['Gasto 30 d',fmt(sa)],['Gasto 30 d previos',fmt(sb)],['Ingresos 30 d',fmt(ia)]],method:'Comparación de ventanas equivalentes de 30 días: frecuencia de compra, gasto e ingresos. Se descarta si los ingresos cayeron.',periods:'últimos 60 días',comparison:'frente a tus 30 días anteriores',recurrence:'2 ventanas',
    why:'Reconocer avances sostiene los hábitos que funcionan.',ifContinues:'Mantiene el margen de ahorro.',alternatives:['Seguir observándolo','Convertirlo en meta'],action:{label:'Ver movimientos',target:'register'},modules:['overview','register'],urgency:.05,minSeen:2}))}
  return out;
 };
 /* --- Sequence: cobro → gasto grande (prueba binomial) --- */
 Engines.sequence=(F)=>{
  const out=[];if(F.paydays.length<5||F.profile.historyDays<120)return out;
  const spends=F.days.map(r=>r.x).filter(v=>v>0);const p90=S.quantile(spends,.9);const big=r=>r.x>=p90;
  const pB=F.days.filter(big).length/F.days.length;const p0=1-Math.pow(1-pB,3);
  let n=0,k=0;for(const p of F.paydays){const i=F.days.findIndex(r=>r.d===p);if(i<0||i+3>=F.days.length)continue;n++;if(big(F.days[i+1])||big(F.days[i+2])||big(F.days[i+3]))k++}
  if(n>=5){const pv=S.binomTail(n,k,p0);if(pv<=.1&&k/n>=p0*1.5)out.push(H({key:'seq.payday-big-spend',engine:'sequence',type:'sequence',category:'habits',kind:'hypothesis',title:'Un gasto grande suele seguir a tu cobro',
   summary:`Tras ${k} de ${n} cobros hubo un día de gasto alto (≥ ${fmt(p90)}) en los 3 días siguientes; por azar se esperarían ≈${(p0*n).toFixed(1)}.`,observed:k/n,baseline:p0,deviation:k/n-p0,impact:0,confidence:confidence({n,needed:10,strength:Math.min(1,(k/n-p0)/.5),stability:1-pv,completeness:F.profile.coverage+.3}),
   evidence:[['Cobros analizados',String(n)],['Seguidos de gasto alto',String(k)],['Esperado por azar',(p0*n).toFixed(1)],['Valor p (binomial exacta)',pv.toFixed(3)]],method:'Prueba binomial exacta: ¿con qué frecuencia un día de gasto alto (percentil 90) cae en las 72 h tras cobrar, frente a la tasa base de tus días?',periods:`${n} cobros`,comparison:'frente a la tasa base de tus días',recurrence:`${k}/${n}`,
   why:'Si hay una secuencia estable, puedes anticiparla.',ifContinues:'Necesita más ciclos para confirmarse.',alternatives:['Seguir observándola','No me interesa'],action:{label:'Ver ingresos',target:'income'},modules:['overview','income'],urgency:.05,minSeen:3}))}
  return out;
 };
 const ENGINE_ORDER=['pattern','anomaly','drift','blindspot','correlation','prediction','evolution','sequence','shadow'];
 const ENGINE_FREQ={pattern:'semanal',anomaly:'diaria',drift:'semanal',blindspot:'diaria',correlation:'semanal',prediction:'diaria',evolution:'mensual',sequence:'semanal',shadow:'diaria'};

 /* ==========================================================================
    PRIORIDAD multidimensional (puntuación de relevancia 0–100; NO es una probabilidad)
    ========================================================================== */
 const WEIGHTS={confidence:.28,impact:.18,urgency:.2,novelty:.1,persistence:.1,actionability:.14};
 function relevance(h,mem,ctx){
  const impact=clamp(Math.log10(1+Math.max(0,h.impact||0))/5);               // RD$100.000 ≈ 1
  const persistence=clamp((h.seenDays||1)/5);
  const novelty=h.isNew?1:clamp(1-(h.seenDays||1)/10);
  const action=h.action?1:.4;
  let s=WEIGHTS.confidence*h.confidence.score+WEIGHTS.impact*impact+WEIGHTS.urgency*(h.urgency||0)+WEIGHTS.novelty*novelty+WEIGHTS.persistence*persistence+WEIGHTS.actionability*action;
  const w=(mem.w||{})[h.engine];const ew=w==null?1:clamp(w,.4,1.6);
  const fatigue=clamp(((mem.fb||[]).filter(f=>f.engine===h.engine&&['not_interested','known','never'].includes(f.a)).length)*.08,0,.4);
  return Math.round(100*clamp(s*ew*(1-fatigue)));
 }

 /* ==========================================================================
    RETROALIMENTACIÓN — efectos verificables sobre la memoria y la priorización
    ========================================================================== */
 /* Mensajes breves de entrada (Centro Estratégico): coherentes con la valencia y el tipo del hallazgo */
 function kicker(h){if(h.valence==='risk')return h.engine==='prediction'?'Algo se acerca':'Esto importa';if(h.valence==='positive')return h.type==='improving'?'Vas mejorando':'Estás avanzando';if(h.engine==='prediction')return 'Algo se acerca';if(h.type==='structural-up'||h.type==='structural-down')return 'Algo cambió';if(h.state==='pattern'||h.type==='weekday-peak'||h.type==='post-payday')return 'Patrón descubierto';if(h.engine==='anomaly')return 'Mira esto';return 'Mira esto'}
 const FEEDBACK=['correct','incorrect','exception','intentional','known','not_interested','follow','improve','helped','never'];
 function feedback(memIn,h,action,today){
  const m=Memory.norm(JSON.parse(JSON.stringify(memIn||{})));if(!FEEDBACK.includes(action))return m;
  const k=h.key,eng=h.engine;const bump=(d)=>{m.w[eng]=+clamp((m.w[eng]==null?1:m.w[eng])+d,.4,1.6).toFixed(2)};
  m.fb.push({k,engine:eng,a:action,d:today});
  const hy=m.hyp[k]=m.hyp[k]||{state:'hypothesis',first:today,last:today,seen:[today],engine:eng,title:h.title};
  switch(action){
   case 'correct':m.know[k]={kind:'pattern',title:h.title,summary:h.summary,since:today,confirmed:true,engine:eng};hy.state='pattern';bump(.1);break;          // confirmación de patrón
   case 'incorrect':m.exc[k]={why:'incorrect',until:addDays(today,120),title:h.title};hy.state='discarded';bump(-.1);break;                                    // corrección de datos/lectura
   case 'exception':m.exc[k]={why:'exception',until:addDays(today,365),title:h.title};hy.state='resolved';for(const d of h.dates||[])m.excludeDates.push(d);break; // no altera línea base
   case 'intentional':m.exc[k]={why:'intentional',until:addDays(today,180),title:h.title};m.know[k]={kind:'intention',title:h.title,since:today,engine:eng};hy.state='resolved';for(const d of h.dates||[])m.excludeDates.push(d);break;
   case 'known':m.exc[k]={why:'known',until:addDays(today,60),title:h.title};hy.state='resolved';bump(-.05);break;                                             // preferencia
   case 'not_interested':m.exc[k]={why:'not_interested',until:addDays(today,45),title:h.title};hy.state='discarded';bump(-.1);break;
   case 'follow':hy.state='following';break;
   case 'improve':m.goals[k]={engine:eng,title:h.title,since:today,baseline:h.observed,target:h.baseline};hy.state='following';break;
   case 'helped':bump(.15);m.prefs['useful.'+eng]=(m.prefs['useful.'+eng]||0)+1;break;
   case 'never':m.disabled[eng+'.'+h.type]=true;hy.state='discarded';break;
  }
  return Memory.prune(m,today);
 }

 /* ==========================================================================
    ORQUESTADOR — silencio inteligente, deduplicación, presupuesto de cómputo
    ========================================================================== */
 function discover(snap,memIn,opts){
  const o=Object.assign({maxSurfaced:4,budgetMs:150,only:null},opts||{});
  const t0=Date.now();const mem=Memory.norm(JSON.parse(JSON.stringify(memIn||{})));const today=snap.today;
  const audit={version:VERSION,ts:today,engines:[],discarded:[],features:null,ms:0};
  const F=buildFeatures(snap,mem);audit.features={days:F.days.length,weeks:F.weeks.length,records:F.profile.records,ms:F.ms,maturity:F.profile.maturity};
  const raw=[];
  for(const name of ENGINE_ORDER){
   if(o.only&&!o.only.includes(name))continue;
   if(Date.now()-t0>o.budgetMs){audit.engines.push({id:name,skipped:'presupuesto de cómputo agotado'});continue}
   const s=Date.now();let produced=0,error=null;
   try{const r=Engines[name](F,snap,mem)||[];for(const h of r){h.engine=name;raw.push(h);produced++}}catch(e){error=String(e&&e.message||e)}
   audit.engines.push({id:name,ms:Date.now()-s,produced,error,frequency:ENGINE_FREQ[name],records:F.profile.records});
  }
  const surfaced=[],internal=[];const seenKeys=new Set();const stg=ST();
  for(const h of raw){
   if(seenKeys.has(h.key))continue;seenKeys.add(h.key);
   if(mem.prefs&&mem.prefs.off&&mem.prefs.off[h.category]){audit.discarded.push({key:h.key,reason:'aprendizaje desactivado para la categoría «'+h.category+'»'});continue}
   const dis=mem.disabled[h.engine+'.'+h.type];if(dis){audit.discarded.push({key:h.key,reason:'tipo desactivado por el usuario'});continue}
   const ex=mem.exc[h.key];if(ex&&(!ex.until||ex.until>=today)){audit.discarded.push({key:h.key,reason:'descartado por retroalimentación: '+ex.why});continue}
   if(stg){try{h.science=stg.science(h,F,snap);h.council=stg.council(h,{mem});}catch(e){audit.engines.push({id:'strategy',error:String(e&&e.message||e)})}
    if(h.science&&h.science.refuted){internal.push(h);audit.discarded.push({key:h.key,reason:'refutada al ponerla a prueba: '+h.science.reason});continue}
    if(h.council&&h.council.verdict==='descartar'){internal.push(h);audit.discarded.push({key:h.key,reason:'el consejo interno la descartó'});continue}
    const th=(mem.thr||{})[h.engine];if(th&&h.confidence.score<.45+th&&!h.immediate){internal.push(h);audit.discarded.push({key:h.key,reason:'umbral elevado por falsos positivos reportados en este motor'});continue}}
   const prev=mem.hyp[h.key];const seen=prev?[...new Set([...(prev.seen||[]),today])].slice(-8):[today];
   h.seenDays=seen.length;h.isNew=!prev;
   const known=mem.know[h.key];
   h.state=known?'pattern':(seen.length>=(h.minSeen||2)||h.immediate)?(h.valence==='risk'?(h.urgency>=.7?'priority':'risk'):h.valence==='positive'?'positive':h.type==='weekday-peak'||h.type==='post-payday'||h.type==='sequence'?'pattern':h.engine==='prediction'?'anticipation':'discovery'):(seen.length>=2?'learning':'hypothesis');
   if(prev&&prev.state==='following')h.state=VISIBLE.has(h.state)?h.state:'following';
   mem.hyp[h.key]={state:h.state,first:prev?.first||today,last:today,seen,engine:h.engine,title:h.title,type:h.type};
   h.relevance=relevance(h,mem);h.kicker=kicker(h);
   if(!VISIBLE.has(h.state)){internal.push(h);audit.discarded.push({key:h.key,reason:`en ${h.state==='hypothesis'?'observación inicial':'aprendizaje'}: ${seen.length}/${h.minSeen||2} evaluaciones en días distintos`});continue}
   if(h.confidence.score<.45&&!h.immediate){internal.push(h);audit.discarded.push({key:h.key,reason:'confianza baja ('+h.confidence.score+')'});continue}
   if(h.relevance<30&&h.state!=='priority'){internal.push(h);audit.discarded.push({key:h.key,reason:'relevancia baja ('+h.relevance+')'});continue}
   surfaced.push(h);
  }
  // un descubrimiento por motor como máximo; orden por relevancia; sin saturar
  surfaced.sort((a,b)=>b.relevance-a.relevance);const seenEng=new Set(),show=[];
  for(const h of surfaced){if(seenEng.has(h.engine)){audit.discarded.push({key:h.key,reason:'otro descubrimiento del mismo motor tiene prioridad'});continue}seenEng.add(h.engine);show.push(h);if(show.length>=o.maxSurfaced)break}
  // estado de los que dejaron de observarse → resueltos
  for(const k of Object.keys(mem.hyp)){const h=mem.hyp[k];if(h.last!==today&&diff(today,h.last)>=14&&!['resolved','discarded','pattern'].includes(h.state))h.state='resolved'}
  // seguimiento de metas de mejora
  for(const [k,g] of Object.entries(mem.goals)){const cur=raw.find(h=>h.key===k);if(cur&&g.baseline!=null){const imp=g.baseline?(g.baseline-cur.observed)/Math.abs(g.baseline):0;g.progress=+imp.toFixed(2)}}
  let strategy=null;
  if(stg&&!o.noStrategy){try{
   const producedKeys=new Set(raw.map(h=>h.key));const unlearned=stg.unlearn(mem,producedKeys,today);
   stg.calibrate(mem);const evaluated=stg.evaluatePredictions(mem,snap);
   const done=(snap.months||[]).filter(m=>!m.partial&&m.txCount>0).map(m=>num(m.expense));
   const gov=stg.govern(mem,done);
   if(gov.ok){const cur=today.slice(0,7),ab=stg.abstain(mem,'spend');gov.abstain=ab;
    if(!ab.abstain)stg.logPrediction(mem,{t:'spend',for:cur,pred:Math.round(gov.pred),lo:Math.round(gov.pred-1.645*gov.sigma),hi:Math.round(gov.pred+1.645*gov.sigma),naive:Math.round(done[done.length-1]),model:gov.champion})}
   stg.recordBenchmark(mem,today);
   strategy={lifeModel:stg.lifeModel(snap,F),curiosity:stg.curiosity(snap,F,mem,{discoveries:show,internal}),governance:gov,unlearned,evaluated,benchmark:stg.benchmark(mem,Date.now()-t0)};
  }catch(e){audit.engines.push({id:'strategy',error:String(e&&e.message||e)})}}
  mem.audit={runs:(mem.audit.runs||0)+1,last:today};Memory.prune(mem,today);
  audit.ms=Date.now()-t0;audit.surfaced=show.length;audit.hypotheses=raw.length;audit.memoryBytes=Memory.size(mem);
  return {discoveries:show,internal,mem,audit,strategy,features:{profile:F.profile,windows:F.windows}};
 }

 /* ==========================================================================
    SIMULACIÓN — bajo demanda (conservador / central / favorable). Siempre una simulación, nunca un hecho.
    ========================================================================== */
 function simulate(snap,sc,opts){
  const o=Object.assign({months:6,runs:600,seed:99},opts||{});const ms=(snap.months||[]).filter(m=>!m.partial&&m.txCount>0);
  if(ms.length<3)return {ok:false,reason:'Se necesitan al menos 3 meses completos de movimientos para simular.'};
  const inc=ms.map(m=>num(m.income)),exp=ms.map(m=>num(m.expense));const R=S.rng(o.seed);
  const s=Object.assign({expensePct:0,incomePct:0,extraMonthly:0,removeMonthly:0,oneOff:0,startLiquid:num(snap.position?.liquid)},sc||{});
  const finals=[];const paths=[];
  for(let r=0;r<o.runs;r++){let b=s.startLiquid-s.oneOff;const path=[];for(let m=0;m<o.months;m++){const i=inc[Math.floor(R()*inc.length)]*(1+s.incomePct/100);const e=exp[Math.floor(R()*exp.length)]*(1+s.expensePct/100)+s.extraMonthly-s.removeMonthly;b+=i-e;path.push(b)}finals.push(b);paths.push(path)}
  const q=p=>S.quantile(finals,p);
  return {ok:true,months:o.months,assumptions:[`Ingresos y gastos mensuales se remuestrean de tus ${ms.length} meses completos`,`Escenario: gastos ${s.expensePct>=0?'+':''}${s.expensePct} %, ingresos ${s.incomePct>=0?'+':''}${s.incomePct} %, cambio fijo mensual ${fmt(s.extraMonthly-s.removeMonthly)}${s.oneOff?`, desembolso único ${fmt(s.oneOff)}`:''}`,'No incluye imprevistos fuera de tu historial'],
   conservative:Math.round(q(.1)),central:Math.round(q(.5)),favorable:Math.round(q(.9)),pNegative:+(finals.filter(v=>v<0).length/finals.length).toFixed(2),
   note:'Simulación: no es una predicción ni un hecho. Conservador = percentil 10, central = mediana, favorable = percentil 90.'};
 }

 /* ==========================================================================
    EXPLICACIÓN VERIFICABLE — «¿Cómo llegamos a esta conclusión?» (solo evidencia y cálculos)
    ========================================================================== */
 function explain(h){
  return {detected:h.summary,
   how:{title:'¿Cómo llegamos a esta conclusión?',method:h.method,periods:h.periods,comparison:h.comparison,evidence:h.evidence.map(e=>({label:e[0],value:e[1]})),
    recurrence:h.recurrence,confidence:{level:h.confidence.level,score:h.confidence.score,parts:h.confidence.parts,formula:h.confidence.method},
    uncertainty:h.kind==='projection'?'Es una proyección con intervalo; no es un hecho confirmado.':h.kind==='hypothesis'?'Es una hipótesis: necesita más evidencia.':h.confidence.level==='baja'?'Evidencia limitada.':'Evidencia suficiente para la medición realizada.',
    since:h.since||null,isolated:h.recurrence&&/puntual/.test(h.recurrence)?'Evento aislado':'Recurrente o sostenido',
    relevanceNote:'La relevancia (0–100) ordena qué mostrar; no es una probabilidad.'},
   why:h.why,ifContinues:h.ifContinues,alternatives:h.alternatives,counterfactual:h.counterfactual||null};
 }
 /* ==========================================================================
    REFLEXIÓN — preguntas que surgen de la evidencia y respetan la decisión personal
    ========================================================================== */
 function reflect(h){
  const q={'weekday-peak':`¿Es intencional que tus ${(h.title.match(/Tus (\w+)s/)||[])[1]||'días'} concentren más gasto?`,'post-payday':'¿Qué parte de tu cobro prefieres reservar antes de empezar a gastar?','structural-up':'¿Este nuevo nivel de gasto es una decisión tuya o algo que ocurrió sin notarlo?','structural-down':'¿Qué te gustaría hacer con el margen que estás liberando?','micro-payments':'¿Cuáles de estos pequeños pagos realmente aportan valor?','apparent-vs-real':'¿Cómo quieres separar lo que ya está comprometido de lo que puedes decidir libremente?','spend-vs-income':'¿Hay algún gasto del próximo mes que puedas anticipar o ajustar?','liquidity-pressure':'¿Qué pagos podrían moverse de fecha si hiciera falta?','improving':'¿Quieres convertir este avance en una meta?','sequence':'¿Quieres planificar el gasto que suele seguir a tu cobro?','weekly-correlation':'¿Te hace sentido esta coincidencia con lo que vives?'}[h.type];
  return q||null;
 }

 const REGISTRY=[{id:'robust-z+mad',engines:['anomaly'],status:'producción',note:'z robusto sobre mediana/MAD'},{id:'isolation-forest',engines:['anomaly'],status:'producción (solo en consenso con z robusto)',note:'64 árboles, semilla fija'},{id:'cusum',engines:['drift'],status:'producción',note:'k=0,6σ h=5σ, ≥4 semanas'},{id:'spearman-permutación+BH',engines:['correlation'],status:'producción en silencio (mínimo 3 evaluaciones)',note:'FDR q=0,10'},{id:'backtest-rodante',engines:['prediction'],status:'producción',note:'solo si mejora ≥5 % al ingenuo'},{id:'montecarlo-liquidez',engines:['prediction'],status:'producción con supuestos explícitos',note:'600 trayectorias, semilla fija'},{id:'binomial-secuencias',engines:['sequence'],status:'experimental (mínimo 3 evaluaciones)',note:'tasa base propia'},{id:'bootstrap-ic',engines:['pattern'],status:'producción',note:'300 remuestreos'}];
 /* API estratégica bajo demanda (no se ejecuta en cada render) */
 function strategic(snap,memIn){const stg=ST();const mem=Memory.norm(JSON.parse(JSON.stringify(memIn||{})));const F=buildFeatures(snap,mem);
  return {horizon:()=>stg.horizon(snap,F),decisionLab:s=>stg.decisionLab(snap,F,s),chain:d=>stg.chain(snap,F,d),graph:()=>stg.graph(snap,F,mem,Object.values(mem.hyp||{})),lifeModel:()=>stg.lifeModel(snap,F),curiosity:()=>stg.curiosity(snap,F,mem,null),answer:(id,v)=>stg.answer(mem,id,v,snap.today),benchmark:()=>stg.benchmark(mem)}}
 const api={strategic,VERSION,REGISTRY,STATES,VISIBLE:[...VISIBLE],FEEDBACK,discover,simulate,explain,reflect,feedback,Memory,buildFeatures,confidence,relevance,WEIGHTS,ENGINE_ORDER,ENGINE_FREQ,
  engines:Object.keys(Engines),isHoliday,_Engines:Engines};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ViveDiscovery=api;
})(typeof window!=='undefined'?window:globalThis);
