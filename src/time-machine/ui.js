/* VIVE Time Machine · exploración sobre los cortes y las reglas contables existentes. */
(()=>{
 'use strict';
 const E=window.ViveWrappedEngine,host=()=>window.ViveTimeHost;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const utc=s=>new Date(s+'T12:00:00Z');
 const iso=d=>d.toISOString().slice(0,10);
 const format=(d,options)=>new Intl.DateTimeFormat('es-DO',{timeZone:'UTC',...options}).format(utc(d));
 const dateText=d=>format(d,{dateStyle:'long'});
 const glyphs={clock:'history',bank:'building',wallet:'wallet',card:'card',loan:'receipt',chart:'chart',spark:'analytics',calendar:'calendar'};
 const svg=key=>host().glyph(glyphs[key]);
 const groups=[
  ['Liquidez y patrimonio',[['net','Patrimonio neto','chart'],['liquid','Fondos disponibles','wallet'],['certificates','Capital en certificados','bank']]],
  ['Endeudamiento',[['liabilities','Deuda registrada','loan'],['cards','Deuda de tarjetas','card'],['loans','Capital de préstamos','loan'],['utilization','Utilización crediticia','card']]],
  ['Comportamiento financiero',[['income','Ingresos','chart'],['expense','Egresos','wallet'],['benefits','Beneficios acreditados','spark']]]
 ];
 const metrics=groups.flatMap(([,values])=>values);
 const flowKeys=new Set(['income','expense','benefits']);
 const valueOf=(p,key)=>p?(key==='income'||key==='expense'?p.flows?.[key]:p[key]):null;
 const money=(n,c)=>new Intl.NumberFormat('es-DO',{style:'currency',currency:c,minimumFractionDigits:2}).format(n);
 const number=n=>new Intl.NumberFormat('es-DO',{maximumFractionDigits:1}).format(n);
 const valueText=(v,key,currency)=>Number.isFinite(v)?key==='utilization'?number(v)+' %':money(v,currency):'Sin datos verificables';
 const change=(a,b)=>Math.round((a-b)*100)/100;
 const monthEnd=d=>iso(new Date(Date.UTC(utc(d).getUTCFullYear(),utc(d).getUTCMonth()+1,0,12)));
 const fullyObserved=(d,first)=>first<=d.slice(0,7)+'-01';
 let active=null;
 function shift(date,step,unit){
  const d=utc(date);
  if(unit==='day'){d.setUTCDate(d.getUTCDate()+step);return iso(d)}
  const y=d.getUTCFullYear(),m=d.getUTCMonth()+step*(unit==='year'?12:1);
  const day=Math.min(d.getUTCDate(),new Date(Date.UTC(y,m+1,0,12)).getUTCDate());
  return iso(new Date(Date.UTC(y,m,day,12)));
 }
 const clamp=(date,state)=>date<state.first?state.first:date>state.now?state.now:date;
 function preset(date,unit){
  const d=utc(date),year=d.getUTCFullYear(),month=d.getUTCMonth();
  const span=unit==='quarter'?3:unit==='year'?12:1;
  return iso(new Date(Date.UTC(year,Math.floor(month/span)*span,0,12)));
 }
 function comparableFlow(a,b,first){
  return a&&b&&fullyObserved(a,first)&&fullyObserved(b,first)&&
   (a.slice(8)===b.slice(8)||a===monthEnd(a)&&b===monthEnd(b));
 }
 function percent(a,b){
  return Number.isFinite(a)&&Number.isFinite(b)&&a>=0&&b>0?100*(a-b)/b:null;
 }
 function tone(value,key){
  if(value===0)return 'neutral';
  return (['liabilities','cards','loans','expense','utilization'].includes(key)?value<0:value>0)?'positive':'negative';
 }
 function deltaHTML(a,b,key,currency,withPercent=false){
  if(!Number.isFinite(a)||!Number.isFinite(b))return '';
  const delta=change(a,b),pct=withPercent?percent(a,b):null;
  const text=key==='utilization'?number(delta)+' pp':money(delta,currency);
  return '<span class="vt-delta" data-tone="'+tone(delta,key)+'">'+(delta>0?'+':'')+esc(text)+(pct===null?'':' · '+(pct>0?'+':'')+esc(number(pct))+' %')+'</span>';
 }
 function navigator(state){
  const {date,now,first,unit,baseline,currency,controls}=state;
  const ticks=[...new Set(Array.from({length:13},(_,i)=>clamp(shift(date,i-6,unit),state)))];
  const events=state.eventDates;
  const dateInput=(field,label,value)=>'<label>'+label+'<input type="date" data-vt-field="'+field+'" min="'+first+'" max="'+now+'" value="'+value+'"></label>';
  return '<div class="vt-navigation"><div class="vt-toolbar"><div class="vt-units" role="group" aria-label="Escala temporal">'
   +[['day','Días'],['month','Meses'],['year','Años']].map(([key,label])=>'<button type="button" data-vt-unit="'+key+'" aria-pressed="'+(unit===key)+'">'+label+'</button>').join('')
   +'</div><div class="vt-actions"><button type="button" data-vt-date="'+now+'">Hoy</button><button type="button" class="vt-settings" data-vt-controls aria-label="Fechas y moneda" aria-expanded="'+controls+'" aria-controls="vt-controls">'+svg('calendar')+'<span>Fechas y moneda</span></button></div></div>'
   +'<div class="vt-ruler"><button type="button" data-vt-step="-1" aria-label="Fecha anterior" '+(date===first?'disabled':'')+'>‹</button>'
   +'<div class="vt-rail" aria-label="Navegación temporal">'+ticks.map(d=>'<button type="button" data-vt-date="'+d+'" class="vt-tick'+(events.has(d)?' vt-tick-event':'')+'" aria-pressed="'+(d===date)+'" aria-label="'+esc(dateText(d)+(events.has(d)?', con acontecimientos':''))+'"><b>'
    +esc(unit==='year'?d.slice(0,4):format(d,{month:'short',...(unit==='day'?{day:'numeric'}:{year:'numeric'})}))+'</b></button>').join('')
   +'</div><button type="button" data-vt-step="1" aria-label="Fecha siguiente" '+(date===now?'disabled':'')+'>›</button></div>'
   +'<div id="vt-controls" class="vt-controls" '+(controls?'':'hidden')+'>'+dateInput('date','Viajar al',date)+dateInput('baseline','Comparar con',baseline)
   +'<label>Moneda<select data-vt-field="currency"><option value="DOP"'+(currency==='DOP'?' selected':'')+'>RD$</option><option value="USD"'+(currency==='USD'?' selected':'')+'>US$</option></select></label>'
   +'<label>Cierre de comparación<select data-vt-field="preset"><option value="">Elegir cierre</option>'+[['month','Mensual'],['quarter','Trimestral'],['year','Anual']].map(([key,label])=>'<option value="'+key+'"'+(preset(date,key)<first?' disabled':'')+'>'+label+'</option>').join('')+'</select></label></div></div>';
 }
 function samples(state,point){
  const dates=[state.date];
  for(let i=0;i<11;i++){
   const end=E.period('month',state.date,i).end;
   if(end<state.first)break;
   dates.unshift(end);
  }
  return dates.map(d=>d===point.date?point:host().snapshot(d,state.currency)).filter(Boolean);
 }
 function scale(values,lower,upper){
  const min=Math.min(0,...values),max=Math.max(0,...values);
  return v=>upper-(v-min)/(max-min||1)*(upper-lower);
 }
 function comparisonGraph(ref,point,currency){
  const y=scale([ref.net,point.net],13,66),zero=y(0);
  const x=[72,248];
  const parts=[ref,point].map((p,i)=>'<line x1="'+x[i]+'" y1="'+zero+'" x2="'+x[i]+'" y2="'+y(p.net)+'" class="vt-compare-stem"/><circle cx="'+x[i]+'" cy="'+y(p.net)+'" r="4" class="vt-point '+(p.net<0?'vt-point-negative':'')+'"/>').join('');
  return '<figure class="vt-compare"><svg viewBox="0 0 320 82" aria-hidden="true"><path d="M27 '+zero+' H299" class="vt-zero"/><text x="8" y="'+(zero+3)+'">0</text>'+parts+'</svg>'
   +'<figcaption>'+[ref,point].map((p,i)=>'<span><small>'+(i?'Seleccionada':'Referencia')+' · '+esc(format(p.date,{dateStyle:'medium'}))+'</small><strong>'+esc(money(p.net,currency))+'</strong></span>').join('')+'</figcaption></figure>';
 }
 function evolution(state,series){
  const {metric,currency,first}=state;
  const label=metrics.find(([key])=>key===metric)[1];
  const choices=metrics.map(([key,name])=>'<option value="'+key+'"'+(metric===key?' selected':'')+'>'+name+'</option>').join('');
  const values=series.map(p=>valueOf(p,metric));
  const known=values.filter(Number.isFinite);
  const y=scale(known,18,112),zero=y(0),start=+utc(series[0].date),end=+utc(series.at(-1).date);
  const x=d=>end===start?170:28+(+utc(d)-start)/(end-start)*284;
  const partial=p=>p.unknown||p.estimatedLoan||(flowKeys.has(metric)&&(p.date!==monthEnd(p.date)||!fullyObserved(p.date,first)));
  const data=series.map((p,i)=>{
   const xx=x(p.date),v=values[i],prev=series[i-1];
   const line=i&&Number.isFinite(values[i-1])&&Number.isFinite(v)?'<path class="vt-series-line'+(partial(prev)||partial(p)?' is-partial':'')+'" d="M'+x(prev.date)+' '+y(values[i-1])+' L'+xx+' '+y(v)+'"/>':'';
   const node=Number.isFinite(v)?'<circle cx="'+xx+'" cy="'+y(v)+'" r="'+(p.date===state.date?5:3.5)+'" class="vt-point'+(partial(p)?' is-partial':'')+'"/>':'<path class="vt-missing" d="M'+(xx-3)+' 119l6 6m-6 0l6 -6"/>';
   return line+node;
  }).join('');
  const hits=series.map((p,i)=>'<button type="button" class="vt-hit" data-vt-date="'+p.date+'" aria-label="'+esc(dateText(p.date)+' · '+valueText(values[i],metric,currency))+
   '" style="left:'+x(p.date)/3.4+'%;top:'+(Number.isFinite(values[i])?y(values[i]):122)/1.3+'%"></button>').join('');
  return '<section class="vt-evolution" aria-labelledby="vt-series-title"><div class="vt-section-head"><h2 id="vt-series-title">Evolución financiera</h2><select data-vt-field="metric" aria-label="Indicador del gráfico">'+choices+'</select></div>'
   +(known.length>1?'<div class="vt-chart-frame" role="group" aria-label="'+esc(label)+' en los cortes registrados"><svg class="vt-chart" viewBox="0 0 340 130" aria-hidden="true"><path d="M20 '+zero+' H320" class="vt-zero"/><text x="6" y="'+(zero+3)+'">0</text>'+data+'</svg>'+hits+'</div>':known.length===1?'<p>Un corte verificable · <strong>'+esc(valueText(known[0],metric,currency))+'</strong></p>':'<p>No hay datos verificables para este indicador en los cortes consultados.</p>')
   +'<div class="vt-plot-legend"><span>● Corte reconstruido</span><span>○ Parcial o estimado</span><span>× Sin dato</span></div><details class="vt-plot-data"><summary>Consultar puntos del gráfico</summary><div>'
   +series.map((p,i)=>'<button type="button" data-vt-date="'+p.date+'"><time datetime="'+p.date+'">'+esc(format(p.date,{dateStyle:'medium'}))+'</time><strong>'+esc(valueText(values[i],metric,currency))+'</strong><small>'+(Number.isFinite(values[i])?(partial(p)?'Parcial o estimado':'Reconstruido'):'Sin dato')+'</small></button>').join('')+'</div></details></section>';
 }
 function positions(state,point,ref){
  const {currency,first}=state;
  return '<section class="vt-position"><h2>Posición del corte</h2>'+groups.map(([title,items])=>'<section><h3>'+title+'</h3><dl>'+items.map(([key,label,ic])=>{
   const a=valueOf(point,key),b=valueOf(ref,key);
   const canCompare=ref&&(!flowKeys.has(key)||comparableFlow(point.date,ref.date,first));
   return '<div>'+svg(ic)+'<dt><button type="button" data-vt-metric="'+key+'" aria-label="Ver evolución de '+label+'">'+label+'</button>'
    +(ref?'<small>Referencia · '+esc(valueText(b,key,currency))+'</small>':'')+'</dt><dd><strong>'+esc(valueText(a,key,currency))+'</strong>'
    +(canCompare?deltaHTML(a,b,key,currency):ref?'<small>Períodos distintos</small>':'')+'</dd></div>';
  }).join('')+'</dl></section>').join('')+'</section>';
 }
 function interpretation(point,ref,currency){
  if(!ref)return '';
  const dimensions=[['Fondos disponibles','liquid',1],['Certificados','certificates',1],['Cuentas por cobrar','receivable',1],['Deudas','liabilities',-1]];
  return dimensions.map(([label,key,sign])=>({label,value:change(point[key],ref[key])*sign}))
   .filter(row=>Number.isFinite(row.value)&&row.value!==0).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value))
   .map(({label,value})=>'<div><span>'+label+'</span>'+deltaHTML(value,0,'net',currency)+'</div>').join('');
 }
 function timeline(state){
  const list=host().milestones(state.currency);
  const periodStart=state.date.slice(0,7)+'-01';
  const events=[...list,...(host().activity?.(periodStart,state.date,state.currency)||[])].sort((a,b)=>b.date.localeCompare(a.date)||a.title.localeCompare(b.title));
  const days=new Map();
  for(const event of events){if(!days.has(event.date))days.set(event.date,[]);days.get(event.date).push(event)}
  const icons={accounts:'bank',cards:'card',loans:'loan',certificates:'bank',payoff:'loan',record:'chart',benefits:'spark',movements:'wallet'};
  return '<ol class="vt-event-days">'+[...days].map(([date,items])=>'<li><time datetime="'+date+'">'+esc(dateText(date))+'</time>'+items.map(e=>
   '<button type="button" data-vt-date="'+date+'">'+(host().bankMark?.(e.bankId)||svg(icons[e.kind]||'clock'))+'<strong>'+esc(e.title)+'</strong><span aria-hidden="true">›</span></button>').join('')+'</li>').join('')+'</ol>'
   +(days.size?'':'<p>Sin acontecimientos comparables en estos registros.</p>');
 }
 function paint(state){
  const {dialog,date,baseline,currency}=state,body=dialog.querySelector('.vt-body');
  const point=host().snapshot(date,currency),ref=baseline!==date?host().snapshot(baseline,currency):null;
  if(!point){body.innerHTML='<p>Este corte no tiene datos verificables.</p>';return}
  const previousScroll=body.scrollTop;
  const series=samples(state,point);
  const anchor=E.schedule().anchor;
  const related=E.kinds.filter(kind=>E.containing(kind,anchor,date)).map(kind=>
   '<button type="button" data-vt-wrapped="'+kind+'">'+({day:'Diario',week:'Semanal',month:'Mensual',quarter:'Trimestral',year:'Anual'})[kind]+'</button>').join('');
  const banks=point.banks.map(a=>'<div><dt>'+esc(a.name)+'</dt><dd>'+esc(money(a.balance,currency))+'</dd></div>').join('');
  const contributions=interpretation(point,ref,currency);
  const quality=point.unknown||point.estimatedLoan?'Reconstrucción parcial':'Corte reconstruido';
  const relatedEvents=state.eventTitles.get(date)||[];
  const limitations=[point.unknown?(point.unknown===1?'Se excluyó un registro sin fecha verificable.':'Se excluyeron '+point.unknown+' registros sin fecha verificable.'):'',
   point.estimatedLoan||ref?.estimatedLoan?'Parte del capital de préstamos se estimó con el plan contractual.':''].filter(Boolean);
  const settings=dialog.querySelector('.vt-nav');
  settings.innerHTML=navigator(state);
  const rail=settings.querySelector('.vt-rail'),selected=rail.querySelector('[aria-pressed="true"]');
  if(selected)rail.scrollLeft=selected.offsetLeft-rail.offsetLeft-(rail.clientWidth-selected.offsetWidth)/2;
  const titleValue=money(point.net,currency);
  body.innerHTML='<div class="vt-workspace"><section class="vt-hero"><div class="vt-hero-content"><span class="vt-cut">'+quality+'</span><time datetime="'+date+'">'+esc(dateText(date))+'</time><span class="vt-net-label">Patrimonio neto</span><h2 data-tone="'+(point.net<0?'negative':'neutral')+'"'+(titleValue.length>20?' class="vt-amount-long"':'')+'>'+esc(titleValue)+'</h2>'
   +(ref?deltaHTML(point.net,ref.net,'net',currency,true)+'<small class="vt-hero-reference">Frente al '+esc(dateText(ref.date))+'</small>':'')+'</div>'
   +(ref?comparisonGraph(ref,point,currency):'<div class="vt-hero-orbit" aria-hidden="true"></div>')+'</section>'
   +evolution(state,series)
   +'<section class="vt-reflection" '+(!ref&&!relatedEvents.length&&!limitations.length?'hidden':'')+'><h2>'+svg('spark')+'VIVE Intelligence</h2>'
   +(ref?'<h3>Aportes al cambio patrimonial</h3><div class="vt-contributions">'+(contributions||'<p>El patrimonio reconstruido permaneció estable.</p>')+'</div>':'')
   +(relatedEvents.length?'<h3>Acontecimientos de este corte</h3><ul>'+relatedEvents.map(title=>'<li>'+esc(title)+'</li>').join('')+'</ul>':'')
   +limitations.map(note=>'<p class="vt-quality">'+esc(note)+'</p>').join('')+'<div data-vt-insights></div></section>'
   +positions(state,point,ref)
   +'<section class="vt-journey"><details class="vt-timeline" '+(state.timeline?'open':'')+'><summary>Acontecimientos y cierres destacados</summary><div>'
   +(state.timeline?timeline(state):'')+'</div></details>'
   +(banks?'<details class="vt-bank-detail" '+(state.banks?'open':'')+'><summary>Saldos por cuenta bancaria</summary><dl>'+banks+'</dl></details>':'')
   +'<details class="vt-method" '+(state.method?'open':'')+'><summary>Cómo se reconstruye el historial</summary><ul><li>Cobertura desde '+esc(dateText(state.first))+' hasta hoy. Los cortes usan aperturas o fechas contractuales registradas y movimientos confirmados. Si falta una fecha de origen, no se sustituye por la fecha de alta.</li><li>Los saldos se reconstruyen a la fecha. Ingresos, egresos y beneficios se acumulan desde el día 1 del mes. Para mostrar variaciones de flujo se comparan cierres completos o el mismo día de dos meses con cobertura desde el inicio.</li><li>Cada moneda conserva su denominación original. La reconstrucción conserva RD$ y US$ separados.</li><li>La vigencia histórica de suscripciones y compromisos sigue pendiente de reconstrucción. La utilización exige límites documentados.</li>'
   +limitations.map(note=>'<li>'+esc(note)+'</li>').join('')+'</ul></details>'
   +(related?'<section class="vt-related"><h2>Wrapped relacionados</h2>'+related+'</section>':'')+'</section></div>';
  body.scrollTop=previousScroll;
  const insight=body.querySelector('[data-vt-insights]');
  const completed=series.filter(p=>p.date===monthEnd(p.date)).slice(-3);
  host().insights(point,currency,completed).then(items=>{
   if(!insight.isConnected||!host().available())return;
   if(items.length)insight.closest('.vt-reflection').hidden=false;
   insight.innerHTML=items.map(f=>'<details class="vt-insight"><summary>'+esc(f.title)+'</summary><p>'+esc(f.explanation)+'</p>'
    +'<dl>'+f.evidence.map(e=>'<div><dt>'+esc(e.label)+'</dt><dd>'+esc(e.value)+'</dd></div>').join('')+'</dl></details>').join('');
  }).catch(()=>{});
  dialog.querySelector('.vt-announcement').textContent= dateText(date)+' · '+titleValue;
 }
 function travel(date){
  if(!active||!E.validDate(date)||!active.first||date<active.first||date>active.now)return false;
  active.date=date;
  paint(active);
  active.dialog.querySelector('.vt-body').scrollTop=0;
  return true;
 }
 function dismiss(state){
  if(state.leaving)return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){state.dialog.close();return}
  state.leaving=true;
  state.dialog.classList.add('vt-leaving');
  state.exitTimer=setTimeout(()=>state.dialog.close(),165);
 }
 function open(date,source){
  if(!host()?.available())return;
  if(active){travel(date);return}
  const now=host().asOf(),history=host().history(true),first=history.first,opener=source||document.activeElement;
  const dialog=document.createElement('dialog');
  dialog.className='vt-dialog';
  dialog.setAttribute('aria-labelledby','vt-title');
  dialog.innerHTML='<header class="vt-top"><div class="vt-brand"><span>'+svg('clock')+'</span><h1 id="vt-title">VIVE Time Machine</h1></div><button type="button" data-vt-close aria-label="Cerrar Time Machine">×</button></header><div class="vt-nav"></div><main class="vt-body"><p class="vt-empty">Tu primer corte estará disponible al registrar una apertura o un movimiento.</p></main><p class="vt-announcement" role="status"></p>';
  const selected=first&&E.validDate(date)&&date>=first&&date<=now?date:now;
  const previous=E.period('month',now).end;
  const dates=history.events||[],eventTitles=new Map();
  for(const {date,title} of dates){
   if(!eventTitles.has(date))eventTitles.set(date,[]);
   eventTitles.get(date).push(title);
  }
  const state={dialog,now,first,date:selected,baseline:selected===now&&first&&previous>=first?previous:now,
   currency:'DOP',unit:'day',metric:'net',eventTitles,eventDates:new Set(eventTitles.keys()),controls:false};
  document.body.append(dialog);
  active=state;
  const focus=selector=>dialog.querySelector(selector)?.focus({preventScroll:true});
  dialog.addEventListener('close',()=>{
   clearTimeout(state.exitTimer);
   dialog.remove();
   if(active===state){active=null;opener?.focus?.({preventScroll:true})}
  });
  dialog.addEventListener('cancel',ev=>{ev.preventDefault();dismiss(state)});
  dialog.addEventListener('change',ev=>{
   const el=ev.target,field=el.dataset.vtField;
   if(!field)return;
   if(field==='preset'&&el.value)state.baseline=preset(state.date,el.value);
   else if(field==='currency'||field==='metric'||E.validDate(el.value)&&el.value>=first&&el.value<=now)state[field]=el.value;
   paint(state);
   focus('[data-vt-field="'+field+'"]');
  });
  dialog.addEventListener('toggle',ev=>{
   const el=ev.target;
   if(el.matches?.('.vt-timeline')){
    state.timeline=el.open;
    if(el.open&&!el.querySelector('.vt-event-days')){
     const items=host().milestones(state.currency);
     for(const {date,title} of items){
      state.eventDates.add(date);
      const titles=state.eventTitles.get(date)||[];
      if(!titles.includes(title))state.eventTitles.set(date,[...titles,title]);
     }
     el.querySelector('div').innerHTML=timeline(state);
    }
   }else if(el.matches?.('.vt-bank-detail'))state.banks=el.open;
   else if(el.matches?.('.vt-method'))state.method=el.open;
  },true);
  dialog.addEventListener('keydown',ev=>{
   if(!ev.target.closest('.vt-rail')||!['ArrowLeft','ArrowRight'].includes(ev.key))return;
   ev.preventDefault();
   state.date=clamp(shift(state.date,ev.key==='ArrowLeft'?-1:1,state.unit),state);
   paint(state);
   focus('.vt-tick[aria-pressed="true"]');
  });
  dialog.addEventListener('click',ev=>{
   const b=ev.target.closest('button,a[data-vt-date]');
   if(!b)return;
   if(b.hasAttribute('data-vt-close'))dismiss(state);
   else if(b.dataset.vtDate||b.dataset.vtStep){
    ev.preventDefault();
    const inRail=b.closest('.vt-ruler'),inBody=b.closest('.vt-body');
    const next=b.dataset.vtDate||clamp(shift(state.date,+b.dataset.vtStep,state.unit),state);
    state.date=next;
    paint(state);
    if(inRail)focus('.vt-tick[aria-pressed="true"]');
    else if(inBody){dialog.querySelector('.vt-body').scrollTop=0;focus('.vt-tick[aria-pressed="true"]')}
    else focus('.vt-actions [data-vt-date]');
   }else if(b.dataset.vtUnit){
    state.unit=b.dataset.vtUnit;paint(state);focus('[data-vt-unit="'+state.unit+'"]');
   }else if(b.hasAttribute('data-vt-controls')){
    state.controls=!state.controls;paint(state);focus('[data-vt-controls]');
   }else if(b.dataset.vtMetric){
    state.metric=b.dataset.vtMetric;paint(state);
    dialog.querySelector('.vt-evolution').scrollIntoView({block:'nearest'});
    focus('[data-vt-field="metric"]');
   }else if(b.dataset.vtWrapped){
    window.ViveWrapped.open(b.dataset.vtWrapped,b,state.date);
   }
  });
  dialog.showModal();
  if(first)paint(state);
  focus('[data-vt-close]');
 }
 document.addEventListener('click',ev=>{
  const b=ev.target.closest?.('[data-vtime-open]');
  if(b)open(b.dataset.vtimeOpen,b);
 });
 window.ViveTimeMachine=Object.freeze({open,travel});
})();
