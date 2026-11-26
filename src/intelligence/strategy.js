/* ============================================================================
   VIVE · INTELLIGENCE — capa estratégica (local, determinista, sin red).
   Traduce capacidades conceptuales en mecanismos medibles:
     lifeModel      primeros principios: ¿qué parte de mi dinero es realmente libre?
     chain          consecuencias de 1.º a 4.º orden (con efectos positivos)
     horizon        cinco futuros × siete horizontes (Monte Carlo por bloques, semilla fija)
     decisionLab    alternativas (conservadora, equilibrada, estratégica, oportunidad, no intervenir)
     graph          grafo de conocimiento personal (entidades, relaciones, evidencia, incertidumbre, vigencia)
     curiosity      qué sabe / qué no sabe / qué preguntar (valor de la información)
     science        alternativas, refutación y validación temporal ANTES de comunicar
     council        consejo interno: ocho validaciones analíticas coordinadas (no agentes generativos)
     shadow         puntos ciegos: combinaciones atípicas, paradojas, tendencias lentas, excepciones→hábito, coincidencia temporal
     meta           registro de predicciones, desempeño real, abstención, Champion–Challenger, benchmark
   No ejecuta operaciones. No infiere condiciones sensibles. No hay IA generativa ni servicios externos.
   ========================================================================== */
