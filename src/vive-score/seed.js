'use strict';
/* VIVE SCORE CRÉDITO · antecedentes ya conocidos (cargados por indicación del titular).
   Se aplican UNA vez por clave, sin pasar por el cuestionario, y quedan como DECLARACIÓN PERSONAL (no verificada):
   puedes verlos, editarlos o quitarlos en «Configuración y antecedentes → Editar antecedentes».
   Si el titular los borra a propósito, no se vuelven a cargar (se recuerda en ST.seeded). */
const SEEDS=[
 {key:'limit-popular-2026-08',kind:'limit',match:/popular/i,period:'2026-08',label:'Popular',
  changes:[{currency:'DOP',prev:200000,next:400000},{currency:'USD',prev:3000,next:6000}],note:'Aumento automático del banco: de RD$200,000 y US$3,000 a RD$400,000 y US$6,000.'},
 {key:'limit-cibao-2026-09',kind:'limit',match:/cibao/i,period:'2026-09',label:'Cibao',
  changes:[{currency:'DOP',prev:144000,next:400000},{currency:'USD',prev:2000,next:6000}],note:'Aumento automático del banco: de RD$144,000 y US$2,000 a RD$400,000 y US$6,000.'}
];
/* Historial de límites: la app no guarda uno, así que VIVE SCORE recuerda el último límite visto de cada tarjeta y moneda.
   Si cambia (porque lo editas en vive el hoy), registra solo el cambio con fecha y hora exactas; el score lo cuenta desde ese mes y año.
   La primera lectura es la línea base (no se inventa historia). Un aumento se registra como automático (no penaliza); puedes marcarlo como solicitado en Antecedentes. */
function observeLimits(A){
 ST.limitObs=ST.limitObs||{};let n=0;const at=new Date().toISOString();
 for(const c of (PAYLOAD.cards||[])){
  const lim=Number(c.limit);if(!(lim>0))continue;
  const key='card:'+(c.productId||c.id)+':'+c.currency,old=ST.limitObs[key];
  if(!old){ST.limitObs[key]={limit:lim,at};n++;continue}
  if(old.limit===lim)continue;
  const label=(c.name||'Tarjeta').replace(/ · (DOP|USD)$/,'');
  A.limit.answer='yes';A.limit.autoFilled=true;A.limit.confirmed=true;
  A.limit.events.push({id:uid(),detected:true,at,product:'card:'+(c.productId||c.id),productLabel:label,period:todayPeriod(),currency:c.currency,prev:old.limit,next:lim,kind:lim>old.limit?'automatic':'decrease',note:'Cambio de límite detectado en vive el hoy el '+at.slice(0,10)+' a las '+at.slice(11,16)+' (UTC).'});
  ST.limitObs[key]={limit:lim,at};n++;
  auditLog('Detectó un cambio de límite en '+label+' ('+c.currency+'): '+old.limit+' → '+lim+'.');
 }
 return n;
}
function applySeeds(){
 if(!PAYLOAD)return false;
 ST.seeded=ST.seeded||{};let changed=false;const A=ensureAnswers();
 let auto=false;
 const ev0=A.limit.events.length;if(observeLimits(A)){auto=true;if(A.limit.events.length>ev0)ST.declVersion++}
 /* Aperturas recientes: se leen solas de las fechas de apertura de vive el hoy (ventana de 0–6 meses); no hay nada que seleccionar. */
 for(const k of ['newCards','newLoans'])if(A[k]&&A[k].answer==null){A[k].answer='no';A[k].items=[];A[k].auto=true;auto=true}
 for(const sd of SEEDS){
  if(ST.seeded[sd.key])continue;
  const card=uniqueProducts().find(p=>p.kind==='card'&&(sd.match.test(p.name||'')||sd.match.test(p.bank||'')));
  if(!card)continue;                                   // si la tarjeta no está registrada todavía, se intenta en la próxima carga
  const pid='card:'+(card.productId||card.id),label=card.name.replace(/ · (DOP|USD)$/,'');
  A.limit.answer='yes';A.limit.autoFilled=true;A.limit.confirmed=true;
  for(const ch of sd.changes)A.limit.events.push({id:uid(),seed:sd.key,product:pid,productLabel:label,period:sd.period,currency:ch.currency,prev:ch.prev,next:ch.next,kind:'automatic',note:sd.note,confirmPrev:!!sd.confirmPrev});
  ST.seeded[sd.key]=true;changed=true;
 }
 if(changed){ST.declVersion++;ST.answersLog=[{at:new Date().toISOString(),version:ST.declVersion,answers:JSON.parse(JSON.stringify(A))},...(ST.answersLog||[])].slice(0,20);auditLog('Cargó automáticamente los aumentos de límite indicados por el titular (Popular, agosto de 2026; Cibao, septiembre de 2026).');saveStore()}
 return changed||auto;
}
