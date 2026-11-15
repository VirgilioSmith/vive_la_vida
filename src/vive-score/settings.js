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
  ['Aperturas recientes',`${s.new0to6} (0–6m) · ${s.new7to12} (7–12m)`,tag2('App + declarado','warn'),'Productos nuevos de la app y los que declaraste.'],
  ['Aumentos de límite solicitados',`${s.limitReq0to6} (0–6m) · ${s.limitReq7to12} (7–12m)`,tag2('Declarado','warn'),'Los aumentos automáticos no se penalizan.'],
  ['Profundidad del historial',`${s.recordMonths} mes(es) observado(s)`,tag2('Observado','good'),'Empieza el 15 de noviembre de 2026; no se inventan meses anteriores.']
 ];
 return rows.map(r=>`<div class="metricLine"><span><b>${safe(r[0])}</b><div class="muted xs">${safe(r[3])}</div></span><span style="text-align:right">${safe(r[1])}<div>${r[2]}</div></span></div>`).join('');
}
function instrumentRows(s){
 const all=[...s.cards.map(c=>({...c,k:'Tarjeta'})),...s.loans.map(l=>({...l,k:'Préstamo'}))];
 if(!all.length)return '<p class="muted">Aún no hay tarjetas ni préstamos registrados en vive el hoy.</p>';
 const now=new Date().getFullYear(),years=[];for(let a=now;a>=now-40;a--)years.push(a);
 return `<div class="tblscroll"><table class="tbl"><thead><tr><th>Producto</th><th>Apertura (mes y año)</th><th>Origen del dato</th><th>Verificado</th></tr></thead><tbody>${all.map(p=>{const id=p.productId||p.id,m=validPeriod(p.opened)?p.opened.slice(5):'',y=validPeriod(p.opened)?p.opened.slice(0,4):'';return `<tr><td><b>${safe(p.name)}</b><div class="muted xs">${p.k}${p.bank?' · '+safe(p.bank):''} · ${safe(p.currency)}</div></td><td><div class="qmyrow"><select class="formSelect" data-ov="${safe(id)}|m" aria-label="Mes de apertura de ${safe(p.name)}"><option value="">Mes</option>${MONTH_NAMES.map((n,i)=>{const v=String(i+1).padStart(2,'0');return `<option value="${v}" ${m===v?'selected':''}>${n[0].toUpperCase()+n.slice(1)}</option>`}).join('')}</select><select class="formSelect" data-ov="${safe(id)}|y" aria-label="Año de apertura de ${safe(p.name)}"><option value="">Año</option>${years.map(a=>`<option value="${a}" ${String(a)===y?'selected':''}>${a}</option>`).join('')}</select></div></td><td>${p.evidenceVerified?'Verificado':ST.overrides[id]?.opened?'Completado por ti':p.opened?'Registrado en la app':'Falta la fecha'}</td><td><label class="qcheck"><input type="checkbox" data-evidence-checked="${safe(p.id)}" ${p.evidenceVerified?'checked':''}><span>Documento revisado</span></label></td></tr>`}).join('')}</tbody></table></div>`;
}
function settingsView(){
 const s=current(),A=ST.answers||{},cal=!s.missing.length;
 return `${sec('Configuración y antecedentes','Aquí ves de dónde sale cada dato, completas lo que falta y cambias tus antecedentes con trazabilidad.')}
 <div class="grid pair"><div class="card"><div class="caps">ESTADO DE CALIBRACIÓN</div><h2 style="margin-top:7px">${cal?'Calibrado':'Incompleto'}</h2><p>${cal?'Todos los datos esenciales están disponibles; el score se calcula.':'Falta información esencial; el score no se calcula hasta completarla:'}</p>${s.missing.length?`<div class="warnings">${s.missing.map(m=>`<div class="witem critical"><span>!</span><div>${safe(m)}</div></div>`).join('')}</div>`:''}<div class="metricList"><div class="metricLine"><span>Cuestionario</span><b>${A.completed?'Completado':'Pendiente'}</b></div><div class="metricLine"><span>Versión de antecedentes</span><b>${ST.declVersion}</b></div><div class="metricLine"><span>Inicio del historial observado</span><b>${myLabel(VS_START)} (desde el 15)</b></div></div><div class="actionLine"><button class="smallbtn" data-q-act="edit">Editar antecedentes</button></div></div>
 <div class="card"><div class="caps">TRAZABILIDAD</div><h2 style="margin-top:7px">Cambios de antecedentes</h2>${(ST.answersLog||[]).length?`<div class="metricList">${ST.answersLog.map(l=>`<div class="metricLine"><span>Versión ${l.version}</span><b>${safe(l.at.slice(0,16).replace('T',' '))}</b></div>`).join('')}</div>`:'<p class="muted">Todavía no hay versiones guardadas.</p>'}<p class="xs muted">Si corriges un antecedente, los cortes se recalculan como corrección de información, no como un movimiento crediticio nuevo.</p></div></div>
 ${sec('¿De dónde sale cada dato?','Conocido en la app, declarado por ti, verificado con documento o desconocido.')}<div class="card"><div class="metricList">${provenance(s)}</div></div>
 ${sec('Tus productos crediticios','Se leen de vive el hoy. Puedes completar la apertura (mes y año) aquí; no se modifica la tarjeta ni el préstamo original.')}<div class="card">${instrumentRows(s)}<div class="actionLine"><button class="smallbtn" data-refresh-data="1">↻ Releer datos de vive el hoy</button><button class="smallbtn" data-go="cards">Ver Tarjetas ↗</button><button class="smallbtn" data-go="loans">Ver Préstamos ↗</button></div></div>
 ${sec('Datos y reversión','Todo lo de VIVE SCORE vive aparte, en el almacenamiento experimental de este navegador.')}<div class="card"><div class="actionLine"><button class="smallbtn" id="downloadJson">↓ Exportar JSON</button><button class="smallbtn" id="downloadCSV">↓ Exportar CSV</button><button class="smallbtn dangerText" id="vsReset">Borrar los datos de VIVE SCORE</button></div><div class="callout">Borrar elimina únicamente las respuestas, cortes observados y sellos de VIVE SCORE. Tus tarjetas, préstamos, movimientos e ingresos no se tocan. Para quitar el módulo por completo, sigue el procedimiento de <code>src/vive-score/README.md</code>.</div></div>`;
}
document.addEventListener('change',e=>{
 const t=e.target;if(!t.dataset?.ov)return;
 const [id,part]=t.dataset.ov.split('|'),cur=ST.overrides[id]?.opened||'';
 let m=part==='m'?t.value:(cur?cur.slice(5):t.closest('tr').querySelector('[data-ov$="|m"]').value),y=part==='y'?t.value:(cur?cur.slice(0,4):t.closest('tr').querySelector('[data-ov$="|y"]').value);
 if(m&&y){setOverride(id,{opened:`${y}-${m}`});auditLog(`Completó la apertura de ${id} (${y}-${m}) dentro de VIVE SCORE`);rebuildDB();render()}
});
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.id!=='vsReset')return;
 if(!confirm('¿Borrar TODOS los datos de VIVE SCORE (respuestas, cortes observados, sellos)? Tus tarjetas, préstamos y movimientos no se tocan.'))return;
 ST=newStore();auditHistory=[];qEditing=false;qStep=0;saveStore();rebuildDB();render();notify('Datos de VIVE SCORE borrados.');
});
