'use strict';
/* VIVE SCORE CRÉDITO · cuestionario inteligente de calibración.
   - Todas las fechas históricas se piden SOLO en mes y año.
   - No hay preguntas sobre consultas de TransUnion, Equifax ni otros burós.
   - Lo que respondes se guarda como DECLARACIÓN PERSONAL (no como evidencia bancaria verificada). */
const Q_STEPS=[
 ['late','Atrasos','¿Te has atrasado alguna vez en el pago de una tarjeta de crédito o préstamo?'],
 ['limit','Aumentos de límite','¿Te han aumentado el límite de alguna tarjeta de crédito?'],
 ['newCards','Tarjetas nuevas','¿Has adquirido alguna tarjeta de crédito recientemente?'],
 ['newLoans','Préstamos recientes','¿Has solicitado o recibido algún préstamo recientemente?'],
 ['first','Antigüedad','¿En qué mes y año obtuviste tu primera tarjeta de crédito o préstamo?'],
 ['closed','Créditos cerrados','¿Has cancelado o cerrado anteriormente alguna tarjeta o préstamo?'],
 ['other','Otros acontecimientos','¿Hubo refinanciamientos, reestructuraciones, consolidaciones, avances de efectivo, sobrelímites, pagos extraordinarios, suspensiones u otros?'],
 ['summary','Resumen','Revisa tus antecedentes antes de comenzar']
];
const BLANK={
 late:()=>({id:uid(),product:'',productLabel:'',productOther:'',period:'',duration:'<30',resolved:true,repeated:false}),
 limit:()=>({id:uid(),product:'',productLabel:'',period:'',prev:'',next:'',kind:'automatic'}),
 newCards:()=>({id:uid(),inst:'',period:'',limit:'',currency:'DOP',kind:'new'}),
 newLoans:()=>({id:uid(),inst:'',loanType:'personal',period:'',amount:'',term:'',quota:'',state:'vigente'}),
 closed:()=>({id:uid(),product:'',productLabel:'',productOther:'',period:'',reason:'',state:'cancelado sin saldo'}),
 other:()=>({id:uid(),type:'otro',period:'',note:''})
};
const LIST_KEY={late:'events',limit:'events',newCards:'items',newLoans:'items',closed:'items',other:'items'};
const uid=()=>'q'+Math.random().toString(36).slice(2,9);
function ensureAnswers(){
 if(ST.answers)return ST.answers;
 const app=appProducts().filter(p=>validPeriod(p.opened)).map(p=>p.opened).sort()[0]||'';
 ST.answers={completed:false,completedAt:null,
  // Tu declaración inicial («nunca he tenido atrasos y estoy al día»), precargada para que la confirmes.
  late:{answer:'no',prefilled:true,confirmed:false,events:[]},
  limit:{answer:null,events:[]},newCards:{answer:null,items:[]},newLoans:{answer:null,items:[]},
  first:{period:app,fromApp:!!app,confirmed:false},closed:{answer:null,items:[]},other:{answer:null,items:[]}};
 return ST.answers;
}
function appProducts(){return PAYLOAD?[...(PAYLOAD.cards||[]).map(c=>({...c,kind:'card'})),...(PAYLOAD.loans||[]).map(l=>({...l,kind:'loan'}))]:[]}
function uniqueProducts(){const seen=new Set();return appProducts().filter(p=>{const k=p.kind+':'+(p.productId||p.id);if(seen.has(k))return false;seen.add(k);return true})}
const getObj=(path)=>{const parts=path.split('.');let o=ST.answers;for(const p of parts)o=o?.[p];return o};
function setPath(path,value){const parts=path.split('.'),last=parts.pop();let o=ST.answers;for(const p of parts)o=o[p];o[last]=value}

