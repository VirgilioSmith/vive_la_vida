'use strict';
/* VIVE SCORE CRÉDITO · estado, persistencia experimental y construcción de cortes a partir de datos reales.
   Se carga DESPUÉS de score.js (motor + vistas) y comparte su ámbito global. */
const VS_START='2026-11';                       // inicio del historial observado: 15 de noviembre de 2026
const MONTH_NAMES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const newStore=()=>({v:1,seeded:{},external:{tu:null},startedOn:VS_START,answers:null,answersLog:[],overrides:{},observed:{},settings:null,audit:[],seals:[],declVersion:0,lastScore:null,lastPeriod:null});
let ST=newStore(),PAYLOAD=null,qEditing=false,qStep=0,saveTimer=0,heightTimer=0,lastHeight=0;
function restoreStore(x){return x&&x.v===1?{...newStore(),...x}:newStore()}
function saveStore(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>VSHost.send('save',{store:ST}),250)}
function setOverride(id,patch){ST.overrides[id]={...(ST.overrides[id]||{}),...patch};saveStore()}

/* ---------- mensajería con el anfitrión ---------- */
const VSHost={
 send(type,data={}){try{parent.postMessage({vs:1,type,...data},location.origin)}catch(_){}},
 go(page){this.send('go',{page})},
 refresh(){this.send('refreshRequest')},
 afterRender(){const c=DB.months.length?evaluate(current()):null;this.send('score',{score:c&&c.score!==null?c.score:null,period:current()?.period||null})},
 boot(){
  window.addEventListener('message',e=>{
   if(e.origin!==location.origin||e.source!==parent)return;const m=e.data;if(!m||m.vs!==1)return;
   if(m.type==='init'){ST=restoreStore(m.store);PAYLOAD=m.payload||null;applyEnv(m.env);auditHistory=Array.isArray(ST.audit)?ST.audit.slice(0,200):[];if(ST.settings)DB.settings={...clone(CAP_DEFAULT),...ST.settings};applySeeds();rebuildDB();render()}
   else if(m.type==='env'){applyEnv(m.env);render()}
   else if(m.type==='data'){PAYLOAD=m.payload||PAYLOAD;applySeeds();rebuildDB();const a=document.activeElement;if(!(a&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)))render()}
  });
  this.send('ready');
 }
};
function applyEnv(env){
 if(!env)return;dark=env.mode!=='light';document.body.classList.toggle('night',dark);document.body.classList.toggle('black',env.mode==='black');
 const a=/^#[0-9a-f]{6}$/i.test(env.accent||'')?env.accent:(/^rgb/i.test(env.accent||'')?env.accent:'#159b81');
 document.body.style.setProperty('--teal',a);document.body.style.setProperty('--teal-dark',`color-mix(in srgb,${a} ${dark?'62%':'78%'},${dark?'#fff':'#000'})`);
}

/* ---------- utilidades de fecha en MES y AÑO ---------- */
const pIdx=p=>{const [y,m]=String(p).split('-').map(Number);return y*12+(m-1)};
const monthsFrom=(a,b)=>pIdx(b)-pIdx(a);
const validPeriod=p=>/^\d{4}-(0[1-9]|1[0-2])$/.test(String(p||''));
const myLabel=p=>validPeriod(p)?`${MONTH_NAMES[Number(p.slice(5))-1]} de ${p.slice(0,4)}`:'—';
const todayPeriod=()=>(PAYLOAD?.today||new Date().toISOString().slice(0,10)).slice(0,7);

/* ---------- hechos observados (solo lo que existe en la app) ---------- */
function factsFromPayload(P){
 if(!P)return {fx:60,cards:[],loans:[],unrated:[],incomes:[],fixed:[]};
 return {fx:P.fx,cards:clone(P.cards||[]),loans:clone(P.loans||[]),unrated:clone(P.unrated||[]),incomes:clone(P.incomes||[]),fixed:clone(P.fixed||[]),spending:clone(P.spending||null),liquidity:clone(P.liquidity||null)};
}
function withOverrides(list){return list.map(x=>{const o=ST.overrides[x.productId||x.id]||{};return {...x,openedSource:validPeriod(x.opened)?'app':(validPeriod(o.opened)?'usuario':'falta'),...((!validPeriod(x.opened)&&validPeriod(o.opened))?{opened:o.opened}:{}),...(o.status?{status:o.status}:{}),source:o.source||(x.source||'app'),evidenceVerified:!!o.evidenceVerified,evidenceNote:o.note||''}})}

