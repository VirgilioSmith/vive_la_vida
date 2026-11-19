'use strict';
/* VIVE SCORE CRÉDITO · «Configuración y antecedentes».
   Muestra de dónde sale cada dato, permite completar fechas faltantes (solo dentro de VIVE SCORE),
   editar los antecedentes con trazabilidad y retirar el experimento sin tocar el resto de la app. */
function provenance(s){
 const A=ST.answers||{},prods=s.cards.concat(s.loans),lateN=A.late?.answer==='yes'?(A.late.events||[]).length:0;
 const tag2=(t,k)=>`<span class="tag ${k}">${t}</span>`;
 const rows=[
  ['Atrasos y puntualidad',A.late?.answer==='no'?'Sin atrasos declarados':A.late?.answer==='yes'?`${lateN} atraso(s) declarado(s)`:'Sin respuesta',A.late?.answer==='no'||A.late?.answer==='yes'?tag2('Declarado','warn'):tag2('Desconocido','bad'),'Declaración personal; además se observa la mora vigente de la app desde noviembre de 2026.'],
  ['Mora vigente (hoy)',`${Math.max(0,...prods.map(x=>Number(x.daysPastDue)||0))} días`,tag2('Observado en la app','good'),'Calculado con los vencimientos reales de tarjetas y préstamos.'],
  ['Utilización y balances',`${s.cards.length} tarjeta(s)`,tag2('Observado en la app','good'),'Límite, saldo, avances y mínimos de tarjetas registradas.'],
  ['Préstamos',`${s.loans.length} préstamo(s)`,tag2('Observado en la app','good'),'Capital, saldo y cuota de los préstamos registrados.'],
  ['Antigüedad',s.oldestPeriod?`${myLabel(s.oldestPeriod)} · ${s.historyMonths} meses`:'Desconocida',s.ageSource==='verificada'?tag2('Verificada','good'):s.ageSource==='registrada en vive el hoy'?tag2('Registrada en la app','good'):s.ageSource==='declarada'?tag2('Declarada','warn'):tag2('Desconocida','bad'),'Apertura bancaria (mes y año); distinta de la fecha en que se registró en la app.'],
  ['Aperturas recientes',`${s.new0to6} en los últimos 6 meses`,tag2('Observado en la app','good'),'Se detectan solos por la fecha de apertura de cada producto.'],
  ['Aumentos de límite solicitados',`${s.limitReq0to6} en los últimos 6 meses`,tag2('Declarado','warn'),'Los aumentos automáticos no se penalizan.'],
  ['Profundidad del historial',`${s.recordMonths} mes(es) observado(s)`,tag2('Observado','good'),'Empieza el 15 de noviembre de 2026; no se inventan meses anteriores.']
 ];
 return rows.map(r=>`<div class="metricLine"><span><b>${safe(r[0])}</b><div class="muted xs">${safe(r[3])}</div></span><span style="text-align:right">${safe(r[1])}<div>${r[2]}</div></span></div>`).join('');
}
function instrumentRows(s){
 const seen=new Set(),all=[...s.cards.map(c=>({...c,k:'Tarjeta'})),...s.loans.map(l=>({...l,k:'Préstamo'}))].filter(p=>{const key=p.k+':'+(p.productId||p.id);if(seen.has(key))return false;seen.add(key);return true});
 if(!all.length)return '<p class="muted">Aún no hay tarjetas ni préstamos registrados en vive el hoy.</p>';
 const now=new Date().getFullYear(),years=[];for(let a=now;a>=now-40;a--)years.push(a);
 const lock=p=>p.openedSource==='app'?'disabled title="La fecha viene de Editar en vive el hoy"':'';
 return `<div class="tblscroll"><table class="tbl"><thead><tr><th>Producto</th><th>Apertura (mes y año)</th><th>Procedencia del dato</th><th>Documento</th></tr></thead><tbody>${all.map(p=>{const id=p.productId||p.id,m=validPeriod(p.opened)?p.opened.slice(5):'',y=validPeriod(p.opened)?p.opened.slice(0,4):'';return `<tr><td><b>${safe(p.name.replace(/ · (DOP|USD)$/,''))}</b><div class="muted xs">${p.k}${p.bank?' · '+safe(p.bank):''}</div></td><td><div class="qmyrow"><select class="formSelect" ${lock(p)} data-ov="${safe(id)}|m" aria-label="Mes de apertura de ${safe(p.name)}"><option value="">Mes</option>${MONTH_NAMES.map((n,i)=>{const v=String(i+1).padStart(2,'0');return `<option value="${v}" ${m===v?'selected':''}>${n[0].toUpperCase()+n.slice(1)}</option>`}).join('')}</select><select class="formSelect" ${lock(p)} data-ov="${safe(id)}|y" aria-label="Año de apertura de ${safe(p.name)}"><option value="">Año</option>${years.map(a=>`<option value="${a}" ${String(a)===y?'selected':''}>${a}</option>`).join('')}</select></div><div class="muted xs">${p.openedSource==='app'?'Fecha registrada en la app (manda sobre lo que completes aquí)':p.openedSource==='usuario'?'Completada por ti':'Falta la fecha'}</div></td><td><select class="formSelect" data-evidence-source="${safe(p.id)}" aria-label="Procedencia de ${safe(p.name)}">${Object.entries(V5_SOURCE_LABELS).map(([k,v])=>`<option value="${k}" ${p.source===k?'selected':''}>${safe(v)}</option>`).join('')}</select></td><td><label class="qcheck"><input type="checkbox" data-evidence-checked="${safe(p.id)}" ${p.evidenceVerified?'checked':''}><span>Documento revisado</span></label></td></tr>`}).join('')}</tbody></table></div>`;
}
function limitHistory(){
 const ev=((ST.answers?.limit?.answer==='yes'?ST.answers.limit.events:[])||[]).slice().sort((a,b)=>String(b.at||b.period).localeCompare(String(a.at||a.period)));
 if(!ev.length)return '<p class="muted">Todavía no hay cambios de límite. Si editas el límite de una tarjeta en vive el hoy, el cambio se registra solo con su fecha.</p>';
 return `<div class="metricList">${ev.map(e=>`<div class="metricLine"><span><b>${safe(e.productLabel||'Tarjeta')} · ${safe(e.currency||'')}</b><div class="muted xs">${e.detected?'Detectado en la app'+(e.at?' · '+safe(e.at.slice(0,10)+' '+e.at.slice(11,16)+' UTC'):''):'Declarado'} · ${safe(myLabel(e.period))}</div></span><span style="text-align:right">${Number(e.prev||0).toLocaleString('es-DO')} → ${Number(e.next||0).toLocaleString('es-DO')}<div>${e.kind==='decrease'?'<span class="badge">Reducción</span>':`<button class="smallbtn" data-limit-kind="${safe(e.id)}">${e.kind==='requested'?'Solicitado por mí':'Automático'} ⇄</button>`}</div></span></div>`).join('')}</div><p class="xs muted">Los aumentos automáticos no restan puntos; marca «Solicitado por mí» solo si tú lo pediste al banco.</p>`;
}
function recentAuto(s){
 const r=(s.products||[]).filter(p=>p.opened&&p.window==='0–6 meses');
 if(!r.length)return '<p class="muted">Ninguna tarjeta ni préstamo se abrió en los últimos 6 meses.</p>';
 return `<div class="metricList">${r.map(p=>`<div class="metricLine"><span><b>${safe(p.name)}</b><div class="muted xs">${p.kind==='loan'?'Préstamo':'Tarjeta'}${p.bank?' · '+safe(p.bank):''} · ${safe(p.source)}</div></span><span style="text-align:right">${safe(myLabel(p.opened))}<div><span class="badge">${safe(p.window)}</span></div></span></div>`).join('')}</div>`;
}
/* Antecedentes: estado de calibración, trazabilidad y procedencia de cada dato. */
function antecedentesView(){
 const s=current();
 return `<div class="card"><div class="caps">CRÉDITOS RECIENTES · DETECTADOS SOLOS</div><h2 style="margin:7px 0 4px">${s.new0to6} en los últimos 6 meses</h2><p class="muted sm">Se leen de la fecha de apertura de cada tarjeta y préstamo en vive el hoy.</p>${recentAuto(s)}</div>
 <div class="card" style="margin-top:12px"><div class="caps">HISTORIAL DE LÍMITES · AUTOMÁTICO</div>${limitHistory()}</div>
 <div class="card" style="margin-top:12px"><div class="caps">¿DE DÓNDE SALE CADA DATO?</div><div class="metricList">${provenance(s)}</div></div>`;
}
/* Configuración: productos leídos (fechas, procedencia, documento), actualización de datos, exportación y borrado. */
function cancelledView(s){
 const mSel=id=>`<select class="formSelect" id="${id}-m" aria-label="Mes"><option value="">Mes</option>${MONTH_NAMES.map((n,i)=>`<option value="${String(i+1).padStart(2,'0')}">${n}</option>`).join('')}</select>`;
 const now=Number((PAYLOAD?.today||new Date().toISOString()).slice(0,4)),ySel=id=>`<select class="formSelect" id="${id}-y" aria-label="Año"><option value="">Año</option>${Array.from({length:41},(_,i)=>now-i).map(y=>`<option>${y}</option>`).join('')}</select>`;
 const app=[...s.cards,...s.loans,...(s.unrated||[])].filter(x=>x.status==='closed');
 const mine=ST.cancelled||[];
 const row=(n,sub,right,btn)=>`<div class="metricLine"><span><b>${safe(n)}</b><div class="muted xs">${sub}</div></span><span style="text-align:right">${right}${btn?`<div>${btn}</div>`:''}</span></div>`;
 return `<div class="card" style="margin-top:12px"><div class="caps">PRODUCTOS CANCELADOS · HISTORIAL</div><p class="muted sm" style="margin:6px 0 10px">Los cancelados en buen estado siguen sumando años a tu historial y a la edad promedio (como en un buró). Los de vive el hoy se leen solos; aquí agregas los de antes.</p>
 ${app.length||mine.length?`<div class="metricList">${app.map(x=>row(x.name.replace(/ · (DOP|USD)$/,''),'Cerrado · leído de vive el hoy',safe(validPeriod(x.opened)?'abierto '+myLabel(x.opened):'sin fecha de apertura'),'')).join('')}${mine.map(x=>row(x.inst||'Producto',`${x.kind==='loan'?'Préstamo':'Tarjeta'}${x.limit?' · '+safe(x.limit):''} · ${x.seed?'reporte de crédito':'declarado'}${x.vector?' · últimos 12 meses '+safe(x.vector):''}`,`<div>abierto ${safe(myLabel(x.opened))}</div><div>${x.state==='saldado'?'saldado':x.state==='castigado'?'castigado':'cancelado'} ${safe(myLabel(x.closed))}</div><div><span class="${(x.maxLate||0)>0?'neg':'pos'}">${(x.maxLate||0)>0?'Atraso '+(['','30','60','90','120+'][Math.min(4,x.maxLate)])+' días':'Sin atrasos'}</span></div>`,`<button class="smallbtn" data-cancel-del="${safe(x.id)}">Quitar</button>`)).join('')}</div>`:'<p class="muted">Todavía no hay productos cancelados.</p>'}
 <div class="qmyrow" style="flex-wrap:wrap;gap:8px;margin-top:14px"><input class="formInput" id="cx-inst" placeholder="Institución o producto" aria-label="Institución o producto" style="max-width:220px"><select class="formSelect" id="cx-kind" aria-label="Tipo"><option value="card">Tarjeta</option><option value="loan">Préstamo</option></select><span class="xs muted">Apertura</span>${mSel('cx-o')}${ySel('cx-o')}<span class="xs muted">Cierre</span>${mSel('cx-c')}${ySel('cx-c')}<select class="formSelect" id="cx-state" aria-label="Estado final"><option value="cancelado sin saldo">Cancelado sin saldo</option><option value="saldado">Saldado (completado)</option><option value="castigado">Castigado (no suma)</option></select><select class="formSelect" id="cx-late" aria-label="Atraso"><option value="0">Sin atrasos</option><option value="1">Atraso 30 días</option><option value="2">Atraso 60 días</option><option value="3">Atraso 90 días</option><option value="4">Atraso 120+ días</option></select><button class="smallbtn" data-cancel-add="1">+ Agregar</button></div></div>`;
}
function lateConfirmView(s){
 const rows=[...s.cards,...s.loans].filter(x=>x.status!=='closed'&&(Number(x.daysPastDue)>0||x.lateDismissed));
 if(!rows.length)return '';
 const line=x=>{const k=lateKey({...x,daysPastDue:Number(x.daysPastDue)||0},PAYLOAD?.today),dis=!!x.lateDismissed;
  return `<div class="metricLine"><span><b>${safe(x.name)}</b><div class="muted xs">${dis?'Marcado como «no es mora» (pagado y sin conciliar en la app)':'vive el hoy lo deduce de un vencimiento sin pago registrado: '+x.daysPastDue+' día(s)'}</div></span><span>${dis?`<button class="smallbtn" data-late-restore="${safe(x.__lateKey||'')}" data-late-pid="${safe(x.productId||x.id)}">Volver a contar</button>`:`<button class="smallbtn" data-late-dismiss="${safe(k)}">No es mora · ya pagué</button>`}</span></div>`};
 return `<div class="card" style="margin-top:12px"><div class="caps">ATRASOS DETECTADOS · CONFIRMACIÓN</div><p class="muted sm" style="margin:6px 0 10px">El atraso vigente se deduce de vencimientos sin pago registrado, no de un reporte bancario. Si ya lo pagaste y solo falta conciliarlo en la app, márcalo para que no cuente como mora. La marca es de ese vencimiento: si aparece otro atraso, vuelve a contar.</p><div class="metricList">${rows.map(line).join('')}</div></div>`;
}
function configuracionView(){
 const s=current();
 return `<p class="muted sm" style="margin:0 0 12px">Se leen de vive el hoy y nunca se modifican. Solo completas el mes y año de apertura cuando la app no lo tiene.</p>${instrumentRows(s)}${lateConfirmView(s)}${cancelledView(s)}`;
}
/* Centro de control: una sola página, sin menú. Cada apartado es una sección plegable; los datos no se repiten. */
const CC_SECTIONS=[['antecedentes','Antecedentes y procedencia'],['productos','Productos y cancelados'],['cortes','Cortes guardados'],['auditoria','Auditoría y pruebas'],['variables','Variables'],['metodologia','Metodología']];
const TAB_ALIAS={observatory:'antecedentes',snapshots:'cortes',audit:'auditoria',data:'antecedentes',capacity:'__detail',matrix:'variables',patterns:'metodologia',method:'metodologia'};   // enlaces de las páginas anteriores
const ccOpen={antecedentes:false,productos:false,cortes:false,auditoria:false,variables:false,metodologia:false};
function controlView(){
 const s=current(),q=qualityReport(s),tests=modelAuditSuite(),passed=tests.filter(z=>z.ok).length,c=evaluate(s),warn=c.errors.filter(z=>z.level!=='info').length,cal=!s.missing.length,last=(DB.seals||[]).filter(z=>z.auto).slice(-1)[0];
 const bodies={antecedentes:antecedentesView,productos:configuracionView,cortes:snapshotView,auditoria:audits,variables:matrixView,metodologia:methodView};
 return `${sec('Centro de control','Todo se lee y se guarda solo. Aquí solo ves lo importante.')}
 <div class="grid stats">${kpi('Confianza de evidencia',`${q.reliability}/100`,'Calidad de los datos, no es score')}${kpi('Cortes observados',DB.months.length,'Desde el 15 de noviembre de 2026')}${kpi('Pruebas del motor',`${passed}/${tests.length}`,'Coherencia algorítmica local')}${kpi('Advertencias',warn,'Datos por revisar',warn?'neg':'')}</div>
 <div class="card" style="margin:15px 0 12px"><div class="hrow wrapMobile"><div><div class="caps">ESTADO</div><h2 style="margin:6px 0 2px">${cal?'Calibrado':'Incompleto'}</h2><p class="sm">${cal?'Todos los datos esenciales están disponibles; el score se calcula.':'Falta información esencial; el score no se calcula hasta completarla.'}</p></div><div class="links"><span class="tag good">● Guardado automático${last?' · '+safe(last.period):''}</span><button class="smallbtn" data-q-act="edit">Editar antecedentes</button></div></div>${s.missing.length?`<div class="warnings">${s.missing.map(m=>`<div class="witem critical"><span>!</span><div>${safe(m)}</div></div>`).join('')}</div>`:''}</div>
 ${CC_SECTIONS.map(([k,l])=>`<details class="ccdet" data-cc="${k}" ${ccOpen[k]?'open':''}><summary>${l}</summary><div class="ccbody">${bodies[k]()}</div></details>`).join('')}`;
}
document.addEventListener('toggle',e=>{const d=e.target;if(d&&d.classList?.contains('ccdet')&&d.dataset.cc)ccOpen[d.dataset.cc]=d.open},true);
document.addEventListener('change',e=>{
 const t=e.target;if(!t.dataset?.ov)return;
 const [id,part]=t.dataset.ov.split('|'),cur=ST.overrides[id]?.opened||'';
 let m=part==='m'?t.value:(cur?cur.slice(5):t.closest('tr').querySelector('[data-ov$="|m"]').value),y=part==='y'?t.value:(cur?cur.slice(0,4):t.closest('tr').querySelector('[data-ov$="|y"]').value);
 if(m&&y){setOverride(id,{opened:`${y}-${m}`});auditLog(`Completó la apertura de ${id} (${y}-${m}) dentro de VIVE SCORE`);rebuildDB();render()}
});
document.addEventListener('click',e=>{
 const ld=e.target.closest('[data-late-dismiss]'),lr=e.target.closest('[data-late-restore]');
 if(ld&&ld.dataset.lateDismiss){(ST.dismissedLate=ST.dismissedLate||{})[ld.dataset.lateDismiss]=true;ST.declVersion++;auditLog('Marcó un atraso como «no es mora» (pagado y sin conciliar).');saveStore();rebuildDB();render();notify('Atraso marcado como pagado.');return}
 if(lr){const pid=lr.dataset.latePid;for(const k of Object.keys(ST.dismissedLate||{}))if(k.startsWith(pid+'|'))delete ST.dismissedLate[k];ST.declVersion++;saveStore();rebuildDB();render();return}
 const lk=e.target.closest('[data-limit-kind]');
 if(lk){const ev=(ST.answers?.limit?.events||[]).find(x=>x.id===lk.dataset.limitKind);if(ev){ev.kind=ev.kind==='requested'?'automatic':'requested';ST.declVersion++;saveStore();rebuildDB();render()}return}
 const ca=e.target.closest('[data-cancel-add]'),cd=e.target.closest('[data-cancel-del]');
 if(ca){const g=i=>document.getElementById(i)?.value||'',inst=g('cx-inst').trim().slice(0,60),o=g('cx-o-y')&&g('cx-o-m')?g('cx-o-y')+'-'+g('cx-o-m'):'',c=g('cx-c-y')&&g('cx-c-m')?g('cx-c-y')+'-'+g('cx-c-m'):'';
  if(!inst||!validPeriod(o)||!validPeriod(c)||c<o){notify('Completa institución, mes y año de apertura y de cierre (el cierre no puede ser anterior).');return}
  (ST.cancelled=ST.cancelled||[]).push({id:uid(),inst,kind:g('cx-kind'),opened:o,closed:c,state:g('cx-state'),maxLate:Number(g('cx-late'))||0});ST.declVersion++;auditLog('Agregó un producto cancelado: '+inst+' ('+o+' → '+c+').');saveStore();rebuildDB();render();notify('Producto cancelado agregado al historial.');return}
 if(cd){ST.cancelled=(ST.cancelled||[]).filter(x=>x.id!==cd.dataset.cancelDel);ST.declVersion++;saveStore();rebuildDB();render();return}
 return;
});