/* ---------- selector visual de mes y año ---------- */
function myPicker(path,item,label){
 const per=validPeriod(item.period)?item.period:'',m=item._m||(per?per.slice(5):''),y=item._y||(per?per.slice(0,4):'');
 const now=new Date().getFullYear(),years=[];for(let a=now;a>=now-40;a--)years.push(a);
 return `<div class="qmy"><span class="qlabel">${safe(label)}</span><div class="qmyrow"><select class="formSelect" data-q-field="${path}|m" aria-label="${safe(label)} · mes"><option value="">Mes</option>${MONTH_NAMES.map((n,i)=>{const v=String(i+1).padStart(2,'0');return `<option value="${v}" ${m===v?'selected':''}>${n[0].toUpperCase()+n.slice(1)}</option>`}).join('')}</select><select class="formSelect" data-q-field="${path}|y" aria-label="${safe(label)} · año"><option value="">Año</option>${years.map(a=>`<option value="${a}" ${String(a)===String(y)?'selected':''}>${a}</option>`).join('')}</select></div></div>`;
}
function qSelect(path,val,label,options){return `<label class="qfield"><span class="qlabel">${safe(label)}</span><select class="formSelect" data-q-field="${path}">${options.map(([v,t])=>`<option value="${safe(v)}" ${String(val)===String(v)?'selected':''}>${safe(t)}</option>`).join('')}</select></label>`}
function qInput(path,val,label,opts={}){return `<label class="qfield"><span class="qlabel">${safe(label)}</span><input class="formInput" data-q-field="${path}" ${opts.num?'data-q-type="num" type="number" min="0" step="any"':'type="text" maxlength="120"'} value="${safe(val??'')}" ${opts.ph?`placeholder="${safe(opts.ph)}"`:''}></label>`}
function qCheck(path,val,label){return `<label class="qcheck"><input type="checkbox" data-q-field="${path}" data-q-type="bool" ${val?'checked':''}> <span>${safe(label)}</span></label>`}
function productSelect(path,item,label,kind){
 const opts=[['','Selecciona…'],...uniqueProducts().filter(p=>!kind||p.kind===kind).map(p=>[p.kind+':'+(p.productId||p.id),p.name+(p.bank?` · ${p.bank}`:'')]),['other','Otro producto (no registrado)']];
 return qSelect(path+'.product',item.product,label,opts)+(item.product==='other'?qInput(path+'.productOther',item.productOther,'¿Cuál producto?',{ph:'Institución y producto'}):'');
}
function chips(key,val,labels){return `<div class="qchips" role="group">${labels.map(([v,t])=>`<button type="button" class="qchip ${val===v?'on':''}" data-q-act="ans" data-q-arg="${key}:${v}" aria-pressed="${val===v}">${t}</button>`).join('')}</div>`}
function listBlock(key,render,addLabel){
 const A=ST.answers[key],arr=A[LIST_KEY[key]];
 return `${arr.map((it,i)=>`<div class="qitem"><div class="qitemhead"><b>Registro ${i+1}</b><button type="button" class="smallbtn dangerText" data-q-act="rm" data-q-arg="${key}:${i}">Quitar</button></div><div class="qgrid">${render(it,`${key}.${LIST_KEY[key]}.${i}`)}</div></div>`).join('')}<button type="button" class="smallbtn" data-q-act="add" data-q-arg="${key}">+ ${addLabel}</button>`;
}