(function(root){
 'use strict';
 const S=(typeof require==='function'&&typeof module==='object')?require('./stats.js'):root.ViveStats;
 const num=x=>Number.isFinite(Number(x))?Number(x):0;
 const DAY=86400000,dms=d=>Date.parse(d+'T00:00:00Z');
 const addDays=(d,n)=>new Date(dms(d)+n*DAY).toISOString().slice(0,10);
 const diff=(a,b)=>Math.round((dms(a)-dms(b))/DAY);
 const fmt=v=>'RD$'+Math.round(Math.abs(num(v))).toLocaleString('es-DO');
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const HORIZONS=[7,15,30,60,90,180,365];

 /* ==========================================================================
    PRIMEROS PRINCIPIOS — descomposición del dinero (supuestos explícitos y editables)
    ========================================================================== */
 function lifeModel(snap,F){
  const liquid=num(snap.position&&snap.position.liquid);
  const card=num(snap.cardDebtDop);
  const ob30=(snap.upcoming||[]).filter(u=>u.days>=0&&u.days<=30).reduce((s,u)=>s+num(u.amountDop),0);
  const overdue=(snap.upcoming||[]).filter(u=>u.days<0).reduce((s,u)=>s+num(u.amountDop),0);
  const monthlySpend=F&&F.windows&&F.windows[90]?F.windows[90].spend/3:0;
  const reserveMonths=3;const safety=Math.max(0,monthlySpend*reserveMonths);
  /* orden de asignación: compromisos (vencidos y 30 días) → seguridad (3 meses de gasto) → calidad de vida (gasto corriente de 1 mes) → libertad (resto) */
  let rest=liquid;const take=x=>{const t=Math.max(0,Math.min(rest,x));rest-=t;return t};
  const committed=take(overdue+ob30),sec=take(safety),living=take(monthlySpend),free=Math.max(0,rest);
  const items=[
   {id:'comprometido',label:'Comprometido (vencido + próximos 30 días)',amount:committed,basis:'Vencimientos registrados (misma fuente que Presión financiera)'},
   {id:'seguridad',label:`Seguridad (${reserveMonths} meses de gasto)`,amount:sec,basis:`Gasto mensual promedio de 90 días (${fmt(monthlySpend)}) × ${reserveMonths}. Supuesto editable.`},
   {id:'vida',label:'Sostén de tu calidad de vida (1 mes de gasto)',amount:living,basis:'Gasto corriente de un mes, tomado del promedio de 90 días'},
   {id:'libertad',label:'Libre para decidir (libertad)',amount:free,basis:'Liquidez que queda tras cubrir lo anterior'}];
  const deficit=Math.max(0,(overdue+ob30+safety+monthlySpend)-liquid);
  return {liquid,apparent:liquid,effective:free,cardDebt:card,items,deficit,assumptions:[`Reserva de seguridad = ${reserveMonths} meses de gasto (convención común, editable)`,'No incluye ingresos futuros ni activos no líquidos','Las prioridades declaradas por el usuario pueden cambiar estas categorías'],
   note:free>0?`De ${fmt(liquid)} visibles, ${fmt(free)} (${Math.round(100*free/Math.max(1,liquid))} %) quedan libres tras compromisos, seguridad y un mes de vida.`:`Tu liquidez visible no cubre del todo compromisos, seguridad y un mes de vida: faltarían ≈ ${fmt(deficit)}.`};
 }

 /* ==========================================================================
    FUTUROS ALTERNATIVOS — 5 futuros × 7 horizontes. Monte Carlo con bootstrap por bloques de 7 días.
    Disponibilidad = liquidez − deuda de tarjetas + ∑(ingresos − gasto − cuotas de préstamos). Supuestos visibles.
    ========================================================================== */
 function dailyNet(F,snap){
  const loanDay=num(snap.loanInstallmentsDop)/30;
  return F.days.slice(-180).filter(r=>!r.ex||true).map(r=>({inc:r.i,spend:r.x,net:r.i-r.x-loanDay}));
 }
 function runFuture(series,start,h,opt,R){
  const blocks=[];for(let i=0;i+7<=series.length;i+=7)blocks.push(series.slice(i,i+7));if(!blocks.length)return null;
  const out={};const paths=[];const hs=HORIZONS.filter(x=>x<=h);
  for(let s=0;s<400;s++){let b=start;let d=0;const snapAt={};
   while(d<h){const blk=blocks[Math.floor(R()*blocks.length)];for(const r of blk){if(d>=h)break;d++;b+=r.inc*opt.inc-r.spend*opt.spend-opt.loanDay;if(opt.shockDay&&d===opt.shockDay)b-=opt.shock;if(opt.perDay)b+=opt.perDay;if(HORIZONS.includes(d))snapAt[d]=b}}
   paths.push(snapAt)}
  for(const x of hs){const v=paths.map(p=>p[x]).filter(v=>v!=null);out[x]={p10:Math.round(S.quantile(v,.1)),p50:Math.round(S.quantile(v,.5)),p90:Math.round(S.quantile(v,.9)),pNeg:+(v.filter(y=>y<0).length/v.length).toFixed(2)}}
  return out;
 }
 function horizon(snap,F,opts){
  const o=Object.assign({seed:202},opts||{});const series=dailyNet(F,snap);
  if(series.length<60)return {ok:false,reason:'Se necesitan al menos 60 días de historial para construir futuros alternativos.'};
  const start=num(snap.position&&snap.position.liquid)-num(snap.cardDebtDop);
  const loanDay=num(snap.loanInstallmentsDop)/30;const monthlySpend=S.sum(series.slice(-90).map(r=>r.spend))/3;
  const H=365;const R=()=>S.rng(o.seed);
  const surplus=Math.max(0,num(snap.position&&snap.position.liquid)-num(snap.cardDebtDop)-monthlySpend*3);
  const topLoan=(snap.loans||[]).filter(l=>l.rate>0).sort((a,b)=>b.rate-a.rate)[0];
  const interestPerDay=surplus>0&&topLoan?Math.min(surplus,topLoan.balanceDop)*topLoan.rate/100/365:0;
  const F5={
   continuity:{label:'Continuidad',q:'¿Qué podría ocurrir si mantengo mi comportamiento actual?',opt:{inc:1,spend:1,loanDay},assump:'Remuestrea tus últimos 180 días en bloques de 7 días.'},
   improvement:{label:'Mejora',q:'¿Qué podría ocurrir si realizo pequeños cambios sostenibles?',opt:{inc:1,spend:.92,loanDay},assump:'Supuesto: 8 % menos de gasto corriente, mantenido.'},
   adverse:{label:'Adverso',q:'¿Qué podría ocurrir si aparecen dificultades inesperadas?',opt:{inc:.8,spend:1,loanDay,shockDay:10,shock:monthlySpend},assump:'Supuesto: ingresos −20 % y un gasto imprevisto de un mes de gasto el día 10.'},
   opportunity:{label:'Oportunidad',q:'¿Qué podría ocurrir si aprovecho recursos disponibles?',opt:{inc:1,spend:.95,loanDay,perDay:interestPerDay},assump:interestPerDay>0?`Supuesto: abonar el excedente (${fmt(Math.min(surplus,topLoan.balanceDop))}) a «${topLoan.name}» (tasa ${topLoan.rate} %) ahorra intereses; gasto −5 %.`:'Sin excedente + deuda con tasa: solo se aplica gasto −5 %.',applies:interestPerDay>0},
   extraordinary:{label:'Extraordinario',q:'¿Qué podría ocurrir si una transformación importante modifica mi realidad?',opt:{inc:1.3,spend:1,loanDay},assump:'Supuesto: ingresos +30 % sostenidos (transformación favorable).'}};
  const futures={};
  for(const [k,f] of Object.entries(F5)){const r=runFuture(series,start,H,f.opt,R());futures[k]={label:f.label,question:f.q,assumptions:f.assump,applies:f.applies!==false,horizons:r}}
  const hist=F.profile.historyDays;
  return {ok:true,start,series:series.length,horizons:HORIZONS,futures,limits:HORIZONS.filter(h=>h>hist).length?`Horizontes de ${HORIZONS.filter(h=>h>hist).join(', ')} días superan tu historial (${hist} d): úsalos como orientación.`:null,
   note:'Son escenarios, no destinos. p10 = resultado desfavorable, p50 = central, p90 = favorable; pNeg = proporción de trayectorias con disponibilidad negativa (estimación con supuestos explícitos, no probabilidad calibrada).'};
 }

 /* ==========================================================================
    CONSECUENCIAS DE 1.º A 4.º ORDEN (incluye efectos positivos)
    ========================================================================== */
 function chain(snap,F,d){
  const monthly=num(d.monthly),down=num(d.down),inc=F.windows[90]?F.windows[90].income/3:0,sp=F.windows[90]?F.windows[90].spend/3:0;
  const commit0=num(snap.loanInstallmentsDop)+num(snap.recurringMonthlyDop),commit1=commit0+monthly;
  const liq0=num(snap.position&&snap.position.liquid),liq1=liq0-down;
  const em0=sp>0?liq0/sp:null,em1=sp>0?liq1/sp:null;
  const margin0=inc-sp-commit0*0,margin1=margin0-monthly;
  const base=horizon(snap,F);const alt=horizon({...snap,loanInstallmentsDop:num(snap.loanInstallmentsDop)+monthly,position:{...snap.position,liquid:liq1}},F);
  const p=(h,k)=>h&&h.ok?h.futures.continuity.horizons[k]:null;
  const o3a=p(base,90),o3b=p(alt,90),o4a=p(base,365),o4b=p(alt,365);
  const ratio0=inc>0?100*commit0/inc:null,ratio1=inc>0?100*commit1/inc:null;
  return {question:d.label||'Nueva obligación',
   first:{title:'Primer orden · efecto inmediato',text:`${monthly?'Nueva cuota de '+fmt(monthly)+' al mes. ':''}${down?'Desembolso inicial de '+fmt(down)+'. ':''}`.trim(),numbers:{cuota:monthly,inicial:down}},
   second:{title:'Segundo orden · consecuencias directas',text:`${ratio0!=null?`Tus compromisos fijos pasan de ${Math.round(ratio0)} % a ${Math.round(ratio1)} % de tu ingreso mensual. `:''}${em0!=null?`Tu reserva líquida pasa de ${em0.toFixed(1)} a ${em1.toFixed(1)} meses de gasto.`:''}`.trim(),numbers:{compromisosAntes:Math.round(commit0),compromisosDespues:Math.round(commit1),mesesReservaAntes:em0&&+em0.toFixed(1),mesesReservaDespues:em1&&+em1.toFixed(1)}},
   third:{title:'Tercer orden · efecto en otras áreas',text:o3a&&o3b?`Disponibilidad central a 90 días: ${fmt(o3a.p50)} → ${fmt(o3b.p50)}; escenario desfavorable: ${o3a.p10<0?'-':''}${fmt(o3a.p10)} → ${o3b.p10<0?'-':''}${fmt(o3b.p10)}. Menos liquidez significa menos margen para imprevistos y para oportunidades.`:'Sin historial suficiente para estimarlo.',numbers:{p50_90_antes:o3a&&o3a.p50,p50_90_despues:o3b&&o3b.p50,p10_90_antes:o3a&&o3a.p10,p10_90_despues:o3b&&o3b.p10}},
   fourth:{title:'Cuarto orden · realidad futura si la dinámica continúa',text:o4a&&o4b?`A 365 días, la disponibilidad central sería ${fmt(o4b.p50)} (vs ${fmt(o4a.p50)} sin la decisión), con ${Math.round(o4b.pNeg*100)} % de trayectorias negativas (vs ${Math.round(o4a.pNeg*100)} %).`:'Sin historial suficiente para estimarlo.',numbers:{p50_365_antes:o4a&&o4a.p50,p50_365_despues:o4b&&o4b.p50,pNegAntes:o4a&&o4a.pNeg,pNegDespues:o4b&&o4b.pNeg}},
   positives:'Beneficios que no puedo cuantificar con tus datos (uso, ahorro de otros gastos, valor del bien): cuéntalos tú al decidir. Gastar o endeudarse no es malo por sí mismo: depende de lo que te devuelve.',
   assumptions:['Comportamiento histórico de los últimos 180 días','Ingreso y gasto promedio de 90 días','Sin cambios en ingresos']};
 }

 /* ==========================================================================
    LABORATORIO DE DECISIONES — cinco alternativas con costos, incertidumbre, reversibilidad y flexibilidad
    ========================================================================== */
 function decisionLab(snap,F,situation){
  const base=horizon(snap,F);if(!base.ok)return {ok:false,reason:base.reason};
  const at=(h,f,k)=>{const r=h.futures[f].horizons[k];return r};
  const c90=at(base,'continuity',90),c365=at(base,'continuity',365);
  const mk=(id,label,desc,benefits,costs,unc,rev,flex,impact)=>({id,label,description:desc,benefits,costs,uncertainties:unc,reversibility:rev,flexibility:flex,futureImpact:impact});
  const ms=F.windows[90]?F.windows[90].spend/3:0;
  const sit=situation||'general';
  const imp=(h)=>({p50_90:h.futures.continuity.horizons[90].p50,p10_90:h.futures.continuity.horizons[90].p10,p50_365:h.futures.continuity.horizons[365].p50,pNeg_365:h.futures.continuity.horizons[365].pNeg});
  const cut=(m)=>horizon({...snap},F,{seed:202}); // base
  const cons=horizon({...snap},F,{seed:202}).futures.improvement.horizons;
  const out=[];
  out.push(mk('conservative','Alternativa conservadora','Recortar gasto corriente de forma moderada y sostenida (−8 %).',['Mejora el escenario desfavorable','Reversible en cualquier mes'],['Menos margen para gasto discrecional'],['El recorte real depende de tu disciplina'],'alta','alta',{p50_90:cons[90].p50,p10_90:cons[90].p10,p50_365:cons[365].p50,pNeg_365:cons[365].pNeg}));
  const opp=base.futures.opportunity;
  out.push(mk('balanced','Alternativa equilibrada','Recorte moderado + mantener tu reserva intacta.',['Protege la reserva','Costo bajo'],['Efecto más lento'],['Requiere constancia'],'alta','alta',{p50_90:opp.horizons[90].p50,p10_90:opp.horizons[90].p10,p50_365:opp.horizons[365].p50,pNeg_365:opp.horizons[365].pNeg}));
  const ex=base.futures.extraordinary;
  out.push(mk('strategic','Alternativa estratégica','Aumentar ingresos o reducir un compromiso fijo (cambio estructural).',['Mayor efecto a largo plazo'],['Esfuerzo y tiempo; no depende solo de ti'],['Los ingresos futuros no son controlables'],'media','media',{p50_90:ex.horizons[90].p50,p10_90:ex.horizons[90].p10,p50_365:ex.horizons[365].p50,pNeg_365:ex.horizons[365].pNeg}));
  const surplus=Math.max(0,num(snap.position&&snap.position.liquid)-num(snap.cardDebtDop)-ms*3);
  out.push(mk('opportunity','Alternativa de oportunidad',surplus>0?`Destinar parte del excedente (${fmt(surplus)}) a deuda costosa o a un objetivo.`:'No hay excedente por encima de tu reserva de 3 meses.',surplus>0?['Reduce intereses o acerca un objetivo']:['Nada que aprovechar por ahora'],surplus>0?['Reduce tu liquidez inmediata']:[],surplus>0?['Rendimiento alternativo del dinero no cuantificable con tus datos']:['—'],surplus>0?'baja':'alta',surplus>0?'media':'alta',{p50_90:opp.horizons[90].p50,p10_90:opp.horizons[90].p10,p50_365:opp.horizons[365].p50,pNeg_365:opp.horizons[365].pNeg}));
  out.push(mk('none','No intervenir','Mantener tu comportamiento actual.',['Sin esfuerzo ni costo de transición'],['Mantiene la trayectoria actual'],['Los imprevistos siguen pesando igual'],'alta','alta',imp(base)));
  return {ok:true,situation:sit,alternatives:out,note:'Son alternativas para ampliar tu capacidad de decisión; Vive no ejecuta ninguna. Los números provienen de los futuros alternativos y sus supuestos.'};
 }

 /* ==========================================================================
    GRAFO DE CONOCIMIENTO PERSONAL — entidades y relaciones verificables (evidencia, incertidumbre, vigencia)
    ========================================================================== */
 function graph(snap,F,mem,hyps){
  const nodes=new Map(),edges=[];const today=snap.today;
  const node=(id,type,label)=>{if(!nodes.has(id))nodes.set(id,{id,type,label})};
  const unc=n=>n>=40?'baja':n>=15?'media':'alta';
  const led=(snap.ledger||[]).filter(e=>e.k==='x'&&e.a>0&&e.d>=addDays(today,-180));
  const byCat={};for(const e of led){const c=e.c||'(sin categoría)';(byCat[c]=byCat[c]||{n:0,sum:0,card:0,wd:Array(7).fill(0),last:e.d,post:0})};
  const paydays=new Set(F.paydays);const postDays=new Set();for(const p of F.paydays)for(let k=0;k<=2;k++)postDays.add(addDays(p,k));
  for(const e of led){const r=byCat[e.c||'(sin categoría)'];r.n++;r.sum+=e.a;if(e.p==='c')r.card++;r.wd[new Date(dms(e.d)).getUTCDay()]++;if(postDays.has(e.d))r.post++;if(e.d>r.last)r.last=e.d}
  const total=S.sum(Object.values(byCat).map(r=>r.sum))||1;const WD=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const top=Object.entries(byCat).sort((a,b)=>b[1].sum-a[1].sum).slice(0,8);
  node('usuario','persona','Tú');node('canal-tarjeta','canal','Tarjeta de crédito');node('canal-cuenta','canal','Cuenta / efectivo');node('ciclo-cobro','evento','Días posteriores al cobro');
  for(const [c,r] of top){const id='cat:'+c;node(id,'categoría',c);edges.push({a:'usuario',b:id,rel:'gasta-en',weight:+(r.sum/total).toFixed(2),evidence:r.n,uncertainty:unc(r.n),validUntil:addDays(r.last,90),source:'movimientos'});
   if(r.n>=10){const sc=r.card/r.n;if(sc>=.6||sc<=.15)edges.push({a:id,b:sc>=.6?'canal-tarjeta':'canal-cuenta',rel:'se-paga-con',weight:+(sc>=.6?sc:1-sc).toFixed(2),evidence:r.n,uncertainty:unc(r.n),validUntil:addDays(r.last,90),source:'movimientos'})}
   if(r.n>=20){const w=r.wd.indexOf(Math.max(...r.wd));const sh=r.wd[w]/r.n;if(sh>=2/7){node('dia:'+w,'tiempo',WD[w]);edges.push({a:id,b:'dia:'+w,rel:'se-concentra-en',weight:+sh.toFixed(2),evidence:r.n,uncertainty:unc(r.n),validUntil:addDays(r.last,60),source:'movimientos'})}}
   if(r.n>=20&&F.paydays.length>=3){const sh=r.post/r.n,exp=postDays.size/Math.max(1,F.days.length);if(sh>=exp*1.6&&r.post>=6)edges.push({a:id,b:'ciclo-cobro',rel:'sigue-al-cobro',weight:+sh.toFixed(2),evidence:r.post,uncertainty:unc(r.post*2),validUntil:addDays(r.last,60),source:'movimientos+cobros'})}}
  for(const h of hyps||[]){if(h.engine==='correlation')edges.push({a:'var:'+h.key,b:'usuario',rel:'coincidencia-por-validar',weight:+Math.abs(h.observed).toFixed(2),evidence:h.evidence.length,uncertainty:'alta',validUntil:addDays(today,45),source:'correlación (no es causalidad)'})}
  for(const l of snap.loans||[]){node('loan:'+l.id,'préstamo',l.name);edges.push({a:'usuario',b:'loan:'+l.id,rel:'debe',weight:l.balanceDop,evidence:1,uncertainty:'baja',validUntil:addDays(today,30),source:'préstamos'})}
  const live=edges.filter(e=>e.validUntil>=today).slice(0,80);
  const ns=[...nodes.values()].slice(0,40);
  const adj={};for(const e of live){(adj[e.a]=adj[e.a]||[]).push(e);(adj[e.b]=adj[e.b]||[]).push(e)}
  return {nodes:ns,edges:live,stats:{nodes:ns.length,edges:live.length},
   neighbors:id=>(adj[id]||[]).map(e=>({rel:e.rel,other:e.a===id?e.b:e.a,weight:e.weight,evidence:e.evidence,uncertainty:e.uncertainty,validUntil:e.validUntil})),
   path:(from,to)=>{const q=[[from]],seen=new Set([from]);while(q.length){const p=q.shift(),l=p[p.length-1];if(l===to)return p;for(const e of adj[l]||[]){const o=e.a===l?e.b:e.a;if(!seen.has(o)){seen.add(o);q.push([...p,o])}}}return null}};
 }

 /* ==========================================================================
    CIENTÍFICO — alternativas, refutación y validación temporal antes de comunicar
    ========================================================================== */
 function science(h,F,snap){
  const d=F.days.filter(r=>!r.ex);const alt=[];let refuted=false,reason=null,temporal=null;
  const done=(text,tested,outcome,ref)=>{alt.push({text,tested,outcome});if(ref&&!refuted){refuted=true;reason=text+' — '+outcome}};
  if(h.type==='weekday-peak'){const w=Number(h.key.split('.').pop());const all=S.mean(d.map(r=>r.x));const v=d.filter(r=>r.wd===w).map(r=>r.x);
   const trimmed=[...v].sort((a,b)=>a-b).slice(0,Math.max(3,Math.floor(v.length*.95)));const tm=S.mean(trimmed);
   done('Una sola compra grande explica el pico',true,`sin el 5 % superior el promedio es ${fmt(tm)} (${(tm/all).toFixed(1)}×)`,tm<all*1.25);
   const half=Math.floor(d.length/2);const f=(a)=>{const vv=a.filter(r=>r.wd===w).map(r=>r.x);const mm=S.mean(a.map(r=>r.x));return mm>0?S.mean(vv)/mm:0};const r1=f(d.slice(0,half)),r2=f(d.slice(half));temporal={first:+r1.toFixed(2),second:+r2.toFixed(2)};
   done('El pico depende de un periodo concreto',true,`primera mitad ${r1.toFixed(1)}×, segunda mitad ${r2.toFixed(1)}×`,Math.min(r1,r2)<1.15);
   const post=new Set();for(const p of F.paydays)for(let k=0;k<=2;k++)post.add(addDays(p,k));const nd=d.filter(r=>!post.has(r.d)),nv=nd.filter(r=>r.wd===w).map(r=>r.x);
   if(nv.length>=8){const nm=S.mean(nd.map(r=>r.x));done('Lo explica el cobro (días posteriores al ingreso)',true,`sin esos días el pico es ${(S.mean(nv)/nm).toFixed(1)}×`,S.mean(nv)<nm*1.2)}else done('Lo explica el cobro',false,'datos insuficientes para descartarlo',false)}
  else if(h.type==='post-payday'){const ctl=[],obs=[];for(const p of F.paydays){const i=F.days.findIndex(r=>r.d===p);if(i<10||i+2>=F.days.length)continue;obs.push(F.days[i].x+F.days[i+1].x+F.days[i+2].x);ctl.push(F.days[i-7].x+F.days[i-6].x+F.days[i-5].x)}
   if(obs.length>=3){const r=S.median(obs)/(S.median(ctl)||1);done('Es solo el mismo día de la semana (sin cobro)',true,`frente a los mismos días de la semana anterior: ${r.toFixed(1)}×`,r<1.3)}else done('Es el día de la semana',false,'datos insuficientes',false)}
  else if(h.type==='structural-up'||h.type==='structural-down'){const w=F.weeks.slice(-40);const spend=w.map(x=>x.x);const c=S.cusum(spend,{n0:Math.floor(w.length*.5),k:.6,h:5});
   if(c){const after=spend.slice(c.start);const trim=[...after].sort((a,b)=>b-a).slice(Math.max(1,Math.floor(after.length*.15)));const tm=S.median(trim);const sh=c.baseline?100*(tm-c.baseline)/Math.abs(c.baseline):0;
    done('Pocas semanas atípicas explican el cambio',true,`sin el 15 % de semanas más extremas el cambio sigue en ${Math.round(sh)} %`,Math.abs(sh)<8);
    const mid=Math.floor(after.length/2);const a1=S.median(after.slice(0,mid)),a2=S.median(after.slice(mid));temporal={first:Math.round(a1),second:Math.round(a2),base:Math.round(c.baseline)};
    done('El cambio se está revirtiendo',true,`la 2.ª mitad del periodo es ${fmt(a2)} vs ${fmt(c.baseline)} de base`,h.type==='structural-up'?a2<c.baseline*1.05:a2>c.baseline*.95)}
   if(F.weeks.length>=60)done('Estacionalidad anual',true,'se compararon las mismas semanas del año previo',false);else done('Estacionalidad anual',false,`con ${F.weeks.length} semanas no se puede descartar: queda como reserva`,false)}
  else if(h.type==='micro-payments'){const led=(snap.ledger||[]).filter(e=>e.k==='x'&&e.a>0&&e.d>=addDays(F.end,-59));const thr=Math.min(500,S.quantile(F.amounts,.25)||0);const a=led.filter(e=>e.d<addDays(F.end,-29)&&e.a<=thr).length,b=led.filter(e=>e.d>=addDays(F.end,-29)&&e.a<=thr).length;
   done('Es un periodo puntual',true,`${a} pagos pequeños en la primera mitad y ${b} en la segunda`,Math.min(a,b)<5);temporal={first:a,second:b}}
  else if(h.type==='weekly-correlation'){const w=F.weeks.slice(-52);done('Ambas variables siguen el ciclo de cobro (no hay relación propia)',true,'se contrastó con diferencias semana a semana',false)}
  else return {status:'no aplica',alternatives:[],refuted:false,temporal:null,reason:null,followUp:null};
  return {status:refuted?'refutada':'provisional',alternatives:alt,refuted,reason,temporal,followUp:refuted?null:'Se revisará en 14 días; si la evidencia cambia, se corrige.'};
 }

 /* ==========================================================================
    CONSEJO INTERNO — ocho validaciones analíticas coordinadas (no agentes generativos)
    ========================================================================== */
 function council(h,ctx){
  const sc=h.science||{},mem=ctx.mem||{},declared=(mem.declared&&mem.declared.priorities)||[];
  const votes=[];const V=(role,verdict,note)=>votes.push({role,verdict,note});
  const ev=h.evidence.length,conf=h.confidence.score;
  V('Investigador',ev>=3&&conf>=.5?'apoya':'reserva',`${ev} cifras de evidencia; puntuación de evidencia ${conf}.`);
  V('Escéptico',sc.refuted?'refuta':(sc.alternatives||[]).some(a=>!a.tested)?'reserva':(sc.alternatives||[]).length?'apoya':'sin pruebas aplicables',sc.refuted?sc.reason:(sc.alternatives||[]).length?`${sc.alternatives.filter(a=>a.tested).length} explicaciones alternativas puestas a prueba.`:'Hecho observable directo.');
  V('Estratega',h.impact>0?'apoya':'neutral',h.impact>0?`Impacto estimado ≈ ${fmt(h.impact)} al mes.`:'Sin impacto cuantificado.');
  V('Predictor',h.ifContinues?'apoya':'neutral',h.ifContinues||'Sin proyección asociada.');
  V('Optimizador',(h.alternatives||[]).length>=2?'apoya':'reserva',`${(h.alternatives||[]).length} alternativas identificadas.`);
  V('Protector',conf<.5&&h.valence==='risk'?'reserva':'apoya',conf<.5&&h.valence==='risk'?'Riesgo de alerta innecesaria: evidencia baja.':'Cálculo local; sin inferencias sensibles; bajo riesgo de falsa alarma.');
  const spendRelated=h.category==='spending';
  V('Humanista',!declared.length?'abstención':spendRelated&&declared.some(p=>/experien|disfrute|familia/i.test(p))&&h.valence==='risk'?'reserva':'apoya',!declared.length?'Aún no declaraste prioridades: no se evalúa la coherencia.':spendRelated&&declared.some(p=>/experien|disfrute|familia/i.test(p))&&h.valence==='risk'?'Declaraste valorar experiencias/familia: este gasto podría ser coherente con tus prioridades.':'Coherente con tus prioridades declaradas.');
  const refutes=votes.filter(v=>v.verdict==='refuta').length,supports=votes.filter(v=>v.verdict==='apoya').length,res=votes.filter(v=>v.verdict==='reserva').length;
  const verdict=refutes?'descartar':supports>=5&&res<=1?'sólido':supports>=3?'provisional':'débil';
  V('Sintetizador',verdict==='sólido'?'apoya':verdict==='descartar'?'refuta':'reserva',`Veredicto: ${verdict}. ${supports} a favor, ${res} con reservas, ${refutes} en contra.`);
  return {votes,verdict,dissent:votes.filter(v=>v.verdict==='reserva'||v.verdict==='refuta').map(v=>v.role+': '+v.note)};
 }

 /* ==========================================================================
    SOMBRA / PARADOJAS / MARIPOSA / TENDENCIA LENTA / EXCEPCIÓN→HÁBITO / COINCIDENCIA TEMPORAL
    ========================================================================== */
 const FIXED=/vivienda|servicios|seguro|deuda|educaci|salud|transporte|impuesto/i;
 const Hh=o=>Object.assign({kind:'fact',valence:'neutral',urgency:.2,impact:0,modules:['overview'],category:'habits',alternatives:[],evidence:[],minSeen:2},o);
 function shadow(F,snap,mem,conf){
  const out=[];const d=F.days;
  /* 1 · combinación atípica con indicadores individualmente normales */
  const base=d.filter(r=>r.x>0&&!r.ex);
  if(base.length>=40){const X=base.map(r=>[r.x,r.n,r.max,r.wd]);const sc=S.isolationForest(X,{seed:31});const cut=S.quantile(sc,.985);
   for(let i=0;i<base.length;i++){const r=base[i];if(r.d<addDays(F.end,-13)||sc[i]<Math.max(.62,cut))continue;
    const zs=[S.robustZ(r.x,base.map(q=>q.x)),S.robustZ(r.n,base.map(q=>q.n)),S.robustZ(r.max,base.map(q=>q.max))];
    if(zs.every(z=>Math.abs(z)<3.2)){out.push(Hh({key:'shadow.combo.'+r.d,engine:'shadow',type:'atypical-combination',category:'habits',title:`Un día normal en cada indicador, atípico en conjunto: ${r.d.slice(8)}/${r.d.slice(5,7)}`,
     summary:`El gasto (${fmt(r.x)}), el número de compras (${r.n}) y el mayor movimiento (${fmt(r.max)}) están dentro de tu rango por separado, pero esa combinación es poco habitual (aislamiento ${sc[i].toFixed(2)}).`,observed:sc[i],baseline:S.median(sc),deviation:sc[i]-S.median(sc),impact:0,dates:[r.d],
     confidence:conf({n:base.length,needed:80,strength:Math.min(1,(sc[i]-.6)/.3),stability:.6,completeness:F.profile.coverage+.3}),evidence:[['Gasto del día',fmt(r.x)],['Compras',String(r.n)],['Mayor movimiento',fmt(r.max)],['z robustos',zs.map(z=>z.toFixed(1)).join(' / ')],['Aislamiento',sc[i].toFixed(2)]],
     method:'Isolation Forest multivariable (gasto, compras, mayor movimiento, día) sobre tu historial; solo se reporta si ningún indicador por separado supera z 3,2. Es una observación, no un problema.',periods:`${base.length} días con gasto`,comparison:'frente a la combinación de tus días habituales',recurrence:'evento puntual',why:'Lo atípico no siempre está en una cifra: a veces está en la forma del día.',ifContinues:'Si se repite, se evaluará como cambio de comportamiento.',alternatives:['Marcar como excepción','Seguir observándolo'],action:{label:'Ver movimientos',target:'register'},modules:['register'],urgency:.15,minSeen:2}));break}}}
  /* 2 · tendencia lenta (Mann–Kendall) que CUSUM no ve */
  const w=F.weeks.slice(-26);if(w.length>=20){const mk=S.mannKendall(w.map(x=>x.x));
   if(mk&&mk.p<=.05&&Math.abs(mk.tau)>=.3&&!out.some(x=>x.type==='slow-trend')){const sl=S.sen(w.map(x=>x.x));const med=S.median(w.map(x=>x.x))||1;const pct=100*sl*w.length/med;
    if(Math.abs(pct)>=12)out.push(Hh({key:'shadow.slow-trend',engine:'shadow',type:'slow-trend',category:'spending',valence:sl>0?'risk':'positive',title:sl>0?'Hay un cambio silencioso: tu gasto sube poco a poco':'Hay un cambio silencioso: tu gasto baja poco a poco',summary:`Tu gasto semanal ${sl>0?'sube':'baja'} ≈ ${fmt(Math.abs(sl))} por semana (≈ ${Math.round(Math.abs(pct))} % en ${w.length} semanas) sin saltos que lo delaten.`,
     observed:sl,baseline:med,deviation:pct/100,impact:Math.abs(sl)*4.3*(w.length/4),confidence:conf({n:w.length,needed:26,strength:Math.min(1,Math.abs(mk.tau)/.6),stability:1-mk.p,completeness:F.profile.coverage+.3}),
     evidence:[['Pendiente (Theil–Sen)',fmt(sl)+' / semana'],['Tau de Kendall',mk.tau.toFixed(2)],['Valor p (Mann–Kendall)',mk.p.toFixed(3)],['Semanas',String(w.length)]],method:'Prueba de tendencia de Mann–Kendall (no paramétrica) y pendiente de Theil–Sen sobre el gasto semanal; detecta cambios lentos que un detector de saltos no ve.',periods:`${w.length} semanas`,comparison:'frente a ti mismo semana a semana',recurrence:`${w.length} semanas`,
     why:'Los cambios graduales son los más difíciles de percibir.',ifContinues:`Si sigue igual, en 6 meses tu gasto semanal sería ≈ ${fmt(med+sl*26)}.`,alternatives:['Confirmar que es tu nueva normalidad','Fijar un tope','Seguir observándolo'],action:{label:'Ver categorías',target:'categories'},modules:['overview','register'],urgency:sl>0?.35:.1,minSeen:2}))}}
  /* 3 · excepción que se vuelve hábito */
  if(F.profile.historyDays>=90){const spend=d.filter(r=>r.x>0).map(r=>r.x);const hi=S.quantile(spend,.9),mid=S.median(spend);const recent=d.slice(-42).filter(r=>r.x>=Math.max(hi,mid*2.5)).length,before=d.slice(-120,-42).filter(r=>r.x>=Math.max(hi,mid*2.5)).length;
   if(recent>=4&&before<=1)out.push(Hh({key:'shadow.exception-habit',engine:'shadow',type:'exception-to-habit',category:'habits',valence:'risk',title:'Una excepción se está convirtiendo en hábito',summary:`Hubo ${recent} días de gasto muy alto en las últimas 6 semanas, frente a ${before} en los 2 meses previos.`,observed:recent,baseline:before,deviation:recent-before,impact:0,
    confidence:conf({n:recent+before,needed:8,strength:Math.min(1,(recent-before)/5),stability:.6,completeness:F.profile.coverage+.3}),evidence:[['Días de gasto muy alto (6 semanas)',String(recent)],['En los 2 meses previos',String(before)],['Umbral',fmt(Math.max(hi,mid*2.5))]],method:'Conteo de días ≥ máx(P90, 2,5× mediana) en dos ventanas consecutivas; se reporta si ≥ 4 recientes y ≤ 1 previo.',periods:'últimas 18 semanas',comparison:'ventana reciente vs previa',recurrence:`${recent} ocurrencias`,
    why:'Un comportamiento extraordinario que se repite deja de ser extraordinario.',ifContinues:'Pasará a formar parte de tu nueva línea base si no lo confirmas o corriges.',alternatives:['Es intencional','Fue temporal','Fijar un tope'],action:{label:'Ver movimientos',target:'register'},modules:['register','overview'],urgency:.4,minSeen:2}))}
  /* 4 · paradojas (dos historias contradictorias) */
  const ms=(snap.months||[]).filter(m=>!m.partial&&m.txCount>0);
  if(ms.length>=6){const A=ms.slice(-3),B=ms.slice(-6,-3);const inc=S.median(A.map(m=>num(m.income))),incB=S.median(B.map(m=>num(m.income)));
   const fixed=m=>S.sum(Object.entries(m.expenseBy||{}).filter(([k])=>FIXED.test(k)).map(([,v])=>v)),vari=m=>S.sum(Object.entries(m.expenseBy||{}).filter(([k])=>!FIXED.test(k)).map(([,v])=>v));
   const fx=S.median(A.map(fixed)),fxB=S.median(B.map(fixed)),vr=S.median(A.map(vari)),vrB=S.median(B.map(vari));
   if(incB>0&&inc>=incB*1.1&&(num(snap.position&&snap.position.liquid)-num(snap.cardDebtDop))<0.5*(S.median(A.map(m=>num(m.income)))*0+1)*Math.max(0,S.median(B.map(m=>num(m.expense)))*3)&&fx>fxB*1.1)out.push(Hh({key:'paradox.income-freedom',engine:'shadow',type:'paradox-income-freedom',category:'liquidity',valence:'neutral',title:'Tus ingresos suben, pero tu libertad financiera no',summary:`Tu ingreso mediano subió ${Math.round(100*(inc/incB-1))} % (${fmt(incB)} → ${fmt(inc)}), pero tus gastos fijos subieron ${Math.round(100*(fx/fxB-1))} % y tu liquidez libre es baja.`,
    observed:inc,baseline:incB,deviation:inc/incB-1,impact:fx-fxB,confidence:conf({n:6,needed:6,strength:.6,stability:.7,completeness:.8}),evidence:[['Ingreso mediano (3 m)',fmt(inc)],['Ingreso mediano (3 m previos)',fmt(incB)],['Gasto fijo mediano (3 m)',fmt(fx)],['Gasto fijo (3 m previos)',fmt(fxB)]],method:'Contraste de dos indicadores que suelen interpretarse por separado (ingresos vs. gastos fijos y liquidez libre).',periods:'últimos 6 meses',comparison:'3 meses vs 3 meses previos',recurrence:'tendencia',
    why:'Más ingreso no equivale a más libertad si los compromisos suben al mismo ritmo.',ifContinues:'Tu margen discrecional no mejorará aunque ganes más.',alternatives:['Fijar qué parte del aumento va a ahorro','Revisar gastos fijos nuevos','Es una decisión deliberada'],action:{label:'Ver flujo',target:'income'},modules:['overview','income'],urgency:.3,minSeen:2}));
   if(vrB>0&&vr<=vrB*.9&&fx>=fxB*1.1)out.push(Hh({key:'paradox.spend-down-fixed-up',engine:'shadow',type:'paradox-spend-fixed',category:'spending',title:'Gastas menos en lo que decides, más en lo que ya está decidido',summary:`El gasto variable bajó ${Math.round(100*(1-vr/vrB))} % (${fmt(vrB)} → ${fmt(vr)}), pero el gasto fijo subió ${Math.round(100*(fx/fxB-1))} % (${fmt(fxB)} → ${fmt(fx)}).`,observed:fx,baseline:fxB,deviation:fx/fxB-1,impact:fx-fxB,
    confidence:conf({n:6,needed:6,strength:.6,stability:.7,completeness:.8}),evidence:[['Variable (3 m)',fmt(vr)],['Variable (3 m previos)',fmt(vrB)],['Fijo (3 m)',fmt(fx)],['Fijo (3 m previos)',fmt(fxB)]],method:'Clasificación de categorías en fijas (vivienda, servicios, seguros, deudas, educación, salud, transporte, impuestos) y variables, comparadas entre dos trimestres.',periods:'últimos 6 meses',comparison:'3 meses vs 3 meses previos',recurrence:'tendencia',
    why:'Un ahorro aparente en lo variable puede ocultar un deterioro en lo que menos puedes ajustar.',ifContinues:'Tu flexibilidad mensual seguirá disminuyendo.',alternatives:['Revisar qué compromiso fijo subió','Es temporal'],action:{label:'Ver categorías',target:'categories'},modules:['overview','register'],urgency:.3,minSeen:2}))}
  const ser=(snap.position&&snap.position.series)||[];
  if(ser.length>=4&&ser.every(x=>x.liquid!=null)){const nA=ser[0].net,nB=ser[ser.length-1].net,lA=ser[0].liquid,lB=ser[ser.length-1].liquid;
   if(nB>nA*1.03&&nA>0&&lB<lA*.9)out.push(Hh({key:'paradox.networth-liquidity',engine:'shadow',type:'paradox-networth-liquidity',category:'liquidity',title:'Tu patrimonio crece, pero tu liquidez disminuye',summary:`Patrimonio neto ${fmt(nA)} → ${fmt(nB)} (+${Math.round(100*(nB/nA-1))} %) mientras tu liquidez pasó de ${fmt(lA)} a ${fmt(lB)} (${Math.round(100*(lB/lA-1))} %).`,observed:lB,baseline:lA,deviation:lB/lA-1,impact:lA-lB,
    confidence:conf({n:ser.length,needed:4,strength:.6,stability:.6,completeness:.8}),evidence:[['Patrimonio (inicio)',fmt(nA)],['Patrimonio (ahora)',fmt(nB)],['Liquidez (inicio)',fmt(lA)],['Liquidez (ahora)',fmt(lB)]],method:'Comparación de la serie de patrimonio neto y de liquidez de los últimos meses (mismas fechas de corte).',periods:`${ser.length} cortes mensuales`,comparison:'primer vs último corte',recurrence:'tendencia',why:'Más patrimonio con menos liquidez reduce tu capacidad de reaccionar.',ifContinues:'Podrías ser más rico y menos flexible.',alternatives:['Es una inversión deliberada','Definir una reserva mínima'],action:{label:'Ver patrimonio',target:'patrimony'},modules:['patrimony','overview'],urgency:.3,minSeen:2}))}
  /* 5 · el problema no es cuánto, sino cuándo coinciden */
  const up=(snap.upcoming||[]).filter(u=>u.days>=0&&u.days<=30&&num(u.amountDop)>0);const tot=S.sum(up.map(u=>num(u.amountDop)));const liq=num(snap.position&&snap.position.liquid);
  if(up.length>=3&&tot>0&&liq>=tot){let best=0,bd=0;for(let s=0;s<=26;s++){const sum=S.sum(up.filter(u=>u.days>=s&&u.days<s+5).map(u=>num(u.amountDop)));if(sum>best){best=sum;bd=s}}
   if(best>=.5*tot&&best>=.4*liq)out.push(Hh({key:'shadow.timing-cluster',engine:'shadow',type:'timing-cluster',category:'liquidity',valence:'risk',title:'El problema no es cuánto debes pagar, sino cuándo coinciden',summary:`${fmt(best)} (${Math.round(100*best/tot)} % de tus próximos 30 días) vencen en una ventana de 5 días, a partir del día ${bd}. Tu liquidez total alcanza (${fmt(liq)}), pero ese tramo concentra el esfuerzo.`,observed:best,baseline:tot,deviation:best/tot,impact:best,
    confidence:conf({n:up.length,needed:6,strength:Math.min(1,best/tot),stability:.8,completeness:.9}),evidence:[['Vence en la ventana',fmt(best)],['Total 30 días',fmt(tot)],['Liquidez',fmt(liq)],['Inicio de la ventana',`día ${bd}`]],method:'Ventana deslizante de 5 días sobre los vencimientos registrados de los próximos 30 días.',periods:'próximos 30 días',comparison:'ventana más cargada vs total',recurrence:'estado actual',
    why:'Coincidir muchos pagos en pocos días tensa la liquidez aunque el total sea manejable.',ifContinues:'Si no se escalona, ese tramo exige disponibilidad inmediata.',alternatives:['Escalonar fechas con el acreedor','Reservar con anticipación','Mantener todo igual'],action:{label:'Ver compromisos',target:'pressure'},modules:['overview','pressure'],urgency:.6,minSeen:1,immediate:true}))}
  /* 6 · anomalía positiva (oportunidad): ingreso inusualmente alto */
  const incs=(snap.ledger||[]).filter(e=>e.k==='i'&&e.a>0&&e.d>=addDays(F.end,-120));
  if(incs.length>=6){const last=incs.filter(e=>e.d>=addDays(F.end,-20)).sort((a,b)=>b.a-a.a)[0];if(last&&S.robustZ(last.a,incs.map(e=>e.a))>=3.5&&last.a>S.median(incs.map(e=>e.a))*1.8)out.push(Hh({key:'shadow.income-anomaly.'+last.d,engine:'shadow',type:'positive-anomaly',category:'income',valence:'opportunity',title:'Entró un ingreso muy por encima de lo habitual: una oportunidad',summary:`${fmt(last.a)} el ${last.d.slice(8)}/${last.d.slice(5,7)}, frente a una mediana de ${fmt(S.median(incs.map(e=>e.a)))}. Una anomalía no es un problema: aquí es margen que puedes dirigir.`,observed:last.a,baseline:S.median(incs.map(e=>e.a)),deviation:S.robustZ(last.a,incs.map(e=>e.a)),impact:last.a-S.median(incs.map(e=>e.a)),dates:[last.d],
   confidence:conf({n:incs.length,needed:12,strength:.8,stability:.7,completeness:.8}),evidence:[['Ingreso',fmt(last.a)],['Mediana',fmt(S.median(incs.map(e=>e.a)))],['z robusto',S.robustZ(last.a,incs.map(e=>e.a)).toFixed(1)]],method:'z robusto (mediana/MAD) sobre tus ingresos de 120 días, clasificado por dirección: aquí es positiva.',periods:'120 días',comparison:'frente a tus ingresos habituales',recurrence:'evento puntual',why:'Decidir qué hacer con un ingreso extraordinario antes de que se diluya aumenta su efecto.',ifContinues:'Si es único, conviene tratarlo como extraordinario.',alternatives:['Reservar','Pagar deuda costosa','Dejarlo en liquidez'],action:{label:'Ver patrimonio',target:'patrimony'},modules:['overview','income'],urgency:.2,minSeen:1,immediate:true}))}
  /* 7 · efecto mariposa: pequeña decisión con efecto acumulado y sensibilidad */
  const small=(snap.ledger||[]).filter(e=>e.k==='x'&&e.a>0&&e.d>=addDays(F.end,-89));const thr=Math.min(500,S.quantile(F.amounts,.25)||0);
  if(thr>0){const sm=small.filter(e=>e.a<=thr);const perWeek=sm.length/(90/7);const avgT=sm.length?S.sum(sm.map(e=>e.a))/sm.length:0;
   const prior=(snap.ledger||[]).filter(e=>e.k==='x'&&e.a>0&&e.a<=thr&&e.d>=addDays(F.end,-179)&&e.d<addDays(F.end,-89)).length/(90/7);
   if(sm.length>=20&&perWeek>=prior*1.25&&prior>0){const extra=(perWeek-prior)*avgT*52/12;const liquid=num(snap.position&&snap.position.liquid);const sens=[.8,1,1.2].map(k=>({k,monthly:extra*k,year:extra*k*12}));
    out.push(Hh({key:'butterfly.small-frequency',engine:'shadow',type:'butterfly',category:'spending',title:'Una pequeña decisión que se repite más cada semana',summary:`Tus pagos pequeños pasaron de ${prior.toFixed(1)} a ${perWeek.toFixed(1)} por semana. El aumento equivale a ≈ ${fmt(extra)} al mes (rango ${fmt(sens[0].monthly)}–${fmt(sens[2].monthly)} según el ticket); en 12 meses ≈ ${fmt(extra*12)}, ${liquid>0?Math.round(100*extra*12/liquid)+' % de tu liquidez actual':''}.`,
     observed:perWeek,baseline:prior,deviation:perWeek/prior-1,impact:extra,confidence:conf({n:sm.length,needed:40,strength:Math.min(1,(perWeek/prior-1)/.8),stability:.6,completeness:F.profile.coverage+.3}),evidence:[['Pagos pequeños por semana (antes)',prior.toFixed(1)],['Pagos pequeños por semana (ahora)',perWeek.toFixed(1)],['Ticket promedio',fmt(avgT)],['Efecto mensual',fmt(extra)],['Sensibilidad ±20 % del ticket',`${fmt(sens[0].monthly)} – ${fmt(sens[2].monthly)}`]],
     method:'Cambio de frecuencia de pagos ≤ el menor entre RD$500 y tu P25 (90 días vs 90 previos) × ticket promedio, con análisis de sensibilidad. No es solo «gasto × 12»: se mide el cambio de frecuencia y su efecto sobre tu liquidez.',periods:'180 días',comparison:'90 días vs 90 previos',recurrence:`${sm.length} pagos`,why:'Los cambios pequeños en frecuencia se acumulan sin que ninguna compra parezca relevante.',ifContinues:`En un año, ≈ ${fmt(extra*12)} adicionales.`,alternatives:['Fijar un tope semanal','Identificar cuáles aportan valor','Es intencional'],action:{label:'Ver presupuesto',target:'budget'},modules:['register','budget','overview'],urgency:.15,minSeen:2}))}}
  return out;
 }

 /* ==========================================================================
    CURIOSIDAD — qué sabe, qué no, qué preguntar (valor de la información)
    ========================================================================== */
 function curiosity(snap,F,mem,disc){
  const known=[`${F.profile.historyDays} días de historial (${F.profile.maturity})`,`${F.paydays.length} cobros detectados`,`${(snap.recurring||[]).length} pagos recurrentes registrados`,`${(snap.cards||[]).length} productos de crédito`];
  const unknown=[];const gaps=[];
  const declared=(mem.declared&&mem.declared.priorities)||[];
  const surfaced=(disc&&disc.discoveries)||[];const inter=(disc&&disc.internal)||[];
  if(!declared.length)gaps.push({id:'priorities',value:clamp(.25+.15*surfaced.length+.05*inter.length),why:'Conocer tus prioridades permite evaluar si tu dinero sigue lo que declaras importante (hoy el consejo interno no puede evaluar la coherencia).',question:'¿Cuáles son tus prioridades hoy?',type:'multi',options:['Libertad','Seguridad','Familia','Experiencias','Aprendizaje','Estabilidad','Propósito','Disfrute'],effect:'Se usa en el consejo interno y en el laboratorio de decisiones.'});
  const liqProb=(inter.concat(surfaced)).find(h=>h.key==='pred.liquidity-30d');
  if(liqProb){const p=liqProb.observed;gaps.push({id:'planned-expense',value:clamp(4*p*(1-p)),why:'La proyección de liquidez tiene incertidumbre; un gasto grande planificado la reduciría.',question:'¿Esperas un gasto importante en los próximos 90 días?',type:'single',options:['No','Sí, menos de RD$20.000','Sí, entre RD$20.000 y RD$100.000','Sí, más de RD$100.000'],effect:'Se incorpora como supuesto en los escenarios adversos.'})}
  const incs=(snap.ledger||[]).filter(e=>e.k==='i'&&e.a>0).map(e=>e.a);
  if(incs.length>=6){const cv=S.stdev(incs)/(S.mean(incs)||1);if(cv>.4)gaps.push({id:'income-stability',value:clamp(cv/1.5),why:'Tus ingresos varían mucho; saber si es esperable mejora las proyecciones.',question:'¿Tus ingresos suelen variar así mes a mes?',type:'single',options:['Sí, es normal en mi trabajo','No, fue algo puntual'],effect:'Ajusta cuánta incertidumbre se asigna a las proyecciones.'})}
  const unc=num(snap.uncategorized);if(unc>=8)gaps.push({id:'categorization',value:clamp(unc/60),why:`${unc} movimientos sin categoría reducen la precisión de todos los análisis.`,question:'Clasificar estos movimientos mejora el análisis',type:'action',options:[],effect:'Mejora la detección de patrones.'});
  for(const c of snap.cardsNoLimit||[])gaps.push({id:'limit:'+c,value:.3,why:`Sin el límite de ${c} no se calcula su utilización.`,question:`¿Cuál es el límite de ${c}?`,type:'action',options:[],effect:'Activa las reglas de crédito.'});
  for(const h of inter.filter(x=>['hypothesis','learning'].includes(x.state)).slice(0,4))unknown.push(`${h.title}: ${h.seenDays||1}/${h.minSeen||2} evaluaciones`);
  if(F.weeks.length<16)unknown.push('Relaciones entre variables: se necesitan ≥ 16 semanas');
  if(F.profile.historyDays<365)unknown.push('Estacionalidad anual: se necesitan ≥ 365 días');
  unknown.push('Bienestar, Mi garaje y Metas: no hay datos guardados en la app (no se infiere nada)');
  const questions=[];
  if(F.windows[90]&&F.windows[90].count>0&&(F.profile.dailyRange||{}).high)questions.push({q:`¿Los días de gasto alto coinciden con tus fechas de cobro?`,answerable:F.paydays.length>=3,via:'secuencia cobro→gasto'});
  questions.push({q:'¿Qué parte de tu gasto es realmente tuya decidir (vs. compromisos)?',answerable:true,via:'modelo de tu realidad'});
  questions.push({q:'¿Hay cambios graduales que ningún indicador por separado muestra?',answerable:F.weeks.length>=20,via:'tendencia Mann–Kendall'});
  gaps.sort((a,b)=>b.value-a.value);
  const asked=(mem.qa&&mem.qa.asked)||{};const ready=gaps.filter(g=>g.type!=='action'&&g.value>=.25&&!(asked[g.id]&&diff(snap.today,asked[g.id])<14)&&!((mem.qa&&mem.qa.answers||{})[g.id]));
  return {known,unknown,gaps,questions,ask:ready[0]||null};
 }
 function answer(memIn,id,value,today){const m=JSON.parse(JSON.stringify(memIn||{}));m.qa=m.qa||{asked:{},answers:{}};m.qa.asked[id]=today;m.qa.answers[id]=value;m.declared=m.declared||{};if(id==='priorities')m.declared.priorities=[].concat(value).slice(0,8);if(id==='planned-expense')m.declared.plannedExpense=value;if(id==='income-stability')m.declared.incomeVariable=value;return m}

 /* ==========================================================================
    METACOGNICIÓN — registro de predicciones, desempeño real, abstención, Champion–Challenger, benchmark
    ========================================================================== */
 const CANDS={naive:a=>a[a.length-1],media3:a=>S.mean(a.slice(-3)),median3:a=>S.median(a.slice(-3)),ewma:a=>S.ewma(a,.5).slice(-1)[0],tendencia:a=>{const l=S.linreg(a.slice(-6));return l?l.predict(a.slice(-6).length).mean:a[a.length-1]}};
 function backtest(series,k=6){const names=Object.keys(CANDS);if(series.length<k+3)return null;const res={};const start=series.length-k;
  for(const n of names){const errs=[];for(let t=start;t<series.length;t++)errs.push(Math.abs(series[t]-CANDS[n](series.slice(0,t))));res[n]={mae:S.mean(errs),last3:S.mean(errs.slice(-3)),errs}}return res}
 /* Champion–Challenger: el campeón solo cambia si el retador mejora ≥ 10 % de forma estable; revierte si se degrada */
 function govern(mem,series){
  mem.models=mem.models||{};const m=mem.models.spend=mem.models.spend||{champion:'naive',version:1,history:[]};
  const k=Math.min(6,series.length-3);const bt=k>=3?backtest(series,k):null;if(!bt)return {ok:false,reason:'menos de 6 meses completos: no hay backtest suficiente; se usa el modelo ingenuo',champion:m.champion,version:m.version};
  const champ=bt[m.champion]||bt.naive;let challenger=null;for(const n of Object.keys(bt))if(n!==m.champion&&(!challenger||bt[n].mae<bt[challenger].mae))challenger=n;
  let event=null;
  if(k>=5&&challenger&&champ.mae>0&&bt[challenger].mae<champ.mae*.9&&bt[challenger].last3<=champ.last3){m.history.push({v:m.version,model:m.champion,mae:Math.round(champ.mae)});m.history=m.history.slice(-4);m.champion=challenger;m.version++;event={promoted:challenger}}
  else if(m.champion!=='naive'&&bt[m.champion].mae>bt.naive.mae*1.1){const prev=m.history.length?m.history[m.history.length-1].model:'naive';event={rolledBack:m.champion,to:prev};m.champion=prev;m.version++}
  return {ok:true,points:k,promotionAllowed:k>=5,champion:m.champion,version:m.version,metrics:Object.fromEntries(Object.entries(bt).map(([k,v])=>[k,Math.round(v.mae)])),naiveMae:Math.round(bt.naive.mae),event,pred:CANDS[m.champion](series),sigma:Math.max(S.stdev(bt[m.champion].errs),S.mad(bt[m.champion].errs),1)};
 }
 function logPrediction(mem,rec){mem.pred=mem.pred||[];if(mem.pred.some(p=>p.t===rec.t&&p.for===rec.for))return;mem.pred.push(rec);mem.pred=mem.pred.slice(-14)}
 function evaluatePredictions(mem,snap){
  let n=0;for(const p of mem.pred||[]){if(p.actual!=null)continue;if(p.t==='spend'){const m=(snap.months||[]).find(x=>x.ym===p.for&&!x.partial&&x.txCount>0);if(m){p.actual=Math.round(num(m.expense));p.err=Math.round(p.actual-p.pred);if(p.naive!=null)p.naiveErr=Math.round(p.actual-p.naive);p.hit=p.actual>=p.lo&&p.actual<=p.hi?1:0;n++}}}
  return n;
 }
 function performance(mem){
  const ev=(mem.pred||[]).filter(p=>p.actual!=null);if(!ev.length)return {n:0};
  const mae=S.mean(ev.map(p=>Math.abs(p.err))),cov=S.mean(ev.map(p=>p.hit)),naive=ev.filter(p=>p.naiveErr!=null);
  return {n:ev.length,mae:Math.round(mae),coverage:+cov.toFixed(2),naiveMae:naive.length?Math.round(S.mean(naive.map(p=>Math.abs(p.naiveErr)))):null};
 }
 function abstain(mem,type){const p=performance(mem);const gov=(mem.models&&mem.models.spend)||null;
  if(type==='spend'&&p.n>=4&&p.coverage<.5)return {abstain:true,reason:`su intervalo del 90 % solo acertó ${Math.round(p.coverage*100)} % de ${p.n} predicciones evaluadas`};
  if(type==='spend'&&p.n>=4&&p.naiveMae!=null&&p.mae>p.naiveMae*1.2)return {abstain:true,reason:'el modelo actual rinde peor que el ingenuo en predicciones ya evaluadas'};
  return {abstain:false}}
 /* Calibración de umbrales con la tasa real de falsos positivos reportada por el usuario */
 function calibrate(mem){const thr={};const by={};for(const f of mem.fb||[]){const e=by[f.engine]=by[f.engine]||{bad:0,good:0};if(f.a==='incorrect')e.bad++;if(f.a==='correct'||f.a==='helped')e.good++}
  for(const [e,v] of Object.entries(by)){const n=v.bad+v.good;if(n>=5&&v.bad/n>.4)thr[e]=.1}mem.thr=thr;return thr}
 function benchmark(mem,runtime){
  const p=performance(mem);const fb=mem.fb||[];const by={};for(const f of fb){const e=by[f.engine]=by[f.engine]||{incorrect:0,correct:0,helped:0,n:0};e.n++;if(f.a==='incorrect')e.incorrect++;if(f.a==='correct')e.correct++;if(f.a==='helped')e.helped++}
  const fp=Object.fromEntries(Object.entries(by).map(([k,v])=>[k,(v.incorrect+v.correct)>=3?+(v.incorrect/(v.incorrect+v.correct)).toFixed(2):null]));
  const total=fb.length,useful=fb.filter(f=>f.a==='helped').length,known=fb.filter(f=>f.a==='known').length;
  const m=mem.models&&mem.models.spend;
  return {predicciones:p,falsosPositivosPorMotor:fp,retroalimentacion:total,utilidadPercibida:total?+(useful/total).toFixed(2):null,repeticionesSilenciadas:known,
   modelo:m?{campeón:m.champion,versión:m.version,historial:(m.history||[]).length}:null,ejecuciones:(mem.audit||{}).runs||0,runtimeMs:runtime||null,
   nota:'Sin puntuación global: cada medida se reporta por separado y solo cuando hay evidencia suficiente (null = aún sin datos).'};
 }
 function recordBenchmark(mem,today){mem.bench=mem.bench||{hist:[]};const b=benchmark(mem);const mo=today.slice(0,7);if(mem.bench.hist.some(h=>h.m===mo))return;mem.bench.hist.push({m:mo,n:b.predicciones.n||0,mae:b.predicciones.mae||null,cov:b.predicciones.coverage||null,fb:b.retroalimentacion});mem.bench.hist=mem.bench.hist.slice(-12)}
 /* Desaprender: un patrón confirmado que deja de observarse se retira para revisión */
 function unlearn(mem,producedKeys,today){const out=[];for(const [k,v] of Object.entries(mem.know||{})){if(v.kind!=='pattern')continue;const h=(mem.hyp||{})[k];if(h&&!producedKeys.has(k)&&diff(today,h.last)>=28){v.status='retirado';v.retiredOn=today;out.push(k);delete mem.know[k];h.state='resolved'}}return out}

 const api={HORIZONS,lifeModel,horizon,chain,decisionLab,graph,science,council,shadow,curiosity,answer,backtest,govern,logPrediction,evaluatePredictions,performance,abstain,calibrate,benchmark,recordBenchmark,unlearn,CANDS};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ViveStrategy=api;
})(typeof window!=='undefined'?window:globalThis);
