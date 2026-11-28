/* VIVE Wrapped · estrenos, archivo y cinco lenguajes visuales. */
(function(){'use strict';
 const E=window.ViveWrappedEngine;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=s=>new Intl.DateTimeFormat('es-DO',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z'));
 const range=p=>p.start===p.end?date(p.end):date(p.start)+' — '+date(p.end);
 const art={
 day:`<g class="vw-sun"><circle cx="98" cy="67" r="35" fill="#ffe8a0"/><circle cx="98" cy="67" r="43" fill="none" stroke="#ffe8a0" stroke-opacity=".5" stroke-dasharray="2 8"/><path d="M98 16V5M98 129v-11M47 67H36M160 67h-11M62 31l-8-8M134 103l8 8M134 31l8-8M62 103l-8 8" stroke="#ffe8a0" stroke-width="2" stroke-linecap="round"/></g><path d="M0 115Q39 66 91 111T180 97V160H0Z" fill="#478a71"/><path d="M0 137Q45 93 90 130T180 119V160H0Z" fill="#aad5ad"/><path d="M0 149Q40 125 80 145T180 132" stroke="#fff" stroke-opacity=".5" fill="none"/>`,
 week:`<g fill="none" stroke="#e8deff" opacity=".32"><path d="M8 30H172M8 65H172M8 100H172M8 135H172"/></g><g fill="#b5a8ff">${[63,101,47,116,82,125,97].map((h,i)=>`<rect x="${8+i*24}" y="${146-h}" width="15" height="${h}" rx="7" style="--beat:${i*65}ms"/>`).join('')}</g><path class="vw-wave" d="M5 89Q22 23 40 58T77 59T116 40T173 20" fill="none" stroke="#ffd0ec" stroke-width="3" stroke-linecap="round"/><g fill="#ffd0ec"><circle cx="40" cy="58" r="4"/><circle cx="116" cy="40" r="4"/></g>`,
 month:`<g class="vw-disc"><circle cx="82" cy="81" r="64" fill="#ff987e"/><path d="M82 81V17A64 64 0 0 1 143 100Z" fill="#ffedb5"/><path d="M82 81L143 100A64 64 0 0 1 28 116Z" fill="#e56796"/><circle cx="82" cy="81" r="26" fill="#591f3c"/><circle cx="82" cy="81" r="51" stroke="#fff" stroke-opacity=".35" stroke-dasharray="1 5" fill="none"/></g><path d="M155 10v34m-17-17h34M20 10v15m-7-7h15" stroke="#ffedb5" stroke-width="2" stroke-linecap="round"/>`,
 quarter:`<g stroke="#fff1c5" stroke-width=".7"><g class="vw-block" style="--beat:0ms"><path d="M5 110L42 88 79 110 42 132Z" fill="#e1ba77"/><path d="M5 110v17l37 22v-17Z" fill="#907044"/><path d="M42 132l37-22v17l-37 22Z" fill="#bd975c"/></g><g class="vw-block" style="--beat:100ms"><path d="M51 69L88 47 125 69 88 91Z" fill="#efcc90"/><path d="M51 69V108L88 130V91Z" fill="#907044"/><path d="M88 91L125 69V108L88 130Z" fill="#bd975c"/></g><g class="vw-block" style="--beat:200ms"><path d="M101 26L138 4 175 26 138 48Z" fill="#ffe4a8"/><path d="M101 26V87L138 109V48Z" fill="#9e7946"/><path d="M138 48L175 26V87L138 109Z" fill="#d6ae6d"/></g></g>`,
 year:`<g class="vw-orbits"><ellipse cx="90" cy="80" rx="77" ry="37" transform="rotate(-35 90 80)" fill="none" stroke="#d8bb7e" stroke-width="1.5"/><ellipse cx="90" cy="80" rx="77" ry="37" transform="rotate(35 90 80)" fill="none" stroke="#819bd0" stroke-width="1.5"/><circle cx="145" cy="36" r="5" fill="#ffe6a2"/><circle cx="30" cy="122" r="4" fill="#b8ceff"/></g><circle cx="90" cy="80" r="37" fill="#344b75" stroke="#8ca3d8"/><path class="vw-star" d="M90 35Q95 74 135 80Q95 86 90 125Q85 86 45 80Q85 74 90 35Z" fill="#ffe6a2"/><g fill="#fff1cf"><circle cx="15" cy="20" r="2"/><circle cx="150" cy="20" r="3"/><circle cx="162" cy="129" r="2"/><circle cx="29" cy="140" r="3"/><circle cx="83" cy="8" r="1.5"/></g>`};
 art.special='<g fill="none" stroke="#f8d780" stroke-width="1.5"><path d="M23 133V65L90 17l67 48v68H23Z"/><path d="M40 133V73l50-36 50 36v60H40Z" opacity=".6"/><path d="M58 133V83l32-23 32 23v50H58Z" opacity=".38"/></g><path class="vw-star" d="M90 78l4 13 13 4-13 4-4 13-4-13-13-4 13-4Z" fill="#ffedaf"/><path d="M11 140h158" stroke="#f8d780" stroke-opacity=".5"/>';
 const tag={day:'Cada día cuenta',week:'Siete días. Una historia.',month:'Un mes que dejó huella',quarter:'Perspectiva que transforma',year:'Un año. Tu historia.'};
 const frequency={day:'DIARIO',week:'SEMANAL',month:'MENSUAL',quarter:'TRIMESTRAL',year:'ANUAL',special:'ESPECIAL'};
 const illustration=k=>'<svg class="vw-art" viewBox="0 0 180 160" aria-hidden="true" focusable="false">'+art[k]+'</svg>';
 let active=null,timer=null;
 const host=()=>window.ViveWrappedHost;
 const idFor=(p,event)=>event?'special:'+event.id:p.kind+':'+p.start;
 function progress(){
  const reader=host()?.reader?.();
  if(!reader)return {key:null,items:{}};
  const key='vive.wrapped.progress.'+reader;
  try{return {key,items:JSON.parse(localStorage.getItem(key)||'{}')||{}}}catch(_){return {key,items:{}}}
 }
 function remember(completed=false){
  if(!active?.p||host()?.reader?.()!==active.reader)return;
  const {p,event,slides,i}=active,{key,items}=progress();
  if(!key)return;
  const id=idFor(p,event);
  if(completed&&!event)delete items[id];
  else items[id]={scene:slides[i].scene,index:i,date:p.end,at:Date.now(),completed};
  const recent=Object.entries(items).filter(([id])=>!id.startsWith('special:')).sort((a,b)=>b[1].at-a[1].at).slice(0,48);
  const specials=Object.entries(items).filter(([id])=>id.startsWith('special:'));
  try{localStorage.setItem(key,JSON.stringify(Object.fromEntries([...recent,...specials])))}catch(_){}
 }
 function featureEntries(){
  const items=progress().items,events=host()?.special?.()||[];
  const unread=events.find(event=>!items[idFor(null,event)])||null;
  const entry=(event,isNew)=>'<button type="button" data-vwrapped="special" data-vw-event="'+esc(event.id)+'" class="vw-entry vw-special '+(isNew?'vw-cover':'vw-past')+'"><span class="vw-entry-copy"><small>VIVE ORIGINALS · ESPECIAL</small><strong>El día que cerraste una deuda</strong><small>'+esc(date(event.date))+'</small></span>'+illustration('special')+'<span class="vw-arrow" aria-hidden="true">↗</span></button>';
  return {premiere:unread?entry(unread,true):'',archive:events.filter(event=>event!==unread).map(event=>entry(event,false)).join('')};
 }
 function continueEntry(schedule){
  const entry=Object.entries(progress().items).filter(([id,item])=>!id.startsWith('special:')&&!item.completed&&item.index>0)
   .sort((a,b)=>b[1].at-a[1].at)[0];
  if(!entry)return '';
  const [id,item]=entry,kind=id.split(':')[0];
  if(!E.containing(kind,schedule.anchor,item.date))return '';
  return '<button type="button" class="vw-resume" data-vwrapped="'+kind+'" data-vw-date="'+item.date+'">Continuar · '+frequency[kind]+' · '+esc(date(item.date))+'</button>';
 }
 function countdown(at){const minutes=Math.max(0,Math.ceil((Date.parse(at)-Date.now())/60000));return minutes>=1440?Math.floor(minutes/1440)+' d '+Math.floor(minutes%1440/60)+' h':Math.floor(minutes/60)+' h '+String(minutes%60).padStart(2,'0')+' min'}
 const mark='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18v-6m5 6V6m5 12V9m5 9V4"/></svg>';
 const calendar='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/></svg>';
 function entry(x,cover,premiere=cover){
  const label=cover?'<small class="vw-cover-line">'+mark+'<span>Wrapped</span>'+(premiere?'<span class="vw-premiere">Estreno</span>':'')+'</small>':'<small>'+frequency[x.kind]+'</small>';
  return '<button type="button" data-vwrapped="'+x.kind+'" class="vw-entry vw-'+x.kind+(cover?' vw-cover':' vw-past')+'"><span class="vw-entry-copy">'+label+'<strong>'+esc(x.title||tag[x.kind])+'</strong><small>'+esc(range(x.p))+'</small></span>'+illustration(x.kind)+'<span class="vw-arrow" aria-hidden="true">›</span></button>';
 }
 function inbox(){
  const s=E.schedule(),n=s.next;
  return '<section class="vw-inbox" aria-label="VIVE Wrapped" data-vw-signature="'+s.today+'-'+s.released+'"><div class="vw-special-new"></div><div class="vw-resume-slot">'+continueEntry(s)+'</div><div class="vw-list vw-regular-premieres">'
   +(s.fresh.length?s.fresh.map(x=>entry(x,true,true)):[entry(s.items[0],true,false)]).join('')+'</div>'
   +'<button type="button" class="vw-upcoming" data-vw-upcoming aria-label="Próximo estreno: '+esc(E.titles[n.kind])+' · '+esc(date(n.nextDate))+' · 8:00 a. m."><span class="vw-upcoming-icon">'+calendar+'</span><span class="vw-upcoming-copy"><small>Próximo estreno</small><strong>'+esc(E.titles[n.kind])+'</strong></span><span class="vw-countdown" data-vw-countdown="'+n.nextAt+'">'+countdown(n.nextAt)+'</span><span class="vw-upcoming-arrow" aria-hidden="true">›</span></button>'
   +'<details class="vw-archive"><summary>Archivo de Wrapped</summary><div class="vw-list">'+s.items.map(x=>entry(x,false)).join('')+'<div class="vw-special-archive"></div></div></details></section>';
 }
 function refresh(){const s=E.schedule();document.querySelectorAll('.vw-inbox').forEach(el=>{if(!el.getClientRects().length)return;if(el.dataset.vwSignature!==s.today+'-'+s.released&&!el.contains(document.activeElement)){const old=el.querySelector('.vw-archive').open,parent=el.parentElement;el.outerHTML=inbox();const current=parent?.querySelector('.vw-inbox');if(old&&current)current.querySelector('.vw-archive').open=true;return}el.querySelectorAll('[data-vw-countdown]').forEach(x=>{x.textContent=countdown(x.dataset.vwCountdown)})});}
 function refreshEditorial(){
  const panels=[...document.querySelectorAll('.vw-inbox')].filter(el=>el.getClientRects().length);
  if(!panels.length||!host()?.available())return;
  const schedule=E.schedule(),info=featureEntries(),resume=continueEntry(schedule);
  const premiered=schedule.fresh.length?schedule.fresh:[schedule.items[0]];
  const premieres=premiered.map(item=>{
   const p=item.p,events=host().events?.(p.start,p.end,p.kind)||[];
   const amounts=host().amounts(p.start,p.end);
   let title='';
   if(events[0]?.kind==='payoff')title='El período en que cerraste una deuda';
   else if(amounts.count&&!amounts.estimatedFx&&amounts.net<0)title='Cuando el gasto superó lo que llegó';
   else if(amounts.count&&Object.values(amounts.byCategory||{}).some(v=>v>0)){
    const category=Object.entries(amounts.byCategory).sort((a,b)=>b[1]-a[1])[0][0];
    title='Una mirada a '+category;
   }
   return entry({...item,title},true,item.fresh);
  }).join('');
  for(const panel of panels){
   for(const [selector,html] of [['.vw-special-new',info.premiere],['.vw-special-archive',info.archive],['.vw-resume-slot',resume],['.vw-regular-premieres',premieres]]){
    const slot=panel.querySelector(selector);
    if(slot&&!slot.contains(document.activeElement)&&slot.innerHTML!==html)slot.innerHTML=html;
   }
  }
 }
 function manageTimer(){const visible=[...document.querySelectorAll('.vw-inbox')].some(x=>x.getClientRects().length);if(visible&&!document.hidden){refresh();host()?.ready?.().then(refreshEditorial).catch(()=>{});if(!timer)timer=setInterval(()=>{if(document.hidden||![...document.querySelectorAll('.vw-inbox')].some(x=>x.getClientRects().length)){clearInterval(timer);timer=null;return}refresh();refreshEditorial()},30000)}else if(timer){clearInterval(timer);timer=null}}
 document.addEventListener('toggle',manageTimer,true);document.addEventListener('visibilitychange',manageTimer);

 const money=n=>new Intl.NumberFormat('es-DO',{style:'currency',currency:'DOP',maximumFractionDigits:0}).format(n);
 const sceneNames={cover:'EL COMIENZO',income:'LO QUE LLEGÓ',expense:'LO QUE SALIÓ',balance:'EL RESULTADO',category:'TUS PRIORIDADES',comparison:'EN EL CAPÍTULO ANTERIOR',final:'LO QUE SIGUE',empty:'TU HISTORIA',milestone:'EL MOMENTO CLAVE',arc:'TUS ETAPAS',plot:'GIRO DE GUION',director:'TRAS LAS CIFRAS',whatif:'ESCENARIO ALTERNATIVO',credits:'DESPUÉS DE LOS CRÉDITOS'};
 function bars(rows){const clean=rows.filter(x=>Number.isFinite(x[1]));if(!clean.length)return '';const signed=clean.some(x=>x[1]<0),max=Math.max(1,...clean.map(x=>Math.abs(x[1]))),zero=signed?50:0,scale=signed?50:100;
 return '<div class="vw-chart" aria-label="Comparación de valores">'+clean.map(([label,value,tone])=>{const w=Math.abs(value)/max*scale,x=value<0?zero-w:zero;return '<div class="vw-bar-row"><div><span>'+esc(label)+'</span><b>'+esc(money(value))+'</b></div><svg viewBox="0 0 100 5" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="5" rx="2.5" fill="currentColor" opacity=".12"/><rect class="vw-fill vw-tone-'+tone+'" x="'+x+'" width="'+w+'" height="5" rx="1.2"/>'+(signed?'<path d="M50 0V5" stroke="currentColor" stroke-width=".4"/>':'')+'</svg></div>'}).join('')+'</div>'}
 function visual(s,p){const d=s.data||{};switch(s.scene){case 'cover':return '<div class="vw-cover-art">'+illustration(p.kind)+'</div>';case 'income':case 'expense':return '<div class="vw-flow-symbol" aria-hidden="true">'+(s.scene==='income'?'↗':'↘')+'</div>'+bars([['Ingresos',d.income,'in'],['Egresos',d.expense,'out']]);case 'balance':return bars([['Ingresos',d.income,'in'],['Egresos',d.expense,'out']]);case 'category':return bars((d.items||[]).map(([label,value],i)=>[label,value,i===0?'accent':'muted']));case 'plot':case 'whatif':case 'comparison':return bars([[s.scene==='whatif'?'Flujo observado':'Período anterior',d.previous,'muted'],[s.scene==='whatif'?'Flujo simulado':'Este período',d.current,'accent']]);case 'arc':return bars(d.items.map(([label,value],i)=>[label,value,i===d.items.length-1?'accent':'muted']));case 'director':return '<details class="vw-evidence-note"><summary>Ver registros que lo sustentan</summary><dl class="vw-evidence">'+d.evidence.map(e=>'<div><dt>'+esc(e.label)+'</dt><dd>'+esc(e.value)+'</dd></div>').join('')+'</dl></details>';case 'credits':case 'milestone':return '<ul class="vw-milestones">'+d.events.map(e=>'<li><time datetime="'+esc(e.date)+'">'+esc(date(e.date))+'</time><strong>'+esc(e.title)+'</strong></li>').join('')+'</ul>';case 'final':return '<div class="vw-finale-art" aria-hidden="true">✳</div>';default:return '<div class="vw-empty-art" aria-hidden="true">◌</div>'}}
 function render(){const {dialog,p,slides,i}=active,s=slides[i];dialog.dataset.kind=p.kind;dialog.dataset.theme=s.theme;dialog.dataset.scene=s.scene;remember();
 dialog.querySelector('.vw-progress').innerHTML=slides.map((_,j)=>'<i class="'+(j<=i?'done':'')+'"></i>').join('');
 const story=dialog.querySelector('.vw-story-copy'),travelDate=s.date||p.end;
 const first=window.ViveTimeHost?.history().first;
 const travel=first&&travelDate>=first?'<button class="vw-travel" type="button" data-vw-travel>Viajar a '+esc(date(travelDate))+' →</button>':'';
 story.innerHTML='<article class="vw-scene"><div class="vw-scene-kicker"><span>'+sceneNames[s.scene]+'</span><span>'+String(i+1).padStart(2,'0')+' / '+String(slides.length).padStart(2,'0')+'</span></div><div class="vw-scene-head"><small>'+esc(range(p))+'</small><h2 id="vw-title">'+esc(s.title)+'</h2></div><div class="vw-scene-metric"><div class="vw-value">'+esc(s.value)+'</div><p>'+esc(s.detail)+'</p></div><div class="vw-scene-visual">'+visual(s,p)+'</div>'+travel+'</article>';story.scrollTop=0;
 dialog.querySelector('.vw-count').textContent=(i+1)+' / '+slides.length;dialog.querySelector('[data-vw-prev]').disabled=i===0;dialog.querySelector('[data-vw-next]').textContent=i===slides.length-1?'Finalizar':'Continuar →';const newer=dialog.querySelector('[data-vw-newer]'),older=dialog.querySelector('[data-vw-older]');if(newer)newer.disabled=p.offset===0;if(older)older.disabled=p.offset>=1199;
 const end=dialog.querySelector('[data-vw-next]');if(slides[i+1]?.scene==='credits')end.textContent='Ver postcréditos';}

 function restoreScene(state,resume){
  state.i=0;
  if(!resume)return;
  const prior=progress().items[idFor(state.p,state.event)];
  if(!prior||prior.completed)return;
  const index=state.slides.findIndex(x=>x.scene===prior.scene);
  if(index>=0)state.i=index;
 }
 function load(state,kind,offset,resume=true){
  const p=E.period(kind,state.anchor,offset),previous=E.period(kind,state.anchor,offset+1);
  const a=host().amounts(p.start,p.end),b=host().amounts(previous.start,previous.end);
  const series=E.chapters(p).map(x=>({...x,...host().amounts(x.start,x.end)}));
  state.p=p;
  state.slides=E.story(p,a,b,host().events?.(p.start,p.end,kind),series,host().editorial?.(p,a,b)||{});
  restoreScene(state,resume);
  render();
 }
 function open(kind,source,selectedDate,eventId){
  const bridge=host();
  if(!bridge?.available()||kind!=='special'&&!E.kinds.includes(kind))return;
  const event=kind==='special'&&(bridge.special?.()||[]).find(x=>x.id===eventId);
  if(kind==='special'&&!event)return;
  if(active)active.dialog.close();
  const opener=source||document.activeElement,d=document.createElement('dialog');
  const state={dialog:d,anchor:E.schedule().anchor,reader:bridge.reader?.(),event};
  d.className='vw-dialog';
  d.setAttribute('aria-labelledby','vw-title');
  d.innerHTML='<div class="vw-frame"><header><div class="vw-wordmark">VIVE ORIGINALS <b>Wrapped</b></div><span class="vw-edition">'+frequency[kind]+'</span><button type="button" data-vw-close aria-label="Cerrar Wrapped">×</button></header><div class="vw-progress" aria-hidden="true"></div>'
   +(event?'':'<nav class="vw-period-nav" aria-label="Historial de períodos"><button type="button" data-vw-older>‹ Anterior período</button><button type="button" data-vw-newer>Más reciente ›</button></nav>')
   +'<main class="vw-story-copy" aria-live="polite"></main><footer><button type="button" data-vw-prev>Anterior</button><span class="vw-count"></span><button type="button" data-vw-next>Siguiente</button></footer></div>';
  document.body.append(d);
  active=state;
  const shift=n=>{
   const index=state.i+n;
   if(index>=0&&index<state.slides.length){state.i=index;render()}
  };
  d.addEventListener('close',()=>{
   d.remove();
   if(active===state){
    active=null;
    const center=opener?.closest?.('.vn-dialog');
    if(!document.querySelector('.vt-dialog[open]')){
     const focus=event&&opener?.closest('.vw-special-new')?center?.querySelector('[aria-pressed="true"]'):opener;
     focus?.focus?.({preventScroll:true});
    }
    manageTimer();
   }
  });
  d.addEventListener('click',ev=>{
   const b=ev.target.closest('button');
   if(!b||active!==state)return;
   if(b.hasAttribute('data-vw-close'))d.close();
   else if(b.hasAttribute('data-vw-travel')){
    const target=state.slides[state.i].date||state.p.end;
    d.close();
    window.ViveTimeMachine?.open(target,opener);
   }else if(b.hasAttribute('data-vw-prev'))shift(-1);
   else if(b.hasAttribute('data-vw-next')){
    if(state.i===state.slides.length-1){remember(true);d.close()}else shift(1);
   }else if(b.hasAttribute('data-vw-older'))load(state,kind,state.p.offset+1);
   else if(b.hasAttribute('data-vw-newer'))load(state,kind,state.p.offset-1);
  });
  let start=null;
  const surface=d.querySelector('.vw-story-copy');
  surface.addEventListener('pointerdown',ev=>{if(ev.pointerType==='touch')start={x:ev.clientX,y:ev.clientY}});
  surface.addEventListener('pointercancel',()=>{start=null});
  surface.addEventListener('pointerup',ev=>{
   if(!start||active!==state)return;
   const dx=ev.clientX-start.x,dy=ev.clientY-start.y;
   start=null;
   if(Math.abs(dx)>=65&&Math.abs(dx)>=Math.abs(dy)*1.5)shift(dx<0?1:-1);
  });
  d.addEventListener('keydown',ev=>{
   if(!['ArrowRight','ArrowLeft'].includes(ev.key))return;
   ev.preventDefault();
   shift(ev.key==='ArrowRight'?1:-1);
  });
  try{
   if(event){
    state.p={kind,start:event.date,end:event.date};
    state.slides=E.specialStory(event);
    restoreScene(state,true);
    render();
   }else load(state,kind,selectedDate?E.containing(kind,state.anchor,selectedDate)?.offset??0:0);
   d.showModal();
   if(!event&&!window.ViveIntelligence)bridge.ready?.().then(()=>{
    if(active!==state||state.i!==0||!bridge.available())return;
    load(state,kind,state.p.offset);
   }).catch(()=>{});
   d.querySelector('[data-vw-close]').focus();
  }catch(err){d.remove();active=null;console.error('VIVE Wrapped:',err)}
 }
 document.addEventListener('click',ev=>{
  const b=ev.target.closest?.('[data-vwrapped]');
  if(!b)return;
  ev.preventDefault();
  ev.stopPropagation();
  open(b.dataset.vwrapped,b,b.dataset.vwDate,b.dataset.vwEvent);
 },true);
 window.ViveWrapped={inbox,open,sync:manageTimer};})();
