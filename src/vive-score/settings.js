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
 const s=current(),A=ST.answers||{},cal=!s.missing.length;
 return `<p class="muted sm" style="margin:0 0 12px">Lo que declaraste, de dónde sale cada dato y qué falta. Cada cambio queda registrado.</p>
 <div class="grid pair"><div class="card"><div class="caps">ESTADO DE CALIBRACIÓN</div><h2 style="margin-top:7px">${cal?'Calibrado':'Incompleto'}</h2><p>${cal?'Todos los datos esenciales están disponibles; el score se calcula.':'Falta información esencial; el score no se calcula hasta completarla:'}</p>${s.missing.length?`<div class="warnings">${s.missing.map(m=>`<div class="witem critical"><span>!</span><div>${safe(m)}</div></div>`).join('')}</div>`:''}<div class="metricList"><div class="metricLine"><span>Cuestionario</span><b>${A.completed?'Completado':'Pendiente'}</b></div><div class="metricLine"><span>Versión de antecedentes</span><b>${ST.declVersion}</b></div><div class="metricLine"><span>Inicio del historial observado</span><b>${myLabel(VS_START)} (desde el 15)</b></div></div><div class="actionLine"><button class="smallbtn" data-q-act="edit">Editar antecedentes</button></div></div>
 <div class="card"><div class="caps">TRAZABILIDAD</div><h2 style="margin-top:7px">Cambios de antecedentes</h2>${(ST.answersLog||[]).length?`<div class="metricList">${ST.answersLog.map(l=>`<div class="metricLine"><span>Versión ${l.version}</span><b>${safe(l.at.slice(0,16).replace('T',' '))}</b></div>`).join('')}</div>`:'<p class="muted">Todavía no hay versiones guardadas.</p>'}<p class="xs muted">Si corriges un antecedente, los cortes se recalculan como corrección de información, no como un movimiento crediticio nuevo.</p></div></div>
 <div class="card" style="margin-top:15px"><div class="caps">CRÉDITOS RECIENTES · DETECTADOS SOLOS</div><h2 style="margin:7px 0 4px">${s.new0to6} en los últimos 6 meses</h2><p class="muted sm">Se leen de la fecha de apertura de cada tarjeta y préstamo en vive el hoy; no tienes que marcar nada.</p>${recentAuto(s)}</div>
 <div class="card" style="margin-top:15px"><div class="caps">HISTORIAL DE LÍMITES · AUTOMÁTICO</div><h2 style="margin:7px 0 4px">Cambios de límite de tus tarjetas</h2>${limitHistory()}</div>
 ${sec('¿De dónde sale cada dato?','Conocido en la app, declarado por ti, verificado con documento o desconocido.')}<div class="card"><div class="metricList">${provenance(s)}</div></div>`;
}
/* Configuración: productos leídos (fechas, procedencia, documento), actualización de datos, exportación y borrado. */
function configuracionView(){
 const s=current();
 return `<p class="muted sm" style="margin:0 0 12px">Los datos se leen de vive el hoy y nunca se modifican. Aquí completas lo que falta dentro de VIVE SCORE.</p>
 <div class="card">${instrumentRows(s)}<div class="actionLine"><button class="smallbtn" data-refresh-data="1">↻ Releer datos de vive el hoy</button><button class="smallbtn" data-go="cards">Ver Tarjetas ↗</button><button class="smallbtn" data-go="loans">Ver Préstamos ↗</button></div><p class="xs muted">VIVE SCORE se actualiza solo cuando registras o cambias algo en la app; este botón fuerza una lectura inmediata.</p></div>
 ${sec('Datos y reversión','Todo lo de VIVE SCORE vive aparte, en el almacenamiento experimental de este navegador.')}<div class="card"><div class="actionLine"><button class="smallbtn" id="downloadJson">↓ Exportar JSON</button><button class="smallbtn" id="downloadCSV">↓ Exportar CSV</button><button class="smallbtn dangerText" id="vsReset">Borrar los datos de VIVE SCORE</button></div><div class="callout">Borrar elimina únicamente las respuestas, cortes observados y sellos de VIVE SCORE. Tus tarjetas, préstamos, movimientos e ingresos no se tocan. Para quitar el módulo por completo, sigue el procedimiento de <code>src/vive-score/README.md</code>.</div></div>`;
}
/* Centro de control: una sola página, sin menú. Cada apartado es una sección plegable; los datos no se repiten. */
const CC_SECTIONS=[['observatorio','Observatorio'],['historial','Historial y evidencias'],['auditoria','Auditoría'],['antecedentes','Antecedentes'],['configuracion','Configuración']];
const TAB_ALIAS={observatory:'observatorio',snapshots:'historial',audit:'auditoria',data:'antecedentes',capacity:'__detail'};   // enlaces de las páginas anteriores
const ccOpen={observatorio:true,historial:false,auditoria:false,antecedentes:true,configuracion:false};
function controlView(){
 const s=current(),q=qualityReport(s),tests=modelAuditSuite(),passed=tests.filter(z=>z.ok).length,c=evaluate(s),warn=c.errors.filter(z=>z.level!=='info').length;
 const bodies={observatorio:observatory,historial:snapshotView,auditoria:audits,antecedentes:antecedentesView,configuracion:configuracionView};
 return `${sec('Centro de control','Calidad de los datos, historial, auditoría, antecedentes y configuración, en una sola página.')}
 <div class="grid stats">${kpi('Confianza de evidencia',`${q.reliability}/100`,'Calidad de los datos, no es score')}${kpi('Cortes observados',DB.months.length,'Desde el 15 de noviembre de 2026')}${kpi('Pruebas del motor',`${passed}/${tests.length}`,'Coherencia algorítmica local')}${kpi('Advertencias',warn,'Datos por revisar',warn?'neg':'')}</div>
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
 const lk=e.target.closest('[data-limit-kind]');
 if(lk){const ev=(ST.answers?.limit?.events||[]).find(x=>x.id===lk.dataset.limitKind);if(ev){ev.kind=ev.kind==='requested'?'automatic':'requested';ST.declVersion++;saveStore();rebuildDB();render()}return}
 const b=e.target.closest('button');if(!b||b.id!=='vsReset')return;
 if(!confirm('¿Borrar TODOS los datos de VIVE SCORE (respuestas, cortes observados, sellos)? Tus tarjetas, préstamos y movimientos no se tocan.'))return;
 ST=newStore();auditHistory=[];qEditing=false;qStep=0;saveStore();rebuildDB();render();notify('Datos de VIVE SCORE borrados.');
});