/* ---------- contadores a partir de antecedentes declarados + observación ---------- */
function declaredCounters(period,observedLate){
 const A=ST.answers||{},c={lateShort:0,late30:0,late60:0,late90:0,late120:0,lateOlder:0,new0to6:0,new7to12:0,limitReq0to6:0,limitReq7to12:0,limitAuto:0,restructure:0,refinance:0,sources:{}};
 const bump=(dur,age,mult)=>{
  const key={'<30':'lateShort','30-59':'late30','60-89':'late60','90-119':'late90','120+':'late120'}[dur]||'late30';
  const limit=key==='lateShort'?12:24;if(age>=limit)c.lateOlder+=mult;else c[key]+=mult;
 };
 if(A.late?.answer==='yes')for(const e of A.late.events||[]){if(!validPeriod(e.period))continue;const age=monthsFrom(e.period,period);if(age<0)continue;bump(e.duration,age,e.repeated?2:1)}
 for(const o of observedLate||[]){const age=monthsFrom(o.period,period);if(age>=0)bump(o.duration,age,1)}
 const windowAdd=(per,key06,key712)=>{if(!validPeriod(per))return;const age=monthsFrom(per,period);if(age<0)return;if(age<=6)c[key06]++};
 if(A.newCards?.answer==='yes')for(const x of A.newCards.items||[])windowAdd(x.period,'new0to6','new7to12');
 if(A.newLoans?.answer==='yes')for(const x of A.newLoans.items||[])windowAdd(x.period,'new0to6','new7to12');
 if(A.limit?.answer==='yes')for(const x of A.limit.events||[]){if(x.kind==='requested')windowAdd(x.period,'limitReq0to6','limitReq7to12');else if(x.kind!=='decrease')c.limitAuto++}
 if(A.other?.answer==='yes')for(const x of A.other.items||[]){if(!validPeriod(x.period))continue;const age=monthsFrom(x.period,period);if(age<0||age>=24)continue;if(x.type==='reestructuracion')c.restructure++;if(x.type==='refinanciamiento')c.refinance++}
 return c;
}
function productList(facts){return [...facts.cards.map(x=>({...x,kind:'card'})),...(facts.unrated||[]),...facts.loans.map(x=>({...x,kind:'loan'}))].filter(x=>x.reported!==false)}
function openedOf(p){return validPeriod(p.opened)?p.opened:(validPeriod(ST.overrides[p.productId||p.id]?.opened)?ST.overrides[p.productId||p.id].opened:'')}
function windowOf(age){return age<0?'futuro':age<=6?'0–6 meses':'más de 6 meses'}
function appOpenings(facts,period){
 const out={n0to6:0,n7to12:0,list:[]},seen=new Set();
 for(const p of productList(facts)){const key=p.kind+':'+(p.productId||p.id);if(seen.has(key))continue;seen.add(key);const o=openedOf(p),age=o?monthsFrom(o,period):null;
  out.list.push({key,name:(p.name||'').replace(/ · (DOP|USD)$/,''),kind:p.kind,bank:p.bank||'',opened:o,age,window:o?windowOf(age):'falta la fecha',source:validPeriod(p.opened)?'registrada en vive el hoy':(o?'completada por ti':'sin dato'),unrated:!!p.reason,closed:p.status==='closed'});
  if(!o||age<0)continue;if(age<=6)out.n0to6++}
 return out;
}
function dpdBucket(d){return d>=120?'120+':d>=90?'90-119':d>=60?'60-89':d>=30?'30-59':'<30'}

