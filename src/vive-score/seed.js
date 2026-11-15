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
function applySeeds(){
 if(!PAYLOAD)return false;
 ST.seeded=ST.seeded||{};let changed=false;const A=ensureAnswers();
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
 return changed;
}
