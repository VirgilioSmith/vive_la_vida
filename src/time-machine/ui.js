/* VIVE Time Machine · lectura local de posiciones registradas. */
(()=>{
 'use strict';
 const E=window.ViveWrappedEngine,host=()=>window.ViveTimeHost;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const displayDate=s=>new Intl.DateTimeFormat('es-DO',{dateStyle:'long',timeZone:'UTC'}).format(new Date(s+'T12:00Z'));
 const fmt=(n,c)=>new Intl.NumberFormat('es-DO',{style:'currency',currency:c,minimumFractionDigits:2}).format(n);
 const metrics=[['liquid','Fondos disponibles'],['liabilities','Deuda registrada'],['cards','Deuda de tarjetas'],['loans','Capital de préstamos'],['certificates','Capital en certificados']];
 let active=null;
 function paint(state){
  const {dialog,first,now,date,baseline,currency}=state,body=dialog.querySelector('.vt-body');
  const point=host().snapshot(date,currency),ref=host().snapshot(baseline,currency);
  if(!point){body.innerHTML='<p>Este corte no tiene datos verificables.</p>';return}
  const amount=n=>esc(fmt(n,currency));
  const delta=(a,b)=>a===b?'Sin cambio':(a>b?'+':'')+amount(a-b);
  const dateField=(field,label,value)=>'<label>'+label+'<input type="date" data-vt-field="'+field+'" min="'+first+'" max="'+now+'" value="'+value+'"></label>';
  const options=['DOP','USD'].map(c=>'<option value="'+c+'"'+(c===currency?' selected':'')+'>'+(c==='DOP'?'RD$':'US$')+'</option>').join('');
  const notices=['Flujos y beneficios acumulados desde el inicio del mes.'];
  if(point.estimatedLoan||ref?.estimatedLoan)notices.push('Parte del capital de préstamos se estimó con el plan contractual.');
  notices.push('Vigencia histórica de suscripciones y compromisos sin reconstruir.');
  if(point.unknown)notices.push(point.unknown===1?'Se excluyó un registro sin fecha verificable.':'Se excluyeron '+point.unknown+' registros sin fecha verificable.');
  const values=metrics.map(([key,label])=>'<div><dt>'+label+'</dt><dd>'+amount(point[key])+(ref&&baseline!==date?'<small>'+delta(point[key],ref[key])+'</small>':'')+'</dd></div>').join('');
  const flow=[['Ingresos',point.flows.income],['Egresos',point.flows.expense],['Beneficios acreditados',point.benefits]].map(([title,value])=>'<div><dt>'+title+'</dt><dd>'+amount(value)+'</dd></div>').join('');
  const wrapped=E.kinds.filter(kind=>E.containing(kind,E.schedule().anchor,date)).map(kind=>'<button type="button" data-vt-wrapped="'+kind+'">'+({day:'Diario',week:'Semanal',month:'Mensual',quarter:'Trimestral',year:'Anual'})[kind]+'</button>').join('');
  const timeline=(state.timeline?host().milestones(currency):[]).map(e=>'<button type="button" data-vt-date="'+esc(e.date)+'"><time datetime="'+esc(e.date)+'">'+esc(displayDate(e.date))+'</time><strong>'+esc(e.title)+'</strong></button>').join('');
  const banks=point.banks.map(x=>'<div><dt>'+esc(x.name)+'</dt><dd>'+amount(x.balance)+'</dd></div>').join('');
  const compare=baseline!==date&&ref;
  const comparison=compare?'<p>Entre ambos cortes, tus fondos disponibles '+(point.liquid===ref.liquid?'se mantuvieron':'variaron '+delta(point.liquid,ref.liquid))+' y tu deuda '+(point.liabilities===ref.liabilities?'se mantuvo':'varió '+delta(point.liabilities,ref.liabilities))+'. El patrimonio también refleja los certificados y acuerdos registrados.</p>':'';
  const chart=compare?positionChart(ref,point,amount):'';
  body.innerHTML='<div class="vt-controls">'+dateField('date','Viajar al',date)+dateField('baseline','Comparar con',baseline)+'<label>Moneda<select data-vt-field="currency">'+options+'</select></label><button type="button" data-vt-date="'+now+'">Hoy</button></div>'
   +'<section class="vt-hero"><time datetime="'+date+'">'+esc(displayDate(date))+'</time><h2>'+amount(point.net)+'</h2><p>Patrimonio neto reconstruido'+(ref&&baseline!==date?' · '+delta(point.net,ref.net)+' frente al corte de comparación':'')+'</p>'+chart+'</section>'
   +'<section class="vt-reflection"'+(comparison?'':' hidden')+'><h2>VIVE Intelligence</h2>'+comparison+'<div data-vt-insights></div></section><p class="vt-method">'+esc(notices.join(' '))+'</p>'
   +'<dl class="vt-metrics">'+values+'<div><dt>Utilización crediticia</dt><dd>'+(point.utilization===null?'Sin límite histórico verificable':point.utilization.toFixed(1)+' %')+'</dd></div>'+flow+'</dl>'
   +(banks?'<details><summary>Saldos por cuenta bancaria</summary><dl class="vt-metrics">'+banks+'</dl></details>':'')
   +'<details class="vt-timeline"'+(state.timeline?' open':'')+'><summary>Acontecimientos y cierres destacados</summary><div>'+(timeline||'<p>Sin acontecimientos comparables en estos registros.</p>')+'</div></details>'
   +(wrapped?'<section class="vt-related"><h2>Historias relacionadas</h2>'+wrapped+'</section>':'');
  const timelineRoot=body.querySelector('.vt-timeline');
  timelineRoot.addEventListener('toggle',()=>{
   if(!timelineRoot.isConnected||state.timeline===timelineRoot.open)return;
   state.timeline=timelineRoot.open;
   if(state.timeline&&!timelineRoot.dataset.loaded){paint(state);body.querySelector('.vt-timeline summary').focus()}
  });
  if(state.timeline)timelineRoot.dataset.loaded='true';
  const insight=body.querySelector('[data-vt-insights]');
  host().insights(point,currency).then(items=>{
   if(!insight.isConnected||!host().available())return;
   if(items.length)insight.closest('.vt-reflection').hidden=false;
   insight.innerHTML=items.map(f=>'<p><strong>'+esc(f.title)+'</strong> '+esc(f.explanation)+'</p>').join('');
  }).catch(()=>{});
 }
 function positionChart(ref,point,amount){
  const max=Math.max(1,Math.abs(ref.net),Math.abs(point.net));
  return '<figure class="vt-comparison"><figcaption>Patrimonio en los dos cortes</figcaption>'+[ref,point].map(x=>{
   const width=50*Math.abs(x.net)/max;
   return '<div><span>'+esc(displayDate(x.date))+'</span><svg viewBox="0 0 100 5" preserveAspectRatio="none" aria-hidden="true"><path d="M50 0V5" stroke="currentColor"/><rect x="'+(x.net<0?50-width:50)+'" width="'+width+'" height="5" rx="1" fill="currentColor"/></svg><strong>'+amount(x.net)+'</strong></div>';
  }).join('')+'</figure>';
 }
 function open(date,source){
  if(!host()?.available())return;
  if(active)active.dialog.close();
  const now=host().asOf(),{first}=host().history(),opener=source||document.activeElement;
  const dialog=document.createElement('dialog');dialog.className='vt-dialog';dialog.setAttribute('aria-labelledby','vt-title');
  dialog.innerHTML='<header><h1 id="vt-title">VIVE Time Machine</h1><button type="button" data-vt-close aria-label="Cerrar Time Machine">×</button></header><main class="vt-body"><p>El viaje empieza cuando hayas registrado tu primera apertura o movimiento.</p></main>';
  const selected=first&&E.validDate(date)&&date>=first&&date<=now?date:now;
  const previous=E.period('month',now).end;
  const baseline=selected===now&&first&&previous>=first?previous:now;
  const state={dialog,now,first,timeline:false,date:selected,baseline,currency:'DOP'};
  document.body.append(dialog);active=state;
  dialog.addEventListener('close',()=>{dialog.remove();if(active===state){active=null;if(!document.querySelector('.vw-dialog[open]'))opener?.focus?.({preventScroll:true})}});
  dialog.addEventListener('change',ev=>{
   const el=ev.target,field=el.dataset.vtField;
   if(!field)return;
   if(field==='currency'||E.validDate(el.value)&&el.value>=first&&el.value<=now)state[field]=el.value;
   paint(state);dialog.querySelector('[data-vt-field="'+field+'"]')?.focus();
  });
  dialog.addEventListener('click',ev=>{
   const button=ev.target.closest('button');
   if(!button)return;
   if(button.hasAttribute('data-vt-close'))dialog.close();
   else if(button.dataset.vtDate){state.date=button.dataset.vtDate;paint(state);dialog.querySelector('[data-vt-field="date"]').focus()}
   else if(button.dataset.vtWrapped){dialog.close();window.ViveWrapped.open(button.dataset.vtWrapped,opener,state.date)}
  });
  if(first)paint(state);
  dialog.showModal();
 }
 document.addEventListener('click',ev=>{
  const b=ev.target.closest?.('[data-vtime-open]');
  if(!b)return;
  open(b.dataset.vtimeOpen,b);
 });
 window.ViveTimeMachine=Object.freeze({open});
})();
