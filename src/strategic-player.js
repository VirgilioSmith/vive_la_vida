(function strategicPlayer(){
 'use strict';
 const KEY='vive.strategic.player.seen.v1';
 const DURATION=10500;
 const CATALOG={
  vive:[
   ['Vive hoy','No pospongas todo lo que te hace sentir vivo.'],
   ['Respira profundo','Que el ruido del día no te quite la calma.'],
   ['Dios primero','Agradece el camino y sigue construyendo.'],
   ['Agradece siempre','También hay motivos para celebrar lo sencillo.'],
   ['Haz espacio','Tu bienestar merece tiempo en tu agenda.'],
   ['Sigue creciendo','Lo pequeño también suma a tu futuro.'],
   ['Abraza momentos','Lo verdaderamente valioso merece presencia.'],
   ['Disfruta ahora','La vida ocurre mientras construyes tus planes.'],
   ['Cuida tu paz','No todo merece tu energía.'],
   ['Elige vivir','Haz que el dinero sirva a tu vida.'],
   ['Mira alrededor','A veces lo mejor ya está contigo.'],
   ['Pausa consciente','Respirar también es una forma de avanzar.'],
   ['Valora lo tuyo','Reconoce lo que has conseguido hasta hoy.'],
   ['Vuelve a ti','Tus metas importan, pero tú también.'],
   ['Comparte alegría','Un buen momento vale más al compartirlo.'],
   ['Vive presente','No dejes para mañana toda tu felicidad.'],
   ['Sigue creyendo','Un paso sincero sigue siendo progreso.'],
   ['Busca equilibrio','Construye mañana sin desaparecer del hoy.'],
   ['Celebra avances','Reconoce tu esfuerzo, incluso en días lentos.'],
   ['Haz recuerdos','Invierte también en experiencias que importan.']
  ],
  joseo:[
   ['Sigue joseando','La vuelta se construye trabajando con visión.'],
   ['Sin bulto','Menos apariencia, más resultados que hablen.'],
   ['Vamos arriba','El sueño grande comienza con una decisión.'],
   ['Modo joseo','Que el esfuerzo de hoy compre libertad mañana.'],
   ['A lo tuyo','No te desenfoques por ruido de afuera.'],
   ['Activa planes','Las ideas valen cuando las pones a caminar.'],
   ['Dale mente','Un buen movimiento vale más que diez impulsos.'],
   ['Joseo inteligente','Produce, organízate y vuelve a producir.'],
   ['Sin excusas','Lo que se puede mejorar, se trabaja.'],
   ['Visión grande','Del primer cliente al próximo nivel.'],
   ['Paso firme','No todo sale de una vez, pero se avanza.'],
   ['Sigue resolviendo','La vuelta se pone dura; la mente busca salida.'],
   ['Facturando metas','Que cada ingreso tenga un propósito.'],
   ['Cero pantalla','No se trata de parecer, sino de construir.'],
   ['Trabajo serio','El verdadero progreso no necesita hacer ruido.'],
   ['Más visión','Lo tuyo tiene futuro si lo sigues trabajando.'],
   ['Dale seguimiento','Un negocio crece cuando no sueltas los detalles.'],
   ['Hoy se mueve','Mañana agradeces el joseo de este día.'],
   ['Suma valor','Primero resuelve necesidades, luego cobra resultados.'],
   ['Mentalidad activa','Que el próximo paso encuentre tus cuentas claras.'],
   ['Vuelve fuerte','Un día flojo no cancela un plan grande.'],
   ['La vuelta','Que el trabajo te acerque a la vida que quieres.']
  ]
 };
 const icons={
  day:'<svg viewBox="0 0 120 120" fill="none" aria-hidden="true"><circle cx="60" cy="60" r="46" stroke="currentColor" stroke-width="2" opacity=".55"/><path d="M35 78V62m17 16V46m17 32V55m17 23V34" stroke="currentColor" stroke-linecap="round" stroke-width="9"/><path d="M26 36l22-14 17 9 25-19" stroke="currentColor" stroke-linecap="round" stroke-width="3" opacity=".55"/></svg>',
  vive:'<svg viewBox="0 0 120 120" fill="none" aria-hidden="true"><path d="M60 98 21 60C-1 36 23 10 45 27l15 13 15-13c22-17 46 9 24 33L60 98Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M33 63h17l10-21 10 37 9-16h10" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  joseo:'<svg viewBox="0 0 120 120" fill="none" aria-hidden="true"><path d="M22 94h78M29 94V62l20-15v47M49 94V31l24-13v76M73 94V51l19 12v31" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="m31 34 21-15m-7 0 7 0 0 7M39 75h2M61 40h2M61 54h2M61 68h2M83 73h2" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>'
 };
 const buttonSvg={
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 9 7 7 7-7"/></svg>',
  previous:'<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M5 7h3v18H5zM27 7v18L10 16z"/></svg>',
  next:'<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M24 7h3v18h-3zM5 7v18l17-9z"/></svg>',
  play:'<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M10 5v22l18-11z"/></svg>',
  pause:'<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><rect x="8" y="5" width="6" height="22" rx="2"/><rect x="18" y="5" width="6" height="22" rx="2"/></svg>'
 };
 const state={layer:null,mode:'day',queue:[],i:0,playing:true,timer:null,remaining:DURATION,started:0,opener:null,overflow:'',data:null,seen:null};
 const $=(q)=>state.layer?.querySelector(q);
 function loadSeen(){try{const obj=JSON.parse(localStorage.getItem(KEY)||'{}');return obj&&typeof obj==='object'?obj:{}}catch(_){return {}}}
 function writeSeen(){try{localStorage.setItem(KEY,JSON.stringify(state.seen))}catch(_){}}
 function pick(mode){
  const list=CATALOG[mode]||CATALOG.vive;
  const seen=Array.isArray(state.seen[mode])?state.seen[mode]:[];
  let choices=list.map((_,i)=>i).filter(i=>!seen.includes(i));
  if(!choices.length){state.seen[mode]=[];choices=list.map((_,i)=>i)}
  const index=choices[Math.floor(Math.random()*choices.length)];
  const next=(Array.isArray(state.seen[mode])?state.seen[mode]:[]).concat(index).slice(-list.length+1);
  state.seen[mode]=next;writeSeen();
  return {title:list[index][0],sub:list[index][1],tone:'calm',route:'',icon:mode,mode};
 }
 function dailySlides(){
  const data=state.data||{};const slides=[];
  const add=(v)=>{
   if(!v||!v.title)return;
   const key=(v.title+'|'+(v.sub||'')).toLowerCase();
   if(slides.some(x=>(x.title+'|'+(x.sub||'')).toLowerCase()===key))return;
   slides.push({title:v.title,sub:v.sub||'',tone:v.tone||'calm',route:v.go||v.route||'',icon:v.icon||'day',mode:'day'});
  };
  if(data.featured?.go)add(data.featured);
  (data.due||[]).forEach(add);
  (data.alerts||[]).forEach(add);
  if(data.summary){
   const x=data.summary;
   add({title:'Tus ingresos',sub:'Durante '+x.period+': '+x.income+'.',tone:'good',route:'flow'});
   add({title:'Tus egresos',sub:'Durante '+x.period+': '+x.expense+'.',tone:'calm',route:'expenses'});
   add({title:'Resultado neto',sub:'Ingresos menos egresos: '+x.net+'.',tone:x.negative?'warn':'good',route:'flow'});
  }
  if(!slides.length)add(data.featured||{title:'Tu momento',sub:'Tu centro estratégico está preparado para acompañarte.'});
  if(slides.length===0)add({title:'Tu resumen',sub:'Consulta tus movimientos para descubrir nuevas señales.'});
  return slides.slice(0,14);
 }
 function clearTimer(){if(state.timer!==null){clearTimeout(state.timer);state.timer=null}}
 function schedule(reset){
  clearTimer();
  const bar=$('.vsp-meter-fill');
  if(reset)state.remaining=DURATION;
  if(bar&&reset){bar.style.animation='none';void bar.offsetWidth;bar.style.animation='vsp-meter '+DURATION+'ms linear forwards'}
  if(bar)bar.style.animationPlayState=state.playing?'running':'paused';
  if(state.playing&&state.layer){
   state.started=performance.now();
   state.timer=setTimeout(()=>{state.timer=null;next()},state.remaining);
  }
  const toggle=$('[data-vsp-action="toggle"]');
  if(toggle){toggle.innerHTML=state.playing?buttonSvg.pause:buttonSvg.play;toggle.setAttribute('aria-label',state.playing?'Pausar mensajes':'Reanudar mensajes')}
 }
 function current(){return state.queue[state.i]||{title:'Vive hoy',sub:'Un día a la vez.',tone:'calm'}}
 function paint(){
  if(!state.layer)return;
  const x=current();
  state.layer.dataset.mode=state.mode;
  state.layer.dataset.tone=x.tone||'calm';
  $('.vsp-art-icon').innerHTML=icons[state.mode]||icons.vive;
  $('.vsp-art-kicker').textContent=state.mode==='day'?'LO QUE IMPORTA':state.mode==='joseo'?'MODO JOSEO':'RECUERDA VIVIR';
  $('.vsp-message-title').textContent=x.title;
  $('.vsp-message-copy').textContent=x.sub;
  $('.vsp-count').textContent=state.mode==='day'?(state.i+1)+' / '+state.queue.length:'SIN REPETICIONES';
  $('.vsp-mode-name').textContent=state.mode==='day'?'Mi día':state.mode==='vive'?'Vive':'Joseo';
  const link=$('[data-vsp-detail]');link.hidden=!x.route;
  if(x.route){link.dataset.id=x.route;link.textContent=x.route==='wallet'?'Abrir Wallet':x.route==='pressure'?'Ver compromisos':x.route==='expenses'?'Ver egresos':'Ver flujo'}
  state.layer.querySelectorAll('[data-vsp-mode]').forEach(b=>{const on=b.dataset.vspMode===state.mode;b.setAttribute('aria-pressed',String(on));b.classList.toggle('active',on)});
  schedule(true);
 }
 function changeMode(mode){
  if(!['day','vive','joseo'].includes(mode)||!state.layer)return;
  state.mode=mode;state.i=0;state.queue=mode==='day'?dailySlides():[pick(mode)];
  state.playing=true;paint();
 }
 function next(){
  if(!state.layer)return;
  if(state.mode==='day')state.i=(state.i+1)%state.queue.length;
  else{state.queue.push(pick(state.mode));state.i=state.queue.length-1;if(state.queue.length>40){state.queue.shift();state.i--}}
  paint();
 }
 function prev(){
  if(!state.layer)return;
  if(state.i>0)state.i--;
  else if(state.mode==='day')state.i=state.queue.length-1;
  else{state.queue.unshift(pick(state.mode));if(state.queue.length>40)state.queue.pop()}
  paint();
 }
 function toggle(){
  if(!state.layer)return;
  if(state.playing){state.remaining=Math.max(200,state.remaining-(performance.now()-state.started));state.playing=false}
  else state.playing=true;
  schedule(false);
 }
 function close(){
  if(!state.layer)return;
  clearTimer();
  const el=state.layer;
  state.layer=null;
  el.remove();
  document.body.style.overflow=state.overflow;
  if(state.opener?.isConnected)state.opener.focus({preventScroll:true});
  state.opener=null;
 }
 function open(opener){
  if(state.layer)return;
  state.opener=opener||document.activeElement;
  state.data=typeof window.vStrategicPlayerData==='function'?window.vStrategicPlayerData():{};
  state.seen=loadSeen();
  const first=state.data?.featured;
  state.mode=first?.go?'day':/jose|factur|vuelta/i.test(first?.title||'')?'joseo':'vive';
  state.queue=state.mode==='day'?dailySlides():[pick(state.mode)];
  state.i=0;state.playing=true;
  const el=document.createElement('div');el.className='vsp-overlay';el.id='vive-strategic-player';el.dataset.mode=state.mode;
  el.innerHTML='<section class="vsp-player" role="dialog" aria-modal="true" aria-label="Centro Estratégico de VIVE" tabindex="-1">'+
  '<header class="vsp-header"><button type="button" class="vsp-header-close" data-vsp-action="close" aria-label="Cerrar el centro estratégico">'+buttonSvg.back+'</button><div class="vsp-header-name"><strong>vive el hoy</strong><small>CENTRO ESTRATÉGICO</small></div><span class="vsp-no-audio">Sin audio</span></header>'+
  '<div class="vsp-content"><div class="vsp-art" role="img" aria-label="Ilustración ambiental de VIVE"><div class="vsp-art-top"><span>VIVE</span><span>✦</span></div><div class="vsp-art-orbit vsp-orbit-one"></div><div class="vsp-art-orbit vsp-orbit-two"></div><div class="vsp-art-icon"></div><div class="vsp-art-bottom"><span class="vsp-art-kicker"></span><span>HOY · AQUÍ · AHORA</span></div></div>'+
  '<div class="vsp-message"><div class="vsp-message-main"><span class="vsp-mode-name"></span><h2 class="vsp-message-title" aria-live="polite"></h2><p class="vsp-message-copy"></p></div><span class="vsp-symbol">✧</span></div>'+
  '<div class="vsp-meter" aria-label="Avance del mensaje"><span class="vsp-meter-fill"></span></div><div class="vsp-timeline"><small class="vsp-count"></small><small>Continuar viviendo</small></div>'+
  '<div class="vsp-transport"><button type="button" data-vsp-action="prev" aria-label="Mensaje anterior">'+buttonSvg.previous+'</button><button type="button" class="vsp-play" data-vsp-action="toggle" aria-label="Pausar mensajes">'+buttonSvg.pause+'</button><button type="button" data-vsp-action="next" aria-label="Siguiente mensaje">'+buttonSvg.next+'</button></div>'+
  '<button type="button" class="vsp-detail" data-vsp-detail data-act="navigate" hidden>Ver detalle</button></div>'+
  '<footer class="vsp-footer"><nav class="vsp-modes" aria-label="Seleccionar modo"><button type="button" data-vsp-mode="day">Mi día</button><button type="button" data-vsp-mode="vive">Vive</button><button type="button" data-vsp-mode="joseo">Joseo</button></nav><p>Mensajes dinámicos, basados en tus registros cuando corresponde.</p></footer>'+
  '</section>';
  state.overflow=document.body.style.overflow;
  document.body.appendChild(el);state.layer=el;document.body.style.overflow='hidden';
  paint();
  el.querySelector('.vsp-header-close')?.focus({preventScroll:true});
 }
 document.addEventListener('click',e=>{
  const op=e.target.closest?.('[data-vsp-open]');if(op){e.preventDefault();e.stopImmediatePropagation();open(op);return}
  if(!state.layer)return;
  const a=e.target.closest?.('[data-vsp-action]');
  if(a){e.preventDefault();e.stopImmediatePropagation();const v=a.dataset.vspAction;if(v==='close')close();else if(v==='next')next();else if(v==='prev')prev();else if(v==='toggle')toggle();return}
  const mode=e.target.closest?.('[data-vsp-mode]');
  if(mode){e.preventDefault();e.stopImmediatePropagation();changeMode(mode.dataset.vspMode);return}
  if(e.target.closest?.('[data-vsp-detail]')){close();return}
 },true);
 document.addEventListener('keydown',e=>{
  if(!state.layer)return;
  if(e.key==='Escape'){e.preventDefault();close();return}
  if(e.key==='ArrowLeft'){e.preventDefault();prev();return}
  if(e.key==='ArrowRight'){e.preventDefault();next();return}
  if(e.key==='Tab'){
   const a=[...state.layer.querySelectorAll('button:not([hidden]):not([disabled])')].filter(b=>b.offsetParent!==null);
   if(!a.length)return;
   const i=a.indexOf(document.activeElement);
   if(e.shiftKey&&(i<=0)){e.preventDefault();a[a.length-1].focus()}
   else if(!e.shiftKey&&i===a.length-1){e.preventDefault();a[0].focus()}
  }
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.layer&&state.playing)toggle()});
 let startX=0,startY=0;
 document.addEventListener('touchstart',e=>{if(!state.layer||!e.target.closest?.('.vsp-art'))return;startX=e.touches[0]?.clientX||0;startY=e.touches[0]?.clientY||0},{passive:true});
 document.addEventListener('touchend',e=>{if(!state.layer||!e.target.closest?.('.vsp-art'))return;const x=(e.changedTouches[0]?.clientX||0)-startX,y=(e.changedTouches[0]?.clientY||0)-startY;if(Math.abs(x)>60&&Math.abs(x)>Math.abs(y))x<0?next():prev()},{passive:true});
})();