/* ---------- construcción de cada corte ---------- */
function materialize(period,idxInList){
 const rec=ST.observed[period],facts=rec.facts,A=ST.answers||{};
 const allCards=withOverrides(facts.cards),allLoans=withOverrides(facts.loans),cards=allCards.filter(x=>x.reported!==false),loans=allLoans.filter(x=>x.reported!==false);
 // mora observada en cortes anteriores (se guarda solo lo que la app registró)
 const observedLate=[];
 for(const p of Object.keys(ST.observed).sort()){if(p>=period)continue;const f=ST.observed[p].facts;const worst=Math.max(0,...f.cards.concat(f.loans).filter(x=>x.reported!==false).map(x=>Number(x.daysPastDue)||0));if(worst>0)observedLate.push({period:p,duration:dpdBucket(worst)})}
 const dc=declaredCounters(period,observedLate),ao=appOpenings(facts,period);
 // antigüedad: apertura registrada en la app o declarada, en mes y año
 const opened=[...cards,...loans,...(facts.unrated||[]).map(u=>({...u,opened:openedOf(u)}))].filter(x=>x.status!=='closed'&&validPeriod(x.opened)).map(x=>x.opened);
 const declaredFirst=validPeriod(A.first?.period)?A.first.period:'';
 const earliestApp=opened.length?opened.slice().sort()[0]:'';
 const oldest=[earliestApp,declaredFirst].filter(Boolean).sort()[0]||'';
 const historyMonths=oldest?Math.max(0,monthsFrom(oldest,period)):0;
 const ages=opened.map(o=>Math.max(0,monthsFrom(o,period)));
 const avgEstimated=!ages.length&&historyMonths>0;
 const avgHistoryMonths=ages.length?Math.round(ages.reduce((a,v)=>a+v,0)/ages.length):historyMonths;
 const keys=Object.keys(ST.observed).sort(),recordMonths=Math.max(1,keys.indexOf(period)+1);
 const formalInc=facts.incomes.filter(i=>i.kind==='formal'),informalInc=facts.incomes.filter(i=>i.kind!=='formal');
 // Adicionales (bonos, comisiones…): se reconocen si aparecen en ≥3 de los últimos 6 meses (promedio de 6 meses); con menos se reconocen proporcionalmente.
 const extraMonthly=l=>l.reduce((a,i)=>a+((i.extra?.total6||0)/6)*clamp((i.extra?.months||0)/3,0,1),0);
 const payroll={gross:formalInc.reduce((a,i)=>a+(i.gross||0),0),afp:formalInc.reduce((a,i)=>a+(i.afp||0),0),sfs:formalInc.reduce((a,i)=>a+(i.sfs||0),0),isr:formalInc.reduce((a,i)=>a+(i.isr||0),0),other:formalInc.reduce((a,i)=>a+(i.other||0),0),net:formalInc.reduce((a,i)=>a+i.net,0),extra:extraMonthly(formalInc),sources:facts.incomes.map(i=>({name:i.name,kind:i.kind,frequency:i.frequency,net:i.net,extra:i.extra}))};
 const informalVerified=informalInc.length&&informalInc.every(i=>i.verified),maxRec=a=>Math.max(0,...a.map(i=>i.recurrenceMonths||0));
 // calibración: sin respuesta de atrasos, o sin antigüedad conocida, no se calcula ningún puntaje
 const missing=[];
 if(!A.completed)missing.push('Falta completar el cuestionario de antecedentes.');
 else{
  if(!A.late||A.late.answer==null)missing.push('No has respondido la pregunta sobre atrasos.');
  if(A.late?.answer==='unsure')missing.push('Atrasos: respondiste «No estoy seguro»; sin esa información el historial de pagos no puede puntuarse.');
  if(historyMonths<=0)missing.push('Falta la antigüedad crediticia (mes y año de tu primera tarjeta o préstamo).');
 }
 const events=[];
 const add=(type,per,label,note)=>events.push({id:'ev-'+events.length,type,date:validPeriod(per)?per:'',label,note});
 for(const e of (A.late?.answer==='yes'?A.late.events||[]:[]))add('late',e.period,'Atraso declarado · '+(e.productLabel||'producto'),`Duración ${e.duration||'—'} · ${e.resolved?'regularizado':'sin regularizar'}${e.repeated?' · más de una vez':''} · declaración personal`);
 for(const e of (A.limit?.answer==='yes'?A.limit.events||[]:[]))add('limit',e.period,(e.detected?(e.kind==='decrease'?'Reducción de límite detectada · ':'Cambio de límite detectado · '):'Aumento de límite declarado · ')+(e.productLabel||'tarjeta'),`${e.prev||'—'} → ${e.next||'—'} ${e.currency||''} · ${e.kind==='requested'?'solicitado':e.kind==='decrease'?'reducción':'automático'} · ${e.detected?'observado en la app':'declaración personal'}`);
 for(const e of (A.newCards?.answer==='yes'?A.newCards.items||[]:[]))add('open',e.period,'Tarjeta nueva declarada · '+(e.inst||'institución'),`Límite original ${e.limit||'—'} ${e.currency||''} · ${e.kind==='additional'?'tarjeta adicional':'línea nueva'} · declaración personal`);
 for(const e of (A.newLoans?.answer==='yes'?A.newLoans.items||[]:[]))add('open',e.period,'Préstamo declarado · '+(e.inst||'institución'),`${e.loanType||'préstamo'} · monto ${e.amount||'—'} · plazo ${e.term||'—'} · estado ${e.state||'—'} · declaración personal`);
 for(const e of (A.closed?.answer==='yes'?A.closed.items||[]:[]))add('close',e.period,'Producto cerrado · '+(e.productLabel||'producto'),`${e.reason||'motivo no indicado'} · ${e.state||'—'} · declaración personal`);
 for(const e of (A.other?.answer==='yes'?A.other.items||[]:[]))add('other',e.period,'Acontecimiento declarado · '+(OTHER_TYPES[e.type]||e.type),`${e.note||'sin nota'} · declaración personal`);
 return {
  period,txRate:facts.fx,formal:formalInc.reduce((a,i)=>a+i.net,0),formalMonths:maxRec(formalInc),formalVerified:formalInc.length>0&&formalInc.every(i=>i.verified),otherFormal:extraMonthly(formalInc),payroll,
  informal:informalInc.reduce((a,i)=>a+i.net,0)+extraMonthly(informalInc),informalQuality:!informalInc.length?'none':informalVerified?'verified':'declared',informalMonths:maxRec(informalInc),paid:0,
  lateShort:dc.lateShort,late30:dc.late30,late60:dc.late60,late90:dc.late90,late120:dc.late120,lateOlder:dc.lateOlder+0,
  collections:0,chargeOffs:0,judicial:0,historyMonths,avgHistoryMonths,avgEstimated,recordMonths,
  hard0to3:0,hard4to6:0,hard7to12:0,
  new0to6:Math.max(dc.new0to6,0)+ao.n0to6,new7to12:Math.max(dc.new7to12,0)+ao.n7to12,products:ao.list,limitReq0to6:dc.limitReq0to6,limitReq7to12:dc.limitReq7to12,limitAuto:dc.limitAuto,
  restructure:dc.restructure,refinance:dc.refinance,
  reportedTU:null,reportedEquifax:null,reportDate:rec.observedAt,cards,loans,
  expenses:[...facts.fixed.map(f=>({id:f.id,name:f.name,kind:f.kind||'subscription',amount:f.amount,onCard:!!f.onCard})),...((facts.spending?.categories)||[]).filter(r=>r.kind==='essential'&&r.total>0).map(r=>({id:'sp-'+r.category,name:r.category+' (efectivo y transferencia)',kind:'essential',amount:r.total,onCard:false,auto:true}))],spending:facts.spending||null,liquidity:facts.liquidity||null,events,missing,
  oldestPeriod:oldest,ageSource:!oldest?'desconocida':(earliestApp&&(!declaredFirst||earliestApp<=declaredFirst))?(cards.concat(loans).some(x=>x.opened===oldest&&x.evidenceVerified)?'verificada':'registrada en vive el hoy'):'declarada',
  declVersion:ST.declVersion,closedMonth:!!rec.closed
 };
}

