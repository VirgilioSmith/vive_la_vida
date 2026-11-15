'use strict';
/* VIVE SCORE CRÉDITO · simulación TransUnion (pestaña aparte).
   - Solo TransUnion: Equifax no publica parámetros, así que no se simula.
   - Equivalencia ORIENTATIVA: escala pública de TransUnion RD 459–848 aplicada de forma lineal al índice VIVE (0–1 000), que ya usa
     los pesos públicos 35 / 30 / 15 / 10 / 10. TransUnion no publica su fórmula: no es una predicción de su score.
   - El valor que tú conozcas de TransUnion es opcional; solo se compara, NO cambia el score de VIVE. */
const TU_MIN=459,TU_MAX=848,TU_SPAN=TU_MAX-TU_MIN;
const tuEstimate=score=>score===null||score===undefined?null:Math.round(TU_MIN+clamp(score,0,1000)/1000*TU_SPAN);
function tuScenarios(){
 const base=clone(current()),b0=evaluate(base);if(b0.score===null)return [];
 const mk=(label,note,fn)=>{const s=clone(base);fn(s);const e=evaluate(s);return {label,note,score:e.score,tu:tuEstimate(e.score),delta:e.score===null?null:tuEstimate(e.score)-tuEstimate(b0.score),util:e.util}};
 return [
  mk('Pagar el 25 % del saldo de cada tarjeta','Baja la utilización agregada.',s=>s.cards.forEach(c=>{c.balance=N(c.balance)*.75;c.statementBalance=N(c.statementBalance)*.75;c.min=N(c.min)*.75;c.advance=Math.min(N(c.advance),c.balance)})),
  mk('Dejar cada tarjeta por debajo del 9 % de uso','Meta de utilización baja en cada línea.',s=>s.cards.forEach(c=>{const cap=N(c.limit)*.09;if(N(c.balance)>cap){const f=cap/Math.max(1,N(c.balance));c.balance=cap;c.statementBalance=N(c.statementBalance)*f;c.min=N(c.min)*f;c.advance=Math.min(N(c.advance),c.balance)}})),
  mk('Aumento automático de límite (el doble)','Sin solicitud: no penaliza.',s=>s.cards.forEach(c=>{c.limit=N(c.limit)*2})),
  mk('Una tarjeta nueva','Cuenta como apertura reciente.',s=>{s.new0to6=N(s.new0to6)+1}),
  mk('Un préstamo nuevo de RD$250,000','Apertura reciente y nueva deuda.',s=>{s.loans.push({id:'tu-sim',name:'Préstamo hipotético',currency:'DOP',type:'personal',original:250000,balance:250000,due:loanQuota(250000,20,36),status:'active',daysPastDue:0,variable:false});s.new0to6=N(s.new0to6)+1}),
  mk('Un atraso de 30 a 59 días','Golpea el historial de pagos.',s=>{s.late30=N(s.late30)+1}),
  mk('Cancelar la tarjeta con más límite','Baja el límite total (sube la utilización) pero su antigüedad sigue sumando.',s=>{const big=s.cards.slice().sort((a,b)=>N(b.limit)-N(a.limit))[0];if(big)big.status='closed'}),
  mk('Un atraso de 90 a 119 días','Golpe mayor al historial de pagos.',s=>{s.late90=N(s.late90)+1}),
  mk('Un aumento de límite que yo solicite','Cuenta como solicitud reciente.',s=>{s.cards.forEach(c=>{c.limit=N(c.limit)*1.5});s.limitReq0to6=N(s.limitReq0to6)+1})
 ];
}
/* Variables del modelo que alimentan la simulación (valores en vivo; si cambian los datos o se cargan cancelados, todo se recalcula). */
function tuInputs(s,e){
 const canc=(ST.cancelled||[]).length,closedApp=[...s.cards,...s.loans].filter(x=>x.status==='closed').length;
 return [
  ['Historial de pagos','Atraso vigente máximo',`${Math.max(0,...s.cards.concat(s.loans).map(x=>N(x.daysPastDue)))} días`],
  ['Historial de pagos','Atrasos anteriores y de cancelados',`${N(s.lateShort)+N(s.late30)+N(s.late60)+N(s.late90)+N(s.late120)+N(s.lateOlder)} registrados`],
  ['Deuda y utilización','Utilización de tarjetas',e.util===undefined||e.util===null?'—':pct(e.util)],
  ['Antigüedad','Cuenta más antigua',`${s.historyMonths} meses`],
  ['Antigüedad','Edad promedio del historial',`${s.avgHistoryMonths} meses`],
  ['Antigüedad','Productos cancelados o saldados que suman',`${canc+closedApp}`],
  ['Crédito reciente','Aperturas en los últimos 6 meses',`${s.new0to6}`],
  ['Crédito reciente','Aumentos de límite solicitados / automáticos',`${s.limitReq0to6} / ${s.limitAuto}`],
  ['Composición','Tarjetas y préstamos activos',`${s.cards.filter(x=>x.status!=='closed').length} · ${s.loans.filter(x=>x.status!=='closed').length}`]
 ].map(r=>`<div class="metricLine"><span><b>${safe(r[1])}</b><div class="muted xs">${safe(r[0])}</div></span><b>${safe(r[2])}</b></div>`).join('');
}
function tuView(){
 const s=current(),e=evaluate(s),est=tuEstimate(e.score),ext=(ST.external||{}).tu||null,gap=ext&&est!==null?ext.value-est:null;
 const rows=FACTORS.map(f=>{const pts=e.points[f.id],contrib=Math.round(pts/1000*TU_SPAN*10)/10,maxC=Math.round(f.max/1000*TU_SPAN*10)/10;return `<div class="metricLine"><span>${safe(f.name)}<div class="muted xs">${f.tag} del modelo · ${pts} / ${f.max} pts VIVE</div></span><b>${contrib} / ${maxC} pts TU</b></div>`}).join('');
 const sc=tuScenarios();
 const now=new Date().getFullYear(),years=[];for(let a=now;a>=now-10;a--)years.push(a);
 return `${sec('Simulación TransUnion','Cómo se vería tu perfil en la escala pública de TransUnion RD (459–848). Es una simulación educativa, separada de tu VIVE SCORE; se recalcula con todas las variables del modelo (incluidos los productos cancelados).')}
 <div class="callout warn"><b>Lectura correcta:</b> TransUnion no publica su fórmula ni sus coeficientes. Esta pantalla aplica de forma lineal su escala pública (459–848) a tu índice VIVE, que ya usa los pesos públicos 35 / 30 / 15 / 10 / 10. Es una referencia para comparar escenarios, <b>no</b> tu score real ni una predicción. <b>Equifax</b> no publica parámetros, por eso no se simula.</div>
 <div class="grid pair"><div class="card scoreHero" style="min-height:auto"><div class="heroDetails"><div class="caps">EQUIVALENCIA ORIENTATIVA · ESCALA 459–848</div><div class="bigNumber monoValue" style="font-size:78px;margin:6px 0">${est??'—'}</div><div class="muted">${est===null?'Sin score VIVE calculable: completa lo que falta en Configuración y antecedentes.':`desde tu VIVE SCORE de ${e.score} / 1 000`}</div><p class="xs muted" style="margin-top:10px">Fórmula: 459 + VIVE ÷ 1 000 × (848 − 459).</p></div></div>
 <div class="card"><div class="caps">APORTE POR FACTOR (EN PUNTOS TU)</div><h2 style="margin:7px 0 10px">De dónde sale el número</h2><div class="metricList">${rows}<div class="metricLine"><span><b>Base de la escala</b></span><b>${TU_MIN} pts</b></div><div class="metricLine"><span><b>Total estimado</b></span><b>${est??'—'}</b></div></div></div></div>
 ${sec('Variables que alimentan la simulación','Valores en vivo del modelo; si cambian tus datos o cargas productos cancelados, esta pantalla se recalcula sola.')}<div class="card"><div class="metricList">${tuInputs(s,e)}</div></div>
 ${sec('Escenarios','Cada fila cambia un dato a la vez sobre una copia; no modifica nada real.')}
 <div class="card">${sc.length?`<div class="tblscroll"><table class="tbl"><thead><tr><th>Si…</th><th>Estimado TU</th><th>Cambio</th><th>VIVE</th></tr></thead><tbody>${sc.map(x=>`<tr><td><b>${safe(x.label)}</b><div class="muted xs">${safe(x.note)}</div></td><td>${x.tu??'—'}</td><td class="${cls(x.delta||0)}">${x.delta===null?'—':sign(x.delta)+' pts'}</td><td>${x.score??'—'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Sin score calculable, no hay escenarios.</p>'}</div>
 ${sec('Tu score TransUnion real (opcional)','Si lo conoces, anótalo solo para compararlo. No cambia tu VIVE SCORE.')}
 <div class="card"><div class="qgrid"><label class="qfield"><span class="qlabel">Tu score TransUnion (459–848)</span><input id="tuObserved" class="formInput" type="number" min="459" max="848" step="1" value="${ext?safe(ext.value):''}" placeholder="Ej. 712"></label><div class="qmy"><span class="qlabel">Mes y año en que lo conociste</span><div class="qmyrow"><select class="formSelect" id="tuMonth" aria-label="Mes del dato de TransUnion"><option value="">Mes</option>${MONTH_NAMES.map((n,i)=>{const v=String(i+1).padStart(2,'0');return `<option value="${v}" ${ext?.period?.slice(5)===v?'selected':''}>${n[0].toUpperCase()+n.slice(1)}</option>`}).join('')}</select><select class="formSelect" id="tuYear" aria-label="Año del dato de TransUnion"><option value="">Año</option>${years.map(a=>`<option value="${a}" ${ext?.period?.slice(0,4)===String(a)?'selected':''}>${a}</option>`).join('')}</select></div></div></div>
 ${ext?`<div class="metricList" style="margin-top:12px"><div class="metricLine"><span>Tu dato (${myLabel(ext.period)||'sin fecha'})</span><b>${ext.value}</b></div><div class="metricLine"><span>Estimación VIVE → TU hoy</span><b>${est??'—'}</b></div><div class="metricLine"><span>Diferencia</span><b class="${cls(gap||0)}">${gap===null?'—':sign(gap)+' pts'}</b></div></div><div class="callout">Una diferencia es normal: TransUnion usa su propio modelo, fechas de reporte y datos que esta app no ve. Úsala para entender la distancia, no para «corregir» el score.</div><div class="actionLine"><button class="smallbtn dangerText" id="tuClear">Quitar mi dato</button></div>`:'<p class="xs muted">Sin dato de TransUnion registrado.</p>'}</div>`;
}
document.addEventListener('change',ev=>{
 const t=ev.target;if(!['tuObserved','tuMonth','tuYear'].includes(t.id))return;
 const v=Number($('#tuObserved').value),m=$('#tuMonth').value,y=$('#tuYear').value;
 if(!Number.isFinite(v)||$('#tuObserved').value===''){return}
 if(v<TU_MIN||v>TU_MAX){notify('El score de TransUnion RD va de 459 a 848.');return}
 ST.external=ST.external||{};ST.external.tu={value:Math.round(v),period:(m&&y)?`${y}-${m}`:''};auditLog('Registró un dato opcional de TransUnion (solo para comparar).');saveStore();render();
});
document.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b||b.id!=='tuClear')return;ST.external={tu:null};auditLog('Quitó el dato opcional de TransUnion.');saveStore();render()});