/* ---------- pasos ---------- */
function stepBody(id){
 const A=ensureAnswers(),yn=[['no','No'],['yes','Sí'],['unsure','No estoy seguro']];
 if(id==='late'){
  return `${chips('late',A.late.answer,[['no','No, nunca'],['yes','Sí'],['unsure','No estoy seguro']])}
  ${A.late.answer==='no'&&A.late.prefilled?`<div class="callout"><b>Tu declaración inicial:</b> «nunca he tenido atrasos y actualmente estoy al día con todas mis obligaciones». Se guarda como <b>declaración personal</b>, no como evidencia bancaria verificada. Si es correcta, pulsa Siguiente para confirmarla.</div>`:''}
  ${A.late.answer==='unsure'?`<div class="callout warn">Sin esta información no puedo puntuar tu historial de pagos y el score quedará sin calcular hasta que respondas Sí o No.</div>`:''}
  ${A.late.answer==='yes'?listBlock('late',(it,p)=>`${productSelect(p,it,'Producto afectado')}${myPicker(p,it,'Mes y año del atraso')}${qSelect(p+'.duration',it.duration,'Duración aproximada',[['<30','Menos de 30 días'],['30-59','30 a 59 días'],['60-89','60 a 89 días'],['90-119','90 a 119 días'],['120+','120 días o más']])}${qCheck(p+'.resolved',it.resolved,'Ya se regularizó')}${qCheck(p+'.repeated',it.repeated,'Ocurrió más de una vez')}`,'Agregar otro atraso'):''}`;
 }
 if(id==='limit'){
  return `${chips('limit',A.limit.answer,yn.slice(0,2))}${A.limit.answer==='yes'?listBlock('limit',(it,p)=>`${productSelect(p,it,'Tarjeta','card')}${myPicker(p,it,'Mes y año del aumento')}${qInput(p+'.prev',it.prev,'Límite anterior',{num:true})}${qInput(p+'.next',it.next,'Límite nuevo',{num:true})}${qSelect(p+'.kind',it.kind,'Tipo de aumento',[['automatic','Automático'],['requested','Solicitado por mí']])}`,'Agregar otro aumento'):''}`;
 }
 if(id==='newCards'){
  const recent=uniqueProducts().filter(p=>p.kind==='card'&&validPeriod(p.opened)&&monthsFrom(p.opened,todayPeriod())<=12);
  return `${recent.length?`<div class="callout"><b>Ya registrado en vive el hoy:</b> ${recent.map(p=>`${safe(p.name)} (${myLabel(p.opened)})`).join(' · ')}. Estas tarjetas ya se cuentan; no las repitas aquí.</div>`:''}${chips('newCards',A.newCards.answer,yn.slice(0,2))}${A.newCards.answer==='yes'?listBlock('newCards',(it,p)=>`${qInput(p+'.inst',it.inst,'Institución o tarjeta',{ph:'Ej. Banco, producto'})}${myPicker(p,it,'Mes y año de apertura')}${qInput(p+'.limit',it.limit,'Límite original',{num:true})}${qSelect(p+'.currency',it.currency,'Moneda',[['DOP','RD$'],['USD','US$']])}${qSelect(p+'.kind',it.kind,'Tipo',[['new','Línea nueva'],['additional','Tarjeta adicional']])}`,'Agregar otra tarjeta'):''}`;
 }
 if(id==='newLoans'){
  const recent=uniqueProducts().filter(p=>p.kind==='loan'&&validPeriod(p.opened)&&monthsFrom(p.opened,todayPeriod())<=12);
  return `${recent.length?`<div class="callout"><b>Ya registrado en vive el hoy:</b> ${recent.map(p=>`${safe(p.name)} (${myLabel(p.opened)})`).join(' · ')}.</div>`:''}${chips('newLoans',A.newLoans.answer,yn.slice(0,2))}${A.newLoans.answer==='yes'?listBlock('newLoans',(it,p)=>`${qInput(p+'.inst',it.inst,'Institución')}${qSelect(p+'.loanType',it.loanType,'Tipo de préstamo',[['personal','Personal'],['hipotecario','Hipotecario'],['vehiculo','Vehículo'],['nomina','De nómina'],['otro','Otro']])}${myPicker(p,it,'Mes y año')}${qInput(p+'.amount',it.amount,'Monto original',{num:true})}${qInput(p+'.term',it.term,'Plazo (meses)',{num:true})}${qInput(p+'.quota',it.quota,'Cuota',{num:true})}${qSelect(p+'.state',it.state,'Estado actual',[['vigente','Vigente'],['saldado','Saldado'],['refinanciado','Refinanciado']])}`,'Agregar otro préstamo'):''}`;
 }
 if(id==='first'){
  const known=uniqueProducts().filter(p=>validPeriod(p.opened)).sort((a,b)=>a.opened.localeCompare(b.opened));
  return `${known.length?`<div class="callout"><b>En vive el hoy:</b> ${known.map(p=>`${safe(p.name)} · apertura ${myLabel(p.opened)}`).join(' · ')}. La fecha de <b>apertura bancaria</b> es distinta de la fecha en que registraste el producto en la app; aquí usamos la apertura.</div>`:'<div class="callout warn">Ningún producto tiene fecha de apertura en la app. Indícala aquí; se guardará como declarada.</div>'}
  <div class="qgrid">${myPicker('first',A.first,'Mes y año de tu primer crédito')}${qCheck('first.confirmed',A.first.confirmed,A.first.fromApp?'Confirmo la fecha tomada de mis datos':'Confirmo esta fecha como correcta')}</div>`;
 }
 if(id==='closed'){
  return `${chips('closed',A.closed.answer,yn.slice(0,2))}${A.closed.answer==='yes'?listBlock('closed',(it,p)=>`${productSelect(p,it,'Producto')}${myPicker(p,it,'Mes y año del cierre')}${qInput(p+'.reason',it.reason,'Motivo')}${qSelect(p+'.state',it.state,'Estado final',[['cancelado sin saldo','Cancelado sin saldo'],['saldado','Saldado'],['castigado','Castigado'],['otro','Otro']])}`,'Agregar otro producto'):''}`;
 }
 if(id==='other'){
  return `${chips('other',A.other.answer,yn.slice(0,2))}${A.other.answer==='yes'?listBlock('other',(it,p)=>`${qSelect(p+'.type',it.type,'Tipo',Object.entries(OTHER_TYPES))}${myPicker(p,it,'Mes y año')}${qInput(p+'.note',it.note,'Nota (opcional)')}`,'Agregar otro acontecimiento'):''}<p class="xs muted">Solo se pide mes y año. Reestructuraciones y refinanciamientos de los últimos 24 meses restan puntos al historial de pagos; los demás acontecimientos se guardan como contexto.</p>`;
 }
 return summaryBody();
}
function summaryBody(){
 const A=ensureAnswers(),prods=uniqueProducts(),late=A.late.answer==='yes'?A.late.events.length:0,lim=A.limit.answer==='yes'?A.limit.events.length:0,nc=A.newCards.answer==='yes'?A.newCards.items.length:0,nl=A.newLoans.answer==='yes'?A.newLoans.items.length:0,cl=A.closed.answer==='yes'?A.closed.items.length:0,ot=A.other.answer==='yes'?A.other.items.length:0;
 const miss=[];
 if(A.late.answer==null)miss.push('Atrasos sin responder.');if(A.late.answer==='unsure')miss.push('Atrasos: «No estoy seguro» (el historial de pagos no podrá puntuarse).');
 if(!validPeriod(A.first.period)&&!prods.some(p=>validPeriod(p.opened)))miss.push('Antigüedad: falta el mes y año de tu primer crédito.');
 const noOpen=prods.filter(p=>!validPeriod(p.opened));if(noOpen.length)miss.push(`${noOpen.length} producto(s) sin fecha de apertura: ${noOpen.map(p=>safe(p.name)).join(', ')}.`);
 for(const [k,l] of [['limit','aumentos de límite'],['newCards','tarjetas nuevas'],['newLoans','préstamos recientes'],['closed','créditos cerrados'],['other','otros acontecimientos']])if(A[k].answer==null)miss.push(`Sin responder: ${l}.`);
 const rows=[['Productos identificados en vive el hoy',`${prods.filter(p=>p.kind==='card').length} tarjeta(s) · ${prods.filter(p=>p.kind==='loan').length} préstamo(s)`],['Atrasos declarados',A.late.answer==='no'?'Ninguno (declaración personal)':A.late.answer==='yes'?String(late):'—'],['Antigüedad conocida',validPeriod(A.first.period)?myLabel(A.first.period)+' (declarada)':'—'],['Aumentos de límite históricos',A.limit.answer==null?'—':String(lim)],['Nuevos créditos',A.newCards.answer==null&&A.newLoans.answer==null?'—':`${nc} tarjeta(s) · ${nl} préstamo(s)`],['Productos cerrados',A.closed.answer==null?'—':String(cl)],['Acontecimientos extraordinarios',A.other.answer==null?'—':String(ot)]];
 return `<div class="metricList">${rows.map(([a,b])=>`<div class="metricLine"><span>${a}</span><b>${safe(b)}</b></div>`).join('')}</div><h3 style="margin:16px 0 6px">Información faltante</h3>${miss.length?`<div class="warnings">${miss.map(m=>`<div class="witem warning"><span>!</span><div>${m}</div></div>`).join('')}</div>`:'<div class="okMessage">✓ No falta información esencial.</div>'}<p class="xs muted">Todo lo anterior son declaraciones personales y datos de la app, no evidencia bancaria verificada. Puedes cambiarlo después en Configuración y antecedentes; cada cambio queda registrado.</p>`;
}
function questionnaire(){
 ensureAnswers();const step=clamp(qStep,0,Q_STEPS.length-1),[id,title,question]=Q_STEPS[step],last=step===Q_STEPS.length-1;
 return `<div class="card qcard"><div class="qhead"><div><div class="caps">${qEditing?'EDITAR ANTECEDENTES':'CALIBRACIÓN INICIAL'} · PASO ${step+1} DE ${Q_STEPS.length}</div><h2>${safe(title)}</h2><p class="qquestion">${safe(question)}</p></div>${qEditing?`<button class="smallbtn" data-q-act="cancel">Cancelar</button>`:''}</div>
 <div class="qprogress" role="progressbar" aria-valuemin="1" aria-valuemax="${Q_STEPS.length}" aria-valuenow="${step+1}"><span style="width:${100*(step+1)/Q_STEPS.length}%"></span></div>
 <div class="qbody">${stepBody(id)}</div>
 <div class="qnav"><button class="smallbtn" data-q-act="prev" ${step===0?'disabled':''}>← Anterior</button>${last?`<button class="btn green" data-q-act="finish">${qEditing?'Guardar cambios':'Comenzar mi VIVE SCORE'}</button>`:`<button class="btn green" data-q-act="next">Siguiente →</button>`}</div></div>
 <p class="xs muted qnote">Las preguntas históricas usan solo mes y año. No se pregunta por consultas a burós de crédito.</p>`;
}
function gateView(){
 if(!PAYLOAD)return `<div class="card"><p>Cargando tus datos crediticios…</p></div>`;
 const A=ST.answers;if((!A||!A.completed)||qEditing)return questionnaire();return null;
}