function rebuildDB(){
 if(!PAYLOAD){DB.months=[];return}
 const cur=todayPeriod(),facts=factsFromPayload(PAYLOAD);
 const prev=ST.observed[cur];
 if(!prev||JSON.stringify(prev.facts)!==JSON.stringify(facts)){ST.observed[cur]={facts,observedAt:PAYLOAD.today,closed:false};saveStore()}
 for(const p of Object.keys(ST.observed))if(p<cur&&!ST.observed[p].closed){ST.observed[p].closed=true;saveStore()}
 const periods=Object.keys(ST.observed).filter(p=>p>=VS_START||p===cur).sort();
 DB.months=periods.map((p,i)=>materialize(p,i));
 DB.settings={...clone(CAP_DEFAULT),...(ST.settings||{})};DB.seals=ST.seals=Array.isArray(ST.seals)?ST.seals:[];DB.metadata={source:'datos reales de vive el hoy',startedOn:VS_START};
 idx=DB.months.length-1;editIndex=idx;
 if(!sim.cardId||!current().cards.some(c=>c.id===sim.cardId))sim.cardId=current().cards[0]?.id||'';
}
const OTHER_TYPES={refinanciamiento:'Refinanciamiento',reestructuracion:'Reestructuración',consolidacion:'Consolidación',avance:'Avance de efectivo',sobrelimite:'Sobrelímite',abono:'Pago extraordinario a capital',suspension:'Suspensión',otro:'Otro acontecimiento relevante'};