/* ---------- acciones ---------- */
function qAction(act,arg){
 const A=ensureAnswers();
 if(act==='ans'){const [k,v]=arg.split(':');A[k].answer=v;if(k==='late'){A.late.prefilled=false;A.late.confirmed=true}if(v==='yes'&&!A[k][LIST_KEY[k]].length)A[k][LIST_KEY[k]].push(BLANK[k]())}
 else if(act==='add')A[arg][LIST_KEY[arg]].push(BLANK[arg]());
 else if(act==='rm'){const [k,i]=arg.split(':');A[k][LIST_KEY[k]].splice(Number(i),1)}
 else if(act==='next'){if(Q_STEPS[qStep][0]==='late'&&A.late.prefilled){A.late.prefilled=false;A.late.confirmed=true}qStep=Math.min(Q_STEPS.length-1,qStep+1)}
 else if(act==='prev')qStep=Math.max(0,qStep-1);
 else if(act==='edit'){beginEdit();return}
 else if(act==='goto')qStep=Math.max(0,Math.min(Q_STEPS.length-1,Number(arg)||0));
 else if(act==='cancel'){qEditing=false;ST.answers=restoreStore({v:1,answers:JSON.parse(editBackup||'null')}).answers||ST.answers;qStep=0}
 else if(act==='finish'){
  const was=A.completed;A.completed=true;A.completedAt=new Date().toISOString();ST.declVersion++;
  ST.answersLog=[{at:A.completedAt,version:ST.declVersion,answers:JSON.parse(JSON.stringify(A))},...(ST.answersLog||[])].slice(0,20);
  auditLog(was?`Modificó antecedentes (versión ${ST.declVersion}); los cortes se recalcularon como corrección de información.`:'Completó el cuestionario de antecedentes.');
  qEditing=false;qStep=0;rebuildDB();notify('Antecedentes guardados.');
 }
 saveStore();render();window.scrollTo?.({top:0})
}
let editBackup=null;
function beginEdit(){ensureAnswers();editBackup=JSON.stringify(ST.answers);qEditing=true;qStep=0;render()}
function qField(t){
 ensureAnswers();const [path,part]=t.dataset.qField.split('|'),type=t.dataset.qType;
 if(part==='m'||part==='y'){const o=getObj(path);o['_'+part]=t.value;const m=o._m||(validPeriod(o.period)?o.period.slice(5):''),y=o._y||(validPeriod(o.period)?o.period.slice(0,4):'');o.period=(m&&y)?`${y}-${m}`:'';if(path==='first')o.fromApp=false;saveStore();return}
 let v=type==='bool'?t.checked:type==='num'?(t.value===''?'':Math.max(0,Number(t.value)||0)):t.value;
 setPath(path,v);
 if(path.endsWith('.product')){const o=getObj(path.replace(/\.product$/,''));o.productLabel=v==='other'?o.productOther||'Otro producto':(t.selectedOptions[0]?.textContent||'');render()}
 if(path.endsWith('.productOther')){const o=getObj(path.replace(/\.productOther$/,''));o.productLabel=v||'Otro producto'}
 if(path==='first.period'){}
 saveStore();
}
